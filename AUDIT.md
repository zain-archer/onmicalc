# OmniCalc Audit — 2026-09-30

## 1. Architecture Audit

**Stack:** TypeScript strict, React 19, Vite 7, hand-written CSS tokens, Vitest + jsdom, Tauri v2 optional, PWA via generated SW.

**Structure:**
```
src/
  core/ (tokenizer, Pratt parser, evaluator, errors, precision, numbers)
  math/ (algebra, calculus, complex, matrices, trig, stats, probability, physics, chemistry, etc.)
  graphing/ (viewport, sampling, analysis, threeD, fields, implicit, extendedSampling, renderer, types, graphState)
  conversions/, engineering/, finance/, constants/, history/, storage/, settings/, intents/, knowledge/, pwa/, ui/
  ui/shell/ (AppShell, Nav, CommandPalette, ShortcutsDialog, Icon)
  ui/panels/ (22 panels, all lazy-loaded)
  ui/components/primitives
  styles/global.css + themes.css (generated from palettes.json)
```

**Routing:** Hash router `#/toolId` via `src/ui/router.ts`, `tools.ts` is single source of truth with status ready/planned.

**State:** Tiny observable `createStore` persisted to localStorage, versioned keys `omnica.*`. Settings, history, memory, graph state all use it. No Redux.

**Build:** Vite base './', chunkSizeWarning 900, code splitting via React.lazy for panels. SW generated from real build output.

**PWA:** manifest.webmanifest, _headers/_redirects, build-sw.mjs, register.ts, install.ts, status.ts, updates.ts.

**Tests:** 68 files / 980 checks, including hardening guardrails (no eval, no fetch, no innerHTML, storage layer only, engine no React/DOM, file size <900).

## 2. Feature Inventory (Existing)

**Tools (22 ready):**
- ask, calculator, fractions, complex, graph, graph3d, matrix, statistics, physics, chemistry, equation, probability, calculus, conversions, constants, numbersystems, engineering, finance, programmer, history, settings, about

**Engines:**
- Core: tokenizer, parser (implicit *, unicode ops, postfix !%, right ^), evaluator with registry, CalcError taxonomy
- Math: algebra (linear/quadratic/polynomial/system), calculus (numeric derivative Richardson, symbolic diff order 10, adaptive Simpson integrate with error, limits with divergence, Taylor), complex (rect/polar, roots), matrices (LU det, inverse, RREF, eigenvalues), trig (DEG/RAD/GRAD + exact tables), stats (mean/median/mode, variance, quartiles, regression), probability (19 dist registry), numberSystems (BigInt base 2/8/10/16/36, bitwise), physics (75 relations residual solver), chemistry (118 elements, formula parser), combinatorics, numbertheory, sequences, special, numerical
- Conversions: 13 categories, 129 units, NIST factors
- Constants: 27 (21 CODATA + 6 math) searchable
- Graphing: viewport, sampling (breaks at NaN/poles), analysis (roots, intersections, extrema, tangent, area), extendedSampling (cartesian/parametric/polar/implicit/inequality), renderer (canvas), analysisExtended (table, evaluate, derivative, integral, tangent/normal, asymptotes, areaBetween)
- History: searchable, favourites, memory m1-m9, export/import JSON + CSV
- Intents: 27 capabilities, patterns with {slots}, fuzzy typo tolerance (Damerau-Levenshtein), AskPanel
- Knowledge: 151 entries JSON, file intake (PDF raw-DEFLATE inflater, docx/xlsx/pptx via DecompressionStream, ODT/ODS, text/csv/json/xml/yaml/latex), question detection
- PWA: installable, offline indicator, update prompt (SKIP_WAITING after user confirms)

**Settings:** theme (light/dark/system), palette (10 palettes ×2), accent custom, angleMode, numberFormat (auto/scientific/engineering), fractionMode, precision 2-15, thousandsSeparator, persistHistory, contrast, reducedMotion. Flat page, no search.

## 3. UX Problems

- Sidebar exposes 22 tools directly → overwhelms beginners, no intent grouping
- No true Home: default route is ask, but ask is also a tool; no recent/favourites/quick actions surface
- Calculator: good but advanced functions hidden behind toggles, no smart defaults visible (angle mode small)
- Graphing: improved but still needs contextual toolbar grouping, legend, better empty states
- Settings: one giant page, no per-section settings, no search, no reset per section
- Command palette exists (Ctrl+K) but doesn't search settings, constants, units, formulas, history
- No "Send to..." cross-tool workflow
- No favorites/pinned tools system
- No onboarding (first-time user sees ask box but no guidance)
- Tables: generic, horizontal overflow on mobile for stats/probability
- No contextual help (?/ⓘ) per advanced feature
- No global search bar as primary entry on mobile (palette is hidden behind button)
- Terminology: "Graphing" vs "3D & Fields" vs "Graph" inconsistent, "Fractions" vs "Calculator" overlap

## 4. Performance Problems

- Initial bundle: index 324kB (102kB gzip) + CSS 32kB — okay but heavy
- Graphing canvas re-renders on every cursor move (fixed with debounced viewport, but still renders full grid)
- No Web Workers for heavy tasks (large matrix, stats, file parsing, graph sampling at high res)
- No incremental/progressive rendering for 3D (wireframe + quads sorted each frame)
- File intake PDF inflater is sync, can block UI for large PDFs
- No cancellation of obsolete calculations (typing fast in graph still triggers old sampling before debounce)
- No automatic quality reduction on low-powered devices

## 5. Mobile Problems

- Sidebar hidden at ≤900px, bottom nav shows 22 items → horizontal scroll, tiny tap targets (68px min but crowded)
- Calculator keypad: 5 cols → 4 cols at ≤420px, but keys still small, no thumb-friendly grouping
- Graphing: previous version had fixed 760×460 SVG, now canvas with ResizeObserver but controls still many, drawer collapses but no bottom sheet
- Tables: not stacked, horizontal scroll needed
- Safe-area insets handled in CSS but not tested for keyboard open (input hidden behind keyboard)
- No swipeable panels, no long-press secondary functions
- Command palette: modal centered, not bottom sheet on mobile

## 6. Settings Problems

- Flat list: Appearance, Theme gallery, Calculation, Data, Backup — no categories for graphing, 3D, fractions, complex, matrices, stats, physics, chemistry, engineering, finance, programmer, converter, constants, history, files, accessibility, keyboard, touch, performance, offline, privacy
- No per-section defaults (graph default range, 3D quality, programmer base, finance currency)
- No search ("degrees" → Calculator → Angle Mode)
- No reset per section, only global reset
- No export/import of settings alone (only full backup)

## 7. Accessibility Problems

- Skip link exists, focus-visible rings exist, but:
- Calculator keys have no aria-label for functions (e.g., "sine" vs "sin")
- Graph canvas has no keyboard alternative (pan/zoom only mouse/touch)
- 3D panel drag-to-rotate has no keyboard alternative
- Tables lack scope, caption
- Command palette has good a11y (listbox, activedescendant) but bottom nav items have no text alternative for screen readers beyond label
- Reduced-motion respected in CSS but not in JS (graph panning still animates via immediate viewport change — okay, but no toggle for trace animation)
- Contrast: high-contrast mode exists but not tested for graph colors (some colors low contrast on dark)
- No scalable text control (browser zoom only)

## 8. Missing Functionality

- Home screen with recent, favorites, quick actions, continue where left off
- Tool discovery page with categories (MATHEMATICS, SCIENCE, etc.)
- Universal search bar (not just palette) that searches tools, functions, constants, units, formulas, settings, history, knowledge
- "Send to..." workflow between tools
- Favorites/pinned system
- Per-section settings with search
- Global settings search
- Smart defaults (angle mode visible, graph viewport sensible, 3D balanced, mobile touch optimized)
- Keyboard shortcuts central system + configurable + Settings → Keyboard
- Touch gestures with fallback (pinch zoom already, but double-tap reset, long-press trace missing)
- Educational mode (Result only vs Explain with steps/formula/variables)
- Files: better preview, analyze, extract, calculate, privacy explanation
- PWA: better install prompt, splash, theme-color per palette, offline/online indication exists but subtle
- Onboarding: 6-step short intro
- Contextual help ? per advanced feature
- Internationalization prep (strings inline)
- Performance mode auto detection
- Memory management cleanup for WebGL/workers

## 9. Recommended Architecture

**Navigation (Intent-based):**
```
HOME (/home)
  - Ask bar (global search)
  - Recent calculations (from history)
  - Favorites (pinned tools/formulas)
  - Quick actions (Calculate, Graph, Convert, Solve)
  - Continue where left off (last graph, last conversion)

CALCULATE (/calculator)
  - Calculator (default)
  - Fractions, Complex, Number Systems

GRAPH (/graph)
  - Graphing (2D)
  - 3D & Fields

SOLVE (/solve)
  - Equation Solver, Calculus, Matrices

CONVERT (/convert)
  - Unit Converter, Constants

ANALYZE (/analyze)
  - Statistics, Probability

SCIENCE (/science)
  - Physics, Chemistry, 3D & Fields

ENGINEERING (/engineering)
  - Engineering

FINANCE (/finance)
  - Finance & Everyday

PROGRAMMER (/programmer)
  - Programmer, Number Systems

REFERENCE (/reference)
  - Constants, Formulas, Knowledge

FILES (/files) -> AskPanel file intake

HISTORY (/history)
SETTINGS (/settings)
  - Categories with search, per-section settings, reset per section

TOOLS (/tools) - Discovery page with categories
```

**Preserve existing routes:** Keep old ids (#/graph, #/calculus etc.) working via redirect map to new grouped routes, so deep links don't break.

**Universal Search:**
- Global bar at top (desktop) / primary entry (mobile)
- Searches: tools, commands, constants, units, formulas, settings, history, knowledge
- Uses existing intents/solve.ts + commands + knowledge + conversions + constants
- Autocomplete, recent, examples, keyboard shortcut Ctrl+K / Cmd+K and / when not typing

**Settings Center:**
- Left nav: General, Appearance, Calculator, Graphing, 3D & Fields, Fractions, Complex, Matrices, Stats, Probability, Physics, Chemistry, Engineering, Finance, Programmer, Converter, Constants, History, Files, Accessibility, Keyboard, Touch, Performance, Offline, Privacy, Data, About
- Each section only relevant settings
- Search: filter settings, click to jump
- Reset per section + reset all + export/import settings
- Use existing settingsStore but split UI

**Performance:**
- Keep lazy panels (already)
- Add Web Worker for graph sampling at high res (optional, progressive)
- Add cancellation token for obsolete calculations
- Add performance mode detection (navigator.hardwareConcurrency, deviceMemory, FPS measurement)

**Cross-tool workflow:**
- Universal `sendTo` bus: `setDraft`, `answerStore`, plus new `sendToTool` that navigates and pre-fills
- "Send to..." button in OutputList / Analysis results

**Home:**
- New panel `HomePanel.tsx` with Ask bar, recent, favorites, quick actions

**PWA:**
- Keep existing, add better install strip (already), add theme-color per palette (already does), add offline/online more prominent

## 10. Phased Implementation Plan

**Phase 1 — Audit (done, this file)**

**Phase 2 — Architecture & UX Plan (done, section 9)**

**Phase 3 — Navigation + Shell:**
- New grouped navigation (HOME, CALCULATE, GRAPH, etc.) + keep old routes via alias map
- New HomePanel with recent, favorites, quick actions
- Tools discovery panel
- Bottom nav: Home, Calculate, Graph, Tools, More (5 items max on mobile)

**Phase 4 — Global Search / Command Palette:**
- Enhance CommandPalette to search settings, constants, units, history, knowledge
- Add global search bar component in topbar (desktop) and as primary in Home
- Add recent commands, examples per section

**Phase 5 — Calculator UX:**
- Keep simple surface, improve hierarchy, angle mode visible, history beside, keyboard shortcuts, copy/paste, undo/redo

**Phase 6 — Graphing UX (already upgraded):**
- Keep new professional graphing, add contextual toolbar grouping, legend, better empty states

**Phase 7 — Tool Integration:**
- Add "Send to..." action everywhere
- Favorites/pinned system (localStorage)

**Phase 8 — Settings Center:**
- New SettingsCenter with categories, search, per-section settings, reset per section

**Phase 9 — Mobile Optimization:**
- Dedicated responsive models: phone bottom nav 5 items, tablet split view, desktop sidebar + inspector
- Bottom sheets for drawers, safe-area, keyboard-aware
- Tables stacked on mobile

**Phase 10 — Performance:**
- Web Worker for graph sampling (optional), cancellation, incremental rendering, auto quality

**Phase 11 — Accessibility:**
- Keyboard alternatives for graph/3D, aria-labels, table semantics, scalable text, focus management, contrast checks

**Phase 12 — PWA/Offline:**
- Verify offline core, improve install prompt, update handling, offline/online indicator prominence

**Phase 13 — Testing:**
- Add tests for new navigation, home, settings search, send-to, mobile layout, keyboard, offline, cross-tool

**Phase 14 — Final QA:**
- Visual QA at 320,375,390,430,768,1024,1366,1920,2560,4K, portrait/landscape, dark/light, reduced-motion, offline, slow device
- Performance measurements (LCP, INP, CLS, cold/warm start, route transition, calculator/graph response)
- Produce final audit report A-O
