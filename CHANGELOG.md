# Changelog

All notable changes to OmniCalc are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

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
