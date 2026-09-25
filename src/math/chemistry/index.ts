import { CalcError } from '@/core/errors';
import { ALL_CONSTANT_VALUES } from '@/constants';
import { molarMass, parseFormula } from './formula';

export * from './elements';
export * from './formula';

/**
 * Chemistry calculations that follow from the elements and the formula parser:
 * amounts of substance, solutions, pH and yields. Everything is in SI inside the
 * functions, with the practical units (grams, litres, moles per litre) on the
 * way in and out, because that is how a chemist writes them.
 */

/** Avogadro constant, from the app's own constants table (CODATA). */
export const AVOGADRO = ALL_CONSTANT_VALUES.n_a!;

/** Molar gas constant, from the app's own constants table (CODATA). */
export const GAS_R = ALL_CONSTANT_VALUES.r_gas!;

/** Molar volume of an ideal gas at 273.15 K and 101.325 kPa, in litres. */
export const MOLAR_VOLUME_STP = ((GAS_R * 273.15) / 101325) * 1000; // 22.4139… L/mol

export interface AmountResult {
  formula: string;
  molarMass: number;
  /** Mass in grams. */
  mass: number;
  /** Amount of substance in moles. */
  moles: number;
  /** Number of formula units. */
  particles: number;
  approximate: boolean;
}

function positive(value: number, what: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new CalcError('DOMAIN', `${what} must be a positive number`, {
      details: `Received ${value}.`,
    });
  }
  return value;
}

/** Amount of substance, mass and particle count from any one of them. */
export function amount(formula: string, input: { mass?: number; moles?: number; particles?: number }): AmountResult {
  const { molarMass: mm, approximate } = molarMass(formula);
  const parsed = parseFormula(formula);
  const supplied = [input.mass, input.moles, input.particles].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (supplied.length !== 1) {
    throw new CalcError('INPUT', 'Give exactly one of mass, moles or particles', {
      details: `${supplied.length} were given. The other two follow from the molar mass of ${parsed.display} (${mm} g/mol).`,
    });
  }
  if (typeof input.mass === 'number') {
    const mass = positive(input.mass, 'Mass');
    const moles = mass / mm;
    return { formula: parsed.display, molarMass: mm, mass, moles, particles: moles * AVOGADRO, approximate };
  }
  if (typeof input.moles === 'number') {
    const moles = positive(input.moles, 'Amount of substance');
    return {
      formula: parsed.display,
      molarMass: mm,
      mass: moles * mm,
      moles,
      particles: moles * AVOGADRO,
      approximate,
    };
  }
  const particles = positive(input.particles!, 'Number of particles');
  const moles = particles / AVOGADRO;
  return { formula: parsed.display, molarMass: mm, mass: moles * mm, moles, particles, approximate };
}

/** Concentration of a solution, in mol/L. */
export function molarity(moles: number, litres: number): number {
  return positive(moles, 'Amount of substance') / positive(litres, 'Volume');
}

/** Amount of solute in a volume of solution of known concentration. */
export function molesInSolution(concentration: number, litres: number): number {
  return positive(concentration, 'Concentration') * positive(litres, 'Volume');
}

/** Mass of solute needed to make a solution. */
export function massForSolution(formula: string, concentration: number, litres: number): AmountResult {
  const moles = molesInSolution(concentration, litres);
  return amount(formula, { moles });
}

export interface DilutionResult {
  /** The value that was missing, in the unit of the others. */
  value: number;
  /** What was solved for: "c1", "v1", "c2" or "v2". */
  solvedFor: 'c1' | 'v1' | 'c2' | 'v2';
  /** The relation, for the working. */
  relation: string;
}

/**
 * Dilution: c₁·V₁ = c₂·V₂. Concentrations must share a unit and volumes must
 * share a unit (the equation is unit-agnostic as long as each pair is
 * consistent), and exactly one of the four values may be left out.
 */
export function dilution(known: Partial<Record<'c1' | 'v1' | 'c2' | 'v2', number>>): DilutionResult {
  const keys: ('c1' | 'v1' | 'c2' | 'v2')[] = ['c1', 'v1', 'c2', 'v2'];
  const missing = keys.filter((key) => known[key] === undefined);
  if (missing.length !== 1) {
    throw new CalcError('INPUT', 'Leave exactly one of c₁, V₁, c₂, V₂ empty', {
      details: `${missing.length} are empty. Dilution is c₁·V₁ = c₂·V₂.`,
    });
  }
  const solvedFor = missing[0]!;
  for (const key of keys) {
    const value = known[key];
    if (key !== solvedFor && (value === undefined || value <= 0)) {
      throw new CalcError('DOMAIN', `${key} must be a positive number for a dilution`, {
        details: `Received ${key} = ${value}.`,
      });
    }
  }
  const { c1, v1, c2, v2 } = known as Record<'c1' | 'v1' | 'c2' | 'v2', number>;
  const value =
    solvedFor === 'c1'
      ? (c2 * v2) / v1
      : solvedFor === 'v1'
        ? (c2 * v2) / c1
        : solvedFor === 'c2'
          ? (c1 * v1) / v2
          : (c1 * v1) / c2;
  return { value, solvedFor, relation: 'c₁·V₁ = c₂·V₂' };
}

/** pH from a hydrogen-ion concentration in mol/L. */
export function phFromConcentration(concentration: number): number {
  return -Math.log10(positive(concentration, 'Concentration'));
}

/** Hydrogen-ion concentration in mol/L from a pH. */
export function concentrationFromPh(pH: number): number {
  if (!Number.isFinite(pH)) {
    throw new CalcError('INPUT', 'A pH must be a number', { details: `Received ${pH}.` });
  }
  return 10 ** -pH;
}

/** pOH from a hydrogen-ion concentration, at 25 °C where pKw = 14. */
export function pohFromConcentration(concentration: number): number {
  return 14 - phFromConcentration(concentration);
}

/** pH of a strong monoprotic acid: one hydrogen ion per molecule. */
export function strongAcidPh(concentration: number): number {
  return phFromConcentration(concentration);
}

/** pH of a strong monoprotic base: one hydroxide ion per formula unit. */
export function strongBasePh(concentration: number): number {
  return 14 - phFromConcentration(positive(concentration, 'Concentration'));
}

/** Percentage yield. */
export function percentYield(actual: number, theoretical: number): number {
  return (actual / positive(theoretical, 'Theoretical yield')) * 100;
}

/** Percentage error against an accepted value. */
export function percentError(measured: number, accepted: number): number {
  if (!Number.isFinite(measured) || !Number.isFinite(accepted)) {
    throw new CalcError('INPUT', 'Both the measured and the accepted value must be numbers');
  }
  if (accepted === 0) {
    throw new CalcError('DOMAIN', 'The accepted value may not be zero, because the error is relative to it');
  }
  return (Math.abs(measured - accepted) / Math.abs(accepted)) * 100;
}

/**
 * Limiting reactant from the amounts actually present.
 *
 * Each entry is the moles of one reactant and the coefficient it has in the
 * balanced equation; the reactant that runs out first is the one with the
 * smallest moles ÷ coefficient. The result reports how much of every other
 * reactant is left over, which is what makes it useful rather than a label.
 */
export interface LimitingResult {
  limiting: string;
  /** Moles of the limiting reactant's product, scaled by its coefficient. */
  extentOfReaction: number;
  rows: { formula: string; moles: number; coefficient: number; ratio: number; excess: number }[];
}

export function limitingReactant(
  reactants: { formula: string; moles: number; coefficient: number }[],
): LimitingResult {
  if (reactants.length < 2) {
    throw new CalcError('INPUT', 'A limiting reactant only exists when two or more reactants are given');
  }
  const rows = reactants.map((entry) => {
    const coefficient = positive(entry.coefficient, `Coefficient of ${entry.formula}`);
    const moles = positive(entry.moles, `Moles of ${entry.formula}`);
    return {
      formula: parseFormula(entry.formula).display,
      moles,
      coefficient,
      ratio: moles / coefficient,
      excess: 0,
    };
  });
  const extent = Math.min(...rows.map((row) => row.ratio));
  for (const row of rows) {
    row.excess = row.moles - extent * row.coefficient;
  }
  const limiting = rows.find((row) => row.ratio === extent)!;
  return { limiting: limiting.formula, extentOfReaction: extent, rows };
}


