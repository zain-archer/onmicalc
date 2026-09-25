import { CalcError } from '@/core/errors';
import { compileFunctionOf } from '@/math/calculus';
import { bisection, secant } from '@/math/numerical';
import {
  getPhysicsFormula,
  PHYSICS_FORMULAS,
  searchPhysicsFormulas,
  type PhysicsFormula,
  type PhysicsQuantity,
} from './formulas';

export * from './formulas';

/**
 * Solves a physics relation for whichever symbol the user is missing.
 *
 * The relation is stored as a residual expression, so solving is a root-finding
 * problem on that residual — no formula is rearranged by hand, and therefore no
 * rearrangement can be wrong. The answer is substituted back into the relation
 * and reported with that check, the unit, and the other real solutions when a
 * relation genuinely has more than one (a quadratic in time, say).
 */

export interface PhysicsSolution {
  formula: PhysicsFormula;
  solvedFor: PhysicsQuantity;
  value: number;
  unit: string;
  /** |residual| after substituting the answer — near zero for a correct root. */
  residual: number;
  verified: boolean;
  steps: string[];
  /** Other real roots, with a note about why they are usually not the answer. */
  alternatives: { value: number; note: string }[];
  notes: string[];
}

interface Root {
  value: number;
  /** The interval whose sign change bracketed this root. */
  bracket: [number, number];
}

const GRID_DECADES = 12;
const MAX_BRACKETS = 8192;

/**
 * A working scale for the unknown, taken as the geometric mean of the values
 * that are known. Physics relations mix quantities of very different size
 * (h = 6.6e-34 with f = 1e15), so an arithmetic scale — or the largest input —
 * would put every candidate far from the answer; the geometric mean sits in the
 * middle of the range the answer can occupy.
 */
export function physicsScale(values: number[]): number {
  const magnitudes = values.filter((value) => value !== 0 && Number.isFinite(value)).map(Math.abs);
  if (magnitudes.length === 0) return 1;
  const mean = Math.exp(magnitudes.reduce((total, value) => total + Math.log(value), 0) / magnitudes.length);
  return Math.min(1e18, Math.max(1e-18, mean));
}

function candidateGrid(scale: number): number[] {
  const values = new Set<number>([0]);
  for (let decade = -GRID_DECADES; decade <= GRID_DECADES; decade += 1) {
    const magnitude = scale * 10 ** decade;
    values.add(magnitude);
    values.add(-magnitude);
  }
  return [...values].sort((a, b) => a - b);
}

/** Readable numbers for the step list: 24, not 23.999999999999996. */
function formatNumber(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude < 1e-4 || magnitude >= 1e15)) return value.toExponential(6);
  const text = value.toPrecision(12);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

export function solvePhysics(
  formulaId: string,
  known: Record<string, number>,
  solveFor: string,
): PhysicsSolution {
  const formula = getPhysicsFormula(formulaId);
  if (!formula) {
    throw new CalcError('INPUT', `Unknown formula “${formulaId}”`, {
      details: `Known formulas include ${PHYSICS_FORMULAS.slice(0, 6)
        .map((entry) => entry.id)
        .join(', ')}, …`,
    });
  }
  const unknown = findQuantity(formula, solveFor);
  if (!unknown) {
    throw new CalcError('INPUT', `“${solveFor}” is not part of ${formula.relation}`, {
      details: `The symbols are ${formula.quantities.map((quantity) => quantity.display ?? quantity.symbol).join(', ')}.`,
    });
  }

  // The residual is written with lower-case symbols, so the unknown has to be
  // identified by its symbol, not by whatever the caller typed.
  const unknownName = unknown.symbol;
  const supplied: Record<string, number> = {};
  for (const quantity of formula.quantities) {
    if (quantity.symbol === unknownName) continue;
    const value = readKnown(quantity, known) ?? quantity.defaultValue;
    if (value === undefined || !Number.isFinite(value)) {
      throw new CalcError('INPUT', `A value is needed for ${quantity.name} (${quantity.unit})`, {
        details: `Solving ${formula.relation} for ${unknown.display ?? unknownName} needs every other symbol in the relation.`,
      });
    }
    supplied[quantity.symbol] = value;
  }
  assertPhysical(formula, supplied);

  const evaluate = compileFunctionOf(formula.residual, [unknownName, ...Object.keys(supplied)]);
  if (!evaluate) {
    throw new CalcError('NOT_SUPPORTED', `The relation “${formula.relation}” could not be read by the expression parser`);
  }
  const g = (x: number): number => {
    try {
      const value = evaluate({ [unknownName]: x, ...supplied });
      return Number.isFinite(value) ? value : Number.NaN;
    } catch {
      return Number.NaN;
    }
  };

  const scale = physicsScale(Object.values(supplied));
  const grid = candidateGrid(scale);
  const samples = grid.filter((x) => Number.isFinite(g(x)));
  if (samples.length === 0) {
    throw new CalcError('DOMAIN', `The relation ${formula.relation} cannot be evaluated with the values given (check for a division by zero or a negative square root)`);
  }
  const magnitudes = samples.map((x) => Math.abs(g(x)));
  const level = Math.max(...magnitudes);
  const spread = level - Math.min(...magnitudes);

  // Does the unknown matter at all? If the residual barely moves across the
  // whole grid then the symbol cancels out and no unique answer exists.
  if (spread <= 1e-12 * Math.max(level, 1e-300)) {
    throw new CalcError('NOT_SUPPORTED', `${unknown.display ?? unknownName} cancels out of ${formula.relation}, so it cannot be found from the others`, {
      details: 'Every value of this symbol satisfies the relation with the values given.',
    });
  }

  // The residual must be zero to this many digits of the relation's own scale —
  // an absolute tolerance would be meaningless for λ = h/p.
  const tolerance = 1e-8 * Math.max(level, 1e-300);
  const roots = findRoots(g, grid, tolerance);
  if (roots.length === 0) {
    throw new CalcError('NOT_SUPPORTED', `No real value of ${unknown.name} solves ${formula.relation} with the values given`, {
      details: formula.note ?? 'The relation may have no real solution for this combination of values.',
    });
  }

  const allowed = roots.filter((root) => passesConstraint(formula, unknownName, root.value));
  if (allowed.length === 0) {
    throw new CalcError('DOMAIN', `The only solutions make ${unknown.name} non-physical`, {
      details: [
        `Roots found: ${roots.map((root) => formatNumber(root.value)).join(', ')}.`,
        constraintExplanation(formula, unknownName, unknown.name),
        formula.note ?? '',
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  const ordered = [...allowed].sort((a, b) => a.value - b.value);
  // Prefer the non-negative solution: times, periods, speeds and energies are
  // what a person means, while the negative root of a quadratic is the "other"
  // answer that gets reported alongside it.
  const chosen = ordered.find((root) => root.value >= 0) ?? ordered[0]!;
  const residual = g(chosen.value);
  const verified = Math.abs(residual) <= tolerance;
  if (!verified) {
    throw new CalcError('CONVERGENCE', `The solution for ${unknown.display ?? unknownName} could not be verified against ${formula.relation}`, {
      details: `Substituting the answer back leaves a residual of ${residual.toExponential(3)}, which is larger than the ${tolerance.toExponential(3)} the relation allows.`,
    });
  }

  const unit = unknown.unit === '—' ? '' : unknown.unit;
  const value = formatNumber(chosen.value);
  const steps: string[] = [
    `Relation: ${formula.relation}`,
    `Known: ${Object.entries(supplied)
      .map(([symbol, number]) => `${symbol} = ${formatNumber(number)}`)
      .join(', ')}`,
    `Solve for ${unknown.display ?? unknownName} (${unknown.name}).`,
    'The relation is stored as a residual that is zero exactly when the relation holds, so the answer is the value that makes the residual zero.',
    `${unknown.display ?? unknownName} = ${value}${unit ? ` ${unit}` : ''}`,
    `Check: substituting back into the relation gives a residual of ${residual.toExponential(3)}.`,
  ];

  return {
    formula,
    solvedFor: unknown,
    value: chosen.value,
    unit: unknown.unit,
    residual,
    verified: true,
    steps,
    alternatives: ordered
      .filter((root) => root !== chosen)
      .map((root) => ({
        value: root.value,
        note: formula.note
          ? `${formula.note} This is the other algebraic solution of the same relation.`
          : 'The other algebraic solution of the same relation.',
      })),
    notes: [
      formula.note,
      `Units: ${unknown.name} in ${unknown.unit}${unknown.constant ? ' (a physical constant, so it is already filled in)' : ''}.`,
    ].filter((note): note is string => Boolean(note)),
  };
}

function findQuantity(formula: PhysicsFormula, wanted: string): PhysicsQuantity | undefined {
  const lower = wanted.trim().toLowerCase();
  return formula.quantities.find(
    (quantity) =>
      quantity.symbol.toLowerCase() === lower || quantity.display?.toLowerCase() === lower,
  );
}

/** Looks a value up by symbol or by the symbol as it is written by hand. */
function readKnown(quantity: PhysicsQuantity, known: Record<string, number>): number | undefined {
  for (const key of [quantity.symbol, quantity.display]) {
    if (!key) continue;
    const value = known[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  const lower = quantity.symbol.toLowerCase();
  for (const [key, value] of Object.entries(known)) {
    if (key.trim().toLowerCase() === lower && Number.isFinite(value)) return value;
  }
  return undefined;
}

function findRoots(g: (x: number) => number, grid: number[], tolerance: number): Root[] {
  const roots: Root[] = [];
  let brackets = 0;
  let previousX = grid[0]!;
  let previousY = g(previousX);
  for (let index = 1; index < grid.length && brackets < MAX_BRACKETS; index += 1) {
    const x = grid[index]!;
    const y = g(x);
    if (Number.isFinite(previousY) && Number.isFinite(y)) {
      if (y === 0) {
        addRoot(roots, x, [previousX, x], g, tolerance);
      } else if (previousY * y < 0) {
        brackets += 1;
        // A relative tolerance: relations such as λ = h/p have roots many
        // orders of magnitude away from 1, where an absolute one stops early.
        const bracketScale = Math.max(Math.abs(previousX), Math.abs(x));
        const found = bisection(g, previousX, x, Math.max(1e-300, 1e-15 * bracketScale));
        const refined = secant(g, found.root, found.root * (1 + 1e-6) + 1e-12, Math.max(1e-300, 1e-16 * bracketScale));
        const best =
          refined.converged && Number.isFinite(refined.root) && Math.abs(g(refined.root)) <= Math.abs(g(found.root))
            ? refined.root
            : found.root;
        if (Number.isFinite(best)) addRoot(roots, best, [previousX, x], g, tolerance);
      }
    }
    previousX = x;
    previousY = y;
  }
  if (roots.length === 0) {
    // No sign change anywhere on the grid: try to walk to a root from the grid
    // points that are closest to zero (a tangency root touches without changing
    // sign, and a relation can also have a root between two huge grid points).
    const guesses = [...grid]
      .filter((value) => value !== 0)
      .sort((a, b) => Math.abs(g(a)) - Math.abs(g(b)))
      .slice(0, 24);
    for (const guess of guesses) {
      const attempt = secant(g, guess, guess * 1.05 + 1e-12, 1e-16);
      if (attempt.converged && Number.isFinite(attempt.root) && Math.abs(g(attempt.root)) <= tolerance) {
        addRoot(roots, attempt.root, [guess * 0.9, guess * 1.1 + 1e-12], g, tolerance);
      }
    }
  }
  return roots;
}

function addRoot(
  roots: Root[],
  value: number,
  bracket: [number, number],
  g: (x: number) => number,
  tolerance: number,
): void {
  if (!Number.isFinite(value)) return;
  if (Math.abs(g(value)) > tolerance) return;
  if (roots.some((existing) => Math.abs(existing.value - value) <= 1e-9 * Math.max(1, Math.abs(value)))) return;
  roots.push({ value, bracket });
}

function passesConstraint(formula: PhysicsFormula, symbol: string, value: number): boolean {
  if (formula.positive?.includes(symbol) && !(value > 0)) return false;
  if (formula.nonNegative?.includes(symbol) && value < 0) return false;
  return true;
}

function constraintExplanation(formula: PhysicsFormula, symbol: string, name: string): string {
  if (formula.positive?.includes(symbol)) return `${name} must be positive for the relation to be physically meaningful.`;
  if (formula.nonNegative?.includes(symbol)) return `${name} may not be negative for the relation to be physically meaningful.`;
  return '';
}

function assertPhysical(formula: PhysicsFormula, supplied: Record<string, number>): void {
  for (const [symbol, number] of Object.entries(supplied)) {
    const quantity = formula.quantities.find((entry) => entry.symbol === symbol);
    const label = quantity ? quantity.name : symbol;
    if (formula.positive?.includes(symbol) && !(number > 0)) {
      throw new CalcError('DOMAIN', `In ${formula.relation}, ${label} must be positive`, {
        details: `Received ${label} = ${number}. A zero or negative value has no meaning in this relation.`,
      });
    }
    if (formula.nonNegative?.includes(symbol) && number < 0) {
      throw new CalcError('DOMAIN', `In ${formula.relation}, ${label} may not be negative`, {
        details: `Received ${label} = ${number}.`,
      });
    }
  }
}

/** Convenience wrapper: everything except the unknown comes from the defaults. */
export function solveWithDefaults(
  formulaId: string,
  solveFor: string,
  overrides: Record<string, number> = {},
): PhysicsSolution {
  return solvePhysics(formulaId, overrides, solveFor);
}

export { searchPhysicsFormulas };
