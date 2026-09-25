import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import type { CommandHandlers } from '@/ui/commands';

const makeHandlers = (): CommandHandlers => ({
  navigate: vi.fn(),
  toggleTheme: vi.fn(),
  setAngleMode: vi.fn(),
  clearDraft: vi.fn(),
  copyResult: vi.fn(),
  openShortcuts: vi.fn(),
});

describe('command palette', () => {
  it('renders nothing while closed', () => {
    render(<CommandPalette open={false} onClose={() => {}} handlers={makeHandlers()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('filters commands as the user types', () => {
    render(<CommandPalette open onClose={() => {}} handlers={makeHandlers()} />);
    const input = screen.getByLabelText('Search commands');
    fireEvent.change(input, { target: { value: 'plot' } });
    expect(screen.getByText('Graphing')).toBeTruthy();
    expect(screen.queryByText('Finance & Everyday')).toBeNull();
    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(screen.getByText(/No command matches/)).toBeTruthy();
  });

  it('runs the highlighted command on Enter', () => {
    const handlers = makeHandlers();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} handlers={handlers} />);
    const input = screen.getByLabelText('Search commands');
    fireEvent.change(input, { target: { value: 'unit converter' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handlers.navigate).toHaveBeenCalledWith('conversions');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves the highlight with the arrow keys and wraps', () => {
    const handlers = makeHandlers();
    render(<CommandPalette open onClose={() => {}} handlers={handlers} />);
    const input = screen.getByLabelText('Search commands');
    fireEvent.change(input, { target: { value: 'calculator' } });
    const first = screen.getByRole('option', { selected: true }).id;
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const second = screen.getByRole('option', { selected: true }).id;
    expect(second).not.toBe(first);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getByRole('option', { selected: true }).id).toBe(first);
  });

  it('closes on Escape and on a backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<CommandPalette open onClose={onClose} handlers={makeHandlers()} />);
    fireEvent.keyDown(screen.getByLabelText('Search commands'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.palette-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('runs a command when clicked', () => {
    const handlers = makeHandlers();
    render(<CommandPalette open onClose={() => {}} handlers={handlers} />);
    fireEvent.mouseDown(screen.getByText('Toggle light / dark theme'));
    expect(handlers.toggleTheme).toHaveBeenCalled();
  });
});
