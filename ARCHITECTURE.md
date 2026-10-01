# OmniCalc — Architecture

_Last verified: Phase 2 (commit `5a1452e` + Phase 2 changes). Every claim below was checked against
the source, not recalled: dependency edges come from an import scan, cycles from a Tarjan SCC pass
over 148 modules, and unused exports from a repo-wide occurrence count._

This document describes what the code **is**. Defects found while writing it are recorded separately
in [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md), with a recommendation for each.

---

## 1. Shape of the system

OmniCalc is a **static, offline-first, client-only** application. There is no backend, no database,
no API, and no network access at runtime — verified: `src/` contains no `fetch`, `XMLHttpRequest` or
`WebSocket` call.

```
Browser
  └── index.html
        └── src/main.tsx                mounts React into #root
              └── src/App.tsx           theme init + ErrorBoundary
                    └── src/ui/shell/AppShell.tsx
                          ├── Sidebar / BottomNav      (from the tool registry)
                          ├── <Suspense> panel host    (one lazy panel per route)
                          ├── CommandPalette (Ctrl+K)  ┐
                          ├── ShortcutsDialog (?)      ├ overlays
                          └── AppStatus (notices)      ┘
```

Everything below the UI is plain TypeScript with **no DOM and no React** — with one documented
exception (§7).

---

## 2. Layers and their dependencies

Verified import matrix (source files only; test files excluded, because tests are allowed to reach
across layers to build fixtures):

| Layer | Imports | Role |
| --- | --- | --- |
| `constants/` | _(nothing)_ | Leaf. Mathematical + physical constants with sources |
| `core/` | `constants`, `core` | The engine: tokenizer → parser → evaluator → formatter |
| `math/` | `constants`, `core`, `math` | 31 mathematical domains built on the engine |
| `conversions/` | `core` | Unit conversion engine + unit definitions |
| `engineering/` | `core` | Electrical / physics / geometry calculators |
| `finance/` | `core` | Interest, loans, everyday money |
| `graphing/` | `core`, `math` | Sampling, viewport maths, analysis, 3D/fields |
| `history/` | `storage` | History + memory registers |
| `settings/` | `core`, `storage` | Settings types and store |
| `storage/` | `core`, `history`, `settings`, `ui`, `version` | Persistence adapters (**one violation — §7**) |
| `knowledge/` | `constants`, `conversions`, `core`, `intents` | Knowledge base, file intake, PDF reader |
| `intents/` | 9 layers | Plain-language layer; the application-service tier |
| `pwa/` | _(nothing)_ | Install prompt, update flow, offline status |
| `ui/` | all of the above | React shell, panels, primitives, theming |

**Dependency direction.** `constants` → `core` → `math`/`conversions`/`engineering`/`finance`/`graphing`
→ `history`/`settings`/`storage` → `intents` → `ui`. Lower layers never import higher ones, with the
single exception in §7.

`intents/` legitimately imports nine layers: it is the orchestrator that turns a sentence into a call
on a domain module. It is the only place where that fan-out is appropriate.

---

## 3. Core calculation flow

The engine is hand-written and dependency-free. **No `eval` and no `new Function` appear anywhere in
`src/`** (verified by repo-wide search) — expressions are tokenized and parsed as data.

```
source string
   │
   ├─ core/parser/tokenizer.ts   text → tokens   (unicode operators, implicit ×, ² ³, mod/and/or/xor)
   ├─ core/parser/parser.ts      tokens → AST    (Pratt / precedence climbing)
   ├─ core/evaluator/evaluate.ts AST → number    (walks nodes; every operation is guarded)
   └─ core/precision/format.ts   number → string (significant figures, separators, fractions)
```

`evaluateExpression()` in `core/engine.ts` is the public entry point. Its contract:

- **It never throws.** Failures come back as data: `{ ok: false, error: { code, message, position,
  length, details } }`.
- Error codes are a closed union (`core/errors/index.ts`): `SYNTAX`, `UNKNOWN_IDENTIFIER`, `BAD_ARITY`,
  `DIV_ZERO`, `DOMAIN`, `OVERFLOW`, `NOT_SUPPORTED`, `DIMENSION`, `SINGULAR`, `CONVERGENCE`, `INPUT`,
  `INTERNAL`.
- `position`/`length` point at the offending characters, which is how the UI can underline the exact
  part of an expression that went wrong.

**Evaluation context** (`EvalContext`) carries `angleMode`, `percentMode`, `constants`, `variables`
and the `functions` registry. `FunctionRegistry` is a name→definition map where each definition
declares `minArgs`/`maxArgs`, a `description` and a `category`, so arity errors and help text come
from the same source of truth.

**Variables** are injected, never global: the calculator passes `{ ...memoryVariables(), ans }`, and
the plotting compiler passes `{ x }`. That is why `ans * 2` fails with "Unknown name" in a fresh
context instead of silently reading stale state.

---

## 4. UI flow and tool registration

### Routing

`ui/router.ts` implements a **hash router** — deliberately, so the app works on static hosting with no
server rewrites. `useRoute()` subscribes to `hashchange`; an unknown or non-ready hash falls back to
`defaultRoute()`.

### Tool registry

`ui/tools.ts` is the single source of truth for navigation. Each `ToolDef` carries `id`, `label`,
`group`, an inline SVG `icon` path, `status`, `phase` and `summary`.

Adding a tool means touching exactly two places: a `ToolDef` in `ui/tools.ts`, and a `React.lazy`
entry plus a `PANELS` mapping in `ui/shell/AppShell.tsx`. Navigation, the command palette, the
accessibility sweep and the interaction sweep all read from the registry, so a new tool is
automatically covered by those tests.

### Lazy panels

All 22 panels are code-split via `React.lazy` behind one `<Suspense>`. The shell and calculator are
the only things in the initial bundle; `AskPanel` (188 kB) and `PhysicsPanel` (33 kB) load on first
open and are then precached by the service worker.

### Shared primitives

`ui/components/primitives.tsx` is the design-system surface every panel uses:

| Primitive | Notes |
| --- | --- |
| `Tabs` | WAI-ARIA tabs pattern: roving tabindex, arrow/Home/End keys |
| `NumberField` / `TextField` / `SelectField` | Label + optional unit + hint; the hint is wired with `aria-describedby` so it is **not** part of the field's accessible name |
| `OutputList` | `<dl>` of results; keys on label **+ position**, because two rows can legitimately share a label (two roots) |
| `Notice` | `info` / `warn` / `error`, with `role="alert"` only for errors |
| `CopyButton` | Clipboard API with a `document.execCommand` fallback for browsers that block it |
| `EmptyState` | The "what to do next" state |

Panels contain **no mathematics**. Their job is: read state → call a domain function → render the
result object. The single exception is the calculator's fraction hint, which calls
`math/arithmetic/fractions` to decide whether to offer a fraction chip.

---

## 5. State flow

State is intentionally minimal: **`ui/bus.ts` + `storage/store.ts`**, about 40 lines of mechanism
total. There is no Redux, Zustand, MobX, or Context-based store — and, given the size of the state
graph below, none is warranted.

`createStore(key, initial)` returns `{ get, set, replace, reset, subscribe }`. `set` shallow-merges a
patch, writes through to `localStorage`, then notifies subscribers. `useStore()` bridges it to React
with `useSyncExternalStore`.

| Store | Key | Purpose |
| --- | --- | --- |
| `settingsStore` | `omnica.settings.v1` | theme, palette, accent, angle/percent mode, precision, format |
| `historyStore` | `omnica.history.v1` | calculation history + favourites |
| `memoryStore` | `omnica.memory.v1` | main memory register + slots m1–m9 |
| `draftStore` | `omnica.draft.v1` | the expression being typed; shared with every "insert" tool |
| `answerStore` | `omnica.answer.v1` | last answer, exposed to the engine as the `ans` variable |
| `askStore` | `omnica.ask.v1` | a plain-language request handed to the Ask panel |
| `noticeStore` | `omnica.notice.v1` | transient toasts |

The draft is persisted deliberately: a reload keeps what you were typing.

**Cross-panel handoff** happens through `draftStore` and `askStore` rather than props or a router
argument — e.g. a "Use in calculator" button calls `appendToDraft(...)` and navigates. This is why
`history/` and `ui/bus` are the only shared mutable singletons.

---

## 6. Storage

Two tiers, both local:

1. **`storage/local.ts`** — defensive `localStorage`. It probes availability first (private mode,
   disabled storage, quota) and returns `null` rather than throwing; `readJSON`/`writeJSON` degrade
   to in-memory values. Callers never see a storage exception.
2. **`storage/store.ts`** — the observable wrapper described in §5.

**Backup/restore** (`storage/backup.ts`, ~231 lines) serialises settings, history, memory and the
draft to a versioned JSON document (`omnica.backup`, version `1`) with a full parse/validate path —
imported values are checked (including `isPaletteId`) rather than trusted, and a malformed file
produces a message, not a crash. **Note:** this module is the layering violation in §7.

**File intake** (`knowledge/files.ts`, `knowledge/pdf.ts`) reads user files entirely on-device. The
PDF reader is a self-contained implementation: a raw-DEFLATE inflater, cross-reference and object
stream handling, and text-operator extraction. Nothing is uploaded.

---

## 7. Dependency boundaries — the one violation

Everything in §2 holds except this edge:

```
src/storage/backup.ts:5   import { draftStore } from '@/ui/bus'
src/storage/backup.ts:7   import { isPaletteId } from '@/ui/theme/palettes'
```

`storage/` is a low-level persistence layer; `ui/bus.ts` is UI state and `ui/theme/palettes.ts` is UI
theming data. This is a **layer violation, not a runtime cycle** — `ui/bus` imports only
`storage/store`, so the chain `storage/backup → ui/bus → storage/store` terminates cleanly.

The cause is that `backup.ts` is not a storage adapter at all: it is an application-level aggregator
that knows about every store in the app, and it happens to live in the wrong directory. Consumers:
`ui/panels/SettingsPanel.tsx`, `ui/shell/AppShell.tsx`, plus three test files.

Recorded with a recommended fix in [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) (finding A1).

---

## 8. Dependency boundaries — module cycles

A Tarjan strongly-connected-component pass over all 149 non-test modules found exactly two cycles.
Both are documented in the audit; one was **fixed** in Phase 2, which is why the table below records a
*former* cycle: the scan was re-run after the fix and now reports only the type-only pair.

| Cycle | Kind | Status |
| --- | --- | --- |
| `math/statistics/{index,descriptive,inference}` | **Runtime** barrel cycle | Fixed in Phase 2 (extracted `moments.ts`) |
| `constants/{math,physical}` | **Type-only** (`import type` is erased by the compiler) | Left as-is, deliberately — see audit C1 |

`math/statistics` now depends in one direction only: `moments.ts` (the pure leaf holding the guards and
`sum`/`mean`/`variance`/`standardDeviation`) ← `descriptive.ts`, `inference.ts` ← `index.ts`. The barrel
re-exports the moments so `@/math/statistics` exposes the same names it always did.

---

## 9. Build, packaging and offline

```
tsc -b            type-check (strict, noUnusedLocals, noUnusedParameters, verbatimModuleSyntax)
vite build        ESM bundle, base './' so it runs from any sub-directory, target es2022
build-sw.mjs      generates the service worker precache list from the real dist/ output
```

`npm run verify` chains `themes:check → typecheck → test → build`; it is the gate every change must
pass. `package.json` version drives the UI and the backup header through a `__APP_VERSION__` define,
so there is one place to bump.

The same `dist/` is used by every target: static hosting, GitHub Pages, Docker (nginx), Netlify,
Vercel, and the Tauri desktop/mobile shells in `src-tauri/`. There are no per-platform forks.

**Themes** are generated: `scripts/gen-themes.mjs` builds CSS custom properties from
`ui/theme/palettes.json`, and `themes:check` fails the build if the two drift. All colour use goes
through CSS variables, which is what makes ten palettes and a high-contrast mode possible without
per-component work.

---

## 10. Testing architecture

69 test files / 1006 tests, run by Vitest in jsdom. Three kinds, by intent:

1. **Domain tests** — maths verified against reference values (SciPy for distributions, independent
   high-precision recomputation for loans, hand-computed statistics).
2. **Panel tests** — `@testing-library/react`, one per significant panel, asserting the user-visible
   result object rather than internals.
3. **Sweeps** — `ui/a11y.test.tsx` renders *every* tool in the registry and asserts accessible names,
   semantics and tab order; `ui/interaction.test.tsx` opens every tool and **presses every button**
   under a React error trap. Both iterate the tool registry, so new tools are covered automatically.

`src/perf.test.ts` asserts *bounded work* (sampling points per curve, integration subdivisions) rather
than wall-clock timings, so it stays meaningful on any machine and cannot flake.

---

## 11. Where to make a change

| Task | Files |
| --- | --- |
| Add a mathematical function | `core/evaluator/functions/*` (declare `minArgs`/`maxArgs`/`description`) |
| Add a calculator section | `ui/tools.ts` + `AppShell.tsx` `PANELS` + a new panel in `ui/panels/` |
| Change how a result is formatted | `core/precision/format.ts` |
| Change what is persisted | `storage/store.ts` + the relevant store in `ui/bus.ts` / `history/` / `settings/` |
| Teach the plain-language layer a sentence | `intents/capabilities/*` + an example in `docs/ASK.md` |
| Add a unit or constant | `conversions/definitions.ts` / `constants/*` |
| Add a colour palette | `ui/theme/palettes.json` (then `npm run themes`) |
