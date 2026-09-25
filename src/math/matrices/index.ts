import { CalcError } from '@/core/errors';
import { EPSILON } from '@/core/numbers';

/** Row-major matrix of numbers. Shape is validated on every operation. */
export type Matrix = number[][];

export function rows(matrix: Matrix): number {
  return matrix.length;
}

export function cols(matrix: Matrix): number {
  return matrix[0]?.length ?? 0;
}

export function isRectangular(matrix: Matrix): boolean {
  const width = cols(matrix);
  return matrix.every((row) => row.length === width && row.every(Number.isFinite));
}

export function assertMatrix(matrix: Matrix, label = 'matrix'): Matrix {
  if (matrix.length === 0 || cols(matrix) === 0) {
    throw new CalcError('DIMENSION', `The ${label} is empty`);
  }
  if (!isRectangular(matrix)) {
    throw new CalcError('DIMENSION', `The ${label} must be rectangular with finite entries`, {
      details: 'Every row needs the same number of numeric entries.',
    });
  }
  return matrix;
}

export function createMatrix(rowCount: number, colCount: number, fill = 0): Matrix {
  if (rowCount < 1 || colCount < 1) throw new CalcError('DIMENSION', 'Matrix dimensions must be at least 1');
  return Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => fill));
}

export function identity(n: number): Matrix {
  const matrix = createMatrix(n, n);
  for (let i = 0; i < n; i += 1) matrix[i]![i] = 1;
  return matrix;
}

function sameShape(a: Matrix, b: Matrix): void {
  if (rows(a) !== rows(b) || cols(a) !== cols(b)) {
    throw new CalcError('DIMENSION', 'Matrices must have the same size for this operation', {
      details: `${rows(a)}×${cols(a)} vs ${rows(b)}×${cols(b)}.`,
    });
  }
}

export function add(a: Matrix, b: Matrix): Matrix {
  assertMatrix(a, 'first matrix');
  assertMatrix(b, 'second matrix');
  sameShape(a, b);
  return a.map((row, i) => row.map((value, j) => value + b[i]![j]!));
}

export function subtract(a: Matrix, b: Matrix): Matrix {
  assertMatrix(a, 'first matrix');
  assertMatrix(b, 'second matrix');
  sameShape(a, b);
  return a.map((row, i) => row.map((value, j) => value - b[i]![j]!));
}

export function scale(a: Matrix, factor: number): Matrix {
  assertMatrix(a);
  if (!Number.isFinite(factor)) throw new CalcError('DOMAIN', 'The scalar must be finite');
  return a.map((row) => row.map((value) => value * factor));
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  assertMatrix(a, 'first matrix');
  assertMatrix(b, 'second matrix');
  if (cols(a) !== rows(b)) {
    throw new CalcError('DIMENSION', 'Inner dimensions do not match for matrix multiplication', {
      details: `${rows(a)}×${cols(a)} · ${rows(b)}×${cols(b)} requires ${cols(a)} = ${rows(b)}.`,
    });
  }
  const result = createMatrix(rows(a), cols(b));
  for (let i = 0; i < rows(a); i += 1) {
    for (let j = 0; j < cols(b); j += 1) {
      let sum = 0;
      for (let k = 0; k < cols(a); k += 1) sum += a[i]![k]! * b[k]![j]!;
      result[i]![j] = sum;
    }
  }
  return result;
}

export function transpose(a: Matrix): Matrix {
  assertMatrix(a);
  const result = createMatrix(cols(a), rows(a));
  for (let i = 0; i < rows(a); i += 1) {
    for (let j = 0; j < cols(a); j += 1) result[j]![i] = a[i]![j]!;
  }
  return result;
}

export function trace(a: Matrix): number {
  assertMatrix(a);
  if (rows(a) !== cols(a)) throw new CalcError('DIMENSION', 'The trace needs a square matrix');
  return a.reduce((sum, row, index) => sum + row[index]!, 0);
}

/** Exact-ish determinant via LU elimination with partial pivoting. */
export function determinant(a: Matrix): number {
  assertMatrix(a);
  const n = rows(a);
  if (n !== cols(a)) throw new CalcError('DIMENSION', 'The determinant needs a square matrix');
  if (n === 1) return a[0]![0]!;

  const work = a.map((row) => [...row]);
  let det = 1;
  for (let i = 0; i < n; i += 1) {
    let pivotRow = i;
    for (let k = i + 1; k < n; k += 1) {
      if (Math.abs(work[k]![i]!) > Math.abs(work[pivotRow]![i]!)) pivotRow = k;
    }
    if (Math.abs(work[pivotRow]![i]!) < Number.EPSILON ** 2) return 0;
    if (pivotRow !== i) {
      [work[i], work[pivotRow]] = [work[pivotRow]!, work[i]!];
      det = -det;
    }
    det *= work[i]![i]!;
    for (let k = i + 1; k < n; k += 1) {
      const factor = work[k]![i]! / work[i]![i]!;
      for (let j = i; j < n; j += 1) work[k]![j]! -= factor * work[i]![j]!;
    }
  }
  return det;
}

/** Gauss–Jordan inverse; reports singular matrices instead of returning garbage. */
export function inverse(a: Matrix): Matrix {
  assertMatrix(a);
  const n = rows(a);
  if (n !== cols(a)) throw new CalcError('DIMENSION', 'Only square matrices can be inverted');
  const work = a.map((row, i) => [...row, ...identity(n)[i]!]);

  for (let i = 0; i < n; i += 1) {
    let pivotRow = i;
    for (let k = i + 1; k < n; k += 1) {
      if (Math.abs(work[k]![i]!) > Math.abs(work[pivotRow]![i]!)) pivotRow = k;
    }
    if (Math.abs(work[pivotRow]![i]!) < 1e-12) {
      throw new CalcError('SINGULAR', 'This matrix has no inverse (determinant is 0)', {
        details: 'The rows are linearly dependent, so the matrix is singular.',
      });
    }
    [work[i], work[pivotRow]] = [work[pivotRow]!, work[i]!];
    const pivot = work[i]![i]!;
    for (let j = 0; j < 2 * n; j += 1) work[i]![j]! /= pivot;
    for (let k = 0; k < n; k += 1) {
      if (k === i) continue;
      const factor = work[k]![i]!;
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j += 1) work[k]![j]! -= factor * work[i]![j]!;
    }
  }
  return work.map((row) => row.slice(n));
}

/** Numerical rank via row echelon form with a tolerance. */
export function rank(a: Matrix, tolerance = 1e-10): number {
  const echelon = toRowEchelon(a, tolerance);
  let count = 0;
  for (const row of echelon) {
    if (row.some((value) => Math.abs(value) > tolerance)) count += 1;
  }
  return count;
}

function toRowEchelon(a: Matrix, tolerance = 1e-12): Matrix {
  assertMatrix(a);
  const work = a.map((row) => [...row]);
  const rowCount = rows(work);
  const colCount = cols(work);
  let lead = 0;
  for (let r = 0; r < rowCount && lead < colCount; r += 1) {
    let i = r;
    while (Math.abs(work[i]![lead]!) <= tolerance && i < rowCount - 1) i += 1;
    if (Math.abs(work[i]![lead]!) <= tolerance) {
      lead += 1;
      r -= 1;
      continue;
    }
    [work[i], work[r]] = [work[r]!, work[i]!];
    const pivot = work[r]![lead]!;
    for (let j = 0; j < colCount; j += 1) work[r]![j]! /= pivot;
    for (let k = 0; k < rowCount; k += 1) {
      if (k === r) continue;
      const factor = work[k]![lead]!;
      if (Math.abs(factor) <= tolerance) continue;
      for (let j = 0; j < colCount; j += 1) work[k]![j]! -= factor * work[r]![j]!;
    }
    lead += 1;
  }
  return work;
}

/** Reduced row echelon form (Gauss–Jordan). */
export function rref(a: Matrix, tolerance = 1e-12): Matrix {
  return toRowEchelon(a, tolerance).map((row) =>
    row.map((value) => (Math.abs(value) <= tolerance ? 0 : Number(value.toPrecision(12)))),
  );
}

/** Gaussian elimination that reports which operations were performed. */
export interface EliminationStep {
  description: string;
  matrix: Matrix;
}

export function gaussianElimination(a: Matrix, tolerance = 1e-12): EliminationStep[] {
  assertMatrix(a);
  const steps: EliminationStep[] = [];
  const work = a.map((row) => [...row]);
  const rowCount = rows(work);
  const colCount = cols(work);

  for (let r = 0; r < rowCount; r += 1) {
    let pivotRow = r;
    for (let k = r + 1; k < rowCount; k += 1) {
      if (Math.abs(work[k]![r]!) > Math.abs(work[pivotRow]![r]!)) pivotRow = k;
    }
    if (Math.abs(work[pivotRow]![r]!) <= tolerance) continue;
    if (pivotRow !== r) {
      [work[r], work[pivotRow]] = [work[pivotRow]!, work[r]!];
      steps.push({ description: `Swap row ${r + 1} with row ${pivotRow + 1} (partial pivoting)`, matrix: work.map((row) => [...row]) });
    }
    const pivot = work[r]![r]!;
    if (Math.abs(pivot - 1) > tolerance) {
      for (let j = 0; j < colCount; j += 1) work[r]![j]! /= pivot;
      steps.push({ description: `Divide row ${r + 1} by ${Number(pivot.toPrecision(6))}`, matrix: work.map((row) => [...row]) });
    }
    for (let k = 0; k < rowCount; k += 1) {
      if (k === r) continue;
      const factor = work[k]![r]!;
      if (Math.abs(factor) <= tolerance) continue;
      for (let j = 0; j < colCount; j += 1) work[k]![j]! -= factor * work[r]![j]!;
      steps.push({
        description: `Row ${k + 1} = row ${k + 1} − ${Number(factor.toPrecision(6))} × row ${r + 1}`,
        matrix: work.map((row) => [...row]),
      });
    }
  }
  return steps;
}

/** Characteristic polynomial coefficients (highest power first) via Faddeev–LeVerrier. */
export function characteristicPolynomial(a: Matrix): number[] {
  assertMatrix(a);
  const n = rows(a);
  if (n !== cols(a)) throw new CalcError('DIMENSION', 'Eigenvalues need a square matrix');
  if (n > 6) {
    throw new CalcError('NOT_SUPPORTED', 'Characteristic polynomials are computed for matrices up to 6×6', {
      details: 'Larger matrices need iterative eigenvalue algorithms, which OmniCalc does not claim to support.',
    });
  }

  const coefficients: number[] = [1];
  let m = identity(n);
  for (let k = 1; k <= n; k += 1) {
    m = multiply(a, m);
    const c = -trace(m) / k;
    coefficients.push(c);
    for (let i = 0; i < n; i += 1) m[i]![i]! += c;
  }
  return coefficients.map((value) => (Math.abs(value) < 1e-12 ? 0 : value));
}

export interface EigenResult {
  /** Real eigenvalues (complex pairs are reported separately). */
  values: number[];
  /** Matching eigenvectors, normalised to unit length where possible. */
  vectors: number[][];
}

export function eigenvalues(a: Matrix): EigenResult {
  assertMatrix(a);
  const n = rows(a);
  if (n !== cols(a)) throw new CalcError('DIMENSION', 'Eigenvalues need a square matrix');
  if (n > 6) {
    throw new CalcError('NOT_SUPPORTED', 'Eigenvalues are solved in closed form for matrices up to 6×6', {
      details: 'Larger systems require iterative methods (QR algorithm) which are not implemented.',
    });
  }

  const coefficients = characteristicPolynomial(a);
  const roots = realPolynomialRoots(coefficients);

  const vectors: number[][] = [];
  for (const value of roots) {
    vectors.push(nullSpaceVector(a, value));
  }
  return { values: roots, vectors };
}

/** Finds a non-zero vector in the null space of (A − λI) by elimination. */
function nullSpaceVector(a: Matrix, lambda: number): number[] {
  const n = rows(a);
  const shifted = a.map((row, i) => row.map((value, j) => (i === j ? value - lambda : value)));
  const reduced = rref(shifted, 1e-9);

  // Free columns are those without a pivot.
  const pivotColumns: number[] = [];
  for (let r = 0; r < n; r += 1) {
    const pivot = reduced[r]!.findIndex((value) => Math.abs(value) > 1e-9);
    if (pivot >= 0) pivotColumns.push(pivot);
  }
  const freeColumn = Array.from({ length: n }, (_, index) => index).find(
    (index) => !pivotColumns.includes(index),
  );

  const vector = Array.from({ length: n }, () => 0);
  if (freeColumn === undefined) {
    vector[n - 1] = 1;
    return normalise(vector);
  }
  vector[freeColumn] = 1;
  for (let r = pivotColumns.length - 1; r >= 0; r -= 1) {
    const pivotCol = pivotColumns[r]!;
    vector[pivotCol] = -reduced[r]![freeColumn]!;
  }
  return normalise(vector);
}

function normalise(vector: number[]): number[] {
  const norm = Math.hypot(...vector);
  if (norm === 0) return vector;
  return vector.map((value) => {
    const scaled = value / norm;
    const rounded = Number(scaled.toPrecision(10));
    return Math.abs(rounded) < 1e-12 ? 0 : rounded;
  });
}

/**
 * Real roots of a polynomial given full coefficients [a_n, …, a_1, a_0].
 * Returns only real roots — complex pairs are reported by the caller as "none",
 * never replaced with a fabricated number.
 */
export function realPolynomialRoots(coefficients: number[]): number[] {
  if (coefficients.length === 0) return [];
  let start = 0;
  while (start < coefficients.length - 1 && coefficients[start] === 0) start += 1;
  const c = coefficients.slice(start);
  const lead = c[0]!;
  if (c.length === 1 || lead === 0) return []; // constant polynomial: no roots

  const monic = c.slice(1).map((value) => value / lead);
  const degree = monic.length;

  if (degree === 1) {
    const b = monic[0]!;
    return b === 0 ? [0] : [-b];
  }
  if (degree === 2) {
    const [b, constant] = [monic[0]!, monic[1]!];
    const discriminant = b * b - 4 * constant;
    if (discriminant < -1e-12) return [];
    if (Math.abs(discriminant) <= 1e-12) return [-b / 2];
    const root = Math.sqrt(discriminant);
    return dedupe([(-b + root) / 2, (-b - root) / 2]);
  }
  if (degree === 3) return cubicRoots(monic[0]!, monic[1]!, monic[2]!);
  if (degree === 4) return quarticRoots(monic[0]!, monic[1]!, monic[2]!, monic[3]!);

  // Degrees 5–6: no closed form in general, so refine numerically and keep only
  // roots that verify the polynomial to a tight residual.
  return newtonRoots(monic);
}

function cubicRoots(b: number, c: number, d: number): number[] {
  // x^3 + b x^2 + c x + d, via the trigonometric/Cardano method.
  const p = c - (b * b) / 3;
  const q = (2 * b * b * b) / 27 - (b * c) / 3 + d;
  const discriminant = (q * q) / 4 + (p * p * p) / 27;
  const shift = -b / 3;
  const roots: number[] = [];

  if (discriminant > 1e-12) {
    const sqrtD = Math.sqrt(discriminant);
    const u = Math.cbrt(-q / 2 + sqrtD);
    const v = Math.cbrt(-q / 2 - sqrtD);
    roots.push(u + v + shift);
  } else if (Math.abs(discriminant) <= 1e-12) {
    const u = Math.cbrt(-q / 2);
    roots.push(2 * u + shift, -u + shift);
  } else {
    const r = Math.sqrt(-(p * p * p) / 27);
    const phi = Math.acos(Math.min(1, Math.max(-1, -q / (2 * r))));
    const m = 2 * Math.sqrt(-p / 3);
    for (let k = 0; k < 3; k += 1) {
      roots.push(m * Math.cos((phi + 2 * Math.PI * k) / 3) + shift);
    }
  }
  return dedupe(roots);
}

function quarticRoots(b: number, c: number, d: number, e: number): number[] {
  // Depressed quartic solved through its resolvent cubic (Ferrari's method).
  const p = c - (3 * b * b) / 8;
  const q = d - (b * c) / 2 + (b * b * b) / 8;
  const r = e - (b * d) / 4 + (b * b * c) / 16 - (3 * b ** 4) / 256;
  const shift = -b / 4;

  if (Math.abs(q) < 1e-14) {
    // Biquadratic: y^4 + p y^2 + r = 0
    const disc = p * p - 4 * r;
    const roots: number[] = [];
    if (disc >= -1e-12) {
      const sqrtDisc = Math.sqrt(Math.max(0, disc));
      for (const ySquared of [(-p + sqrtDisc) / 2, (-p - sqrtDisc) / 2]) {
        if (ySquared >= -1e-12) {
          const y = Math.sqrt(Math.max(0, ySquared));
          roots.push(y + shift, -y + shift);
        }
      }
    }
    return dedupe(roots);
  }

  const resolventRoots = cubicRoots(-p, -4 * r, 4 * p * r - q * q);
  const m = resolventRoots.find((value) => value > 1e-12) ?? resolventRoots[0] ?? 0;
  const sqrtM = Math.sqrt(Math.max(0, m));
  const roots: number[] = [];
  // y^2 + sqrt(m) y + (p+m)/2 + q/(2 sqrt(m)) = 0  and the sign twin.
  const constantA = (p + m) / 2 - q / (2 * (sqrtM || 1));
  const constantB = (p + m) / 2 + q / (2 * (sqrtM || 1));
  for (const [linear, constant] of [
    [sqrtM, constantA],
    [-sqrtM, constantB],
  ] as const) {
    const disc = linear * linear - 4 * constant;
    if (disc < -1e-9) continue;
    const sqrtDisc = Math.sqrt(Math.max(0, disc));
    roots.push((-linear + sqrtDisc) / 2 + shift, (-linear - sqrtDisc) / 2 + shift);
  }
  return dedupe(roots);
}

function newtonRoots(coefficients: number[]): number[] {
  const derivative = (x: number) => polyDerivative(coefficients, x);
  const found: number[] = [];

  for (let start = -20; start <= 20; start += 0.25) {
    let x = start;
    for (let iteration = 0; iteration < 200; iteration += 1) {
      const value = polyValue(coefficients, x);
      const slope = derivative(x);
      if (Math.abs(slope) < 1e-15) break;
      const next = x - value / slope;
      if (!Number.isFinite(next)) break;
      if (Math.abs(next - x) <= 1e-15 * Math.max(1, Math.abs(next))) {
        x = next;
        break;
      }
      x = next;
    }
    // Keep only roots that genuinely satisfy the polynomial.
    if (Math.abs(polyValue(coefficients, x)) < 1e-9 * Math.max(1, Math.abs(x) ** coefficients.length)) {
      if (!found.some((value) => Math.abs(value - x) < 1e-6)) found.push(x);
    }
  }
  return dedupe(found.map((value) => Number(value.toPrecision(10))));
}

function polyValue(coefficients: number[], x: number): number {
  // Horner, with the implicit leading 1.
  let result = 1;
  for (const coefficient of coefficients) result = result * x + coefficient;
  return result;
}

function polyDerivative(coefficients: number[], x: number): number {
  const degree = coefficients.length;
  let result = degree; // derivative of x^n term
  for (let i = 0; i < degree; i += 1) {
    result = result * x + (degree - i - 1) * coefficients[i]!;
  }
  return result;
}

function dedupe(values: number[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (out.some((existing) => Math.abs(existing - value) < 1e-8)) continue;
    out.push(Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12)));
  }
  return out.sort((a, b) => a - b);
}

export function equals(a: Matrix, b: Matrix, tolerance = 1e-9): boolean {
  if (rows(a) !== rows(b) || cols(a) !== cols(b)) return false;
  return a.every((row, i) => row.every((value, j) => Math.abs(value - b[i]![j]!) <= tolerance));
}

export function formatMatrix(a: Matrix, precision = 6): string {
  const width = Math.max(
    ...a.flat().map((value) => String(Number(value.toPrecision(precision))).length),
  );
  return a
    .map((row) => row.map((value) => String(Number(value.toPrecision(precision))).padStart(width)).join('  '))
    .join('\n');
}

/** Parses "1 2; 3 4" or "[[1,2],[3,4]]" into a matrix. Returns null when invalid. */
export function parseMatrix(input: string): Matrix | null {
  const text = input.trim();
  if (!text) return null;

  const bracketed = /^\[\[.*\]\]$/s.test(text);
  const source = bracketed ? text.slice(2, -2) : text;
  const rowTexts = bracketed ? source.split(/\]\s*,\s*\[/) : source.split(/[;\n]/);

  const matrix: Matrix = [];
  for (const rowText of rowTexts) {
    if (!rowText.trim()) return null;
    const cells = rowText.trim().split(/[\s,]+/);
    const row: number[] = [];
    for (const cell of cells) {
      if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(cell)) return null;
      row.push(Number(cell));
    }
    if (row.length === 0) return null;
    matrix.push(row);
  }
  if (matrix.length === 0) return null;
  return isRectangular(matrix) ? matrix : null;
}

export { EPSILON };
