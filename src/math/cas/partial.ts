import { add as addNode, div as divNode, formatNice, num, pow as powNode, type Node } from './ast';
import {
  degree,
  monic,
  polynomialToNode,
  polyAdd,
  polyDerivative,
  polyDivide,
  polyMultiply,
  polySub,
  polyEvaluate,
  rationalRoots,
  rootMultiplicity,
  squareFree,
  trim,
  type Polynomial,
} from './polyops';

/**
 * Partial-fraction decomposition of a rational function with rational
 * coefficients, restricted to denominators that factor into linear factors and
 * (at most) one irreducible quadratic. Anything else returns null — the caller
 * then reports "not supported" instead of inventing a decomposition.
 */

export interface FractionTerm {
  /** Numerator polynomial (constant for linear factors, linear for quadratics). */
  numerator: Polynomial;
  /** Denominator factor. */
  factor: Polynomial;
  /** Power of the factor in the original denominator. */
  power: number;
}

export interface PartialFractionResult {
  /** Polynomial part when the fraction is improper. */
  polynomial: Polynomial;
  terms: FractionTerm[];
  /** Original denominator factorisation actually used. */
  denominator: Polynomial;
  numerator: Polynomial;
}

/** Solves a square linear system with partial pivoting; null when singular. */
function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row]![col]! / a[col]![col]!;
      if (factor === 0) continue;
      for (let k = col; k <= n; k += 1) a[row]![k] = a[row]![k]! - factor * a[col]![k]!;
    }
  }
  const solution = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i += 1) solution[i] = a[i]![n]! / a[i]![i]!;
  return solution;
}

/** Factorises into distinct linear factors plus one leftover factor. */
function factorDenominator(denominator: Polynomial): { factor: Polynomial; power: number }[] | null {
  const factors: { factor: Polynomial; power: number }[] = [];
  let remaining = trim(denominator);

  // Peel off integer/rational roots repeatedly (each root may repeat).
  for (let guard = 0; guard < 32 && degree(remaining) > 2; guard += 1) {
    const roots = rationalRoots(remaining);
    if (roots.length === 0) break;
    const root = roots[0]!;
    const power = rootMultiplicity(remaining, root);
    if (power === 0) break;
    factors.push({ factor: [-root, 1], power });
    for (let i = 0; i < power; i += 1) remaining = trim(polyDivide(remaining, [-root, 1]).quotient);
  }

  if (degree(remaining) === 1) {
    const root = -remaining[0]! / remaining[1]!;
    factors.push({ factor: [-root, 1], power: 1 });
    remaining = [1];
  } else if (degree(remaining) === 2) {
    const [c, b, a] = [remaining[0]!, remaining[1]!, remaining[2]!];
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const r1 = (-b + Math.sqrt(disc)) / (2 * a);
      const r2 = (-b - Math.sqrt(disc)) / (2 * a);
      factors.push({ factor: [-r1, 1], power: 1 });
      if (Math.abs(r1 - r2) > 1e-12) factors.push({ factor: [-r2, 1], power: 1 });
      else factors[factors.length - 1]!.power = 2;
      remaining = [1];
    } else {
      // Irreducible over the reals: keep as a single quadratic factor.
      factors.push({ factor: monic(remaining), power: 1 });
      remaining = [1];
    }
  }

  if (degree(remaining) > 0) return null;
  return factors;
}

export function partialFractions(
  numeratorInput: Polynomial,
  denominatorInput: Polynomial,
): PartialFractionResult | null {
  const denominator = trim(denominatorInput);
  if (degree(denominator) < 1) return null;

  // Improper fraction: divide first.
  const division = polyDivide(numeratorInput, denominator);
  const numerator = trim(division.remainder);
  const polynomial = trim(division.quotient);

  if (degree(numerator) < 0) return { polynomial, terms: [], denominator, numerator };

  const factors = factorDenominator(denominator);
  if (!factors) return null;

  // Build the ansatz: unknown coefficients for each (factor, power) slot.
  interface Slot {
    factor: Polynomial;
    power: number;
    /** Basis polynomials multiplying each unknown. */
    basis: Polynomial[];
    unknowns: number;
  }
  const slots: Slot[] = factors.map(({ factor, power }) => ({
    factor,
    power,
    basis: new Array<number>(power).fill(0).map(() => [] as unknown as Polynomial).map(() => []),
    unknowns: factor.length === 2 ? power : 1,
  }));

  // Compute the full denominator D and, for each slot/order, D / factor^k.
  const totalDegree = degree(denominator);
  const cofactor = (factor: Polynomial, power: number): Polynomial | null => {
    let rest: Polynomial = [1];
    for (const entry of factors) {
      const exponent = entry.factor === factor ? entry.power - power : entry.power;
      for (let i = 0; i < exponent; i += 1) rest = polyMultiply(rest, entry.factor);
    }
    return degree(rest) === 0 && rest[0] === 1 ? [1] : rest;
  };

  const basisMatrix: Polynomial[] = [];
  for (const slot of slots) {
    const shape = slot.factor.length === 2 ? 1 : 2; // linear factor → 1 unknown, quadratic → 2
    const unknowns = shape * slot.power;
    slot.unknowns = unknowns;
    for (let power = 1; power <= slot.power; power += 1) {
      const cof = cofactor(slot.factor, power);
      if (!cof) return null;
      if (shape === 1) basisMatrix.push(trim(cof));
      else {
        basisMatrix.push(trim(cof)); // constant part
        basisMatrix.push(trim(polyMultiply(cof, [0, 1]))); // x part
      }
    }
  }

  const size = basisMatrix.length;
  const rows: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const rhs = new Array<number>(size).fill(0);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) rows[row]![col] = basisMatrix[col]![row] ?? 0;
    rhs[row] = numerator[row] ?? 0;
  }
  // Pad with the (possibly missing) high-order coefficients of the numerator.
  void totalDegree;

  const solution = solveLinearSystem(rows, rhs);
  if (!solution) return null;

  const terms: FractionTerm[] = [];
  let cursor = 0;
  for (const slot of slots) {
    if (slot.factor.length === 2) {
      for (let power = 1; power <= slot.power; power += 1) {
        const value = solution[cursor];
        cursor += 1;
        if (value === undefined || Math.abs(value) < 1e-12) continue;
        terms.push({ numerator: [value], factor: slot.factor, power });
      }
    } else {
      for (let power = 1; power <= slot.power; power += 1) {
        const b = solution[cursor];
        const c = solution[cursor + 1];
        cursor += 2;
        if (b === undefined || c === undefined) return null;
        if (Math.abs(b) < 1e-12 && Math.abs(c) < 1e-12) continue;
        terms.push({ numerator: trim([b, c]), factor: slot.factor, power });
      }
    }
  }

  // Verify: rebuild the rational function and compare with the input.
  let rebuilt: Polynomial = [0];
  for (const term of terms) {
    let division2: Polynomial = [1];
    for (const entry of factors) {
      const exponent = entry.factor === term.factor ? entry.power - term.power : entry.power;
      for (let i = 0; i < exponent; i += 1) division2 = polyMultiply(division2, entry.factor);
    }
    rebuilt = polyAdd(rebuilt, polyMultiply(term.numerator, division2));
  }
  const rebuiltTotal = polyAdd(rebuilt, polyMultiply(polynomial, denominator));
  const difference = trim(polySub(rebuiltTotal, numeratorInput));
  const scale = Math.max(1, ...trim(numeratorInput).map((c) => Math.abs(c)));
  if (difference.some((c) => Math.abs(c) > 1e-6 * scale)) return null;

  return { polynomial, terms, denominator, numerator };
}

/** Human-readable form, e.g. `1 / (x + 1) - 1 / (x + 2)`. */
export function partialFractionToString(result: PartialFractionResult, variable = 'x'): string {
  const pieces: Node[] = [];
  const polynomialPart = trim(result.polynomial);
  if (polynomialPart.some((coefficient) => coefficient !== 0)) pieces.push(polynomialToNode(polynomialPart, variable));
  for (const term of result.terms) {
    const numerator = polynomialToNode(trim(term.numerator), variable);
    let denominator = polynomialToNode(trim(term.factor), variable);
    if (term.power > 1) denominator = powNode(denominator, num(term.power));
    pieces.push(divNode(numerator, denominator));
  }
  if (pieces.length === 0) return '0';
  return formatNice(pieces.reduce((accumulator, piece) => addNode(accumulator, piece))).replace(/ \+ -/g, ' - ');
}

/** Rounds 0.9999999999 to 1 and −1.0000000001 to −1 without touching real values. */
export function roundNice(value: number): number {
  const rounded = Math.round(value * 1e10) / 1e10;
  const snapped = Math.round(value);
  return Math.abs(rounded - snapped) < 1e-9 ? snapped : rounded;
}

/** Roots of a factor, used by the integration rules. */
export function linearRoot(factor: Polynomial): number {
  return -factor[0]! / factor[1]!;
}

export { polyEvaluate, polyDerivative, squareFree };
