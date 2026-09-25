# Android wrapper (Trusted Web Activity)

This folder holds the Bubblewrap configuration that turns the deployed PWA into a Play Store app.

1. **Edit `twa-manifest.json`** — replace every `REPLACE-WITH-YOUR-DEPLOYED-HOST.example.com` with the
   HTTPS host that serves the build. Keep `appVersionName` / `appVersionCode` in step with
   `package.json` (`appVersionCode` = `major * 10000 + minor * 100 + patch`).
2. **Create the signing key** (once):

   ```bash
   keytool -genkeypair -v -keystore store/android/android.keystore -alias omnica \
     -keyalg RSA -keysize 2048 -validity 10950
   ```

3. **Build the App Bundle:**

   ```bash
   npm run store:twa:init     # first time only — creates the Gradle project
   npm run store:twa:build    # writes app-release-bundle.aab (and an APK for testing)
   ```

4. **Start a local test** — `npm run store:twa:init` prints a command such as
   `adb install -r app-release-signed.apk`.
5. **Verify the link** — run `npm run store:assetlinks -- <SHA-256 from Play Console>` and deploy, so
   the app runs full-screen without the browser bar. See [`../../docs/STORES.md`](../../docs/STORES.md).

A native alternative that keeps 100% of the app offline (no host required) is the Tauri Android
target: `npm run mobile:android:init && npm run mobile:android:build`. F-Droid only accepts that
route, because a web wrapper has nothing to reproduce from source.
