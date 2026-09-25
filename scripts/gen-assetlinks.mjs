/**
 * Writes the Digital Asset Links file a Trusted Web Activity needs.
 *
 *   npm run store:assetlinks -- <SHA-256 fingerprint> [package id]
 *
 * Google Play signs the uploaded app with a key whose SHA-256 fingerprint is
 * shown in Play Console → Test and release → App integrity → App signing key
 * certificate. Copy that value here (colons are optional) and the app opens
 * without the browser address bar; without it, Android falls back to a normal
 * browser tab.
 *
 * The generated file belongs in `public/.well-known/assetlinks.json`, which the
 * build copies to the web root of whichever host serves the PWA.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [, , rawFingerprint, rawPackage = 'app.omnica.calculator'] = process.argv;

const fingerprint = (rawFingerprint ?? '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');

if (fingerprint.length !== 64) {
  console.error(
    'usage: npm run store:assetlinks -- <SHA-256 fingerprint from Play Console> [package id]\n' +
      'example: npm run store:assetlinks -- AB:CD:...(64 hex digits) app.omnica.calculator',
  );
  process.exit(1);
}

const coloned = fingerprint.match(/../g).join(':');
const manifest = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: rawPackage,
      sha256_cert_fingerprints: [coloned],
    },
  },
];

const outDir = join(root, 'public', '.well-known');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'assetlinks.json');
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`store: wrote public/.well-known/assetlinks.json for ${rawPackage}`);
console.log(`store: fingerprint ${coloned}`);
console.log('store: rebuild and redeploy so the file is served at /.well-known/assetlinks.json');
