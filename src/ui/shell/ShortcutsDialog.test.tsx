import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShortcutsDialog } from './ShortcutsDialog';

describe('shortcuts dialog', () => {
  it('is hidden until opened', () => {
    render(<ShortcutsDialog open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists the shortcuts grouped by area', () => {
    render(<ShortcutsDialog open onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeTruthy();
    expect(screen.getAllByText('Open the command palette').length).toBeGreaterThan(0);
    expect(screen.getByText('Zoom in on the plot')).toBeTruthy();
  });

  it('closes from the button', () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
