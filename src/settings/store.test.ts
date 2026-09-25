import { beforeEach, describe, expect, it } from 'vitest';
import { settingsStore, SETTINGS_KEY } from './store';
import { DEFAULT_SETTINGS } from './types';
import { readRaw } from '@/storage/local';

describe('settings store', () => {
  beforeEach(() => settingsStore.reset());

  it('starts from defaults', () => {
    expect(settingsStore.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges patches and notifies subscribers', () => {
    const seen: string[] = [];
    const off = settingsStore.subscribe((state) => seen.push(state.theme));
    settingsStore.set({ theme: 'dark' });
    settingsStore.set({ angleMode: 'RAD' });
    off();
    settingsStore.set({ theme: 'light' });
    expect(seen).toEqual(['dark', 'dark']);
    expect(settingsStore.get().angleMode).toBe('RAD');
    expect(settingsStore.get().theme).toBe('light');
  });

  it('persists to localStorage', () => {
    settingsStore.set({ precision: 6 });
    const raw = readRaw(SETTINGS_KEY);
    expect(raw).toContain('"precision":6');
  });
});
