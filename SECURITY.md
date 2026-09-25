# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | ✅ |

## The threat model in one paragraph

OmniCalc is a static web app. It has **no backend, no database, no authentication and no network
access at runtime**, so there is nothing to breach server-side: the attack surface is the code
running in the user's own browser tab, plus whatever they choose to load it from. The main risks are
therefore (a) a malicious expression executing code, (b) an imported backup file corrupting local
state, and (c) a compromised dependency or hosting origin.

## How those risks are mitigated

| Risk | Mitigation |
| --- | --- |
| Code execution from input | Expressions are parsed by a hand-written tokenizer/Pratt parser and evaluated over a typed AST. `eval`, `new Function`, `setTimeout("…")` and `innerHTML` are banned and enforced by tests (`src/hardening.test.ts`). |
| Malicious backup file | `parseBackup()` never throws and sanitises every field: unknown formats are rejected, numbers are range-checked, colours are pattern-checked, history is capped at 500 entries and the draft at 2000 characters. A rejected file leaves existing data untouched. |
| Data exfiltration | No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` anywhere in `src/`. No analytics, no third-party scripts, no external fonts or CDNs, no cookie, no account. |
| Supply chain | Two runtime dependencies (React, React DOM) and a small devDependency set; `npm ci` with a committed lockfile; `npm audit` runs in CI. |
| Hosting | Static files only. Deploy with HTTPS; the provided configs set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN` and a restrictive `Permissions-Policy`. The Tauri config ships a strict CSP. |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

1. Use GitHub's private *Report a vulnerability* (Security → Advisories → Report a vulnerability), or
   email the maintainers listed in the repository.
2. Include: what you did, what happened, what you expected, and the smallest reproducible input
   (an expression or a backup file is ideal).
3. Expect an acknowledgement within 72 hours and a fix or a written assessment within 30 days.

Please give us a reasonable window to ship a fix before public disclosure. There is no bug bounty —
this is a free, volunteer project — but credit is given in the release notes unless you prefer
otherwise.

## What is explicitly out of scope

- Anything requiring a modified build, a compromised browser or a malicious extension.
- Denial of service against a local browser tab (for example pasting an enormous expression); the
  parser rejects pathological input with a normal error, but a slow tab is not a vulnerability.
- The contents of `localStorage` under `omnica.*` keys, which are the user's own data.
