# Changelog

All notable changes to OmniCalc are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased] — 2.0.0 (in progress)

The engine upgrade: exact symbolic work, advanced mathematics and 3D/field graphing, landing tier by
tier. Each tier keeps the existing 819 checks green and adds its own.

### Added — symbolic computer algebra (`src/math/cas/`)

- **Symbolic integration** — a table of standard forms plus linearity, integration by parts and a
  substitution search, every answer verified by differentiating it back before it is shown.
  `integrate x^2`, `integrate sqrt(x)`, `integrate sin(2x)`, `integrate ln(x)` and definite
  integrals with the constant of integration left out.
- **Limits** — `limit of sin(x)/x as x approaches 0` → 1, one-sided limits, `exists: false` with the
  two one-sided values when a two-sided limit does not exist, and an explicit note when the answer
  comes from a series expansion or a numeric side probe.
- **Series** — Taylor and Maclaurin expansions with the coefficients and the general term.
- **Polynomial algebra** — division, GCD/LCM, monic parts, rational roots, multiplicity, square-free
  decomposition, discriminants and Sturm real-root counts.
- **Partial fractions, inequalities and nonlinear systems** — with the solving steps shown.

### Added — advanced mathematics (`src/math/numbertheory`, `combinatorics`, `sequences`, `special`, `numerical`)

- **Number theory on BigInt** — gcd/lcm/extended gcd, modular powers and inverses, deterministic
  Miller–Rabin (witnesses to 37 make it exact in range), Pollard rho factorisation with `isPrime`
  cross-checks, divisors and divisor sums, Euler's totient, the Möbius function, the Chinese
  remainder theorem for non-coprime moduli (reporting when there is no solution) and integer roots.
- **Combinatorics** — factorials, binomials, permutations, combinations with repetition,
  multinomials, derangements, Catalan, Stirling (first and second kind) and Bell numbers; results
  that exceed double precision are returned as exact digit strings rather than a rounded float.
- **Sequences** — nth terms and partial sums of arithmetic and geometric sequences, Fibonacci,
  recursion evaluation (`a(n) = 3a(n−1)`) and pattern recognition that says "unknown" rather than
  fitting a curve to three points.
- **Special functions** — Γ, log Γ, B, the regularised incomplete gamma and beta, erf/erfc,
  Legendre, Chebyshev, Hermite and Laguerre polynomials, Bessel J and Y, complete elliptic
  integrals K and E by AGM, and ζ(s) for s > 1 (and it refuses below that instead of guessing).
- **Numerical analysis** — bisection, Newton, secant and regula falsi root finding; golden-section
  and Newton optimisation with a polish step; gradient descent; linear, Lagrange and Newton
  interpolation; least squares; numerical first and second derivatives; Simpson quadrature with an
  error estimate; and Euler, midpoint and RK4 ODE solvers with iteration histories.

### Added — 3D and field graphing (`src/graphing/threeD.ts`, `fields.ts`, `implicit.ts`)

- **New "3D & Fields" tool** (`#/graph3d`) — surfaces `z = f(x, y)` drawn as depth-sorted wireframes
  or shaded quads, rotated by dragging or by typing the angles, with axis guides and a readout.
- **Vector fields** — `F₁(x, y)`, `F₂(x, y)` arrows with raw, length-scaled or direction-only
  scaling, RK4 streamlines that stop when they close, stagnation points refined by Newton, and the
  divergence and curl at the centre of the view.
- **Contours and heat maps** — marching-squares implicit curves and contour lines at automatic
  human-friendly levels, five colour palettes, and heat-map cells that skip undefined samples.
- Pure geometry, no canvas or WebGL: the same data can be exported, tested or rendered natively.

### Fixed

- Γ now raises an error at 0 and the negative integers (poles) instead of returning a huge number.
- Bessel J uses a correctly normalised Miller downward recurrence, so `J₀(1)` and friends are now
  accurate to full precision at small arguments.
- The AGM series for the complete elliptic integral E had a sign error; `E(0.5)` now matches the
  quadrature value 1.3506438810476755.
- Sequence pattern recognition no longer calls any three numbers "polynomial".
- Newton optimisation polishes its answer with a golden-section pass, so flat (multiple) stationary
  points converge as far as double precision allows instead of stalling early.

### Added — probability distributions (`src/math/probability/distributions.ts`)

- **Nineteen distributions in one registry** — normal, log-normal, exponential, continuous uniform,
  Weibull, Laplace, Cauchy, Student t, chi-square, F, gamma, beta, binomial, Bernoulli, discrete
  uniform, Poisson, geometric, negative binomial and hypergeometric — each with its density or mass,
  cumulative value, quantile, mean, variance, support, parameter limits and a note on when to use it.
- **Quantiles that hold up everywhere**: closed forms where they exist (normal, exponential, Weibull,
  Laplace, Cauchy, log-normal), bisection on the exact CDF otherwise, and a smallest-integer search
  for discrete distributions.
- **Reproducible simulation** — inverse-transform sampling from a seeded mulberry32 generator, so a
  seed always produces the same sample; the panel reports the sample mean, standard deviation and
  standard error next to the theoretical values.
- **Checked against SciPy 1.17** for 28 density, CDF and quantile values, plus round-trip and
  density-vs-CDF cross-checks for every distribution.
- The probability panel is now built from the registry: it lists all nineteen distributions, builds
  the parameter fields from each distribution's own description, and reports the shape summary.

### Added — statistics, regression and inference

- **Shape and spread** — geometric, harmonic and weighted means, mean absolute deviation, coefficient
  of variation, standard error of the mean, skewness and kurtosis (with the Fisher–Pearson sample
  corrections that statistical software uses), five-number summary, IQR and z-score outliers, ranks,
  Spearman and Pearson association, covariance and correlation matrices, frequency tables,
  histograms, moving averages.
- **Curve fitting** — polynomial (any degree), multiple, exponential `a·e^(bx)`, power `a·x^b` and
  logarithmic `a + b·ln x` fits, solved with the matrix module's reduced row echelon form and
  reported with coefficients, R², adjusted R², the standard error of the estimate and a prediction.
- **Hypothesis tests** — one-sample t and z, Welch and pooled two-sample t, paired t, chi-square
  goodness of fit and independence, F test for two variances, one-proportion z, t-based mean
  intervals, Wilson proportion intervals, sample-size planning and a correlation significance test.
  Every result carries the statistic, its degrees of freedom, an exact p-value, a plain-language
  conclusion, the assumptions it needs and an interval where one applies.
- **New tools in the Statistics panel**: *Shape & spread*, *Curve fitting* and *Hypothesis tests*,
  each validating its input and explaining what went wrong rather than showing NaN.
- Reference values for all of the above come from SciPy 1.17; 31 new checks.

## [1.3.0] — 2026-09-25

Four things in one release: the app now fits every screen, ships ten colour palettes, explains what
things *are*, and reads the questions out of your files — plus one-command packaging for the app
stores.

### Added — knowledge base (`src/knowledge/`)

- **151 sourced explanations** (mathematics 63, physics 45, chemistry 14, computing 15, finance 14)
  stored as plain data with a one-line definition, a longer note, a formula where one exists, units,
  tags, a CODATA/standard source and links to the tool that computes with them.
- **Lookup without guessing** (`resolveTerm`): an exact term wins, otherwise a near miss is suggested
  rather than assumed, and a term the app knows somewhere else (a unit, a constant, a function) is
  reported as such instead of being "corrected" into a different word.
- **`define` in Ask OmniCalc** — "what is pi" → the π entry with its CODATA value, source and a live
  check; "what is a mile" → the unit; "define ohm's law" → the entry, its formula and its variables.
  Unknown terms are listed with close matches; nothing is ever invented.
- **`knowledgeSearch`** — "search for energy" (15 matches), "list physics constants" (21),
  "what formulas do you know" (81 stored formulas).

### Added — read your files (`src/knowledge/files.ts`, `src/knowledge/pdf.ts`)

- **Offline intake for PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), OpenDocument
  (.odt/.ods/.odp), plain text, Markdown, CSV/TSV, JSON, XML, YAML, LaTeX, logs and source files.**
  Office formats are unzipped in the browser with `DecompressionStream('deflate-raw')` — no library,
  no upload, no network.
- **A PDF text extractor written from scratch**: raw-DEFLATE inflater (fixed *and* dynamic Huffman),
  `FlateDecode` streams, `Tj`/`TJ`/`'`/`"` operators with `Td`/`TD`/`T*` line breaks, PDF string
  escapes and octal codes. A scanned or CID-only PDF says "this looks like a picture" instead of
  producing mojibake.
- **Worksheet mode in the Ask panel**: attach a file (button or drag-and-drop) and the questions in
  it are listed as chips; the first one is solved straight away, the extracted text is shown and
  editable, and "Solve from this text" / "Skip to the next question" work down the list.
  `candidateTasks()` scores lines by instruction verb, an `=`, operators and question marks.
- Images are shown, never claimed: there is no OCR, and the panel says so.

### Added — themes (`src/ui/theme/palettes.json` → `src/styles/themes.css`)

- **Ten palettes × light and dark = 20 combinations**, each defined once as data and generated into
  CSS by `npm run themes` (`themes:check` fails the build on drift). The popular set is Classic,
  Solarized, Dracula, Nord, GitHub and Sepia; accessibility adds High Contrast; more adds Ocean,
  Sunset and Forest.
- A **theme gallery** in Settings with live previews of both modes, keyboard- and screen-reader
  labelled, plus the existing accent colour, system mode, contrast and reduced-motion switches.
  Applying a palette also updates the browser/OS `theme-color`.
- `settings.palette` round-trips through backup/restore with validation.

### Added — adaptive layout (`src/styles/global.css`)

- Fluid type and spacing scale, container queries at 520 px and 760 px so panels adapt to the space
  they are given rather than the window, safe-area insets with `viewport-fit=cover`, `100dvh` height
  on mobile, a sidebar layout for 701–900 px tablets, a hidden bottom nav in landscape, a 360 px
  pass, hover-free styling for touch devices, a print stylesheet and a `prefers-contrast` bump.

### Added — store packaging (`docs/STORES.md`, `src-tauri/`)

- **Android**: Bubblewrap/TWA recipe for Google Play plus a Tauri Android recipe for a real native
  WebView app (`npm run android:init`), with keystore, signing, AAB and Play-console steps.
- **iOS**: Tauri iOS recipe plus a Capacitor fallback, Xcode archive and App Store Connect steps.
- **Everywhere else**: Microsoft Store (MSIX), Snap, Flathub, AUR, Homebrew, Winget, F-Droid, Amazon
  Appstore, Samsung Galaxy Store and Huawei AppGallery, each with the exact commands.

### Changed

- `npm run verify` now starts with `themes:check`, so a palette edited by hand cannot ship out of
  sync with the generated stylesheet.

## [1.2.0] — 2026-09-25

Typos no longer send Ask OmniCalc down the wrong path: mistyped words are read as the word you meant,
and every assumption is shown rather than hidden.

### Added — typo tolerance (`src/intents/fuzzy.ts`)

- **Damerau–Levenshtein correction with a length-scaled budget** (one typo for 4–7 letters, two for 8+),
  so swaps (`convret`), dropped letters (`solv`), doubled letters (`intergrate`) and wrong letters
  (`fahrenhite`) all resolve — including adjacent-transposition typos, which plain edit distance misses.
- **A vocabulary read out of the app's own data** (`src/intents/vocabulary.ts`): capability keywords,
  titles, example sentences, sentence-template literals, introducers and slot names, plus every unit
  name, engine function name and physical-constant alias. A new capability therefore extends typo
  tolerance with no extra work.
- **Ambiguity is resolved by meaning, not by guessing.** Words that are equally close are ranked so an
  instruction word wins over prose ("precent" → "percent", not "present"), and genuinely ambiguous
  readings are all scored — the plan that makes sense of the whole sentence is the one that runs.
- **Nothing else is touched.** Only alphabetic words of four or more letters are ever rewritten;
  numbers, expressions, symbols and spacing are byte-identical. Common English and the app's filler
  words are protected, so "I want to know" can never become "watt" or "now".
- **Mistyped units are understood too:** the unit lookup falls back to the closest unit name, so
  "250 g in ouces" and "kilomters" still convert.
- **The assumption is visible.** The Ask panel adds a *Typos* line ("I read “convret” as “convert” and
  “miels” as “miles”"), the live hint says what it assumed while you type, and an unmatched request
  repeats the corrections next to the suggestions. History keeps your own words, uncorrected.

### Changed

- `plan()` returns `corrections` alongside the plan, and ranks multiple readings of the same sentence.
- The Ask panel reports the corrected wording in its preview line, so the user can disagree before
  reading the answer.

### Tests

- `src/intents/fuzzy.test.ts` (41 checks): distance and budget behaviour, candidate choice, ambiguity
  handling, byte-exact preservation of numbers and clean sentences, protection of ordinary English,
  24 mistyped end-to-end requests, and a typing-speed budget for 200 corrections.

## [1.1.0] — 2026-09-25

Ask OmniCalc: type what you want in your own words and the app works out which tool to use, pulls
the numbers out of your sentence and answers — no menus, no formula syntax to remember.

### Added — natural-language entry layer (`src/intents/`)

- **"Ask OmniCalc" is the new default screen.** One text box, live "I will …" feedback, plain-language
  understanding line, formatted answer with tables/lists/notes, a copy button and
  "Send to calculator". Nothing about maths lives in the UI: the panel renders result blocks.
- **27 capabilities across 10 groups** covering everyday maths and percentages, units, equations and
  systems, graphing and calculus (derivative, integral, limit, Taylor), statistics and regression,
  probability, matrices and vectors, physics/engineering and geometry, money and dates.
- **Sentence templates with typed slots** (`src/intents/patterns.ts`) extract numbers, units, lists and
  function bodies from ordinary phrasing; introducers are matched once, so "15 percent of 200" and
  "% of" do not collide with "30% off".
- **Scoring, not first-match** (`src/intents/solve.ts`): keyword specificity + example similarity +
  the capability's own templates + domain hints, with two `=` routed to the simultaneous-equation
  solver and bare sums like `2^10` routed to the calculator.
- **Honest failures.** Unmatched requests return ranked suggestions, and capabilities explain exactly
  what is missing ("I need the capacitance in farads and the voltage") instead of guessing.
- **Form fallback.** Any capability can also be completed by typing values into generated fields —
  and typed values win over the sentence.
- **Command palette handoff.** Ctrl/⌘+K accepts a full request and answers it: the palette always
  offers "Ask OmniCalc: …" for what you typed.
- **61 routing checks, 42 end-to-end answer checks and 12 panel tests**, plus a unit vocabulary derived
  automatically from the existing converter (so every unit already in the app is understood by name).

## [1.0.0] — 2026-09-25

First production release: every planned phase (0–28) is implemented, the app is deployable to any
static host, and the desktop/mobile shells are ready to package.

### Added — production finishing pass

- **Publishing tooling.** GitHub Actions for CI (`ci.yml`, Node 20 + 22 matrix), GitHub Pages
  deployment (`deploy-pages.yml`) and tagged releases with zipped static bundles and
  `SHA256SUMS.txt` (`release.yml`).
- **Host configurations.** `netlify.toml`, `vercel.json`, `public/_headers`, `public/_redirects`,
  `Dockerfile` + `docker/nginx.conf` + `docker-compose.yml` for self-hosting, and cache-header
  guidance for nginx and Apache in `DEPLOYMENT.md`.
- **Installable-app polish.** Manifest now declares an `id`, launch handler, window-controls-overlay
  support and four shortcuts (Calculator, Graph, Units, History); `index.html` gained light/dark
  theme colours, iOS/meta app tags, Open Graph + Twitter preview and `robots.txt`/`sitemap.xml`.
- **Repository hygiene.** `SECURITY.md` (threat model and reporting process), `CODE_OF_CONDUCT.md`,
  `.editorconfig`, `.nvmrc`, issue forms for bugs and feature requests, and a pull-request template.
- **Single source of truth for the version.** `package.json` is injected at build time and consumed
  by `src/version.ts`, the About panel and the backup header.
- **Accessibility sweep test** that walks every tool and fails on unlabelled controls, buttons
  without accessible names, images without `alt`, positive `tabindex`, unlabelled SVGs, duplicate
  landmarks or missing live regions.

### Fixed

- **Physical constants were unreachable from the expression parser.** They are now registered in the
  engine's constant table, so `c`, `h`, `k_b`, `N_A`, `r_gas` and every alias evaluate in any tool,
  not just the Constants panel.
- **Uppercase-only constant names could never be typed.** The tokenizer lower-cases identifiers, so
  the gravitational constant `G` failed with *unknown identifier*; the lookup table is now keyed in
  both spellings and insertion uses the lower-case form.
- **`e_charge` showed a garbled symbol** (`e₀?`) in the Constants panel.
- **Ten unlabelled memory inputs** in History & Memory (registers M and m1–m9) had no accessible
  name; every memory input and clear button is now labelled for screen readers.

### Changed

- Version bumped to **1.0.0** across `package.json`, the Tauri configuration, the About panel and the
  backup format header.
- `npm run verify` (typecheck → tests → production build) documented as the release gate;
  `npm run docker:build` / `docker:run` added.
- 511 automated tests across 49 files.

## [0.1.0] — 2026-09-25

First complete feature set (superseded by 1.0.0). Everything below is free, offline and local: no account, no ads, no paid
tiers, no network requests at runtime.

### Added — engine

- Hand-written tokenizer → Pratt parser → evaluator → formatter (no `eval`, no `new Function`).
- Unicode operators (`× ÷ − · √ π ² ³`), implicit multiplication, postfix `!` and `%`, floored `mod`,
  arbitrary-base `log(x, b)`, `root(n, x)` with odd-root support.
- Structured error taxonomy (`SYNTAX`, `DOMAIN`, `DIV_ZERO`, `OVERFLOW`, `UNKNOWN_IDENTIFIER`,
  `BAD_ARITY`, `NOT_SUPPORTED`, `INPUT`) with source positions; `evaluateExpression()` never throws.
- Precision-aware formatter: noise snapping (`0.1 + 0.2 = 0.3`), exact integers to 2^53,
  auto/scientific/engineering notation, thousands grouping, string-based decimal shifting.

### Added — mathematics and tools

- Trigonometry and hyperbolics in DEG/RAD/GRAD with exact-angle tables and asymptote detection.
- Constants library (21 CODATA physical constants + mathematical constants) with sources.
- Unit converter across 13 categories, including affine temperature conversions.
- Fractions: exact rational arithmetic, mixed numbers, decimal → fraction with bounded denominators.
- Complex numbers: rectangular/polar, arithmetic, powers, roots, exp/log, formatting and parsing.
- Matrices and vectors: LU determinant, inverse, RREF with steps, rank, characteristic polynomial,
  eigenvalues, robust real polynomial roots, vector algebra.
- Equation solver: linear, quadratic, polynomials (with verification probes) and linear systems.
- Statistics: descriptive statistics, quartiles, z-score, covariance, correlation, linear regression
  with `r²`, predictions and residuals.
- Probability: normal, binomial, Poisson, uniform, exponential and Student-t densities and CDFs,
  inverse normal, gamma/beta helpers, combinations and permutations.
- Graphing: viewport maths, discontinuity-aware sampling, roots/intersections/extrema, tangent lines,
  area under and between curves, SVG plot with zoom, pan and trace.
- Calculus: numeric and symbolic derivatives, partial derivatives, adaptive Simpson integration with
  an error estimate, two-sided limits with divergence detection, Taylor series.
- Number systems: exact base 2–36 conversion (full 64-bit range), bitwise AND/OR/XOR/NOT/shift/rotate
  at 8/16/32/64 bits with signed and unsigned readouts.
- Engineering: Ohm's law, resistor networks, capacitors, RC time constant, mechanics, density,
  pressure, kinematics and nine geometric shapes with the triangle inequality enforced.
- Finance and everyday: simple/compound interest, EMI with amortisation schedule, future/present
  value, ROI, percentages, discounts, tips, bill splitting, date/age/time differences.
- Programmer calculator: fixed-width integer arithmetic that wraps like a register and reports
  overflow, hex/dec/oct/bin keypad, bitwise operations, bit-pattern display.

### Added — application

- Calculator UI with basic/scientific keypads, live evaluation and exact-fraction hints.
- History with favourites, search, CSV export; memory register plus slots m1–m9.
- Command palette (`Ctrl/Cmd+K` or `/`), keyboard shortcut help (`?`), `Alt+↑/↓` tool switching,
  `Alt+D` theme toggle.
- Themes: light/dark/system, 8 accent presets plus custom colour, high-contrast mode and a
  reduced-motion switch.
- Versioned JSON backup with validated import (replace or merge), RFC-4180 CSV export.
- PWA: offline-first service worker with an explicit “new version ready” prompt, install support and
  a live offline indicator.
- Accessibility: skip link, focus trapping in dialogs, labelled controls, `aria-live` results,
  keyboard-only operation, reduced-motion support.
- Performance: on-demand panel loading, so the first paint ships 96 kB gzip instead of 137 kB.

### Security and privacy

- No `eval`, `new Function`, `innerHTML`, `fetch`, `XMLHttpRequest` or `sendBeacon` anywhere in
  `src/` — enforced by `src/hardening.test.ts`.
- No external origins in the shell; no analytics or third-party scripts; localStorage only under
  `omnica.*` keys and only through the storage layer.

### Testing

- 511 automated tests in 49 files: engine, every math domain, every panel, backup/import, PWA
  plumbing, cross-panel integration, edge cases, performance guardrails and safety guardrails.

[1.0.0]: https://github.com/omnica/omnica/releases/tag/v1.0.0
[0.1.0]: https://github.com/omnica/omnica/releases/tag/v0.1.0
