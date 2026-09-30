import { describe, expect, it } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { TOOLS } from '@/ui/tools';

describe('app shell', () => {
  it('opens the Home panel by default', async () => {
    window.location.hash = '';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /Home/ })).toBeTruthy();
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });

  it('still reaches the keypad in one click', () => {
    window.location.hash = '#/calculator';
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /Calculator/ })).toBeTruthy();
    expect(screen.getByLabelText('Expression')).toBeTruthy();
    // The angle mode is always visible.
    expect(screen.getByRole('group', { name: 'Angle mode' })).toBeTruthy();
  });

  it('never renders a link to an unimplemented tool', () => {
    render(<App />);
    const labels = screen.getAllByRole('button').map((btn) => btn.textContent ?? '');
    for (const tool of TOOLS.filter((entry) => entry.status === 'planned')) {
      expect(labels.some((label) => label.includes(tool.label)), `${tool.label} should be hidden`).toBe(false);
    }

    // New intent-based navigation: groups are visible, sub-tools expandable, full list in Tools panel
    expect(labels.some((label) => label.includes('Home'))).toBe(true);
    expect(labels.some((label) => label.includes('Calculate'))).toBe(true);
    expect(labels.some((label) => label.includes('Graph'))).toBe(true);
    expect(labels.some((label) => label.includes('Tools'))).toBe(true);
    expect(labels.some((label) => label.includes('Settings'))).toBe(true);
  });
});

describe('shell shortcuts', () => {
  it('opens the command palette with Ctrl+K and closes it with Escape', () => {
    window.location.hash = '#/calculator';
    render(<App />);
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
  });

  it('navigates from the palette', async () => {
    window.location.hash = '#/calculator';
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByLabelText('Search commands'), { target: { value: 'finance' } });
    fireEvent.keyDown(screen.getByLabelText('Search commands'), { key: 'Enter' });
    expect(window.location.hash).toBe('#/finance');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Finance/ })).toBeTruthy();
    });
  });

  it('shows the shortcut list from the top bar', () => {
    window.location.hash = '#/calculator';
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
  });
});
