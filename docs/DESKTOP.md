# Desktop and mobile packaging

The web build is the source of truth: every package below bundles the same `dist/` output, so there
is never a second implementation to keep in sync.

## Recommended: Tauri (small, fast, no bundled browser)

Tauri uses the operating system's own WebView, so a packaged OmniCalc is a few megabytes rather than
the ~120 MB an Electron build would need.

```bash
# one-time tooling
cargo install tauri-cli --version "^2"
rustup target add x86_64-pc-windows-msvc   # or your target triple

npm ci
npm run build                              # produces dist/
cd src-tauri && cargo tauri build          # or: cargo tauri dev
```

Artifacts land in `src-tauri/target/release/bundle/`:

| Platform | Output |
| --- | --- |
| Windows | `.msi` (WiX) and `.exe` (NSIS) installers |
| macOS | `.app` and `.dmg` |
| Linux | `.deb`, `.rpm` and `.AppImage` |

The configuration in `src-tauri/tauri.conf.json` already points at `../dist`, sets a sensible window
size, disables telemetry and allows no network permissions beyond local files.

### What differs from the browser build

- The service worker is unused (the app is already local); Tauri simply loads `index.html`.
- Updates are the user's choice: rebuild and reinstall, or point the updater at a JSON feed you host.
- File import/export uses the same download/upload paths, which the WebView handles natively.

## Alternative: Electron

If a Tauri toolchain is unavailable, Electron works with the same `dist/`:

```bash
npm i -D electron
npx electron . # with a 20-line main.js loading dist/index.html
```

Expect a much larger installer; no OmniCalc code changes are needed either way.

## Android / iOS

1. Simplest: install the PWA from the browser (Add to Home Screen). It is offline-capable and looks
   native, and it stays free forever.
2. Native wrappers: Tauri v2 supports Android and iOS (`cargo tauri android init`,
   `cargo tauri ios init`), reusing the same configuration.

## Publishing the desktop builds from CI

`.github/workflows/release.yml` already builds the web bundles on a `v*` tag. To add installers, run
`cargo tauri build` in the same job on a matrix of runners (`ubuntu-latest`, `macos-latest`,
`windows-latest`) and attach `src-tauri/target/release/bundle/**` to the release. Signing keys are the
only secret needed, and only if you choose to sign.

## Release checklist

- [ ] `npm run verify` green (typecheck + 688 tests + production build)
- [ ] `README.md`, `CHANGELOG.md` and `PROJECT_STATUS.md` updated
- [ ] Version bumped in `package.json` and `src-tauri/tauri.conf.json` — the UI and backups read it from there
- [ ] Fresh-profile smoke test: first run, keyboard-only navigation, offline reload, export/import
- [ ] Checksums published alongside the installers
