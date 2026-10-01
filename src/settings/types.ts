import type { AngleMode } from '@/core/numbers/angle';

export type ThemeMode = 'light' | 'dark' | 'system';
export type NumberFormat = 'auto' | 'scientific' | 'engineering';
export type FractionMode = 'auto' | 'decimal' | 'fraction';
export type PercentSetting = 'contextual' | 'strict';

export interface Settings {
  theme: ThemeMode;
  /** Palette pack id (see `src/ui/theme/palettes.json`). */
  palette: string;
  accent: string;
  angleMode: AngleMode;
  /** `200 + 10%` → 220 (contextual) or 200.1 (strict). */
  percentMode: PercentSetting;
  /** Significant digits used when formatting results. */
  precision: number;
  numberFormat: NumberFormat;
  fractionMode: FractionMode;
  thousandsSeparator: boolean;
  /** Keep history entries after a reload. */
  persistHistory: boolean;
  reducedMotion: boolean;
  /** Extra border/text contrast for low-vision use. */
  contrast: 'normal' | 'high';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  palette: 'classic',
  accent: '#6366f1',
  angleMode: 'DEG',
  percentMode: 'contextual',
  precision: 12,
  numberFormat: 'auto',
  fractionMode: 'auto',
  thousandsSeparator: true,
  persistHistory: true,
  reducedMotion: false,
  contrast: 'normal',
};
