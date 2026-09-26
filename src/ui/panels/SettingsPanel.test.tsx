import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel';
import { settingsStore } from '@/settings/store';
import { DEFAULT_SETTINGS } from '@/settings/types';

beforeEach(() => {
  settingsStore.reset();
});

describe('settings panel', () => {
  it('picks a palette from the compact appearance controls', () => {
    render(<SettingsPanel />);
    fireEvent.change(screen.getByRole('combobox', { name: /^Colour palette/ }), { target: { value: 'dracula' } });
    expect(settingsStore.get().palette).toBe('dracula');
    expect(screen.getByTestId('theme-current').textContent).toMatch(/Dracula/);
  });

  it('keeps the palette list and accessibility choice available without a gallery', () => {
    render(<SettingsPanel />);
    const palette = screen.getByRole('combobox', { name: /^Colour palette/ }) as HTMLSelectElement;
    for (const label of ['Indigo', 'Solarized', 'Dracula', 'Nord', 'GitHub', 'Paper']) {
      expect([...palette.options].some((option) => option.textContent === label)).toBe(true);
    }
    expect(screen.getByRole('option', { name: 'High contrast (WCAG AAA)' })).toBeTruthy();
  });

  it('changes the accent colour from the preset palette', () => {
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Accent Emerald/ }));
    expect(settingsStore.get().accent).toBe('#10b981');
  });

  it('accepts a custom accent colour', () => {
    render(<SettingsPanel />);
    fireEvent.change(screen.getByLabelText('Custom accent colour'), { target: { value: '#123456' } });
    expect(settingsStore.get().accent).toBe('#123456');
  });

  it('switches theme, contrast and motion preferences', () => {
    render(<SettingsPanel />);
    fireEvent.change(screen.getByLabelText('Light or dark'), { target: { value: 'dark' } });
    expect(settingsStore.get().theme).toBe('dark');

    fireEvent.change(screen.getByLabelText('Contrast'), { target: { value: 'high' } });
    expect(settingsStore.get().contrast).toBe('high');

    fireEvent.click(screen.getByLabelText('Reduce motion and transitions'));
    expect(settingsStore.get().reducedMotion).toBe(true);
  });

  it('restores defaults', () => {
    settingsStore.set({ precision: 4, accent: '#123456' });
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Reset settings/i }));
    expect(settingsStore.get()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('backup and export', () => {
  it('imports a backup file and reports what arrived', async () => {
    const { buildBackup, serializeBackup } = await import('@/storage/backup');
    const { historyStore: store } = await import('@/history/store');
    const text = serializeBackup({
      ...buildBackup(),
      history: [
        { id: 'a', expression: '6*7', display: '42', value: 42, at: 1, favorite: true },
      ],
    });
    render(<SettingsPanel />);
    fireEvent.change(screen.getByLabelText(/^Backup JSON/), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted backup' }));

    await waitFor(() => {
      expect(screen.getByText(/Imported 1 history entries/)).toBeTruthy();
    });
    expect(store.get().entries[0]?.expression).toBe('6*7');
  });

  it('explains a rejected file without touching existing data', async () => {
    const { historyStore: store } = await import('@/history/store');
    store.set({ entries: [] });
    render(<SettingsPanel />);
    fireEvent.change(screen.getByLabelText(/^Backup JSON/), { target: { value: '{"hello":true}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted backup' }));

    await waitFor(() => {
      expect(screen.getByText('This is not an OmniCalc backup file.')).toBeTruthy();
    });
    expect(store.get().entries).toHaveLength(0);
  });
});
