import type { ThemeMode } from '@/settings/types';

/** Accent palette offered in Settings. All free, no branding constraints. */
export interface AccentPreset {
  id: string;
  label: string;
  value: string;
}

/**
 * "Use the palette's own accent colour" (the default). The theme only applies an
 * accent override for a valid hex value that differs from the palette's own, so
 * any non-colour value is a sentinel — an empty string is the explicit one.
 */
export const PALETTE_ACCENT = '';

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { id: 'indigo', label: 'Indigo', value: '#6366f1' },
  { id: 'sky', label: 'Sky', value: '#0ea5e9' },
  { id: 'emerald', label: 'Emerald', value: '#10b981' },
  { id: 'amber', label: 'Amber', value: '#f59e0b' },
  { id: 'rose', label: 'Rose', value: '#ef4444' },
  { id: 'pink', label: 'Pink', value: '#ec4899' },
  { id: 'violet', label: 'Violet', value: '#8b5cf6' },
  { id: 'slate', label: 'Slate', value: '#64748b' },
];

export const THEME_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export type ContrastMode = 'normal' | 'high';

export const CONTRAST_OPTIONS: readonly { value: ContrastMode; label: string }[] = [
  { value: 'normal', label: 'Standard contrast' },
  { value: 'high', label: 'High contrast (WCAG AAA)' },
];

export function isAccentPreset(value: string): boolean {
  return ACCENT_PRESETS.some((preset) => preset.value.toLowerCase() === value.toLowerCase());
}

/** Validates a CSS colour so a hand-typed value can never break the theme. */
/** True when the string is a safe 6-digit hex colour. */
export function isHexColour(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

export function normaliseAccent(value: string, fallback = '#6366f1'): string {
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed.toLowerCase() : fallback;
}

export function nextThemeMode(current: ThemeMode): ThemeMode {
  if (current === 'system') return 'light';
  return current === 'light' ? 'dark' : 'system';
}
