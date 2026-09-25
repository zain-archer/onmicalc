/**
 * Generates src/styles/themes.css from src/ui/theme/palettes.json.
 *
 * Keeping the palettes in one data file means the app, the pre-paint boot script
 * and the settings UI can never disagree, and there is no flash of the wrong
 * theme: the CSS is present before React runs. `npm run themes:check` (and the
 * theme test) fails if the file is stale.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(fileURLToPath(new URL('src/ui/theme/palettes.json', root)), 'utf8'));

const VAR = {
  bg: '--bg',
  bgElev: '--bg-elev',
  bgInset: '--bg-inset',
  border: '--border',
  text: '--text',
  textDim: '--text-dim',
  accent: '--accent',
  ok: '--ok',
  warn: '--warn',
  danger: '--danger',
  shadow: '--shadow',
};

export function renderThemesCss(palettes = data) {
  const lines = [
    '/* GENERATED FILE — do not edit by hand.',
    ' * Source: src/ui/theme/palettes.json   Generator: scripts/gen-themes.mjs',
    ' * Run `npm run themes` after changing a palette.',
    ' */',
    '',
    ':root {',
    '  --palette: classic;',
    '}',
    '',
  ];
  for (const pack of palettes.packs) {
    for (const kind of ['light', 'dark']) {
      const palette = pack[kind];
      lines.push(`/* ${pack.label} — ${kind} */`);
      lines.push(`:root[data-palette='${pack.id}'][data-theme='${kind}'] {`);
      for (const [key, variable] of Object.entries(VAR)) {
        if (palette[key]) lines.push(`  ${variable}: ${palette[key]};`);
      }
      lines.push('}');
      lines.push('');
    }
  }
  return lines.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('gen-themes.mjs')) {
  const target = fileURLToPath(new URL('src/styles/themes.css', root));
  const css = renderThemesCss();
  const check = process.argv.includes('--check');
  const current = (() => {
    try {
      return readFileSync(target, 'utf8');
    } catch {
      return '';
    }
  })();
  if (check) {
    if (current !== css) {
      console.error('src/styles/themes.css is out of date — run `npm run themes`.');
      process.exit(1);
    }
    console.log(`themes: ${data.packs.length} palettes in sync`);
  } else {
    writeFileSync(target, css);
    console.log(`themes: wrote ${data.packs.length * 2} palettes as ${data.packs.length} packs`);
  }
}
