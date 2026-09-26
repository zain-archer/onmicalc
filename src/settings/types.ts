import type { AngleMode } from '@/core/numbers/angle';

export type ThemeMode = 'light' | 'dark' | 'system';
export type NumberFormat = 'auto' | 'scientific' | 'engineering';
export type FractionMode = 'auto' | 'decimal' | 'fraction';

export interface Settings {
  theme: ThemeMode;
  /** Palette pack id (see `src/ui/theme/palettes.json`). */
  palette: string;
  accent: string;
  angleMode: AngleMode;
  /** Significant digits used when formatting results. */
  precision: number;
  numberFormat: NumberFormat;
  fractionMode: FractionMode;
  thousandsSeparator: boolean;
  reducedMotion: boolean;
  /** Extra border/text contrast for low-vision use. */
  contrast: 'normal' | 'high';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  palette: 'classic',
  // Empty means “use the selected palette’s own accent colour”.
  accent: '',
  angleMode: 'DEG',
  precision: 12,
  numberFormat: 'auto',
  fractionMode: 'auto',
  thousandsSeparator: true,
  reducedMotion: false,
  contrast: 'normal',
};
