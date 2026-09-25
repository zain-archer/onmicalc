# OmniCalc — Project Status

_Last updated: 2026-09-25 (Phases 0–28 complete — production release 1.0.0)_

## Current phase

**Phase 28 — Release docs** (complete). All 29 phases are implemented and the project has shipped its first production release (**1.0.0**).

## Completed

**Phase 0 — Foundation.** Vite 7 + React 19 + TypeScript strict (project references), `@/*` alias,
static build with `base: './'` + hash routing, app shell (sidebar on desktop, bottom nav on mobile),
tool registry (`src/ui/tools.ts`) with a `ready|planned` status per tool so the UI never links to an
unimplemented tool, theme system (light/dark/system + accent, pre-paint boot script), error
boundary, versioned settings store, defensive storage layer with memory fallback, `CalcError`
taxonomy, PWA manifest + generated icons + generated service worker, Vitest/jsdom/Testing Library.

**Phase 1 — Core engine.** Tokenizer with unicode operators and positioned errors; Pratt parser
(precedence, implicit multiplication, function calls, postfix `!`/`%`, right-associative `^`);
evaluator with arity-checked registry, floored modulo, documented error codes; `evaluateExpression()`
never throws and returns `{value, display, ast}` or a structured error; precision-aware number
formatter (0.1+0.2 → 0.3, exact integers ≤ 2^53, auto/scientific/engineering, grouping);
factorial exact for 0..170.

**Phase 2 — Scientific functions.** Full trig/hyperbolic sets with DEG/RAD/GRAD handling and
exact-angle tables for twelfths/eighths of a turn; asymptotes reported as DOMAIN errors instead of
1.6e16; logarithms (ln, log, log(x, base), log2), exp, pow, root(n, x) with odd-root support.

**Phases 3–4 — Calculator UI, history & memory.** Basic/scientific keypads, as-you-type evaluation,
draft store, answer store, history with favourites and search, memory slots m1–m9, shared UI
primitives (`Tabs`, `TextField`, `SelectField`, `NumberField`, `OutputList`, `Notice`, `CopyButton`,
`ToolLayout`, `EmptyState`).

**Phase 5 — Constants.** 21 CODATA physical constants plus mathematical constants, searchable, with
source notes.

**Phase 6 — Unit converter.** 13 categories (length, mass, area, volume, temperature incl. affine,
speed, pressure, energy, power, data, time, angle, force).

**Phase 7 — Fractions.** Exact rational arithmetic, mixed numbers, simplification, decimal → fraction
conversion (`fromDecimal`) with best-bounded-approximation fallback.

**Phase 8 — Complex numbers.** Rectangular/polar conversion, arithmetic, `sqrt`, integer and general
powers, roots of unity, exp/log, formatting and parsing.

**Phase 9 — Matrices & vectors.** LU determinant, inverse, RREF, rank, step-by-step Gaussian
elimination, Faddeev–LeVerrier characteristic polynomial (≤ 6×6), eigenvalues, robust real
polynomial roots, matrix parsing; vector algebra (cross, normalize, projection, angle).

**Phase 10 — Equation solver.** Linear and quadratic with steps, polynomial solving with verification
probes (non-polynomial input is reported as unsupported instead of being "solved"), degree
detection, linear systems with determinant and status.

**Phase 11 — Statistics.** Mean/median/mode, population & sample variance, quartiles, IQR,
percentile, z-score, covariance, correlation, linear regression with `r²`, prediction and residuals,
`summarize`.

**Phase 12 — Probability.** log-gamma, gamma, regularised incomplete gamma/beta, `erf` accurate to
~1e-15, normal/Poisson/uniform/exponential/t and binomial densities, CDFs, inverse normal (Acklam),
combinations and permutations.

**Phase 13 — Graphing.** Viewport maths (anchor-preserving zoom, pan, nice ticks, scale clamping),
sampling that breaks polylines at NaN/overflow/discontinuities, root/intersection/extremum finding,
tangent lines, area under a curve and between curves; SVG plot panel with function list, colours,
visibility toggles, wheel zoom, pointer pan, trace readout and analysis markers.

**Phase 14 — Calculus.** Numeric first/second derivatives (Richardson extrapolation with
domain guards), partial derivatives, symbolic differentiation through order 10 with a canonical
printer, adaptive Simpson integration reporting its error estimate, two-sided limits with divergence
detection, Taylor series.

**Phase 15 — Number systems.** Exact base conversion for base 2/8/10/16/36 including the full
unsigned 64-bit range (BigInt, never rounded through a double), bitwise AND/OR/XOR/NOT/shift/rotate
at 8/16/32/64-bit widths with signed *and* unsigned readouts, bit-pattern display, and clear errors
for invalid digits, negative shifts and oversized shifts.

**Phase 16 — Engineering.** Ohm's law and power from any two known quantities, series/parallel
resistor networks, capacitor energy/charge, RC time constant, force, weight, work, kinetic and
potential energy, momentum, density, pressure, velocity, acceleration, kinematics, and geometry for
circle, rectangle, square, triangle (with the triangle inequality enforced), cube, box, cylinder,
sphere, cone.

**Phase 17 — Finance & everyday.** Simple and compound interest (including continuous compounding
and effective annual rate), loan/mortgage payments with a full amortisation schedule, future/present
value, annuity future value, ROI with annualised return, percentages, percentage change and ratio,
discounts with tax, tips and bill splitting, date differences with business-day counts, age, and time
differences across midnight.

**Phase 18 — Programmer mode.** Fixed-width integer arithmetic (add/subtract/multiply/divide/mod/
power) that wraps modulo 2^width exactly like a register, reports overflow instead of hiding it,
exact 64-bit results via BigInt, hex/dec/oct/bin keypad with base switching, bitwise operations on
the accumulator, and a live hex/oct/bin/unsigned/signed readout with bit strip.

**Phase 19 — Advanced UX.** Command palette (`Ctrl/Cmd+K` or `/`) with fuzzy search across every
ready tool plus theme, angle-mode, clear, copy and help actions; keyboard shortcuts dialog (`?`);
`Alt+↑/↓` walks the tool list, `Alt+D` toggles the theme, `Escape` closes overlays; shortcuts are
ignored while typing in a field. Pure, unit-tested matching logic (`matchesBinding`,
`filterCommands`, `moveSelection`).

**Phase 20 — Themes.** Accent preset palette (8 free colours) plus a validated custom colour,
light/dark/system modes, high-contrast mode (WCAG-AAA borders, focus rings, 2 px outlines) and a
reduced-motion switch, all applied as `data-*` attributes on the document root with an
`@media (prefers-reduced-motion)` fallback.

**Phase 21 — Offline / PWA verification.** Service worker no longer activates silently: the new
worker waits, the app shows "A new version is ready — Reload" and only then posts `SKIP_WAITING`, so
nobody loses work mid-calculation. Install prompt capture with a dismissible strip, standalone-mode
detection and a live online/offline indicator that reassures users nothing is uploaded.

**Phase 22 — Import / export.** Versioned JSON backup (settings, history, memory slots, draft) with
full validation and sanitisation on import (`parseBackup` never throws and never trusts a field),
replace/merge import modes, RFC-4180 CSV export of history, palette commands for
export/import, and transient notices for success and failure.

**Phase 23 — Expanded testing.** Added a cross-cutting integration suite (every ready tool renders
through the real shell; calculator → history → palette flow; `ans` reuse; unit conversion; theme
toggle; backup round trip), an edge-case suite (250-deep nesting, 500-term expressions, 4000-deep
unbalanced input, error positions, overflow refusal, unicode operators, percent/mod/factorial
semantics, `ans` scope, formatting extremes and registry invariants) and UI-level backup import
tests that prove a rejected file never touches existing data. A real bug was found and fixed:
`ans` was read without subscribing to the answer store, so the second calculation could use a stale
value.

## In progress

Nothing — 1.0.0 is released and the project is in maintenance mode.

## Remaining

Nothing outstanding from the original plan (phases 0–28 are all complete and released). Future work
would be new phases beyond it, each following the same discipline:

- Symbolic (closed-form) integration and equation rearrangement, with the same “say so when unsure”
  policy as the numeric methods.
- 3-D surface plotting and vector fields.
- Localisation (the UI is English-only today; all strings are inline, so extraction is the first
  step).
- Optional cloud-free sync between a user's own devices (would have to remain account-free and
  end-to-end, or it is out of scope by the project's own rules).

## Tests

| Suite | Files | Tests | Status |
| --- | --- | --- | --- |
| Engine and math domains (core, math, constants, conversions, history, settings) | 21 | 294 | passing |
| Applied calculators (engineering, finance) | 2 | 27 | passing |
| Graphing | 1 | 15 | passing |
| UI panels, shell, palette, theme and shortcuts | 15 | 88 | passing |
| PWA (status, install, updates) | 3 | 8 | passing |
| Storage, backup and export | 2 | 12 | passing |
| Integration (every tool renders, cross-panel flows) | 1 | 24 | passing |
| Performance and safety guardrails | 2 | 14 | passing |
| Constants → engine integration | 1 | 14 | passing |
| Accessibility sweep (per-tool semantics) | 1 | 21 | passing |
| **Total** | **49** | **511** | **all passing** |

`npx tsc -b --force` is clean. `npm run verify` (typecheck → tests → build) is the release gate and
is green.

## Build status

`npm run build` succeeds — initial entry chunk 312.42 kB (98.24 kB gzip) plus 20.9 kB CSS (4.8 kB
gzip), with 17 on-demand panel chunks between 3.9 kB and 14.5 kB. The service worker precaches all
29 emitted assets (including `robots.txt` and `sitemap.xml`) under a content-hash cache name. The
output is pure static files: no server, no rewrites, no environment variables.

## Deployment status

Publishable to every major platform with committed configuration:

| Target | Path |
| --- | --- |
| GitHub Pages | `.github/workflows/deploy-pages.yml` (push to `main`) |
| Netlify / Cloudflare Pages | `netlify.toml`, `public/_headers`, `public/_redirects` |
| Vercel | `vercel.json` |
| Docker / any registry | `Dockerfile`, `docker/nginx.conf`, `docker-compose.yml` |
| nginx, Apache, S3, `file://` | recipes in `DEPLOYMENT.md` |
| GitHub Releases | `.github/workflows/release.yml` (tag `v*`) |
| Desktop + mobile | `src-tauri/` + `docs/DESKTOP.md` |

Local verification done here: production build served with `npm run preview`, offline reload, zero
post-load network requests, `npm audit` clean. The app has **not** been published to a public URL
from this sandbox, because that requires an account only the project owner can authorise — the
workflows and configs above need nothing else.

## Known bugs

None open. Every issue found during the production pass (constants availability, `G` case handling,
garbled `e_charge` symbol, unlabelled memory fields) is fixed and covered by a regression test.

## Deliberate design decisions

- `%` is the **percent** postfix operator (`50%` = 0.5); modulo is `mod(a, b)` with floored
  semantics.
- `0^0 = 1` by calculator convention; factorial is limited to 0..170 and refuses non-integers rather
  than approximating.
- Bitwise and fixed-width integer arithmetic use **BigInt**: JavaScript's 32-bit bitwise coercion
  would silently corrupt 64-bit work, so results are exact and overflow is reported.
- Statistics offers both population and sample variance; regression reports `r²` and residuals.
- Where a closed form is unavailable or input is not a polynomial, the solver says so explicitly
  rather than returning an approximate "answer".
- No `eval`/`new Function` anywhere; all expressions go through the hand-written parser.

## Key facts for future sessions

- The math engine (`src/core`, `src/math`, `src/engineering`, `src/finance`, `src/graphing`,
  `src/conversions`, `src/constants`) must stay framework-free — no React or DOM imports.
- Add a tool by editing `src/ui/tools.ts` and registering its panel in `src/ui/shell/AppShell.tsx`;
  flip `status` to `ready` only when UI + logic + errors + tests + docs exist.
- Storage keys are versioned (`omnica.settings.v1`); bump the suffix on breaking changes.
- Run `npx tsc -b --force && npx vitest run && npm run build` after every phase.
- All trigonometry goes through `src/math/trigonometry` so exact-angle behaviour and domain checks
  are preserved.
