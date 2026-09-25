# Contributing to OmniCalc

Thanks for helping keep a capable calculator free for everyone. This project has a few firm rules
because they are what make the result trustworthy.

## Ground rules

1. **Never break the free promise.** No paywalls, trials, accounts, ads, paid APIs, telemetry or
   “pro” features. Nothing in the app may require a server or upload user data.
2. **No `eval`, `new Function`, or string-to-code execution** — expressions go through
   `src/core/parser` and `src/core/evaluator`. `src/hardening.test.ts` fails the build if this is
   violated, along with any `fetch`/`XHR`, `innerHTML` or third-party script.
3. **Correctness beats features.** If a case is unsupported, return a typed `CalcError` explaining
   why instead of a plausible-looking wrong number.
4. **The engine stays platform-independent.** `src/core`, `src/math`, `src/graphing`,
   `src/conversions`, `src/engineering`, `src/finance` and `src/constants` must not import React or
   touch the DOM. The UI contains no mathematics.

## Getting started

```bash
git clone <your fork>
cd omnica
npm ci
npm run dev          # http://localhost:5173
npm run verify       # typecheck + tests + production build — must be green
```

Useful scripts: `npm run test:watch`, `npm run typecheck`, `npm run preview`.

## Where things live

| Path | Contents |
| --- | --- |
| `src/core` | tokenizer, parser, evaluator, precision, errors (no UI) |
| `src/math/*` | one folder per math domain, each with its own tests |
| `src/conversions`, `src/constants` | data-driven tables plus their engines |
| `src/engineering`, `src/finance` | applied calculators |
| `src/graphing` | viewport, sampling and analysis maths |
| `src/ui` | shell, panels, primitives, theme (no maths) |
| `src/storage`, `src/settings`, `src/history` | persistence and models |

## Adding a tool

1. Put the mathematics in the right `src/` module with unit tests (happy paths, boundaries and the
   exact error you expect for invalid input).
2. Add metadata to `src/ui/tools.ts` (icon path, group, phase, summary) and register the panel in
   `src/ui/shell/AppShell.tsx`. New panels are loaded on demand — keep them lazy.
3. Flip `status` to `'ready'` only when UI, logic, error handling, tests, responsive behaviour and
   documentation all exist.
4. Update `PROJECT_STATUS.md` (completed/remaining/tests/build) and `CHANGELOG.md`.

## Style

- TypeScript strict; no `any` in new code; prefer small pure functions with explicit return types.
- Comments explain *why* (a limit of floating point, a convention, a trade-off), not *what*.
- Keep files under ~900 lines; extract a helper module rather than growing a file.
- CSS uses the existing tokens in `src/styles/global.css`; no CSS frameworks and no external fonts.
- Accessibility is part of “done”: labelled controls, keyboard operation, visible focus,
  `aria-live` for results that change, and no colour-only meaning.

## Tests

- Colocate `*.test.ts(x)` next to the code.
- UI tests assert user-visible text and roles, not implementation details.
- Numeric assertions use tolerances (`toBeCloseTo`) with a documented expected value.
- Anything with a performance budget should assert *bounded work* (point counts, subdivisions),
  not wall-clock time, so CI stays deterministic.

## Reporting bugs

Include the exact expression, the expected result, the actual result, your browser/OS and whether
the app was installed. A failing test case is the most useful report of all.

## Licence

Contributions are accepted under the MIT licence in [LICENSE](./LICENSE).
