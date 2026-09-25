import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProgrammerPanel } from './ProgrammerPanel';

const set = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('programmer panel', () => {
  it('shows the value in every base at once', () => {
    render(<ProgrammerPanel />);
    set('Integer input', '255');
    expect(screen.getAllByText('255').length).toBeGreaterThan(0);
    expect(screen.getByText('0xFF')).toBeTruthy();
    expect(screen.getByText('0o377')).toBeTruthy();
  });

  it('switches the input base so hex digits can be typed', () => {
    render(<ProgrammerPanel />);
    set('Input base', '16');
    set('Integer input', 'f');
    expect(screen.getByText('0xF')).toBeTruthy();
  });

  it('adds integers on the keypad', () => {
    render(<ProgrammerPanel />);
    const input = screen.getByLabelText('Integer input') as HTMLInputElement;
    set('Integer input', '0');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(input.value).toBe('12');
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    set('Integer input', '5');
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }));
    expect(input.value).toBe('17');
  });

  it('wraps results to the selected width and says so', () => {
    render(<ProgrammerPanel />);
    set('Bit width', '8');
    set('Integer input', '200');
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    set('Integer input', '100');
    fireEvent.click(screen.getByRole('button', { name: 'Evaluate' }));
    // 200 + 100 = 300 wraps to 44 at 8 bits, and the panel says so.
    expect((screen.getByLabelText('Integer input') as HTMLInputElement).value).toBe('44');
    expect(screen.getByText(/did not fit in 8 bits/)).toBeTruthy();
  });

  it('applies bitwise operations to the accumulator', () => {
    render(<ProgrammerPanel />);
    set('Integer input', '240');
    set('Bitwise operand', '15');
    fireEvent.change(screen.getByLabelText('Bitwise operation'), { target: { value: 'or' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect((screen.getByLabelText('Integer input') as HTMLInputElement).value).toBe('255');
  });

  it('clears back to zero', () => {
    render(<ProgrammerPanel />);
    set('Integer input', '1234');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect((screen.getByLabelText('Integer input') as HTMLInputElement).value).toBe('0');
  });
});
