# OmniCalc — Project Status

_Last updated: 2026-09-25 (Phase 29 complete: 1.0.0 → 1.3.0 · 2.0.0 in progress: engine upgrade tiers)_

## Current phase

**2.0.0 — engine upgrade (in progress).** Phase 29 and everything before it is complete: 57 test
files and 819 checks up to 1.3.0, now **68 files / 980 checks**, with `npm run typecheck` clean after
every tier. Tiers land one at a time, each with its own module set, tests and a commit:

| Tier | Area | Where | Status |
| --- | --- | --- | --- |
| 1 | Symbolic CAS: integration, limits, series, polynomial algebra, inequalities, nonlinear systems | `src/math/cas/*` | ✅ 59 tests (`e3b5df9`) |
| 3 | Number theory, combinatorics, sequences, special functions, numerical methods | `src/math/{numbertheory,combinatorics,sequences,special,numerical}/` | ✅ 33 tests (`a635de1`) |
| 2 | 3D surfaces, vector fields with streamlines, implicit curves, contours, heat maps | `src/graphing/{threeD,fields,implicit}.ts`, `src/ui/panels/Graph3DPanel.tsx` | ✅ 19 tests (engine + panel) |
| 5 | 19-distribution registry with pdf/CDF/quantile, reproducible sampling | `src/math/probability/{normal,distributions}.ts`, `ProbabilityPanel` | ✅ 19 tests |
| 4 | Descriptive shape/spread, rank + association statistics, curve fitting, hypothesis tests and intervals | `src/math/statistics/{descriptive,regression,inference}.ts`, `StatisticsTools.tsx` | ✅ 31 tests |
| 6 | 75-relation physics library with a residual solver that solves for any symbol and verifies its answer | `src/math/physics/{formulas,index}.ts`, `PhysicsPanel.tsx` | ✅ 20 tests (14 engine + 6 panel) |
| 7 | Periodic table, formula parser, molar mass and composition, solutions/pH, limiting reactants | `src/math/chemistry/{elements,formula,index}.ts`, `ChemistryPanel.tsx` | ✅ 24 tests (16 engine + 8 panel) |
| — | Interaction sweep: every button of every tool is pressed, plus all routes and shell controls | `src/ui/interaction.test.tsx` | ✅ 48 tests |

Everything in these tiers is reachable from the UI: *Graphing* stays the 2D plotter and the new
*3D & Fields* tool (`#/graph3d`) covers surfaces, vector fields, contours and heat maps, reusing the
same expression parser, settings and accessible primitives as the rest of the app.

### Hardening found by the interaction sweep (`src/ui/interaction.test.tsx`)

Pressing every button of every tool under a React error trap surfaced three genuine defects, all
fixed: two rows in one output list could share a label, which made React reuse the wrong key
(`OutputList` now keys on label + position); the programmer keypad reached `mod 0` and `÷ 0` without
catching the `CalcError`, which is now shown as an inline notice instead of an uncaught handler error;
and `downloadText` assumed `URL.createObjectURL` exists, so it now reports to the user when a browser
refuses to start a download. The sweep also pins the routing table: every tool's hash renders its
own heading, an unknown hash still lands on a usable panel, and every tool offers controls or
explains itself.

### Tier 7 — Chemistry (`src/math/chemistry/`)

The full periodic table (118 elements with atomic mass, category, group, period and block, and an
explicit `synthetic` flag wherever the mass is only the most stable isotope's mass number), a
hand-written recursive-descent **formula parser** — brackets, `[Fe(CN)6]`, repeated elements and
hydrates (`CuSO4·5H2O`) — and the chemistry that follows: molar mass and percent composition, the
empirical formula from mass percentages (Hill order, with a warning when the percentages do not add
up), mass ↔ moles ↔ particles, concentration, dilution (`c₁V₁ = c₂V₂`), pH/pOH for strong acids and
bases, percentage yield and error, and the limiting reactant with the excess of every other reactant.

### Tier 6 — Physics (`src/math/physics/`)

Seventy-five relations across nine categories (mechanics, gravitation, waves & sound, thermal,
electricity, magnetism, optics, fluids, modern physics). Every relation is stored as data with its
symbols, names and units, and as a **residual** — `F = m·a` is held as `f - m*a`, which the app's own
parser compiles, so nothing is ever evaluated as code and no hand rearrangement can be wrong.

The solver (`solvePhysics`) takes a formula, the values you know, and the symbol you want. It builds
a candidate grid from a geometric mean of the known values (relations mix `h = 6.6e-34` with
`f = 1e15`, where an arithmetic scale would put every trial far from the answer), brackets sign
changes, refines with bisection and a secant polish, and then **substitutes the answer back into the
relation** — an answer whose residual exceeds 1e-8 of the relation's own scale is refused rather than
shown. `positive`/`nonNegative` rules reject non-physical values before and after solving, the
non-negative root is preferred when a relation is quadratic (the other root is reported as an
alternative with the reason), constants are pre-filled from the same CODATA values the constants
panel uses, and symbols are accepted in either form (`R1` or `R₁`). The *Physics* tool lists,
searches and solves all of it, with the check, the unit, the working and *Use in calculator*.

### Tier 5 — Probability distributions (`src/math/probability/distributions.ts`)

One registry of nineteen distributions (normal, log-normal, exponential, uniform, Weibull, Laplace,
Cauchy, Student t, χ², F, gamma, beta, binomial, Bernoulli, discrete uniform, Poisson, geometric,
negative binomial, hypergeometric). Each entry carries its own density, CDF, quantile, mean,
variance, support, parameter rules and a "when to use it" note, so the panel, the intent layer and
the tests all read the same data. Continuous quantiles are found by bisection on the exact CDF
(robust at every parameter, exact to machine precision), discrete quantiles return the smallest
integer whose CDF reaches p, and sampling uses inverse-transform with a deterministic
mulberry32 seed — the same seed always gives the same sample. Values are checked against SciPy.

### Tier 4 — Statistics, regression and inference

Descriptive statistics beyond the basic summary (geometric/harmonic/weighted means, mean absolute
deviation, coefficient of variation, skewness and kurtosis with the Fisher–Pearson corrections,
five-number summary, IQR and z-score outliers, ranks, Spearman correlation, covariance and
correlation matrices, frequency tables, histograms, moving averages); curve fitting (polynomial,
multiple, exponential, power and logarithmic, all solved through the matrix module's own reduced row
echelon form and reported with R², adjusted R² and the standard error of the estimate); and
inference (one-sample t and z tests, Welch and pooled two-sample t tests, paired t, chi-square
goodness of fit and independence, F test for variances, one-proportion z test, t- and Wilson
confidence intervals, sample-size planning and a significance test for a correlation) — every test
reporting its statistic, degrees of freedom, exact p-value, a plain-language conclusion, the
assumptions it needs and where relevant an interval. Reference values come from SciPy 1.17.

## Phase 29 — Plain-language entry ("Ask OmniCalc") (complete) All 29 original phases are implemented and shipped (**1.0.0**); **1.1.0** adds the intent layer so the app can be used without knowing which tool to open, **1.2.0** makes that layer typo-tolerant, and **1.3.0** adds selectable themes, a layout that adapts to every device, a sourced knowledge base ("what is pi"), offline reading of PDF/Office/text files, and packaging for every app store.

## 1.3.0 — Themes, adaptive layout, understanding everything, app stores

| Piece | Where | What it does |
| --- | --- | --- |
| Palette data | `src/ui/theme/palettes.json` | Ten palettes (Classic, Solarized, Dracula, Nord, GitHub, Sepia, High Contrast, Ocean, Sunset, Forest) × light and dark, each defined once as eleven tokens with tags (`popular`, `accessibility`, `more`). |
| Theme generator | `scripts/gen-themes.mjs` → `src/styles/themes.css` | `npm run themes` writes the stylesheet; `npm run themes:check` fails `npm run verify` if the generated file drifts from the data, so hand edits cannot ship. |
| Theme plumbing | `src/ui/theme/palettes.ts`, `theme.ts`, `src/settings/types.ts`, `index.html` | `settings.palette` is applied as `data-palette` on the document root before first paint (no flash), the browser/OS `theme-color` follows the palette, and a custom accent is only used when it is a valid hex that differs from the palette's own accent. |
| Theme gallery | `src/ui/panels/SettingsPanel.tsx` | Every palette shown as a card with live light/dark previews, grouped popular/accessibility/more, keyboard- and screen-reader-labelled, with a one-click reset to the palette accent. |
| Adaptive layout | `src/styles/global.css`, `index.html` | Fluid type/spacing scale, container queries at 520 px and 760 px (panels adapt to their own width, not the window), safe-area insets with `viewport-fit=cover`, `100dvh`, landscape and ≤360 px passes, a 701–900 px tablet sidebar, touch-only sizing, a print sheet and `prefers-contrast`/`prefers-reduced-transparency` support. |
| Knowledge base | `src/knowledge/index.ts`, `entries/*.json` | 151 sourced entries (mathematics 63, physics 45, chemistry 14, computing 15, finance 14) with definition, detail, formula, units, source and related tool. `resolveTerm` answers exactly, suggests near misses, and recognises terms it knows elsewhere (units, constants, functions) instead of inventing an answer. |
| Definitions in Ask | `src/intents/capabilities/knowledge.ts` | "what is pi" (entry + CODATA value + live check), "what is a mile" (unit and category), "define ohm's law" (entry + formula), "search for energy", "list physics constants", "what formulas do you know". Unknown terms are reported, never fabricated. A new `accepts()` guard keeps arithmetic ("what is 12 + 34 * 2") with the calculator rather than the definition engine. |
| File intake | `src/knowledge/files.ts`, `src/knowledge/pdf.ts`, `src/ui/panels/AskPanel.tsx` | Attach or drop a PDF, Word, Excel, PowerPoint, OpenDocument, CSV/TSV, JSON, XML, YAML, LaTeX, log, source or text file: it is read on the device (Office formats unzipped with `DecompressionStream('deflate-raw')`, PDFs decoded by a built-in raw-DEFLATE inflater with `Tj`/`TJ` operators), the questions inside are listed as chips and solved one after another, and the extracted text stays editable. Images are displayed but never guessed at — OmniCalc says it has no OCR instead of inventing text. |
| Store packaging | `docs/STORES.md`, `store/`, `scripts/gen-store-icons.mjs`, `scripts/gen-assetlinks.mjs`, `src-tauri/` | Step-by-step Google Play (TWA *and* native Tauri Android), App Store, Microsoft Store, F-Droid, Amazon/Samsung/Huawei, Snap/Flathub/AppImage/deb/rpm/AUR and Winget/Homebrew recipes; generated Play/App Store artwork; a Digital Asset Links generator; a Tauri mobile entry point; and `src/packaging.test.ts` guardrails that fail the build if versions, identifiers, icons, scripts or listing text drift apart. |

## Phase 29 — Plain-language entry layer (1.1.0 → 1.2.0)

The app now opens on a single question — *"What do you want to do?"* — and answers it.

| Piece | Where | What it does |
| --- | --- | --- |
| Capability registry | `src/intents/types.ts` | 27 capabilities described as data: id, title, promise, group, keywords, examples, inputs, optional sentence templates and a `run()` that calls existing engine functions. The UI holds no maths. |
| Sentence templates | `src/intents/patterns.ts` | `{slot}` templates → anchored regex with typed slots (number, unit, list, expression, text, angle); introducers are consumed exactly once, filler phrases are stripped, values are parsed loosely. |
| Unit vocabulary | `src/intents/units.ts` | Built from the existing converter's `CATEGORIES`, so every unit name/alias the app already knows is understood in sentences; cross-category conversions explain themselves. |
| Planner / scorer | `src/intents/solve.ts` | Ranks capabilities by keyword specificity + example similarity + template match + unit/arithmetic hints; two `=` becomes a system of equations; returns `Plan` or a `PlanFailure` with suggestions. |
| Capability packs | `src/intents/capabilities/*.ts` | Everyday maths & percentages · units · algebra & systems · graphing & calculus · statistics, regression & probability · matrices & vectors · physics, Ohm's law, capacitors & geometry · money, interest & dates. |
| Ask panel | `src/ui/panels/AskPanel.tsx` | Default tool (`#/ask`): live "I will …" feedback, understanding line, headline + result blocks (stats/table/list/note), copy, send-to-calculator, live history entries, hand-fill fields, and a grouped "Everything you can ask" browser. |
| Palette handoff | `src/ui/shell/CommandPalette.tsx`, `src/ui/bus.ts` | `Ctrl/⌘+K` accepts a full request and offers "Ask OmniCalc: …" for whatever was typed. |
| Typo tolerance | `src/intents/fuzzy.ts`, `src/intents/vocabulary.ts`, `src/intents/wordlists.ts` | Damerau–Levenshtein correction with a length-scaled budget read against a vocabulary built from the app's own keywords, templates, units, functions and constants; ambiguous words become alternative readings that the scorer chooses between; numbers, expressions and ordinary English are never touched, and every change is reported. |
| Cheat sheet | `docs/ASK.md` | Every request you can type, grouped by area, plus how the scorer decides and how to add a capability. |
| Tests | `src/intents/intents.test.ts`, `src/ui/panels/AskPanel.test.tsx` | 61 routing checks, 42 end-to-end answer checks, structural invariants, pattern/unit behaviour, 12 panel tests. |

## 2.0.0 — Engine upgrade tiers

### Tier 1 — Computer algebra (`src/math/cas/`, committed `e3b5df9`)

Symbolic integration (table + linearity + parts + substitution search with verification), definite
integrals, limits with one-sided values and an `exists` flag instead of a made-up number, Taylor and
Maclaurin series, polynomial division/GCD/Sturm real roots, partial fractions, inequalities and
nonlinear systems — 59 checks that all compare against known-correct results or a numeric check.

### Tier 3 — Advanced mathematics (`src/math/numbertheory`, `combinatorics`, `sequences`, `special`, `numerical`)

BigInt number theory (gcd/lcm/extended gcd, modular arithmetic, deterministic Miller–Rabin,
Pollard rho factorisation, divisors, totient, Möbius, CRT, integer roots), exact combinatorial
counts that return their digits as text when they exceed double precision, sequence generation and
pattern recognition, special functions (gamma family, erf, Legendre/Chebyshev/Hermite/Laguerre,
Bessel J/Y, complete elliptic integrals by AGM, zeta for s > 1) and numerical analysis
(root finding by four methods, optimisation with a polish step, interpolation, least squares,
numerical derivatives, Simpson quadrature with an error estimate, Euler/midpoint/RK4 ODE solvers).

### Tier 2 — 3D and field graphing (`src/graphing/threeD.ts`, `fields.ts`, `implicit.ts`, `Graph3DPanel`)

Platform-independent geometry only (no canvas/WebGL): surface sampling with `null` gaps instead of
invented values, yaw/pitch rotation with optional perspective projection, painter-ordered wireframes
and Lambert-shaded quads, space curves; vector fields with raw/length/direction scaling, Newton-
refined stagnation points, numerical divergence and curl, RK4 streamlines with closure detection;
marching-squares implicit curves, automatic "nice" contour levels, five colour ramps and heat-map
cells. The panel adds drag-to-rotate, resolution/level controls and a readout, and reports bad
expressions instead of drawing them.

Verified end to end (examples from the suite): `20 percent of 250` → 50 · `price 240 with 25 percent discount` → 180 · `72 fahrenheit in celsius` → 22.22222222 °C · `solve 3x + 5 = 20` → x = 5 · `x^2 - 5x + 6 = 0` → x = 2, x = 3 · `integrate x^2 from 0 to 3` → 9 · `limit of sin(x)/x as x approaches 0` → 1 · `determinant of 1 2; 3 4` → −2 · `voltage with current 2 and resistance 50` → 100 V · `probability z < 1.96` → 0.9750021 · `days between 2024-01-01 and 2026-09-25` → 998 days.

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

Nothing — 1.3.0 is complete and verified (themes, adaptive layout, knowledge base, file intake, store
packaging).

## Remaining

Nothing outstanding from the original plan (phases 0–28 are all complete and released, and the
post-release passes — natural-language entry, typo tolerance, themes, adaptive layout, the knowledge
base, file intake and store packaging — are in 1.3.0). Future work would be new phases beyond it,
each following the same discipline:

- OCR for pictures of questions (today images are shown and the user types the question; there is no
  on-device OCR and the app refuses to pretend otherwise).
- More knowledge entries (151 today) and worked examples attached to each formula.
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
| UI panels, shell, themes, palettes and shortcuts | 17 | 113 | passing |
| Intent layer (routing, answers, patterns, units) | 1 | 117 | passing |
| Typo tolerance (distance, readings, mistyped requests) | 1 | 41 | passing |
| Knowledge base and file intake (formats, PDF, worksheet questions) | 1 | 15 | passing |
| PWA (status, install, updates) | 3 | 8 | passing |
| Storage, backup and export | 2 | 12 | passing |
| Integration (every tool renders, cross-panel flows) | 1 | 25 | passing |
| Performance and safety guardrails | 2 | 14 | passing |
| Store packaging guardrails (versions, icons, listing text) | 1 | 11 | passing |
| Constants → engine integration | 1 | 8 | passing |
| Accessibility sweep (per-tool semantics) | 1 | 22 | passing |
| **Total** | **55** | **727** | **all passing** |

`npx tsc -b --force` is clean. `npm run verify` (themes:check → typecheck → tests → build) is the
release gate and is green.

## Build status

`npm run build` succeeds — initial entry chunk 322.79 kB (101.86 kB gzip) plus 32.14 kB CSS (7.31 kB
gzip, up from 22.95 kB with the ten palettes and the adaptive-layout rules), with 18 on-demand chunks
between 2.3 kB and 184.4 kB (the Ask panel chunk carries the intent layer, every capability pack and
the file readers; it is fetched only when that tool is opened). The service worker precaches all 39
emitted assets (including `robots.txt`, `sitemap.xml` and `privacy.html`) under a content-hash cache
name (`omnica-e87db937cbba`). The output is pure static files: no server, no rewrites, no environment
variables.

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
| Desktop + mobile | `src-tauri/` (Tauri v2, with the mobile entry point) + `docs/DESKTOP.md` |
| Google Play | `store/android/twa-manifest.json` + `npm run store:twa:build` (TWA) or `npm run mobile:android:build` (native) |
| Apple App Store | `npm run mobile:ios:init && npm run mobile:ios:build` |
| Microsoft Store, F-Droid, Amazon, Samsung, Huawei, Snap, Flathub, Winget, Homebrew | recipes in `docs/STORES.md`; listing text in `docs/STORE_LISTING.md` |
| Privacy policy for store forms | `PRIVACY.md`, served as `dist/privacy.html` |

Local verification done here: production build served with `npm run preview`, offline reload, zero
post-load network requests, `npm audit` clean. The app has **not** been published to a public URL
from this sandbox, because that requires an account only the project owner can authorise — the
workflows and configs above need nothing else.

## Known bugs

None open. Every issue found during the production pass (constants availability, `G` case handling,
garbled `e_charge` symbol, unlabelled memory fields) is fixed and covered by a regression test, and
the 1.3.0 pass fixed the one routing regression it introduced ("what is 12 + 34 * 2" going to the
definition engine) by adding and testing a capability `accepts()` guard.

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
- Definitions are data with a source attached (`src/knowledge/entries/*.json`); a term that is not in
  the knowledge base is reported as unknown with near matches, never filled in from a guess.
- Files are read in memory on the device and never uploaded, and pictures are shown rather than
  "read": there is no OCR, and the app says so instead of inventing a question.

## Key facts for future sessions

- The math engine (`src/core`, `src/math`, `src/engineering`, `src/finance`, `src/graphing`,
  `src/conversions`, `src/constants`) must stay framework-free — no React or DOM imports.
- Add a tool by editing `src/ui/tools.ts` and registering its panel in `src/ui/shell/AppShell.tsx`;
  flip `status` to `ready` only when UI + logic + errors + tests + docs exist.
- Storage keys are versioned (`omnica.settings.v1`); bump the suffix on breaking changes.
- Run `npx tsc -b --force && npx vitest run && npm run build` after every phase (`npm run verify` also
  runs `themes:check` first).
- `src/styles/themes.css` is generated from `src/ui/theme/palettes.json` — never edit it by hand.
- Knowledge lives in `src/knowledge/entries/*.json`; adding an entry needs no code change.
- All trigonometry goes through `src/math/trigonometry` so exact-angle behaviour and domain checks
  are preserved.
