# Publish OmniCalc — the exact commands

Everything is already committed and configured: `base: './'` (so the app works from any sub-path),
service worker, manifest, icons, `netlify.toml`, `vercel.json`, `public/_headers`, `public/_redirects`,
`Dockerfile`, `docker-compose.yml`, GitHub Actions workflows, Tauri config and the Android TWA
manifest. You only need an account on the host you pick — nothing in this repo needs a paid service.

## 0. Quality gate (run this first — it must be green)

```bash
cd omnica
npm ci
npm run verify        # themes in sync → typecheck → 980 tests → production build
```

`npm run verify` is the whole gate: 10 theme palettes in sync, `tsc -b` clean, every test in
`src/**/*.test.ts(x)` passing, and `dist/` built with the service worker precache manifest.

## 1. The web (free, 2 minutes)

```bash
npm run build         # → dist/
```

| Where | What to do | Result |
| --- | --- | --- |
| **GitHub Pages** | push to `main`; enable Settings → Pages → Source: *GitHub Actions* | `https://<you>.github.io/omnica/` |
| **Netlify** | drag `dist/` onto app.netlify.com/drop, or connect the repo (`netlify.toml` is read) | `https://<name>.netlify.app` |
| **Vercel** | import the repo (`vercel.json` is read) | `https://<name>.vercel.app` |
| **Cloudflare Pages** | connect the repo, build `npm run build`, output `dist` | `https://<name>.pages.dev` |
| **Any cPanel / FTP / S3 / VPS** | upload the contents of `dist/` | your own domain |

Then set the domain, wait for HTTPS (all four hosts do it automatically) and the app installs itself
from the browser — “Install app” appears in Chrome/Edge, “Add to Home Screen” on iOS/Safari.

## 2. Docker / your own server

```bash
docker compose up -d --build          # http://localhost:8080
```

## 3. Desktop installers (Windows, macOS, Linux)

```bash
npm run desktop:build                  # Tauri: .msi/.exe, .dmg, .deb/.rpm/.AppImage
```

Artifacts land in `src-tauri/target/release/bundle/`. Sign the Windows build with a code-signing
certificate and the macOS build with an Apple Developer ID before you distribute them.

## 4. Google Play (Android)

```bash
npm run store:assetlinks -- <SHA-256 fingerprint from Play Console>   # → public/.well-known/assetlinks.json
npm run build && <deploy>              # so the file is live on your HTTPS origin
npm run store:twa:init                 # Bubblewrap reads store/android/twa-manifest.json
npm run store:twa:build                # → app-release-bundle.aab (upload to Play Console)
```

- In `store/android/twa-manifest.json`, replace `REPLACE-WITH-YOUR-DEPLOYED-HOST.example.com` with the
  HTTPS origin from step 1. Without the asset-links file Android shows a URL bar above the app;
  with it the app opens full screen.
- Play Console: create the app, upload the `.aab`, paste the listing from `docs/STORE_LISTING.md`,
  fill the Data safety form with “no data collected” (true — no telemetry, no accounts, no network
  calls), then publish to internal testing first.
- Prefer a native shell? `npm run mobile:android:init` + `npm run mobile:android:build` builds a Tauri
  APK/AAB instead (also works for iOS: `npm run mobile:ios:init` / `mobile:ios:build`).

## 5. Apple App Store (iOS)

```bash
npm run mobile:ios:init
npm run mobile:ios:build               # then upload with Xcode/Transporter
```

Requires macOS with Xcode and an Apple Developer account. The App Store review also accepts the PWA
itself for many utility apps, but a Tauri/Capacitor wrapper is the safe route.

## 6. Other stores, no extra build

- **Microsoft Store** — publish the Tauri `.msi` (Partner Center), or the PWA via PWABuilder.
- **F-Droid / Snapcraft / Flathub / AUR** — wrap the `.deb`/`.AppImage` or point them at the repo.
- **Amazon Appstore, Samsung Galaxy Store, Huawei AppGallery, Xiaomi GetApps** — all accept the same
  Android `.aab`/`.apk` from step 4.
- **Itch.io, SourceForge, GitHub Releases** — attach `dist/` as a zip; `npm run build && zip -r omnica-web.zip dist`.

## 7. Release

```bash
npm version 2.0.0 --no-git-tag-version
git add -A && git commit -m "release: 2.0.0"
git tag v2.0.0 && git push origin main --tags
```

`.github/workflows/release.yml` then runs the gate and attaches the web bundle to the GitHub release;
`.github/workflows/deploy-pages.yml` republishes the site.

## 8. What only you can do

Two things cannot be done from this workspace, because they need your accounts:

1. **Choose the host and push** — the repo has no remote yet: `git remote add origin git@github.com:<you>/omnica.git && git push -u origin main`.
2. **Store dashboards** — Play Console, App Store Connect and Partner Center accounts (one-off fees
   apply for Google Play and Apple; the Microsoft Store developer account is free for individuals).

Everything else — the build, the PWA, the store assets, the listing text, the CI — is in the repo and
verified by `npm run verify`.
