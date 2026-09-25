/**
 * Store-ready icon assets, generated from the same artwork as the PWA icons.
 *
 *   npm run store:icons
 *
 * Writes:
 *   src-tauri/icons/*.png      Tauri desktop/mobile icon set (32/128/256/512)
 *   store/assets/play-icon.png       512×512, opaque tile for Google Play
 *   store/assets/appstore-icon.png   1024×1024, opaque tile for the App Store
 *   store/assets/maskable-512.png    maskable variant reused by Android wrappers
 *
 * `.ico` (Windows) and `.icns` (macOS) are not written here: run
 * `npx tauri icon store/assets/appstore-icon.png` to regenerate the full set
 * including those two, if you have the Tauri CLI available.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG, renderIcon } from './icon-art.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const tauri = join(root, 'src-tauri', 'icons');
const assets = join(root, 'store', 'assets');
mkdirSync(tauri, { recursive: true });
mkdirSync(assets, { recursive: true });

/**
 * 1024×500 feature graphic (Google Play listing): the same gradient and mark
 * scaled up, drawn without text so it needs no font.
 */
function renderFeatureGraphic(width = 1024, height = 500) {
  const rgba = Buffer.alloc(width * height * 4);
  const ss = 2;
  const mix = (a, b, t) => a + (b - a) * t;
  const insideRounded = (x, y, x0, y0, x1, y1, r) => {
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return Math.hypot(x - cx, y - cy) <= r;
  };
  const dot = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;

  // Mark box in the middle, keypad laid out inside it.
  const boxW = height * 0.56;
  const boxH = height * 0.56;
  const bx = (width - boxW) / 2;
  const by = (height - boxH) / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const t = (px + py) / (width + height);
          let cr = mix(99, 34, t);
          let cg = mix(102, 211, t);
          let cb = mix(241, 238, 0.7);

          let paint = false;
          if (insideRounded(px, py, bx, by, bx + boxW, by + boxH, boxW * 0.22)) {
            cr = 255;
            cg = 255;
            cb = 255;
            paint = true;
          }
          // Same layout as the app icon, scaled into the box.
          const ux = (px - bx) / boxW;
          const uy = (py - by) / boxH;
          if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1) {
            if (insideRounded(ux, uy, 0.11, 0.13, 0.89, 0.32, 0.095)) paint = 'dark';
            for (const cx of [0.24, 0.5, 0.76]) {
              for (const cy of [0.5, 0.7, 0.9]) {
                if (dot(ux, uy, cx, cy, 0.068)) paint = 'dark';
              }
            }
          }
          if (paint === 'dark') {
            cr = 30;
            cg = 41;
            cb = 90;
          }
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }
      const n = ss * ss;
      const i = (y * width + x) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(width, height, rgba);
}

const files = [
  [join(tauri, '32x32.png'), 32, {}],
  [join(tauri, '128x128.png'), 128, {}],
  [join(tauri, '128x128@2x.png'), 256, {}],
  [join(tauri, 'icon.png'), 512, {}],
  [join(assets, 'play-icon.png'), 512, { maskable: true }],
  [join(assets, 'appstore-icon.png'), 1024, { maskable: true }],
  [join(assets, 'maskable-512.png'), 512, { maskable: true }],
];

for (const [path, size, options] of files) {
  writeFileSync(path, renderIcon(size, options));
  console.log(`store: wrote ${path.slice(root.length + 1)} (${size}px)`);
}

const banner = join(assets, 'play-feature-graphic.png');
writeFileSync(banner, renderFeatureGraphic());
console.log(`store: wrote ${banner.slice(root.length + 1)} (1024x500)`);
