import type { AngleMode } from '@/core/numbers/angle';

export type ThemeMode = 'light' | 'dark' | 'system';
export type NumberFormat = 'auto' | 'scientific' | 'engineering';
export type FractionMode = 'auto' | 'decimal' | 'fraction';

export interface Settings {
  theme: ThemeMode;
  accent: string;
  angleMode: AngleMode;
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
  accent: '#6366f1',
  angleMode: 'DEG',
  precision: 12,
  numberFormat: 'auto',
  fractionMode: 'auto',
  thousandsSeparator: true,
  persistHistory: true,
  reducedMotion: false,
  contrast: 'normal',
};
