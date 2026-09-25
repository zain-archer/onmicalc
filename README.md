# OmniCalc

[![CI](https://github.com/omnica/omnica/actions/workflows/ci.yml/badge.svg)](https://github.com/omnica/omnica/actions/workflows/ci.yml)
[![Deploy](https://github.com/omnica/omnica/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/omnica/omnica/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.3.0-informational.svg)](./CHANGELOG.md)

A **free**, offline-first scientific, engineering and graphing calculator for the web, desktop and
mobile. No accounts, no ads, no paid APIs, no premium tiers — every calculation runs on your device.

> Status: **release 1.3.0** — all 29 phases (0–28) plus the natural-language **Ask OmniCalc** layer
> (typo-tolerant), a 151-entry knowledge base that answers "what is pi", offline intake for PDF/Word/
> Excel/PowerPoint/text files, ten colour palettes, an adaptive layout for every screen, and
> packaging for every app store. See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for the details.

## What it does

| Area | Tools |
| --- | --- |
| Calculate | scientific keypad, exact fractions, complex numbers, programmer calculator |
| Analyse | graphing (zoom/pan/trace, roots, extrema, areas), calculus (derivatives, integrals, limits, series), equation solver, matrices & vectors, statistics, probability |
| Convert | unit converter (13 categories), physical & mathematical constants, number systems and bitwise logic |
| Applied | engineering (electrical, physics, geometry), finance & everyday (loans, interest, ROI, percentages, dates, tips) |
| Explain | **Ask in plain words** ("20 percent of 250", "solve 3x + 5 = 20"), a 151-entry knowledge base ("what is pi", "define acceleration", "what unit is N"), stored formulas and constants that can be sent straight to the calculator |
| Read your files | drop a **PDF, Word, Excel, PowerPoint, OpenDocument, CSV, JSON, text or image** file and OmniCalc lists the questions inside it and solves them — read on your device, never uploaded |
| System | history with favourites, memory slots, settings, **ten colour palettes** in light and dark, adaptive layout for phone/tablet/desktop, backup export/import, installable offline PWA |

Extras: command palette (`Ctrl/Cmd+K`), full keyboard navigation, high-contrast and reduced-motion
modes, and a fluid layout that adapts from a 320 px phone to a split-screen tablet to a wide desktop
(container queries, safe-area insets, landscape and print passes).

## Run it anywhere

| Target | How |
| --- | --- |
| Browser (any) | `npm run build` and serve `dist/` — works from a sub-directory or a USB stick |
| Installable app | Open the site and choose *Install* (Chrome/Edge address bar, iOS *Add to Home Screen*) |
| GitHub Pages | Enable Actions → the `Deploy to GitHub Pages` workflow does the rest |
| Netlify / Vercel / Cloudflare Pages | Build `npm run build`, publish `dist` (configs are committed) |
| Own server | `docker compose up -d --build` → `http://localhost:8080` |
| nginx / Apache / S3 | Static files + the cache headers in [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Desktop (Win/macOS/Linux) | `npm run desktop:build` (Tauri v2, ~10 MB installers) |
| Google Play | `npm run store:twa:build` (TWA) or `npm run mobile:android:build` (native) |
| App Store | `npm run mobile:ios:init && npm run mobile:ios:build` |
| Other stores | `docs/STORES.md` — Microsoft Store, F-Droid, Amazon, Samsung, Huawei, Snap, Flathub, Homebrew, Winget… |

Everything above ships the same build: one engine, one UI, no per-platform forks.

## Documentation

| File | Contents |
| --- | --- |
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | phase-by-phase status, test/build numbers, known issues |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | static hosting recipes, PWA verification, cache headers |
| [docs/DESKTOP.md](./docs/DESKTOP.md) | Tauri/Electron packaging and mobile notes |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | workflow, code rules, how to add a tool |
| [docs/PUBLISHING.md](./docs/PUBLISHING.md) | five-minute publishing guide for the web platforms |
| [docs/STORES.md](./docs/STORES.md) | step-by-step Play Store, App Store and every other store |
| [docs/STORE_LISTING.md](./docs/STORE_LISTING.md) | ready-to-paste store listing text |
| [PRIVACY.md](./PRIVACY.md) | privacy policy (served as `privacy.html` for store submissions) |
| [docs/ASK.md](./docs/ASK.md) | every sentence Ask OmniCalc understands |
| [CHANGELOG.md](./CHANGELOG.md) | release history |
| [SECURITY.md](./SECURITY.md) | threat model, hardening measures, how to report a vulnerability |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | community expectations |

## Principles

- Completely free, MIT licensed
- Offline first (installable PWA, no backend required)
- Private: calculations never leave the device
- Accurate: a hand-written safe expression engine, never `eval` / `new Function`
- Honest: unsupported or unsafe input returns a typed, explanatory error instead of a wrong number
- Documented: every phase, decision and limitation is written down in-repo
- Accessible and responsive from a 320 px phone to a large desktop

## Quick start

```bash
npm ci
npm run dev        # http://localhost:5173
npm run verify     # themes:check + typecheck + 727 tests + production build (the gate for every change)
npm run build      # type-check + production bundle + service worker
npm run preview    # serve the production build
```

## Technology

| Concern | Choice | Why |
| --- | --- | --- |
| Language | TypeScript (strict) | Safety across a large math surface |
| UI | React 19 + Vite | Fast dev loop, static output, easy PWA |
| Styling | Hand-written CSS with design tokens | No CSS framework weight; themable via CSS variables |
| Tests | Vitest + Testing Library | Same toolchain as Vite, jsdom for UI tests |
| Math engine | In-repo tokenizer → parser → evaluator → formatter | Portable, dependency-free, auditable, no `eval` |
| Offline | Generated service worker (`scripts/build-sw.mjs`) | Precache is derived from the real build output |
| Icons | Generated PNGs (`scripts/gen-icons.mjs`) | No external image assets or binary dependencies |
| Desktop / mobile | Tauri v2 (optional) | Reuses the same `dist/` build; far lighter than Electron |

## Architecture

```
src/
├── core/          # platform-independent engine (no React, no DOM)
│   ├── parser/    # tokenizer + Pratt parser -> AST
│   ├── evaluator/ # AST evaluation, scope, function registry
│   ├── numbers/   # numeric helpers, angle modes
│   ├── precision/ # formatting, rounding, significant figures
│   └── errors/    # CalcError taxonomy used by every layer
├── math/          # math domains built on the engine (arithmetic, trig, stats, matrices, ...)
├── intents/       # plain-language layer: capabilities, sentence templates, scorer
├── conversions/   # data-driven unit conversion engine + definitions
├── engineering/   # electrical / physics / geometry calculators
├── finance/       # interest, loans, everyday money tools
├── graphing/      # plotting, isolated from the core
├── constants/     # structured constants database with sources
├── history/       # history + memory model
├── storage/       # defensive localStorage/IndexedDB adapters
├── settings/      # settings store and defaults
└── ui/            # React shell, panels, theming (contains no math logic)
```

Rules the codebase enforces (all covered by automated guard tests):

1. `src/core`, `src/math`, `src/graphing`, `src/conversions`, `src/engineering`, `src/finance` and
   `src/constants` never import React and never touch the DOM.
2. The UI contains no mathematical logic; it calls the engine.
3. No `eval`, no `new Function`, no `innerHTML`, no `fetch`/`XHR`, no external origins, no analytics.
4. `localStorage` is only reachable through `src/storage`, under versioned `omnica.*` keys.

## Quality gates

| Gate | Command | What it covers |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | strict TS across app, tests and build scripts |
| Tests | `npm test` | 727 tests: engine, every math domain, every panel, knowledge and file intake, themes, packaging, a11y sweep, integration, perf and safety guardrails |
| Build | `npm run build` | production bundle + generated service worker |
| All three | `npm run verify` | the single release gate (also run by CI on Node 20 and 22) |

## Development workflow

The project was built in 29 numbered phases (0–28) recorded in
[PROJECT_STATUS.md](./PROJECT_STATUS.md). Every phase must leave `npm run verify` green — typecheck,
tests and production build — before the next one starts, so the status file plus the test suite is
enough for a new contributor to resume without reading the whole codebase.

## Privacy

OmniCalc has no backend, no analytics and no network requests at runtime. History, memory, settings
and favourites are stored locally on your device and can be exported or erased at any time.

## License

MIT — see [LICENSE](./LICENSE).
