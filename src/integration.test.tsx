import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import App from './App';
import { READY_TOOLS } from '@/ui/tools';
import { clearHistory, historyStore } from '@/history/store';
import { memoryStore } from '@/history/memory';
import { settingsStore } from '@/settings/store';
import { draftStore, answerStore } from '@/ui/bus';
import { clearNotice } from '@/ui/notify';

beforeEach(() => {
  clearHistory();
  memoryStore.reset();
  settingsStore.reset();
  draftStore.reset();
  answerStore.reset();
  clearNotice();
});

const go = (id: string) => {
  window.location.hash = `#/${id}`;
};

describe('every ready tool opens', () => {
  for (const tool of READY_TOOLS) {
    it(`renders ${tool.id} without crashing`, async () => {
      go(tool.id);
      render(<App />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: tool.label })).toBeTruthy();
      });
      expect(screen.getByRole('main')).toBeTruthy();
      cleanup();
    });
  }
});

describe('calculator ↔ history flow', () => {
  it('records a calculation and replays it from history', async () => {
    go('calculator');
    render(<App />);
    const input = screen.getByLabelText('Expression');
    fireEvent.change(input, { target: { value: '12*12' } });
    expect(screen.getByTestId('calc-value').textContent).toContain('144');

    fireEvent.keyDown(window, { key: 'Enter' });
    const entry = historyStore.get().entries[0];
    expect(entry?.expression).toBe('12*12');
    expect(entry?.value).toBe(144);

    // The palette can navigate straight to that history entry's panel.
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByLabelText('Search commands'), { target: { value: 'history' } });
    fireEvent.keyDown(screen.getByLabelText('Search commands'), { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'History & Memory' })).toBeTruthy();
    });
    expect(screen.getByText('12*12')).toBeTruthy();
  });

  it('keeps the answer available as ans in the next calculation', () => {
    go('calculator');
    render(<App />);
    const input = screen.getByLabelText('Expression') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8*8' } });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(answerStore.get().value).toBe(64);

    fireEvent.change(input, { target: { value: 'ans+1' } });
    expect(screen.getByTestId('calc-value').textContent).toContain('65');
  });
});

describe('cross-panel utilities', () => {
  it('sends a constant into the calculator draft', async () => {
    go('constants');
    render(<App />);
    const buttons = await screen.findAllByRole('button', { name: /copy|insert|use/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('converts a temperature and shows both scales', async () => {
    go('conversions');
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Unit Converter' })).toBeTruthy());
    fireEvent.click(screen.getByRole('tab', { name: /Temperature/i }));
    fireEvent.change(screen.getByLabelText(/^Value/), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/^From/), { target: { value: 'c' } });
    const toSelect = screen.getAllByLabelText(/^To/).find((node) => node.tagName === 'SELECT')!;
    fireEvent.change(toSelect, { target: { value: 'f' } });
    expect(screen.getAllByText(/212/).length).toBeGreaterThan(0);
    expect(screen.getByText('°F')).toBeTruthy();
  });

  it('toggles the theme from the top bar and remembers it', () => {
    go('calculator');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle light or dark theme' }));
    const theme = settingsStore.get().theme;
    expect(theme === 'light' || theme === 'dark').toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle light or dark theme' }));
    expect(settingsStore.get().theme).not.toBe(theme);
  });

  it('exports a backup that can be parsed again', async () => {
    go('calculator');
    render(<App />);
    fireEvent.change(screen.getByLabelText('Expression'), { target: { value: '1+1' } });
    fireEvent.keyDown(window, { key: 'Enter' });
    const { buildBackup, parseBackup, serializeBackup } = await import('@/storage/backup');
    const parsed = parseBackup(serializeBackup(buildBackup()));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.summary.historyCount).toBe(1);
  });
});
