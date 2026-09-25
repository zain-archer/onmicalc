import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE_ID, PALETTE_PACKS, paletteById, paletteColors, paletteSwatchStyle } from './palettes';
import { applyTheme, resolveTheme } from './theme';
import { settingsStore } from '@/settings/store';

// Read the generated file through Node, resolved from the project root, so the
// check works the same in jsdom and in CI.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(process.cwd(), 'src/styles/themes.css'), 'utf8');

describe('theme gallery', () => {
  it('ships a good spread of palettes, all unique', () => {
    expect(PALETTE_PACKS.length).toBeGreaterThanOrEqual(10);
    const ids = PALETTE_PACKS.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = PALETTE_PACKS.map((pack) => pack.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const pack of PALETTE_PACKS) {
      expect(pack.description.length).toBeGreaterThan(10);
      expect(pack.tags.length).toBeGreaterThan(0);
    }
  });

  it('has at least five widely liked palettes and a high-contrast one', () => {
    expect(PALETTE_PACKS.filter((pack) => pack.tags.includes('popular')).length).toBeGreaterThanOrEqual(5);
    expect(PALETTE_PACKS.some((pack) => pack.tags.includes('accessibility'))).toBe(true);
  });

  it('defines every colour for both modes of every palette', () => {
    const keys = Object.keys(PALETTE_PACKS[0]!.light);
    for (const pack of PALETTE_PACKS) {
      for (const mode of ['light', 'dark'] as const) {
        for (const key of keys) {
          const value = (pack[mode] as unknown as Record<string, string>)[key];
          expect(value, `${pack.id}.${mode}.${key}`).toBeTruthy();
        }
      }
    }
  });

  it('generated stylesheet matches the data (no drift, no flash)', () => {
    for (const pack of PALETTE_PACKS) {
      for (const mode of ['light', 'dark'] as const) {
        const block = `:root[data-palette='${pack.id}'][data-theme='${mode}']`;
        expect(css).toContain(block);
        expect(css).toContain(`${block} {\n  --bg: ${pack[mode].bg};`);
        expect(css).toContain(`--accent: ${pack[mode].accent};`);
      }
    }
    expect(css).toContain('--palette: classic;');
  });

  it('falls back safely for unknown ids', () => {
    expect(paletteById('nope').id).toBe(DEFAULT_PALETTE_ID);
    expect(paletteById(undefined).id).toBe(DEFAULT_PALETTE_ID);
    expect(paletteColors('nope', 'dark')).toEqual(PALETTE_PACKS[0]!.dark);
  });

  it('applies the palette to the document root', () => {
    applyTheme('dark', '', { palette: 'dracula' });
    expect(document.documentElement.dataset.palette).toBe('dracula');
    expect(document.documentElement.dataset.theme).toBe('dark');

    // A palette accent needs no inline override…
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');

    // …but a custom accent does, and an unknown palette falls back.
    applyTheme('light', '#ff00aa', { palette: 'nope' });
    expect(document.documentElement.dataset.palette).toBe(DEFAULT_PALETTE_ID);
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ff00aa');
  });

  it('builds an inline swatch for both modes', () => {
    const dark = paletteSwatchStyle('nord', 'dark', true);
    const light = paletteSwatchStyle('nord', 'system', false);
    expect(dark.background).toBe(paletteById('nord').dark.bgElev);
    expect(light.background).toBe(paletteById('nord').light.bgElev);
    expect(dark['--swatch-accent']).toBe(paletteById('nord').dark.accent);
  });

  it('stores the choice so the next visit keeps it', () => {
    settingsStore.reset();
    settingsStore.set({ palette: 'sepia' });
    expect(settingsStore.get().palette).toBe('sepia');
    applyTheme(settingsStore.get().theme, settingsStore.get().accent, { palette: settingsStore.get().palette });
    expect(document.documentElement.dataset.palette).toBe('sepia');
    expect(['light', 'dark']).toContain(resolveTheme(settingsStore.get().theme));
  });
});
