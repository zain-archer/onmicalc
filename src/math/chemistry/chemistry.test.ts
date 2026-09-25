import { describe, expect, it } from 'vitest';
import { ELEMENTS, getElement, searchElements } from './elements';
import { empiricalFormula, molarMass, parseFormula, percentComposition } from './formula';
import {
  amount,
  AVOGADRO,
  dilution,
  limitingReactant,
  MOLAR_VOLUME_STP,
  molarity,
  percentError,
  percentYield,
  phFromConcentration,
  strongAcidPh,
  strongBasePh,
} from './index';

describe('periodic table data', () => {
  it('lists all 118 elements with consistent numbering', () => {
    expect(ELEMENTS).toHaveLength(118);
    ELEMENTS.forEach((element, index) => {
      expect(element.atomicNumber).toBe(index + 1);
      expect(element.symbol).toMatch(/^[A-Z][a-z]?$/);
      expect(element.mass).toBeGreaterThan(1);
      expect(element.group).toBeGreaterThanOrEqual(1);
      expect(element.group).toBeLessThanOrEqual(18);
      expect(element.period).toBeGreaterThanOrEqual(1);
      expect(element.period).toBeLessThanOrEqual(7);
    });
    expect(new Set(ELEMENTS.map((element) => element.symbol)).size).toBe(118);
  });

  it('looks elements up by symbol, name and number', () => {
    expect(getElement('Na')?.name).toBe('Sodium');
    expect(getElement('na')?.atomicNumber).toBe(11);
    expect(getElement('sodium')?.symbol).toBe('Na');
    expect(getElement(26)?.symbol).toBe('Fe');
    expect(getElement('Ob')).toBeUndefined();
    expect(searchElements('noble gas').length).toBeGreaterThanOrEqual(6);
    expect(searchElements('period 1')).toHaveLength(2);
  });

  it('marks elements whose mass is only a mass number', () => {
    expect(getElement('Tc')?.synthetic).toBe(true);
    expect(getElement('U')?.synthetic).toBeUndefined();
  });
});

describe('chemical formula parser', () => {
  it('counts atoms in simple and repeated formulas', () => {
    expect(parseFormula('H2O').parts).toEqual([
      { symbol: 'H', count: 2 },
      { symbol: 'O', count: 1 },
    ]);
    expect(parseFormula('H2O').atoms).toBe(3);
    expect(parseFormula('C6H12O6').atoms).toBe(24);
    // An element that appears twice is added, not replaced.
    expect(parseFormula('CH3COOH').parts).toEqual([
      { symbol: 'C', count: 2 },
      { symbol: 'H', count: 4 },
      { symbol: 'O', count: 2 },
    ]);
  });

  it('handles brackets and their multipliers', () => {
    expect(parseFormula('Ca(OH)2').parts).toEqual([
      { symbol: 'Ca', count: 1 },
      { symbol: 'O', count: 2 },
      { symbol: 'H', count: 2 },
    ]);
    expect(parseFormula('Al2(SO4)3').parts).toEqual([
      { symbol: 'Al', count: 2 },
      { symbol: 'S', count: 3 },
      { symbol: 'O', count: 12 },
    ]);
    expect(parseFormula('K4[Fe(CN)6]').parts).toEqual([
      { symbol: 'K', count: 4 },
      { symbol: 'Fe', count: 1 },
      { symbol: 'C', count: 6 },
      { symbol: 'N', count: 6 },
    ]);
  });

  it('handles hydrates written with a dot', () => {
    const hydrate = parseFormula('CuSO4·5H2O');
    expect(hydrate.parts).toEqual([
      { symbol: 'Cu', count: 1 },
      { symbol: 'S', count: 1 },
      { symbol: 'O', count: 9 },
      { symbol: 'H', count: 10 },
    ]);
    // The same compound written with a full stop or an asterisk.
    expect(parseFormula('CuSO4.5H2O').atoms).toBe(hydrate.atoms);
    expect(parseFormula('CuSO4*5H2O').atoms).toBe(hydrate.atoms);
  });

  it('refuses malformed formulas with a readable reason', () => {
    expect(() => parseFormula('H2O(')).toThrow(/missing a closing/);
    expect(() => parseFormula('H2O)')).toThrow(/Unexpected/);
    expect(() => parseFormula('Xx2')).toThrow(/not an element symbol/);
    expect(() => parseFormula('h2o')).toThrow(/capital letter/);
    expect(() => parseFormula('')).toThrow(/Type a chemical formula/);
    expect(() => parseFormula('3H2O')).not.toThrow();
  });
});

describe('molar mass and composition', () => {
  it('computes molar masses against reference values', () => {
    expect(molarMass('H2O').molarMass).toBeCloseTo(18.015, 3);
    expect(molarMass('NaCl').molarMass).toBeCloseTo(58.44, 2);
    expect(molarMass('C6H12O6').molarMass).toBeCloseTo(180.156, 2);
    expect(molarMass('Ca(OH)2').molarMass).toBeCloseTo(74.093, 2);
    expect(molarMass('CuSO4·5H2O').molarMass).toBeCloseTo(249.68, 1);
    expect(molarMass('KMnO4').molarMass).toBeCloseTo(158.034, 2);
    expect(molarMass('Tc').approximate).toBe(true);
    expect(molarMass('Pu').approximate).toBe(true);
    expect(molarMass('H2O').approximate).toBe(false);
    expect(molarMass('U').approximate).toBe(false); // uranium has a standard atomic weight
  });

  it('reports mass percentages that add up to 100', () => {
    const water = percentComposition('H2O');
    const total = water.rows.reduce((sum, row) => sum + row.percent, 0);
    expect(total).toBeCloseTo(100, 6);
    const hydrogen = water.rows.find((row) => row.symbol === 'H')!;
    expect(hydrogen.percent).toBeCloseTo(11.19, 2);
    expect(hydrogen.mass).toBeCloseTo(2.016, 3);
    // Sorted from the largest mass share downwards.
    expect(water.rows[0]!.symbol).toBe('O');
  });

  it('finds the empirical formula from mass percentages', () => {
    // Glucose is CH2O empirically: 40 % C, 6.7 % H, 53.3 % O.
    expect(empiricalFormula({ C: 40, H: 6.7, O: 53.3 }).formula).toBe('CH2O');
    // Water: H 11.19 %, O 88.81 %.
    expect(empiricalFormula({ H: 11.19, O: 88.81 }).formula).toBe('H2O');
    // Iron(III) oxide: Fe 69.94 %, O 30.06 % → Fe2O3.
    expect(empiricalFormula({ Fe: 69.94, O: 30.06 }).formula).toBe('Fe2O3');
    // Percentages that do not add up are still solved, but the note says so.
    expect(empiricalFormula({ C: 20, H: 3.3 }).note).toMatch(/add up to/);
    expect(() => empiricalFormula({})).toThrow(/at least one element/);
    expect(() => empiricalFormula({ Xx: 10 })).toThrow(/not an element symbol/);
  });
});

describe('amounts, solutions and pH', () => {
  it('converts between mass, moles and particles', () => {
    const water = amount('H2O', { mass: 18.015 });
    expect(water.moles).toBeCloseTo(1, 6);
    expect(water.particles).toBeCloseTo(AVOGADRO, 12);

    const fromMoles = amount('NaCl', { moles: 2 });
    expect(fromMoles.mass).toBeCloseTo(116.88, 2);

    const fromParticles = amount('CO2', { particles: AVOGADRO / 2 });
    expect(fromParticles.moles).toBeCloseTo(0.5, 12);
    expect(fromParticles.mass).toBeCloseTo(molarMass('CO2').molarMass / 2, 6);

    expect(() => amount('H2O', {})).toThrow(/exactly one/);
    expect(() => amount('H2O', { mass: 1, moles: 1 })).toThrow(/exactly one/);
    expect(() => amount('H2O', { mass: -1 })).toThrow(/positive/);
  });

  it('computes concentrations and dilutions', () => {
    expect(molarity(0.5, 2)).toBeCloseTo(0.25, 12);
    expect(() => molarity(0, 1)).toThrow(/positive/);
    expect(() => molarity(1, 0)).toThrow(/positive/);

    // 10 mL of 1 mol/L diluted to 100 mL gives 0.1 mol/L.
    const dilutionResult = dilution({ c1: 1, v1: 0.01, v2: 0.1 });
    expect(dilutionResult.solvedFor).toBe('c2');
    expect(dilutionResult.value).toBeCloseTo(0.1, 12);
    expect(dilution({ c1: 1, c2: 0.1, v2: 0.1 }).value).toBeCloseTo(0.01, 12);
    expect(dilution({ v1: 0.01, c2: 0.1, v2: 0.1 }).value).toBeCloseTo(1, 12);
    expect(dilution({ c1: 1, v1: 0.01, c2: 0.1 }).value).toBeCloseTo(0.1, 12);
    expect(() => dilution({ c1: 1, v1: 0.01 })).toThrow(/exactly one/);
    expect(() => dilution({ c1: 0, v1: 0.01, v2: 0.1 })).toThrow(/positive/);
  });

  it('computes pH of strong acids and bases at 25 °C', () => {
    expect(strongAcidPh(0.1)).toBeCloseTo(1, 12);
    expect(strongAcidPh(1e-7)).toBeCloseTo(7, 12);
    expect(strongBasePh(0.01)).toBeCloseTo(12, 12);
    expect(phFromConcentration(1e-3)).toBeCloseTo(3, 12);
    expect(10 ** -phFromConcentration(0.0025)).toBeCloseTo(0.0025, 12);
    expect(() => strongAcidPh(0)).toThrow(/positive/);
  });

  it('computes yields and errors', () => {
    expect(percentYield(4.5, 5)).toBeCloseTo(90, 12);
    expect(percentError(9.8, 9.81)).toBeCloseTo(0.10193679918450546, 9);
    expect(() => percentYield(1, 0)).toThrow(/positive/);
    expect(() => percentError(1, 0)).toThrow(/may not be zero/);
  });

  it('finds the limiting reactant and the excess left over', () => {
    // 2H2 + O2 → 2H2O with 5 mol H2 and 1 mol O2: O2 runs out first.
    const result = limitingReactant([
      { formula: 'H2', moles: 5, coefficient: 2 },
      { formula: 'O2', moles: 1, coefficient: 1 },
    ]);
    expect(result.limiting).toBe('O2');
    expect(result.extentOfReaction).toBe(1);
    const hydrogen = result.rows.find((row) => row.formula === 'H2')!;
    expect(hydrogen.excess).toBeCloseTo(3, 12); // 5 − 2·1
    expect(() => limitingReactant([{ formula: 'H2', moles: 1, coefficient: 1 }])).toThrow(/two or more/);
    expect(() => limitingReactant([{ formula: 'H2', moles: 0, coefficient: 1 }, { formula: 'O2', moles: 1, coefficient: 1 }])).toThrow(/positive/);
  });

  it('knows the molar volume of a gas at STP', () => {
    expect(MOLAR_VOLUME_STP).toBeCloseTo(22.414, 3);
  });
});
