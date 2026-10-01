# OmniCalc — Architecture Audit

**Scope:** architecture and code quality of the Phase 1 baseline (`5a1452e`).
**Method:** every finding below is backed by a repo-wide search, an import-graph scan, a Tarjan SCC
pass over 148 modules, or a duplicate-body comparison — not by inspection alone.
**Discipline:** findings are classified, and only the justified ones were implemented. Nothing in this
document is a preference-driven redesign.

## Classification legend

| Class | Meaning |
| --- | --- |
| **REFACTOR** | A real defect (cycle, dead code, duplicated logic). Implemented in Phase 2. |
| **IMPROVE** | Worth doing, but does not justify the churn now. Documented with a plan. |
| **KEEP** | Works as intended. Recorded so it is not "fixed" later by mistake. |
| **DO NOT TOUCH** | Looks unusual, but changing it would add risk or cost for no real gain. |

## Summary

| # | Finding | Class | Status |
| --- | --- | --- | --- |
| R1 | Runtime circular dependency in `math/statistics` | **REFACTOR** | **Fixed** |
| R2 | `erf()` implemented twice in two modules | **REFACTOR** | **Fixed** |
| R3 | Eight dead exports, two of them from panels | **REFACTOR** | **Fixed** (7 deleted, 1 activated) |
| R4 | `AboutPanel` advertised a test count that had drifted (688 → 1006) | **REFACTOR** | **Fixed** |
| A1 | `storage/backup.ts` imports from `@/ui` (layer violation) | IMPROVE | Deferred, plan recorded |
| C1 | `constants/{math,physical}` type-only cycle | DO NOT TOUCH | Verified harmless |
| C2 | `knowledge` → `intents/fuzzy` package-level cycle | DO NOT TOUCH | Verified benign |
| C3 | Four more duplicated small helpers | DO NOT TOUCH | Judged not worth the coupling |
| C4 | 14 raw `throw new Error` among 319 `CalcError` | IMPROVE | Partly legitimate; documented |
| C5 | Large components (498 / 459 / 416 lines) | IMPROVE | UI restructuring — deferred |
| C6 | `ui/components/` has no adjacent test file | IMPROVE | Deferred to the testing phase |
| C7 | No ESLint / Prettier | IMPROVE | Deferred (carried from Phase 1) |
| C8 | `backup.ts` import validation | KEEP | Verified thorough — no change |
| C9 | `requirePositive` duplicated in two layers | DO NOT TOUCH | Coupling would cost more |
| C10 | `regularisedGammaP(a, x)` vs `regularisedBeta(x, a, b)` argument order | KEEP | Matches `P(a, x)` and `I_x(a, b)`; all 5 call sites correct |
| B1 | **Bessel functions are numerically wrong** outside a limited range | **REFACTOR — do not fix here** | Reported; belongs to the calculation-correctness phase |
| H1 | `README.md` contained 12 NUL bytes, so grep/ripgrep skipped it as binary | **REFACTOR** | **Fixed** |

---

## R1 — Runtime circular dependency in `math/statistics`

**Problem.** `math/statistics/index.ts` both *implements* the core descriptive statistics and acts as
the barrel that re-exports the sibling modules, which import those implementations back.

**Location / evidence.**

```
math/statistics/index.ts:233   export * from './descriptive'
math/statistics/index.ts:234   export * from './regression'
math/statistics/index.ts:235   export * from './inference'

math/statistics/descriptive.ts:2   import { mean, standardDeviation, variance } from './index'
math/statistics/inference.ts:4     import { mean, standardDeviation, variance } from './index'
```

Detected by SCC analysis as: `descriptive ↔ index ↔ inference`.

**Why it matters.** This is a **runtime** cycle, not a type-level one. Module initialisation order is
therefore load-order dependent: `index` begins executing, reaches its re-export lines, which begin
loading `descriptive`, which imports `mean`/`variance` from a not-yet-finished `index`. It works
today only because every use sits *inside a function body*, so the binding is resolved after
initialisation. Any future top-level use — a lookup table, a default parameter — would silently read
`undefined`, and bundlers do not promise a stable order.

**Risk of fixing.** Low. The moved functions are pure and their bodies are unchanged.

**Recommended solution.** Extract the shared moments into a leaf module `math/statistics/moments.ts`
and have both siblings import from it, so the graph becomes acyclic:
`index → {moments, descriptive, regression, inference}`, `descriptive → moments`.

**Fixed now?** **Yes** — it is a genuine correctness hazard with a mechanical, verifiable fix.

---

## R2 — `erf()` implemented twice

**Problem.** The error function is implemented identically in two modules, and one of them already
imports from the other's package.

**Location / evidence.** Byte-identical bodies:

```
math/special/index.ts:136       export function erf(x) { if (x === 0) return 0; ... }
math/probability/normal.ts:14   export function erf(x) { if (x === 0) return 0; ... }
```

…and `normal.ts` already imports `regularisedGammaP` from `@/math/special`, so the dependency exists.

**Why it matters.** `erf` underpins the normal CDF, which underpins every continuous distribution and
the statistics inference tools. Two copies mean two places to fix a numerical bug, and the docstring
in `normal.ts` describes `erf` as the accuracy base for the rest of the library. Drift between them
would be invisible until results diverged.

**Risk of fixing.** Low — the surviving implementation is the same code, and `@/math/probability`'s
public surface (`index.ts:121` re-exports `erf`) is preserved by re-exporting.

**Recommended solution.** Delete the copy in `normal.ts`; import `erf` from `@/math/special` and
re-export it so existing importers are unaffected.

**Fixed now?** **Yes** — single source of truth for a numerically critical routine.

---

## R3 — Dead exports

**Problem.** Eight exported symbols are referenced **nowhere** in the repository (verified by
repo-wide occurrence count across `.ts`, `.tsx`, `.mjs`, `.js`, `.json`, excluding `node_modules` and
`dist`): each appears exactly once, at its declaration.

| Symbol | File | Notes |
| --- | --- | --- |
| `ToolLayout` | `ui/components/primitives.tsx:336` | A shared layout primitive never used by any panel |
| `safeIntegerOperation` | `ui/panels/ProgrammerPanel.tsx:264` | A `try/catch` wrapper; the panel already handles the same errors inline (~20 lines) |
| `fractionFromDecimal` | `ui/panels/FractionsPanel.tsx:210` | Re-wraps `fromDecimal`, which the panel calls directly |
| `fractionOf` | `ui/panels/FractionsPanel.tsx:214` | Unused constructor helper |
| `APP_VERSION_SHORT` | `version.ts:14` | Never read |
| `REPO_URL` | `version.ts:19` | Never read |
| `POPULAR_PALETTE_IDS` | `ui/theme/palettes.ts:49` | Never read |
| `PALETTE_ACCENT` | `ui/theme/presets.ts:11` | Never read (note: it is `''`, an override sentinel) |

**Why it matters.** Dead code is maintenance surface that lies: it implies a capability that does not
exist, and `safeIntegerOperation` in particular reads like a safety net that callers rely on. Two of
these are exported from **panels**, whose public surface should be components only.

**Checked before deleting.** `safeIntegerOperation` is *not* a missing safety net — `ProgrammerPanel`
already wraps `integerOperation` in `try/catch` and shows `errorMessage(err)` to the user, and Phase 1
added coverage for the `mod 0` / `÷ 0` paths. Deleting it removes redundancy, not protection.

**Risk of fixing.** Very low — each symbol was verified unused repo-wide, including build scripts.

**Fixed now?** **Yes**, with one revision made during implementation. `PALETTE_ACCENT` turned out to be
`''` — the sentinel the theme reads as "use the palette's own accent" — while `SettingsPanel.tsx:74,110`
wrote that bare `''` literally in two places. Its comment also claimed the sentinel was `#000000`,
which is simply wrong: `isHexColour('')` is `false`, so *any* non-colour value means "no override", and
`'#000000'` would be a real (black) override. Deleting the constant would have removed the only name for
a non-obvious protocol and kept two magic literals, so it was **kept, corrected and wired up** instead:
`SettingsPanel` now passes `PALETTE_ACCENT` and the comment describes the actual sentinel. The other
seven symbols were deleted outright.

Deleting `ToolLayout`, `fractionFromDecimal`, `fractionOf` and `safeIntegerOperation` left four now-unused
imports (`fraction`, and the `react`/`Fraction`/`errorMessage`/`IntegerOp`/`BitWidth` types behind them);
`noUnusedLocals` caught them immediately and they were removed too. That cascading effect is the reason
the compiler is part of the verification loop for a deletion-only change.

---

## R4 — A user-visible number that had drifted

**Problem.** `AboutPanel.tsx:95` told users the app contains "688 automated tests". The suite actually
runs **1006**, which the panel itself was contradicting.

**Location.** `src/ui/panels/AboutPanel.tsx:95`.

**Why it matters.** It is the one place the app makes a verifiable claim about its own quality, and it
was wrong by 46%. `PROJECT_STATUS.md` and `README.md` already record the correct counts, so a reader
checking the About screen against the docs saw a contradiction.

**Evidence.** `grep -rn "688" src/` matched only this line; the verify run reports `1006 passed (1006)`.
The count is also re-stated in the About panel's sibling paragraph, so it is duplicated data by nature.

**Risk.** Negligible, but a literal test count rots on the next test added. Fixed by replacing the number
with a claim that is true, verifiable and stable: *no network requests at runtime, and no accounts:
every calculation runs on this device* — which is exactly the privacy guarantee the app does keep.
Keeping a number in sync by hand would just re-introduce the same defect.

**Fixed now?** **Yes** — one string, no behaviour, and it removes a false claim from the UI.

---

## A1 — `storage/backup.ts` imports from `@/ui`

**Problem.** A low-level layer depends on a higher one, which the layering rule in ARCHITECTURE.md §2
exists to prevent.

**Location / evidence.**

```
storage/backup.ts:5   import { draftStore } from '@/ui/bus'
storage/backup.ts:7   import { isPaletteId } from '@/ui/theme/palettes'
```

This is the **only** such edge in the codebase — a scan of `core`, `math`, `intents`, `conversions`,
`engineering`, `finance`, `graphing`, `constants`, `history`, `settings`, `knowledge`, `storage` and
`pwa` for `from '@/ui'` returns these two lines and nothing else.

**Why it matters.** It makes the documented layer map untrue, and it means `storage/` cannot be
reasoned about — or reused — as a standalone persistence layer. The root cause is misfiling:
`backup.ts` is an application-level aggregator that knows about *every* store in the app, so it is not
a storage adapter at all.

**Risk of leaving it.** Low. There is **no runtime cycle** — `ui/bus` imports only
`storage/store`, so `storage/backup → ui/bus → storage/store` terminates. Nothing is broken.

**Risk of fixing.** Low but non-trivial churn: it requires a new home for the module and updates to
**5 consumers** — `ui/panels/SettingsPanel.tsx`, `ui/shell/AppShell.tsx`, `integration.test.tsx`,
`ui/panels/SettingsPanel.test.tsx`, and the module's own `storage/backup.test.ts` (which would move).

**Recommended solution.** Relocate the module to an application layer (for example
`src/app/backup.ts`), moving its test with it and updating the five import paths. Behaviour is
identical — it is a pure relocation, so it can be done at any time with no functional risk.

**Fixed now?** **No — deferred, deliberately.** This is a purity correction with zero functional
impact, and it is the largest-churn item in the audit. Phase 2's mandate is *smallest maintainable
improvement*, so it is recorded with a concrete plan rather than bundled in. It is a good candidate
for Phase 3.

---

## C1 — `constants/{math,physical}` type-only cycle — DO NOT TOUCH

`constants/physical.ts:6` is `import type { ConstantDef } from './math'`, and
`constants/math.ts:82` re-exports `PHYSICAL_CONSTANTS` from `./physical`.

Because it is a **type-only import**, TypeScript erases it at compile time: **no runtime cycle
exists.** The SCC pass reports it because the analyser is syntax-based. "Fixing" it would mean
introducing a shared types module to satisfy a tool, adding a file for no runtime benefit.

**Verdict: KEEP as-is.** Documented so it is not mistaken for a defect later.

---

## C2 — `knowledge` → `intents/fuzzy` — DO NOT TOUCH

`knowledge/index.ts:25` imports `closestWord` / `damerauDistance` from `@/intents/fuzzy`, while
`intents/capabilities/knowledge.ts` imports from `@/knowledge`. At package granularity that looks
circular.

Inspection shows it is **not** a module cycle: `intents/fuzzy.ts` is a leaf (pure string-distance
utilities with no imports of its own), and the SCC pass found no cycle here. The edge is a data layer
reaching for generic string utilities that were filed under `intents/`.

The cleaner home for `fuzzy.ts` is a shared low-level utility module. That said, it is a pure
relocation affecting several importers, with no behavioural consequence.

**Verdict: KEEP for now.** The import is acyclic and harmless; relocating `fuzzy.ts` is listed as a
Phase 3 candidate alongside A1 rather than done piecemeal here.

---

## C3 — Four more duplicated helpers — DO NOT TOUCH

A duplicate-body scan (normalised whitespace, bodies ≥ 60 chars) found five groups. Three are real
duplicates; two turned out to be false positives worth recording.

| Group | Assessment |
| --- | --- |
| `erf` (2 copies) | **Real** — fixed (R2) |
| `engineering/index.ts::requirePositive` + `finance/index.ts::requirePositive` | Identical ~5-line guards |
| `graphing/analysis.ts::safe` + `math/calculus/index.ts::safeEvaluate` | Identical NaN/throw guards |
| `ui/commands.ts::moveSelection` + `ui/shortcuts.ts::nextToolIndex` | Identical modulo-wrap |
| `cas/inequality.ts::syntheticCheck` + `cas/polyops.ts::syntheticDivide` | Synthetic division; bodies match after whitespace normalisation |

**Why not fixed.** Each is 3–6 lines of trivial guard logic. Consolidating them would mean creating a
shared utility module and making three unrelated domains depend on it — trading a few duplicated lines
for new coupling, import churn and a wider blast radius. `requirePositive` in particular has
different labels and error wording at its two sites, so unifying it would either change messages or
add parameters.

The `syntheticCheck`/`syntheticDivide` pair is the only one with real algorithmic substance, but both
live deep inside the CAS internals where a subtle behavioural difference would be expensive to
discover.

**Verdict: KEEP**, with a note. Duplicating a five-line guard is cheaper to maintain than a shared
guard with five call sites and two behaviours.

---

## C4 — Error-handling consistency — IMPROVE (partly by design)

**Evidence.** The codebase throws `CalcError` **319** times and raw `Error` **14** times. It also uses
an `{ ok: false, ... }` result object **164** times, and has 143 `catch` sites.

**Assessment.** The 14 raw throws are almost all legitimate and should stay:

| Site | Verdict |
| --- | --- |
| `knowledge/pdf.ts` (4) | Internal DEFLATE codec control flow, caught by the caller and mapped to `null`. Using `CalcError` here would be wrong — it is not a domain error. |
| `main.tsx` (1) | Boot guard for a missing `#root`. |
| `intents/units.ts` (5) | **The one inconsistency.** These carry user-facing messages but use raw `Error`, so a caller cannot match on a `code` the way `CalcError` allows. |

**Why it matters.** Only for `units.ts`: every other layer lets callers branch on `error.code`; a raw
`Error` forces string matching. It is a consistency gap, not a bug — the messages surface correctly.

**Recommended solution.** Convert the five throws in `intents/units.ts` to `CalcError` with an
appropriate code (`INPUT`). Small and contained.

**Fixed now?** **No.** It is an ergonomics improvement with no user-visible effect, and Phase 2 is
already scoped to three changes. Recorded for Phase 3.

---

## C5 — Large components — IMPROVE, deferred

Largest single components by body size:

```
ui/panels/Graph3DPanel.tsx  Graph3DPanel()   ~498 lines
ui/panels/AskPanel.tsx      AskPanel()       ~459 lines
ui/panels/GraphPanel.tsx    GraphPanel()     ~416 lines
ui/panels/SettingsPanel.tsx SettingsPanel()  ~329 lines
```

These are large but not tangled: each is a single panel whose body is mostly JSX over memoised
derived values, and the heavy maths already lives in `graphing/` and `math/`. Splitting them is a
**UI restructuring** exercise (extract sub-components, agree new file boundaries) and therefore
belongs to the UX/component phase, not here — doing it now would be an unrequested UI refactor with
real regression risk and no architectural gain.

**Verdict: DEFER** to the UI/component phase.

---

## C6 — Test-coverage gaps — IMPROVE, deferred

Directories with source files but **no adjacent test file**:

```
core/evaluator/            (covered transitively by core/engine.test.ts)
core/evaluator/functions/  (covered transitively)
math/special/              no direct test file
math/{combinatorics,numbertheory,numerical,sequences}/  no direct test file
intents/capabilities/      (covered by intents/intents.test.ts, 117 tests)
ui/components/             no direct test file — primitives are exercised through panel tests
```

**Partly closed in this phase.** R2 consolidated `erf` into `math/special`, a module that had no test
file, so a direct suite was added for it (`src/math/special/special.test.ts`, 65 tests) rather than
leaving the one function the whole probability stack rests on covered only incidentally. Every value in
it was computed independently with MPFR (`mpmath`, 30–40 digits). That test is what surfaced B1. The
remaining directories in the list above stay deferred to the testing phase.

**Verdict: DEFER** to the testing phase, which is the right place to decide what deserves a dedicated
suite rather than incidental coverage.

---

## C7 — No ESLint / Prettier — IMPROVE, deferred

Carried from Phase 1. Adds tooling whose findings cannot be fully resolved inside a phase that is
meant to stay small. Recommended as its own change (expect a batch of `react-hooks/exhaustive-deps`
findings).

---

## C8 — `backup.ts` import validation — KEEP (verified strength, not a defect)

Checked while auditing the storage boundary (A1), because importing a user-supplied JSON file is the
one place untrusted data enters the app. **It is already defended properly**, and the finding is
recorded here as a KEEP so it is not "fixed" by a later phase on the assumption that it is unguarded:

```ts
isRecord(value)                      // reject null / array / primitive
isPaletteId(value.palette)           // palette must be a known id
value.accent === '' || /^#[0-9a-f]{6}$/i.test(value.accent)   // or a valid hex colour
typeof value.thousandsSeparator === 'boolean'                 // explicit per-field type checks
Array.isArray(value) && .filter(isRecord)                     // history entries
typeof entry.expression === 'string' && entry.expression.trim().length > 0
/^m[1-9]$/.test(key) && Number.isFinite(slot)                 // memory slots
raw.version > BACKUP_VERSION                                  // future-version refusal
```

Every field falls back to a default rather than propagating a malformed value, `JSON.parse` is wrapped,
and the draft is length-capped (`slice(0, 2000)`). That is the correct policy — repair per field, keep
what is valid — already implemented.

**Verdict: KEEP.** No change. Recorded because the audit's job is to say what was *checked*, and an
unchecked "looks risky" note here would invite a pointless rewrite of working, careful code.

---

## C9 — `finance` and `engineering` each define their own `requirePositive` — DO NOT TOUCH

Two identical private helpers with identical messages, in different layers, each used by dozens of
functions in its own module. They are not shared because the layers do not depend on each other, and
hoisting a shared guard into `core` would couple two independent domains to add a message string.

**Verdict: DO NOT TOUCH** — the duplication is cheaper than the coupling.

---

## H1 — `README.md` was not searchable (12 NUL bytes in a tracked text file)

**Problem.** `README.md` ended with a UTF-16LE fragment — `#\x00 \x00o\x00n\x00m\x00i\x00c\x00a\x00l\x00c\x00` and two
encoded newlines — appended after the real content. Twelve NUL bytes in a text file make `grep`,
`ripgrep` and any searching tool treat it as **binary**, so `grep -rn "pattern" .` silently skips the
project's front page.

**How it was found.** Not by reading it: a `grep` for a test-count string in `README.md` reported
"binary file matches", which is not a thing a Markdown file should ever say.

**Evidence.** `git show 2690aee:README.md | grep -c $'\0'` → the corruption is **pre-existing in the
baseline**, not introduced by this work (it is also present at `5a1452e`). A sweep of all 300 tracked
files found NUL bytes in exactly 13 — `README.md` plus 12 legitimate PNGs — so it is isolated.

**Risk of fixing.** None: only the trailing fragment was removed. `git diff` shows 3 deleted lines and
no other change, and the rest of the file is byte-identical.

**Fixed now?** **Yes.** It is two lines of dead garbage in a tracked deliverable, it breaks repository
tooling rather than merely looking untidy, and the fix cannot alter behaviour. The file's stale test
counts (1006/69 → 1069/70) were updated at the same time, now that the file can be searched.

---

## B1 — The Bessel functions are wrong outside a limited range (found while adding the special-function tests)

**How it was found.** Not by looking for bugs: while writing `src/math/special/special.test.ts`
(the module had no test file, gap C6) every expected value was computed independently with MPFR
(`mpmath` at 30–40 significant digits) instead of being recalled. 53 of 57 sampled values agreed with
the reference to better than `1e-12`. The Bessel functions did not — and unlike everything else in the
module, `besselY` had **no test at all**.

**Problem.** Both Bessel functions lean on a one-term asymptotic expansion in a region where it has not
converged, and the small-`x` `Y` seed is that same asymptotic. Measured relative error against mpmath:

| | x = 0.5 | 1 | 2 | 3 | 5 | 8 | 11 | 12 | 12.5 | 20 | 50 | 200 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `J₀` | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | 0.2% | 0.4% | 0.2% |
| `J₁` | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | 5% | 0.4% | 0.05% |
| `J₂` | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | 4% | 6% | 3% |
| `J₅` | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | <1e-12 | **58%** | **20%** | **2%** |
| `Y₀` | **29%** | **93%** | 4% | 2% | 2% | 1% | 1% | 0.2% | 0.8% | 2% | 0.1% | 0.02% |
| `Y₁` | **26%** | 0.2% | **84%** | **15%** | **15%** | 6% | 3% | **12%** | 3% | 0.7% | 1% | 0.7% |
| `Y₂` | **26%** | 5% | **18%** | **15%** | 4% | 2% | 2% | 0.4% | **16%** | **20%** | 2% | 0.3% |
| `Y₅` | **26%** | 5% | 10% | 7% | 7% | 1% | 0.6% | 2% | **36%** | **67%** | **29%** | **28%** |

Two distinct causes, both visible in the source:

1. **`besselY` seeds `Y₀`/`Y₁` with the large-`x` asymptotic** (`src/math/special/index.ts:228`):
   ```ts
   const y0 = Math.sqrt(2 / (Math.PI * x)) * Math.sin(x - Math.PI / 4);
   ```
   at `x = 1`, where that expansion is meaningless. The comment above it claims "Y₀ and Y₁ from a
   series/asymptotic blend" — there is no series. This is why `Y₀(1)` returns `0.1699162315486493`
   against a true `0.088256964215676958` (93% off), and it is worst exactly at small `x`, where these
   functions are usually wanted.
2. **Both functions use a single asymptotic term for `x ≥ 16`** (and, for `J`, negative `x` far from
   zero takes the Miller branch with too few recurrence steps: `J₀(−100)` returns `1.2399` against
   `0.019986`). The expansion is only valid for `x ≫ n²`, so the error grows with order — `J₅(20)` is
   58% off and `J₅(200)` is still 2% off. A correct implementation needs the full asymptotic series
   (or, for large `x`, a continued fraction / Airy-type expansion).

`besselJ` for `x < 16` is genuinely good (Miller downward recurrence with normalisation, accurate to
better than `1e-11` on every sampled order, and correct for negative arguments through the parity of
`J`), so the defect is confined to the asymptotic branch and to `besselY`.

**Location.** `src/math/special/index.ts` — `besselJ` line ~208 (the `x < 16` split), `besselY` line ~237.

**Why it matters, and why it is not a P0 today.** Severity is high per result — a 93% error is not a
rounding artefact — but **reachability is zero**: `@/math/special` is imported by exactly two modules,
`math/probability/distributions.ts` and `math/probability/normal.ts`, and those use only `gamma`,
`logGamma`, `erf`, `regularisedGammaP` and `regularisedBeta`. No engine function, no Ask intent, and no
panel exposes a Bessel function, and `core/` does not import `math/special` at all. Verified by
`grep -rn '@/math/special' src`. So no user can obtain a wrong answer from this code today.

**Risk of fixing.** Moderate — this is real numerical work (a correct small-`x` `Y` series needs the
harmonic-number expansion, and a proper large-`x` treatment needs more than one asymptotic term), and
writing it blind would risk replacing one wrong answer with another. It needs its own reference-verified
pass, exactly as the normal quantile fix had in Phase 1.

**Fixed now?** **No — deliberately.** This is a calculation-correctness defect, not an architecture one,
and Phase 2's rules forbid changing behaviour or absorbing unrelated work. Fixing it here would also mean
choosing an algorithm without the verification budget that correctness changes need. The work is
captured in `src/math/special/special.test.ts`: the accurate ranges are pinned, and the two defects are
recorded as `it.todo` entries so they appear in every test run rather than living in a document nobody
reads.

**Smallest safe fix (recommended next step).** In the calculation-correctness phase:
1. Replace the `Y₀`/`Y₁` seed with a genuine small-`x` series
   (`Y₀(x) = 2/π[(ln(x/2)+γ)J₀(x) + Σ_{k≥1}(−1)^{k+1}H_k(x/2)^{2k}/(k!)²]`, and the corresponding `Y₁`
   series), keeping the existing forward recurrence for `n ≥ 2` and the asymptotic only where `x ≫ n²`.
2. Extend the `J`/`Y` asymptotic branch with the next terms of the expansion (or lower the branch
   threshold and raise the Miller start index `start` so it stays accurate for large `|x|`).
3. Pin every case above with the mpmath references already computed, then flip the two `it.todo` entries
   into real assertions.

---

## C10 — The two randomised-argument orders are correct, not a slip — KEEP

`regularisedGammaP(a, x)` and `regularisedBeta(x, a, b)` put their arguments in different orders, which
looks like an inconsistency worth "fixing". It is not: each matches its own standard notation, `P(a, x)`
and `I_x(a, b)`, and every call site uses the right order — `distributions.ts:313,389,450,482,591` all
pass the variable first for the beta form, and `advanced.test.ts:245` doubles as a check (`I_x(1,1) = x`).
Reordering either one to look consistent would be a silent breaking change to a numerical API. Recorded
so a future "consistency" pass does not make it.

**Verdict: KEEP.**

---

## Conclusions

The architecture is **sound and needs no rewrite.** Against the usual failure modes it is in good
shape: no backend or network surface, no state-management framework, no runtime cycles left after R1,
no dead exports left after R3, and one layer violation that is documented with a plan.

The three implemented fixes are all *reductions* — one cycle removed, one duplicated numerical
routine unified, eight dead symbols deleted. Total behavioural change: **none expected**, which is why
every existing test must continue to pass unchanged.
