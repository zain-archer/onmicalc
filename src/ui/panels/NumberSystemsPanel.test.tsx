import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NumberSystemsPanel } from './NumberSystemsPanel';

const setField = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('number systems panel', () => {
  it('converts between bases exactly', () => {
    render(<NumberSystemsPanel />);
    setField(/^Value/, '255');
    setField('To base', '2');
    expect(screen.getAllByText('11111111').length).toBeGreaterThan(0);
    setField('To base', '16');
    expect(screen.getAllByText('FF').length).toBeGreaterThan(0);
  });

  it('handles the full unsigned 64-bit range without rounding', () => {
    render(<NumberSystemsPanel />);
    setField(/^Value/, '18446744073709551615');
    setField('To base', '16');
    expect(screen.getAllByText('FFFFFFFFFFFFFFFF').length).toBeGreaterThan(0);
  });

  it('explains invalid digits instead of guessing', () => {
    render(<NumberSystemsPanel />);
    setField('From base', '2');
    setField(/^Value/, '12');
    expect(screen.getByText(/not a valid base-2 whole number/i)).toBeTruthy();
  });

  it('applies bitwise operations at the chosen width', () => {
    render(<NumberSystemsPanel />);
    setField(/^Operand A/, '240');
    setField(/^Operand B/, '15');
    setField('Operation', 'or');
    expect(screen.getByText('255')).toBeTruthy();
    setField('Operation', 'not');
    setField('Bit width', '16');
    expect(screen.getByText('65295')).toBeTruthy();
  });

  it('reports shift errors', () => {
    render(<NumberSystemsPanel />);
    setField('Operation', 'shl');
    setField(/^Operand B/, '100');
    expect(screen.getByText(/shift amount is larger/i)).toBeTruthy();
  });
});
