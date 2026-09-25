/**
 * Generates PWA icons without any image dependency.
 * Writes uncompressed-filter PNGs (RGBA) using zlib.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => Math.round(a + (b - a) * t);

function roundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function circle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) <= r;
}

/** Draws the OmniCalc mark: gradient tile with a display bar and keypad dots. */
function render(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 3; // supersampling for smooth edges
  const pad = maskable ? 0.26 : 0.14; // maskable art stays inside the safe zone
  const inner = 1 - pad * 2;
  const cornerR = maskable ? 0 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const insideTile = maskable
            ? true
            : roundRect(px, py, 0, 0, size, size, cornerR) ||
              (px >= 0 && py >= 0 && px <= size && py <= size && px > cornerR && py > cornerR);
          if (!insideTile) continue;

          const t = (px + py) / (2 * size);
          let cr = mix(99, 34, t);
          let cg = mix(102, 211, t);
          let cb = mix(241, 238, t);

          // Content coordinates in a 0..1 box.
          const ux = (px / size - pad) / inner;
          const uy = (py / size - pad) / inner;
          let paint = false;
          if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1) {
            if (roundRect(ux, uy, 0.03, 0.07, 0.97, 0.24, 0.085)) paint = true;
            for (const cx of [0.19, 0.5, 0.81]) {
              for (const cy of [0.45, 0.7, 0.94]) {
                if (circle(ux, uy, cx, cy, 0.082)) paint = true;
              }
            }
          }
          if (paint) {
            cr = 255;
            cg = 255;
            cb = 255;
          }
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }
      const n = ss * ss;
      const i = (y * size + x) * 4;
      const alpha = a / n; // 0..255 coverage
      if (alpha > 0) {
        rgba[i] = Math.round(r / (a / 255 || 1));
        rgba[i + 1] = Math.round(g / (a / 255 || 1));
        rgba[i + 2] = Math.round(b / (a / 255 || 1));
      }
      rgba[i + 3] = Math.round(alpha);
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(outDir, { recursive: true });
const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-512-maskable.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, {}],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(outDir, name), render(size, opts));
  console.log(`icons: wrote ${name} (${size}px)`);
}
