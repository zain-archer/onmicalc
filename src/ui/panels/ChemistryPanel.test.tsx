import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChemistryPanel } from './ChemistryPanel';

const setField = (label: string | RegExp, value: string, index = 0) => {
  fireEvent.change(screen.getAllByLabelText(label)[index]!, { target: { value } });
};
const clickTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('chemistry panel', () => {
  it('shows the molar mass and composition of a formula', () => {
    render(<ChemistryPanel />);
    expect(screen.getByText(/^18\.015/)).toBeTruthy(); // M(H2O)
    expect(screen.getByText(/^88\.809/)).toBeTruthy(); // oxygen share
    expect(screen.getByText(/^11\.19/)).toBeTruthy(); // hydrogen share
  });

  it('understands brackets and hydrates', () => {
    render(<ChemistryPanel />);
    setField(/^Formula/, 'Al2(SO4)3');
    expect(screen.getByText(/^342\.13/)).toBeTruthy();
    setField(/^Formula/, 'CuSO4·5H2O');
    expect(screen.getByText(/^249\.67/)).toBeTruthy();
  });

  it('explains a formula it cannot read', () => {
    render(<ChemistryPanel />);
    setField(/^Formula/, 'Xx2');
    expect(screen.getByRole('alert').textContent).toMatch(/not an element symbol/);
  });

  it('converts between mass, moles and particles', () => {
    render(<ChemistryPanel />);
    setField(/^Mass/, '36.03');
    expect(screen.getByText('2')).toBeTruthy(); // 36.03 g of water is 2 mol
    setField(/^Mass/, '');
    setField(/^Amount of substance/, '1');
    expect(screen.getAllByText(/^18\.015/).length).toBeGreaterThan(0);
  });

  it('finds elements by symbol, name and number', () => {
    render(<ChemistryPanel />);
    clickTab('Elements');
    setField(/^Find an element/, 'Fe');
    expect(screen.getByText('Iron (Fe)')).toBeTruthy();
    expect(screen.getByText('55.845')).toBeTruthy();
    setField(/^Find an element/, '26');
    expect(screen.getByText('Iron (Fe)')).toBeTruthy();
    expect(screen.getByText('Transition metal')).toBeTruthy();
  });

  it('works out concentrations, dilutions and pH', () => {
    render(<ChemistryPanel />);
    clickTab('Solutions & pH');
    expect(screen.getByText('0.25')).toBeTruthy(); // 0.5 mol in 2 L

    fireEvent.change(screen.getByLabelText(/^What do you want/), { target: { value: 'dilution' } });
    expect(screen.getByText('0.1')).toBeTruthy(); // 1 mol/L × 10 mL → 100 mL

    fireEvent.change(screen.getByLabelText(/^What do you want/), { target: { value: 'ph' } });
    expect(screen.getByText('1')).toBeTruthy(); // 0.1 mol/L strong acid
  });

  it('finds the limiting reactant and the excess', () => {
    render(<ChemistryPanel />);
    clickTab('Reaction');
    expect(screen.getByText('O2')).toBeTruthy();
    expect(screen.getByText('left over: 3 mol')).toBeTruthy(); // 5 − 2·1 H2
  });

  it('refuses a reactant with no moles', () => {
    render(<ChemistryPanel />);
    clickTab('Reaction');
    fireEvent.click(screen.getByRole('button', { name: 'Add a reactant' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Type a chemical formula/);
  });
});
