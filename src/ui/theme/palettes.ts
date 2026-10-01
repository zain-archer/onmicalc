/**
 * Typed access to the palette data (see `palettes.json`, generated into
 * `src/styles/themes.css` by `scripts/gen-themes.mjs`).
 *
 * A "theme" here is a *palette pack*: one light and one dark rendition of the
 * same look. The user picks a palette (or "match system"), and the existing
 * light/dark toggle still works on top of it, so every pack gives two themes.
 */

import data from './palettes.json';
import type { ThemeMode } from '@/settings/types';

export interface Palette {
  bg: string;
  bgElev: string;
  bgInset: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  ok: string;
  warn: string;
  danger: string;
  shadow: string;
}

export interface PalettePack {
  id: string;
  label: string;
  description: string;
  /** 'popular' palettes are shown first, 'accessibility' gets a badge. */
  tags: string[];
  light: Palette;
  dark: Palette;
}

export const PALETTE_PACKS: readonly PalettePack[] = data.packs as PalettePack[];
export const DEFAULT_PALETTE_ID = 'classic';

export function paletteById(id: string | undefined): PalettePack {
  return PALETTE_PACKS.find((pack) => pack.id === id) ?? PALETTE_PACKS[0]!;
}

export function isPaletteId(id: string): boolean {
  return PALETTE_PACKS.some((pack) => pack.id === id);
}

/** Resolved colours for a pack in the given (already resolved) mode. */
export function paletteColors(id: string, resolved: 'light' | 'dark'): Palette {
  const pack = paletteById(id);
  return resolved === 'dark' ? pack.dark : pack.light;
}

/** Inline style object for preview swatches — no CSS class needed per pack. */
export function paletteSwatchStyle(id: string, mode: ThemeMode, prefersDark: boolean): Record<string, string> {
  const resolved = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;
  const palette = paletteColors(id, resolved);
  return {
    background: palette.bgElev,
    borderColor: palette.border,
    color: palette.text,
    '--swatch-accent': palette.accent,
    '--swatch-inset': palette.bgInset,
    '--swatch-dim': palette.textDim,
  };
}
