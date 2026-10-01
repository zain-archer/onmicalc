import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CalculusPanel } from './CalculusPanel';
import { settingsStore } from '@/settings/store';

beforeEach(() => {
  settingsStore.reset();
});

const field = (label: string) => screen.getByLabelText(new RegExp(label, 'i')) as HTMLInputElement;
/** The values rendered in the results list, in order. */
const outputValues = () =>
  [...document.querySelectorAll('.output__value')].map((node) => node.textContent?.trim() ?? '');
const setField = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

/** Opens the Limits tab. */
const openLimits = () => fireEvent.click(screen.getByRole('tab', { name: 'Limits' }));

describe('calculus panel', () => {
  it('differentiates and integrates with the range the user typed', () => {
    render(<CalculusPanel />);
    setField('Function', 'x^2');
    setField('Evaluate at', '3');
    // d/dx x² at x = 3 is 6; the value lives in the results list.
    expect(outputValues().some((value) => value.startsWith('6'))).toBe(true);
  });

  it('estimates a finite limit', () => {
    render(<CalculusPanel />);
    openLimits();
    setField('Function', 'sin(x)/x');
    setField('Approach x', '0');
    expect(document.body.textContent).toMatch(/two-sided/i);
  });

  /**
   * Regression: limits at infinity were implemented in the symbolic engine but
   * no UI could reach them — the limit tool only accepted a number, and the
   * intent layer only matched digits. "lim x → ∞" is a standard question, so the
   * field now takes the word "infinity" (or ∞).
   */
  describe('limits at infinity', () => {
    it('accepts the word infinity and returns an exact rational limit', () => {
      render(<CalculusPanel />);
      openLimits();
      setField('Function', '(2x^2+3x)/(x^2-1)');
      setField('Approach x', 'infinity');
      expect(screen.getByText(/x → \+∞/)).toBeTruthy();
      expect(outputValues()).toContain('2');
      expect(screen.getByText(/lim f\(x\) as x → \+∞/)).toBeTruthy();
      expect(screen.getByText(/exact/i)).toBeTruthy();
    });

    it('accepts the ∞ symbol and a negative direction', () => {
      render(<CalculusPanel />);
      openLimits();
      setField('Function', '1/x');
      setField('Approach x', '∞');
      expect(screen.getByText(/x → \+∞/)).toBeTruthy();
      setField('Approach x', '-infinity');
      expect(screen.getByText(/x → −∞/)).toBeTruthy();
    });

    it('gets a transcendental limit right instead of an approximation', () => {
      render(<CalculusPanel />);
      openLimits();
      setField('Function', 'atan(x)');
      setField('Approach x', 'inf');
      // π/2 = 1.57079632679 — the substitution estimator is good to ~1e-14.
      expect(outputValues().some((value) => value.startsWith('1.57079632679'))).toBe(true);
    });

    it('refuses to guess when the tail never settles', () => {
      render(<CalculusPanel />);
      openLimits();
      setField('Function', 'sin(x)/x');
      setField('Approach x', 'infinity');
      // sin(x)/x does tend to 0, but the estimator must not invent a value when
      // it cannot bound the error; either an honest answer or an honest refusal.
      const text = document.body.textContent ?? '';
      expect(text).toMatch(/could not be determined/i);
      expect(text).toMatch(/does not settle/i);
    });

    it('tells the user when the limit diverges', () => {
      render(<CalculusPanel />);
      openLimits();
      setField('Function', 'x^2');
      setField('Approach x', '-infinity');
      expect(document.body.textContent).toMatch(/diverge/i);
    });
  });

  it('explains an unparseable function instead of showing a number', () => {
    render(<CalculusPanel />);
    setField('Function', 'foo(x)');
    expect(screen.getByRole('alert').textContent).toMatch(/unknown function/i);
  });
});
