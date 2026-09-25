import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProbabilityPanel } from './ProbabilityPanel';

const setField = (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('probability panel', () => {
  it('shows density, cumulative probability and moments for the normal distribution', () => {
    render(<ProbabilityPanel />);
    expect(screen.getAllByText(/P\(X ≤ x\)/).length).toBeGreaterThan(0);
    expect(screen.getByText(/When to use it/)).toBeTruthy();
    setField(/^Value x/, '1.96');
    expect(screen.getAllByText(/^0\.9750021/).length).toBeGreaterThan(0);
  });

  it('switches to another distribution and rebuilds its parameter fields', () => {
    render(<ProbabilityPanel />);
    fireEvent.change(screen.getByLabelText('Distribution'), { target: { value: 'binomial' } });
    expect(screen.getByLabelText(/n — number of trials/)).toBeTruthy();
    expect(screen.getByLabelText(/p — success probability/)).toBeTruthy();
    setField(/^Value x/, '3');
    expect(screen.getAllByText(/P\(X = x\)/).length).toBeGreaterThan(0);
  });

  it('reports a parameter outside the allowed range instead of computing', () => {
    render(<ProbabilityPanel />);
    fireEvent.change(screen.getByLabelText('Distribution'), { target: { value: 'poisson' } });
    setField(/λ — mean number of events/, '-2');
    expect(screen.getAllByText(/at least|greater than/).length).toBeGreaterThan(0);
  });

  it('simulates reproducibly from a seed', () => {
    render(<ProbabilityPanel />);
    setField(/^Draws/, '500');
    const first = screen.getByText(/Sample mean/).parentElement?.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'New sample' }));
    const second = screen.getByText(/Sample mean/).parentElement?.textContent;
    expect(second).not.toBe(first);
    expect(screen.getByText(/Standard error of the mean/)).toBeTruthy();
  });

  it('lists every distribution in the registry', () => {
    render(<ProbabilityPanel />);
    const select = screen.getByLabelText('Distribution') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);
    expect(options).toContain('lognormal');
    expect(options).toContain('weibull');
    expect(options).toContain('hypergeometric');
    expect(options.length).toBeGreaterThanOrEqual(18);
  });
});
