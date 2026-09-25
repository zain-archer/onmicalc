# OmniCalc 1.3.0 — complete feature list

Everything below is implemented, tested and available to every user at no cost. No feature is
gated, limited or reserved for a paid tier, and nothing requires an account or a network connection.

Summary: **19 tools**, **30 plain-language requests**, **151 knowledge entries**, **129 units**,
**27 constants**, **10 themes**, **1 signed-off test suite (55 files / 727 tests)**.

---

## 1. Asking in your own words (Ask OmniCalc)

The app opens on a single box: *“What do you want to do?”*

- **30 request types** recognised from ordinary sentences, in ten packs: everyday maths, units,
  algebra & systems, graphs & calculus, statistics/regression/probability, matrices & vectors,
  physics & engineering, money, dates & time, and knowledge.
- **Live “I will …” feedback** before anything runs, so you always know which tool it chose.
- **Typo tolerance** (Damerau–Levenshtein, budget scaled by word length) with every correction
  reported: `convret 5 km to miles`, `intergrate x^2 from 0 to 3`, `fahrenhite`.
- **Ambiguity handled by meaning**: equally-close readings are all scored and the best whole
  sentence wins; numbers, expressions and spacing are never rewritten.
- **Guards against silly matches**: “what is 12 + 34 * 2” goes to the calculator, not the dictionary.
- **Falls back honestly**: unclear requests get ranked suggestions, never a silent guess.
- **Answers are actionable**: copy, send to the calculator, send to the graph, or fill a form
  instead (“Enter the values instead”).
- **Command palette handoff**: `Ctrl/⌘+K` accepts a whole request.
- **Files**: attach or drop a file and its questions are listed and solved one by one.
- Cheat sheet of every supported sentence: `docs/ASK.md`.

## 2. Calculate

| Tool | What it does |
| --- | --- |
| **Calculator** | Basic and scientific keypad, as-you-type evaluation, DEG/RAD/GRAD, memory slots m1–m9, `ans`, draft that survives a reload. |
| **Fractions** | Exact rational arithmetic, simplification, mixed numbers, decimal → fraction with best-bounded approximation. |
| **Complex numbers** | Rectangular ↔ polar, arithmetic, powers, integer and general roots, roots of unity, exp/log, formatting and parsing. |
| **Number systems** | Bases 2/8/10/16/36 with the full unsigned 64-bit range exact (BigInt), bitwise AND/OR/XOR/NOT/shift/rotate at 8/16/32/64 bits with signed *and* unsigned readouts, bit-pattern display. |
| **Programmer mode** | Register-exact fixed-width arithmetic that wraps and reports overflow, hex/dec/oct/bin keypad, live bit strip. |

Engine guarantees: safe hand-written tokenizer + Pratt parser (**no `eval`/`new Function` anywhere**),
implicit multiplication, unicode operators, floored `mod`, `%` as percent, exact factorial 0..170,
error codes with positions, and `evaluateExpression` that never throws.

## 3. Analyse

| Tool | What it does |
| --- | --- |
| **Graphing** | Plot multiple functions with colours and visibility toggles; wheel zoom and pointer pan that keep the anchor; nice ticks; sampling that breaks lines at poles and domain edges; trace readout; roots, intersections, extrema, tangents, area under a curve and between curves. |
| **Equation solver** | Linear and quadratic with steps, polynomial solving with verification probes, degree detection, simultaneous linear systems with determinant and status; unsupported input is reported, not faked. |
| **Calculus** | Numeric first/second derivatives (Richardson extrapolation) and partial derivatives, symbolic differentiation to order 10 with a canonical printer, adaptive Simpson integration that reports its error estimate, two-sided limits with divergence detection, Taylor series. |
| **Statistics** | Mean/median/mode, population and sample variance, quartiles, IQR, percentile, z-score, covariance, correlation, linear regression with r², prediction and residuals, dataset summary. |
| **Probability** | normal, binomial, Poisson, uniform, exponential and t densities and CDFs, inverse normal, erf accurate to ~1e-15, combinations and permutations. |
| **Matrices & vectors** | LU determinant, inverse, RREF, rank, step-by-step Gaussian elimination, characteristic polynomial (≤6×6), eigenvalues, polynomial roots; vector cross product, normalisation, projection, angle, magnitude. |

## 4. Convert

- **Unit converter — 13 categories, 129 units**: length, area, volume, mass, temperature (affine),
  time, speed, pressure, energy, power, data, frequency, angle. Factors are NIST SP 811 exact values.
- **Constants — 27**: 21 CODATA physical constants and 6 mathematical constants, searchable, each
  with its source and a live value from the engine.
- **Cross-category conversions explain themselves** instead of failing silently.

## 5. Applied / everyday

- **Engineering**: Ohm's law and power from any two known quantities, series/parallel resistor
  networks, capacitor charge and energy, RC time constant, force, weight, work, kinetic and potential
  energy, momentum, density, pressure, velocity, acceleration, kinematics, and geometry for circle,
  rectangle, square, triangle (triangle inequality enforced), cube, box, cylinder, sphere, cone.
- **Finance & everyday**: simple and compound interest (including continuous compounding and
  effective annual rate), loans/mortgages with a full amortisation schedule, future/present value,
  annuity future value, ROI with annualised return, percentages and percentage change, discounts with
  tax, tips, bill splitting, date differences with business days, age, time across midnight.

## 6. Knowledge — “what is pi”

- **151 sourced entries**: mathematics 63, physics 45, computing 15, chemistry 14, finance 14. Each
  carries a one-line definition, a longer explanation, the formula where one exists, units, tags, a
  source and the tool that computes with it.
- **Definitions on demand**: `what is pi` (with its CODATA value and a live numeric check),
  `define acceleration`, `define ohm's law` (with formula and variables), `what unit is N`,
  `what is a mile`, `meaning of eigenvalue`.
- **Search**: `search for energy` (ranked matches), `list physics constants`, `what formulas do you
  know` (every stored formula).
- **Never invents**: unknown terms return near matches or “not in the knowledge base”; known-elsewhere
  terms (a unit, a constant, a function) are reported as such instead of being “corrected”.
- Adding an entry is a data edit — no code change.

## 7. Read your own files

Attach or drag a file into the Ask panel; it is parsed **on your device** and its questions become
clickable chips (the first is solved immediately).

- **PDF** — built-in extractor: raw-DEFLATE inflater (fixed *and* dynamic Huffman), `FlateDecode`
  streams, `Tj`/`TJ`/`'`/`"` operators, escapes and octal codes, page count.
- **Word `.docx`, Excel `.xlsx`, PowerPoint `.pptx`** — unzipped in the browser with
  `DecompressionStream('deflate-raw')`; paragraphs, cell values and slide text.
- **OpenDocument `.odt`/`.ods`/`.odp`** and **text, Markdown, CSV/TSV, JSON, XML, YAML, LaTeX, logs,
  source code**.
- **Images** are displayed but never guessed at — OmniCalc states it has no OCR, and the extracted
  text box lets you correct or paste the question.
- **Question detection** scores lines by instruction verb, `=`, numbers with operators and question
  marks; “Skip to the next question” walks the worksheet.
- Nothing is uploaded; corrupt or unsupported files produce an explanation, never a crash.

## 8. System, look and feel

- **Themes — 10 palettes × light & dark = 20 combinations**: Classic, Solarized, Dracula, Nord,
  GitHub, Sepia (popular), High Contrast (accessibility), Ocean, Sunset, Forest. Gallery in Settings
  with live previews, applied before first paint (no flash), palette-aware browser/OS theme colour,
  custom accent colour, system mode, reduced-motion switch, high-contrast mode.
- **Adaptive layout for every device**: fluid type/spacing scale, container queries at 520 px and
  760 px, safe-area insets, `100dvh`, landscape pass that hides the bottom bar, ≤360 px pass,
  701–900 px tablet sidebar, touch-only sizing, print stylesheet.
- **History & memory**: favourites, search, live entries from every tool, memory slots, export.
- **Import / export**: versioned JSON backup (settings, history, memory, draft) with full validation,
  replace/merge import, RFC-4180 CSV export of history.
- **Keyboard**: `Ctrl/⌘+K`/`/` command palette, `?` shortcut sheet, `Alt+↑/↓` tool walk,
  `Alt+D` theme toggle, `Escape` cancels; shortcuts are ignored while typing.
- **Accessibility**: labelled fields, live regions for results, focus-visible rings, screen-reader
  semantics checked per tool, reduced-motion and high-contrast system preferences respected, large
  touch targets.
- **Offline PWA**: installable, service worker with a “new version is ready — Reload” prompt,
  offline operation, zero post-load network requests, online/offline indicator.
- **About & roadmap**: version, licence, phase list.

## 9. Platforms and packaging

- **Web / PWA**: any static host — GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3, nginx,
  Apache, Docker (`Dockerfile` + compose), or straight from `file://`.
- **Desktop**: Tauri v2 (Windows, macOS, Linux) — MSI/NSIS, DMG, AppImage, deb, rpm; Snap, Flathub,
  AUR, Winget, Homebrew recipes in `docs/STORES.md`.
- **Android**: Play Store via Trusted Web Activity (`store/android/`) *or* a fully native Tauri
  Android build; also F-Droid, Amazon, Samsung, Huawei, Aptoide.
- **iOS**: Tauri iOS build or the documented Capacitor fallback for the App Store.
- **Store paperwork ready**: generated Play icon/feature graphic and App Store icon, Digital Asset
  Links generator, `docs/STORE_LISTING.md` (name, descriptions, keywords, screenshots captions) and a
  `PRIVACY.md` / `privacy.html` privacy policy.
- **CI**: GitHub Actions for CI (Node 20 + 22), Pages deployment and tag releases.

## 10. Guarantees

- **100% free**: MIT licensed, no subscription, no premium tier, no ads, no login, no paid API, no
  backend, no telemetry.
- **Private by construction**: no analytics, no tracking, no network code at all (enforced by a test
  that scans the sources for `fetch`, `XMLHttpRequest`, `eval`, `new Function`, `innerHTML`).
- **Correct or explicit**: knowingly-wrong answers are treated as bugs; unsupported cases are
  explained (scanned PDFs, non-polynomial equations, factorial of a fraction, domain errors).
- **Verified**: `npm run verify` = theme check → typecheck → 727 tests in 55 files → production build.
- **Reproducible**: clone, `npm ci`, `npm run build`, serve `dist/`.

## Not included (stated honestly)

- **No OCR** — a picture of a question is shown, not read; you type or paste the text.
- **No closed-form symbolic integration** — integrals are numeric with an error estimate.
- **No 3-D plotting** and no vector-field graphs.
- **English-only UI** (all strings are inline; extraction is the first step for localisation).
- **No cloud sync** — backups are files you own.
