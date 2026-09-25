import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Packaging guardrails: the app is published to several stores, and every one of
 * them needs the version, identifiers, artwork and listing text to agree. These
 * checks fail the build when a release would be rejected or, worse, shipped with
 * mismatched version numbers.
 */
const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), 'utf8');
const json = <T>(file: string): T => JSON.parse(read(file)) as T;
const exists = (file: string) => existsSync(join(root, file));

const pkg = json<{ version: string; scripts: Record<string, string> }>('package.json');
const tauri = json<{
  identifier: string;
  version: string;
  bundle: { icon: string[] };
}>('src-tauri/tauri.conf.json');
const twa = json<{
  packageId: string;
  appVersionName: string;
  appVersionCode: number;
  host: string;
  startUrl: string;
  iconUrl: string;
}>('store/android/twa-manifest.json');

const versionCode = (version: string) => {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  return major * 10000 + minor * 100 + patch;
};

describe('release versions agree everywhere', () => {
  it('keeps every manifest on the same version', () => {
    expect(tauri.version).toBe(pkg.version);
    expect(read('src-tauri/Cargo.toml')).toContain(`version = "${pkg.version}"`);
    expect(read('src/version.ts')).toContain(`'${pkg.version}'`);
    expect(twa.appVersionName).toBe(pkg.version);
  });

  it('uses Android version codes derived from the version', () => {
    expect(twa.appVersionCode).toBe(versionCode(pkg.version));
  });

  it('uses one application id for every platform', () => {
    expect(tauri.identifier).toBe('app.omnica.calculator');
    expect(twa.packageId).toBe(tauri.identifier);
  });
});

describe('store assets are committed or generated on demand', () => {
  it('ships every icon the Tauri bundles reference', () => {
    for (const icon of tauri.bundle.icon) {
      expect(exists(join('src-tauri', icon)), `${icon} is missing — run npm run store:icons`).toBe(true);
    }
  });

  it('ships the Play and App Store artwork', () => {
    for (const asset of ['play-icon.png', 'appstore-icon.png', 'play-feature-graphic.png']) {
      const path = join('store', 'assets', asset);
      expect(exists(path), `${path} is missing — run npm run store:icons`).toBe(true);
      expect(statSync(join(root, path)).size).toBeGreaterThan(1000);
    }
  });

  it('has a script for every packaging step the guide mentions', () => {
    for (const script of [
      'store:icons',
      'store:assetlinks',
      'store:twa:init',
      'store:twa:build',
      'mobile:android:init',
      'mobile:android:build',
      'mobile:ios:init',
      'mobile:ios:build',
      'desktop:build',
      'docker:build',
      'verify',
    ]) {
      expect(pkg.scripts[script], `${script} script is missing`).toBeTruthy();
    }
  });

  it('is ready for mobile builds (Tauri mobile entry point)', () => {
    const cargo = read('src-tauri/Cargo.toml');
    expect(cargo).toMatch(/\[lib\]/);
    expect(cargo).toMatch(/crate-type\s*=\s*\[[^\]]*"staticlib"/);
    expect(read('src-tauri/src/lib.rs')).toContain('mobile_entry_point');
    expect(read('src-tauri/src/main.rs')).toContain('omnica_lib::run()');
  });

  it('points the wrapper at an HTTPS host and a root scope', () => {
    expect(twa.startUrl).toBe('/');
    expect(twa.iconUrl).toMatch(/^https:\/\/.+\/icons\/icon-512\.png$/);
    expect(read('store/android/README.md')).toMatch(/REPLACE-WITH-YOUR-DEPLOYED-HOST/);
  });
});

describe('store paperwork is in place', () => {
  it('documents every store the project claims to support', () => {
    const guide = read('docs/STORES.md');
    for (const store of [
      'Google Play',
      'Apple App Store',
      'Microsoft Store',
      'F-Droid',
      'Amazon Appstore',
      'Samsung Galaxy Store',
      'Huawei AppGallery',
      'Snap',
      'Flathub',
      'Homebrew',
      'Winget',
    ]) {
      expect(guide, `docs/STORES.md does not mention ${store}`).toContain(store);
    }
  });

  it('keeps the listing copy inside the stores’ limits', () => {
    const listing = read('docs/STORE_LISTING.md');
    const blocks = [...listing.matchAll(/```\n([\s\S]*?)```/g)].map((match) => match[1]!.trim());
    const [name, short, full] = blocks;
    expect(name!.length).toBeLessThanOrEqual(30);
    expect(short!.length).toBeLessThanOrEqual(80);
    expect(full!.length).toBeLessThanOrEqual(4000);
    expect(full).toContain('no ads');
    expect(listing).toContain('No data collected');
  });

  it('publishes a privacy policy that matches the app (no collection)', () => {
    const privacy = read('PRIVACY.md');
    expect(privacy).toMatch(/collects nothing/i);
    expect(privacy).toMatch(/no analytics/i);
    expect(exists('public/privacy.html')).toBe(true);
    expect(read('public/privacy.html')).not.toMatch(/<script/i);
  });
});
