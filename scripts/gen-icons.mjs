/**
 * Generates PWA icons without any image dependency.
 * The artwork lives in `scripts/icon-art.mjs`, shared with the store assets.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcon } from './icon-art.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

mkdirSync(outDir, { recursive: true });
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(outDir, name), renderIcon(size, opts));
  console.log(`icons: wrote ${name} (${size}px)`);
}
