import { settingsStore } from '@/settings/store';
import type { ThemeMode } from '@/settings/types';
import { normaliseAccent, type ContrastMode } from './presets';

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

/** Apply theme, accent colour, contrast level and motion preference to the root. */
export function applyTheme(theme: ThemeMode, accent: string, options: ThemeOptions = {}): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(theme);
  root.style.setProperty('--accent', normaliseAccent(accent));
  root.dataset.contrast = options.contrast === 'high' ? 'high' : 'normal';
  root.dataset.motion = options.reducedMotion ? 'reduced' : 'full';
}

/** Wire the settings store to the DOM. Returns an unsubscribe function. */
export function initTheme(): () => void {
  const sync = () => {
    const { theme, accent, contrast, reducedMotion } = settingsStore.get();
    applyTheme(theme, accent, { contrast, reducedMotion });
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
