import { settingsStore } from '@/settings/store';
import type { ThemeMode } from '@/settings/types';
import { isHexColour, normaliseAccent, type ContrastMode } from './presets';
import { DEFAULT_PALETTE_ID, isPaletteId, paletteColors } from './palettes';

export interface ThemeOptions {
  contrast?: ContrastMode;
  reducedMotion?: boolean;
}

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode;
}

/** Apply palette, theme, accent colour, contrast level and motion preference. */
export function applyTheme(
  theme: ThemeMode,
  accent: string,
  options: ThemeOptions & { palette?: string } = {},
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const paletteId = options.palette && isPaletteId(options.palette) ? options.palette : DEFAULT_PALETTE_ID;
  const resolved = resolveTheme(theme);
  root.dataset.palette = paletteId;
  root.dataset.theme = resolved;
  // The accent is only overridden when the user picked a custom colour: every
  // palette ships its own accent, and the stylesheet wins by default.
  const palette = paletteColors(paletteId, resolved);
  root.style.removeProperty('--accent');
  // Only a valid hex that differs from the palette's own accent is an override;
  // anything else (empty or malformed) means "use the palette colour".
  if (isHexColour(accent) && accent.trim().toLowerCase() !== palette.accent.toLowerCase()) {
    root.style.setProperty('--accent', normaliseAccent(accent, palette.accent));
  }
  root.dataset.contrast = options.contrast === 'high' ? 'high' : 'normal';
  root.dataset.motion = options.reducedMotion ? 'reduced' : 'full';

  // Mobile browser chrome / OS status bar follow the palette so the app looks
  // installed rather than embedded. Keeps the manifest's default as fallback.
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', palette.bg);
  root.style.backgroundColor = palette.bg;
}

/** Wire the settings store to the DOM. Returns an unsubscribe function. */
export function initTheme(): () => void {
  const sync = () => {
    const { theme, accent, contrast, reducedMotion, palette } = settingsStore.get();
    applyTheme(theme, accent, { contrast, reducedMotion, palette: palette ?? DEFAULT_PALETTE_ID });
  };
  sync();
  const unsubscribe = settingsStore.subscribe(sync);
  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const onMediaChange = () => {
    if (settingsStore.get().theme === 'system') sync();
  };
  media?.addEventListener('change', onMediaChange);
  return () => {
    unsubscribe();
    media?.removeEventListener('change', onMediaChange);
  };
}
