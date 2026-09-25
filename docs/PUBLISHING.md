# Publishing OmniCalc — the five-minute version

Everything is committed and configured. Pick a target, run two commands, share the link.

## 0. Prerequisites (once)

```bash
cd omnica
git init                       # already done in this workspace
git add -A && git commit -m "OmniCalc 1.3.0"
git remote add origin git@github.com:<you>/omnica.git
git push -u origin main
```

> Shipping to the **Play Store, App Store, Microsoft Store, F-Droid, Snap, Flathub** and the rest is
> covered step by step in [`STORES.md`](./STORES.md), with ready-to-paste listing text in
> [`STORE_LISTING.md`](./STORE_LISTING.md).

## 1. GitHub Pages (free, zero config)

Push to `main`. `.github/workflows/deploy-pages.yml` builds and publishes automatically; the URL is
`https://<you>.github.io/omnica/`. Enable it once in **Settings → Pages → Source: GitHub Actions**.

## 2. Any other static host

| Host | Build command | Publish directory | Extra |
| --- | --- | --- | --- |
| Netlify | `npm run build` | `dist` | drag-and-drop also works (`netlify.toml` is read automatically) |
| Vercel | `npm run build` | `dist` | `vercel.json` committed |
| Cloudflare Pages | `npm run build` | `dist` | `public/_headers` + `public/_redirects` committed |
| Surge / Neocities / Hostinger / cPanel | `npm run build` | upload `dist/` | nothing else needed |
| S3 + CloudFront | `npm run build` | `aws s3 sync dist/ s3://bucket/` | set `no-cache` on `index.html` and `sw.js` |

## 3. Your own server (Docker)

```bash
docker compose up -d --build      # http://localhost:8080
docker build -t ghcr.io/<you>/omnica:1.0.0 . && docker push ghcr.io/<you>/omnica:1.0.0
```

## 4. Desktop installers

```bash
npm run desktop:build            # Windows .msi/.exe, macOS .dmg, Linux .deb/.rpm/.AppImage
```

## 5. App stores

- **Microsoft Store**: publish the Tauri `.msi` (or the PWA) through Partner Center.
- **Google Play / App Store**: `cargo tauri android init` / `ios init`, or ship the PWA
  (Play Store accepts a packaged TWA; the App Store accepts a WebView wrapper).
- **Flathub / Snapcraft / AUR**: the Linux `.deb`/`.AppImage` or a small manifest wrapping them.

## 6. Tag a release

```bash
git tag v1.0.0 && git push origin v1.0.0
```

`.github/workflows/release.yml` runs the full quality gate, then attaches `omnica-web.zip`,
`omnica-web.tar.gz` and `SHA256SUMS.txt` to a GitHub release with generated notes.

## 7. After publishing

1. Add your absolute URL to `<link rel="canonical">` in `index.html` (currently commented out) and
   replace the placeholder repository URLs in `README.md` badges, `package.json` and `src/version.ts`.
2. Visit the site once, then reload offline: it must still work.
3. Run the six-step checklist in [DEPLOYMENT.md §4](../DEPLOYMENT.md).
