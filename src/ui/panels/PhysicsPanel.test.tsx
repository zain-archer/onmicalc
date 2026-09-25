import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PhysicsPanel } from './PhysicsPanel';

const setField = (label: string | RegExp, value: string, index = 0) => {
  fireEvent.change(screen.getAllByLabelText(label)[index]!, { target: { value } });
};

const chooseFormula = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const answerArea = () => document.querySelector('.tool__output')?.textContent ?? '';
const bodyText = () => document.body.textContent ?? '';

describe('physics panel', () => {
  it('opens on a relation and shows its library', () => {
    render(<PhysicsPanel />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe("Newton's second law");
    expect(answerArea()).toContain('Mechanics · F = m·a');
    expect(bodyText()).toMatch(/75 of 75 formulas shown/);
    expect(screen.getByRole('button', { name: "Ohm's law" })).toBeTruthy();
  });

  it('narrows the library by search text', () => {
    render(<PhysicsPanel />);
    setField(/^Search formulas/, 'ohm');
    expect(screen.getByRole('button', { name: "Ohm's law" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Work done by a force' })).toBeNull();
    // The first match becomes the open formula.
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe("Ohm's law");
    expect(answerArea()).toContain('Electricity · V = I·R');
  });

  it('solves for the missing symbol and can be pointed at another one', () => {
    render(<PhysicsPanel />);
    chooseFormula("Ohm's law");
    setField(/^I — current/, '2');
    setField(/^R — resistance/, '50');
    expect(screen.getByText('100')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Solve for/), { target: { value: 'r' } });
    // Voltage and current are the knowns now, and voltage is still empty.
    expect(screen.getByText(/value is needed for voltage/)).toBeTruthy();
    setField(/^V — voltage/, '100');
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('shows the substitution check, the unit and the working', () => {
    render(<PhysicsPanel />);
    chooseFormula('Kinetic energy');
    setField(/^m — mass/, '1500');
    setField(/^v — speed/, '27.77777777777778');
    expect(screen.getByText('578,703.703704')).toBeTruthy();
    expect(screen.getByText('J')).toBeTruthy();
    expect(screen.getByText('Check (residual after substituting back)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show the working' }));
    expect(answerArea()).toMatch(/substituting back into the relation/);
    expect(answerArea()).toMatch(/Relation: Eₖ = ½m·v²/);
    expect(screen.getByRole('button', { name: 'Hide the working' })).toBeTruthy();
  });

  it('refuses a value that is not physical and says which one', () => {
    render(<PhysicsPanel />);
    setField(/^m — mass/, '0');
    setField(/^a — acceleration/, '3');
    expect(screen.getByRole('alert').textContent).toMatch(/mass must be positive/);
  });

  it('reports the other algebraic solution of a quadratic relation', () => {
    render(<PhysicsPanel />);
    chooseFormula('SUVAT: s = u·t + ½a·t²');
    fireEvent.change(screen.getByLabelText(/^Solve for/), { target: { value: 't' } });
    setField(/^s — displacement/, '45');
    setField(/^u — initial velocity/, '0');
    setField(/^a — acceleration/, '9.80665');
    expect(screen.getByText('3.02942996565')).toBeTruthy();
    expect(screen.getByText('-3.02942996565')).toBeTruthy();
    expect(answerArea()).toMatch(/other algebraic solution/i);
  });
});
