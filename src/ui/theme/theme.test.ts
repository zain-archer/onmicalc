import { describe, expect, it, beforeEach } from 'vitest';
import { applyTheme, resolveTheme } from './theme';
import { ACCENT_PRESETS, CONTRAST_OPTIONS, nextThemeMode, normaliseAccent, isAccentPreset } from './presets';

describe('theme presets', () => {
  it('offers a free accent palette with unique ids', () => {
    expect(ACCENT_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ACCENT_PRESETS.map((preset) => preset.id)).size).toBe(ACCENT_PRESETS.length);
    expect(ACCENT_PRESETS.every((preset) => /^#[0-9a-f]{6}$/i.test(preset.value))).toBe(true);
  });

  it('validates accent values so a bad colour cannot break the theme', () => {
    expect(normaliseAccent('#ABCDEF')).toBe('#abcdef');
    expect(normaliseAccent('  #123456  ')).toBe('#123456');
    expect(normaliseAccent('red; drop table')).toBe('#6366f1');
    expect(normaliseAccent('')).toBe('#6366f1');
    expect(isAccentPreset('#6366f1')).toBe(true);
    expect(isAccentPreset('#123456')).toBe(false);
  });

  it('documents the contrast options', () => {
    expect(CONTRAST_OPTIONS.map((option) => option.value)).toEqual(['normal', 'high']);
  });

  it('cycles theme modes', () => {
    expect(nextThemeMode('system')).toBe('light');
    expect(nextThemeMode('light')).toBe('dark');
    expect(nextThemeMode('dark')).toBe('system');
  });
});

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-contrast');
    document.documentElement.removeAttribute('data-motion');
    document.documentElement.style.removeProperty('--accent');
  });

  it('writes theme, accent, contrast and motion to the document root', () => {
    applyTheme('dark', '#10b981', { contrast: 'high', reducedMotion: true });
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.contrast).toBe('high');
    expect(root.dataset.motion).toBe('reduced');
    expect(root.style.getPropertyValue('--accent')).toBe('#10b981');
  });

  it('defaults to normal contrast, full motion and the palette accent', () => {
    applyTheme('light', 'not-a-colour');
    const root = document.documentElement;
    expect(root.dataset.contrast).toBe('normal');
    expect(root.dataset.motion).toBe('full');
    // No inline accent: the palette's own colour from the stylesheet is used.
    expect(root.style.getPropertyValue('--accent')).toBe('');
    expect(root.dataset.palette).toBe('classic');
  });

  it('applies a custom accent only when one is set', () => {
    applyTheme('dark', '#123456', { palette: 'ocean' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456');
    // Setting the palette's own colour back to normal removes the override.
    applyTheme('dark', '', { palette: 'ocean' });
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('');
  });

  it('resolves the system theme through the media query', () => {
    expect(['light', 'dark']).toContain(resolveTheme('system'));
    expect(resolveTheme('dark')).toBe('dark');
  });
});
