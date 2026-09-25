# OmniCalc desktop shell (Tauri v2)

A thin native wrapper around the same static build in `../dist`. Nothing here changes app behaviour:
no extra permissions, no updater, no network access.

```bash
cargo install tauri-cli --version "^2"   # one-time
npm run build                            # creates ../dist
cargo tauri dev                          # hot-reload shell for development
cargo tauri build                        # installers for the current platform
```

Icons: copy `public/icons/icon-192.png` and `public/icons/icon-512.png` into `src-tauri/icons/`
before bundling (or run `npx tauri icon public/favicon.svg`).

Full instructions, artifact table and release checklist: [`../docs/DESKTOP.md`](../docs/DESKTOP.md).
