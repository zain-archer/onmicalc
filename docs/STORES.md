# Publishing OmniCalc to the app stores

Everything in this file is reproducible from a clone of the repository. No step needs a paid service,
a backend, an API key or an account *inside the app* — only the store accounts, which belong to the
person publishing.

| Store / platform | Route | Config in this repo | Account needed |
| --- | --- | --- | --- |
| Google Play | Trusted Web Activity (Bubblewrap) **or** native Tauri Android | `store/android/`, `src-tauri/` | Play Console, $25 once |
| Apple App Store | Native Tauri iOS **or** Capacitor wrapper | `src-tauri/`, `store/ios` steps below | Mac + Xcode, $99/year |
| Microsoft Store | MSIX around the Windows bundle | `src-tauri/`, steps below | Partner Center, ~$19 once |
| F-Droid | Native Tauri Android APK | `src-tauri/` | none (free, FOSS only) |
| Amazon Appstore, Samsung Galaxy Store, Huawei AppGallery, Aptoide, APKPure | same AAB/APK as Play | `store/android/` | free developer accounts |
| Snap Store, Flathub, AUR | Linux packages | steps below | free |
| Winget, Chocolatey, Scoop, Homebrew | CLI manifests pointing at GitHub Releases | `.github/workflows/release.yml` | free |
| Any static host (Pages, Netlify, Vercel, Cloudflare, S3, Docker) | the PWA itself | `netlify.toml`, `vercel.json`, `Dockerfile`, `docs/PUBLISHING.md` | free tier |

## 0. Prepare a release (once per version)

```bash
npm ci
npm run verify                     # themes:check + typecheck + tests + build
npm run store:icons                # Tauri icons + Play/App Store artwork
npm run test                       # (optional) re-runs the packaging guard tests
```

Bump `version` in `package.json` **and** the version fields in `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `src/version.ts` and `store/android/twa-manifest.json`
(`appVersionName` + `appVersionCode`, where the code is `major*10000 + minor*100 + patch`,
so `1.3.0` → `10300`). `src/packaging.test.ts` fails if any of them drift apart.

Store listing copy, ready to paste, is in [`STORE_LISTING.md`](./STORE_LISTING.md), with the privacy
policy at [`../PRIVACY.md`](../PRIVACY.md) (a hosted copy is emitted to `dist/privacy.html`).

## 1. Google Play

### Route A — Trusted Web Activity (smallest download, needs a host)

```bash
# 1. deploy the PWA somewhere on HTTPS (see docs/PUBLISHING.md), then
#    replace REPLACE-WITH-YOUR-DEPLOYED-HOST.example.com in store/android/twa-manifest.json
npm run store:twa:init                 # first run only: scaffolds the Gradle project
npm run store:twa:build                # → app-release-bundle.aab + app-release-signed.apk
```

Then in Play Console → *Test and release* → *App integrity* → *App signing key certificate*, copy the
SHA-256 fingerprint and publish it so the app runs without the browser bar:

```bash
npm run store:assetlinks -- "AB:CD:EF:...:<64 hex digits>" app.omnica.calculator
npm run build && <redeploy>            # serves /.well-known/assetlinks.json
```

Full-screen is verified with `https://<host>/.well-known/assetlinks.json` returning the manifest and
`adb shell dumpsys package app.omnica.calculator | grep -i "domain="`.

**Limitation (by design, stated honestly):** a TWA needs the network the first time and needs the host
to stay up. Everything after the first load is served from the service worker cache.

### Route B — Native Tauri Android (fully offline, no host needed)

```bash
cargo install tauri-cli --version "^2"      # one-time
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
export ANDROID_HOME="$HOME/Android/Sdk"     # Android Studio SDK + NDK
export NDK_HOME="$ANDROID_HOME/ndk/<version>"

npm run mobile:android:init                 # creates src-tauri/gen/android
npm run mobile:android:build                # → AAB + APKs, signed with the release key

# signing key (once), then add it to src-tauri/gen/android/keystore.properties:
keytool -genkeypair -v -keystore omnica-release.keystore -alias omnica -keyalg RSA -keysize 2048 -validity 10950
```

Upload `src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`
to Play. This route works with no internet at all, which is also what F-Droid requires.

### Play listing checklist

- App name (30 chars), short description (80), full description (4000) → `docs/STORE_LISTING.md`.
- Icon: `store/assets/play-icon.png` (512×512). Feature graphic: `store/assets/play-feature-graphic.png` (1024×500).
- Phone screenshots: at least 2, 320–3840 px, 16:9 or 9:16 (take them from the running app;
  App Store sizes in §2).
- Category *Education* or *Tools*, content rating questionnaire (no user-generated content, no ads,
  no data collection), data safety form: **no data collected, no data shared, no tracking**.
- Privacy policy URL: the deployed `privacy.html`.
- Release track: internal testing → closed → production. Play reviews a TWA faster than a new native app.

## 2. Apple App Store

Requires macOS with Xcode 15+, an Apple Developer account and a bundle identifier that matches
`src-tauri/tauri.conf.json` (`app.omnica.calculator`).

```bash
cargo install tauri-cli --version "^2"
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
npm run mobile:ios:init                    # creates src-tauri/gen/apple (Xcode project)
npm run mobile:ios:build                   # or open the project in Xcode and Archive it
xcrun altool --upload-app -f OmniCalc.ipa -t ios \
  --apiKey "$APPLE_API_KEY" --apiIssuer "$APPLE_API_ISSUER"
```

Then in App Store Connect: create the app record, paste the listing text, set the *Privacy* answers to
"Data Not Collected", add screenshots (6.7" 1290×2796 and 6.5" 1242×2688, plus iPad 12.9" if you keep
the `ipad` target), and submit for review. Note Apple treats "calculator" apps strictly: mention the
graphing, statistics, matrices and calculus tools in the description and in the review notes so it is
clear this is not a duplicate of the built-in Calculator app.

Capacitor fallback (if you prefer a WKWebView wrapper without Rust):

```bash
npm i -D @capacitor/cli && npm i @capacitor/ios
npx cap init OmniCalc app.omnica.calculator --web-dir=dist
npx cap add ios && npx cap sync ios && npx cap open ios
```

## 3. Microsoft Store (Windows)

```bash
npm run desktop:build                 # → MSI + NSIS installers in src-tauri/target/release/bundle
```

Package the NSIS output as an MSIX with the free *MSIX Packaging Tool* (or `MakeAppx.exe pack /d <dir>
/p OmniCalc.msix /nv`), sign with your Partner Center certificate, then submit in Partner Center
(*Apps and games* → *New product*). Store listing fields mirror §1; the privacy policy URL is
`PRIVACY.md` hosted or `privacy.html`.

Also publishable without a Store account:

```bash
wingetcreate update OmniCalc.OmniCalc --version 1.3.0 --urls <url-to-installer>
```

## 4. Linux packages

| Format | Command | Notes |
| --- | --- | --- |
| Snap | `snapcraft init && npm run desktop:build && snapcraft` | store listing is free; `confinement: strict`, no network plug needed |
| Flathub | `flatpak-builder --force-clean build-dir org.omnica.OmniCalc.yml` | needs a Flathub repo PR; manifest uses the release tarball |
| AppImage | `npm run desktop:build -- --bundles appimage` | runs anywhere, no store |
| Debian / RPM | `npm run desktop:build -- --bundles deb,rpm` | attach to GitHub Releases |
| AUR | `makepkg -si` from a `PKGBUILD` pointing at the release tarball | free, community-run |

Because the app is a pure static bundle, the simplest Linux "package" remains the PWA plus the Docker
image: `docker run --rm -p 8080:80 ghcr.io/<owner>/omnica:1.3.0`.

## 5. Other Android stores

All of these accept the same signed AAB/APK as Play (Route A or B):

| Store | Upload | Notes |
| --- | --- | --- |
| F-Droid | merge request with a build recipe | **Route B only** — F-Droid rebuilds from source, so a TWA is not accepted |
| Amazon Appstore | `amazon-appstore-cli` or the web console | free; the APK from Route B |
| Samsung Galaxy Store | Seller Portal | free; APK or AAB |
| Huawei AppGallery | AppGallery Connect | free; AAB |
| Aptoide / APKPure / Amazon Fire | manual upload or self-hosted | free; APK |

## 6. One-command summary

```bash
npm ci && npm run verify && npm run store:icons      # release inputs
npm run store:twa:build                              # Android (Play, TWA)
npm run mobile:android:build                         # Android (Play/F-Droid, native)
npm run mobile:ios:build                             # iOS (App Store)
npm run desktop:build                                # Windows/macOS/Linux desktop bundles
npm run docker:build                                 # server-free web image
```

## 7. What only the owner can do

Nothing in this repository needs a secret, but four things cannot be done from a sandbox and are
listed here so no step is a surprise: creating the store accounts and paying the one-off/annual fees;
holding the signing keys (`store/android/android.keystore`, the Play/App signing keys, the Windows
certificate); deploying the PWA to a domain you own (needed for the TWA variant and for the privacy
policy URL); and answering the store review questions about data collection — whose true answers are
"nothing is collected" for every question, because the app has no network code at all.

The claim "no network code" is enforced by the test suite: `src/hardening.test.ts` scans the sources
for `fetch`, `XMLHttpRequest`, `eval`, `new Function` and `innerHTML`.
