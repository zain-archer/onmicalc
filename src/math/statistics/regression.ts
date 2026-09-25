import { CalcError } from '@/core/errors';
import { rref, type Matrix } from '@/math/matrices';
import { formatNumber } from '@/core/precision/format';

/**
 * Least-squares curve fitting.
 *
 * Straight lines live in `./index` (linearRegression); this module adds the
 * polynomial, multiple, exponential, power and logarithmic fits, all solved the
 * same way — build the design matrix, solve the normal equations with the
 * matrix module's own reduced row echelon form, then report the coefficients,
 * R², the adjusted R² and the standard error of the estimate.
 */

export interface FitResult {
  kind: 'polynomial' | 'multiple' | 'exponential' | 'power' | 'logarithmic';
  /** Coefficients in the order used by `equation` (ascending powers for polynomials). */
  coefficients: number[];
  equation: string;
  r2: number;
  adjustedR2: number;
  /** Standard error of the estimate (residual standard deviation). */
  standardError: number;
  /** Number of fitted coefficients, including the intercept. */
  termCount: number;
  points: number;
  predict: (x: number) => number;
  residuals: number[];
  note?: string;
}

function requirePairs(x: readonly number[], y: readonly number[], minimum: number): void {
  if (x.length !== y.length) {
    throw new CalcError('INPUT', `There must be one y for every x (${x.length} x values, ${y.length} y values)`);
  }
  if (x.length < minimum) {
    throw new CalcError('INPUT', `At least ${minimum} points are needed for this fit`, { details: `Received ${x.length}.` });
  }
  if ([...x, ...y].some((value) => !Number.isFinite(value))) {
    throw new CalcError('INPUT', 'Every data point must be a finite number');
  }
}

/** Solves the normal equations for a design matrix and reports the fit quality. */
function leastSquaresFit(
  design: number[][],
  y: readonly number[],
  kind: FitResult['kind'],
  equation: (coefficients: number[]) => string,
  predict: (coefficients: number[], x: number) => number,
  note?: string,
): FitResult {
  const rows = design.length;
  const columns = design[0]!.length;
  if (rows < columns) {
    throw new CalcError('INPUT', `This fit needs at least ${columns} points (it has ${columns} coefficients)`, {
      details: `Received ${rows}.`,
    });
  }
  // Normal equations: (XᵀX) β = Xᵀy.
  const augmented: Matrix = Array.from({ length: columns }, (_, i) => {
    const row: number[] = Array.from({ length: columns }, (_, j) =>
      design.reduce((sum, designRow) => sum + designRow[i]! * designRow[j]!, 0),
    );
    row.push(design.reduce((sum, designRow, index) => sum + designRow[i]! * y[index]!, 0));
    return row;
  });
  const reduced = rref(augmented, 1e-12);
  const coefficients = reduced.map((row) => row[columns]!);
  if (coefficients.some((value) => !Number.isFinite(value))) {
    throw new CalcError('CONVERGENCE', 'The fit could not be solved — the data may be degenerate (repeated x values)');
  }

  const predicted = design.map((row) => row.reduce((sum, value, index) => sum + value * coefficients[index]!, 0));
  const residualValues = y.map((value, index) => value - predicted[index]!);
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length;
  const totalSum = y.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const residualSum = residualValues.reduce((sum, value) => sum + value * value, 0);
  const r2 = totalSum < 1e-300 ? 1 : 1 - residualSum / totalSum;
  const degreesOfFreedom = Math.max(1, rows - columns);
  const standardError = Math.sqrt(residualSum / degreesOfFreedom);
  const adjustedR2 =
    rows - columns > 0 ? 1 - (1 - r2) * ((rows - 1) / (rows - columns)) : Number.NaN;

  return {
    kind,
    coefficients,
    equation: equation(coefficients),
    r2,
    adjustedR2,
    standardError,
    termCount: columns,
    points: rows,
    predict: (x: number) => predict(coefficients, x),
    residuals: residualValues,
    note,
  };
}

function format(value: number): string {
  return formatNumber(value, { precision: 6 });
}

/** Polynomial y = a₀ + a₁x + … + a_dx^d. Coefficients come back in ascending order. */
export function polynomialRegression(x: readonly number[], y: readonly number[], degree = 2): FitResult {
  const order = Math.floor(degree);
  if (order < 1 || order > 10) throw new CalcError('INPUT', 'The degree must be a whole number between 1 and 10');
  requirePairs(x, y, order + 1);
  const design = x.map((value) => Array.from({ length: order + 1 }, (_, power) => value ** power));
  const equation = (coefficients: number[]) => {
    const terms = coefficients
      .map((coefficient, power) => ({ coefficient, power }))
      .reverse()
      .filter((term) => Math.abs(term.coefficient) > 1e-12);
    if (terms.length === 0) return 'y = 0';
    return `y = ${terms
      .map((term, index) => {
        const magnitude = format(Math.abs(term.coefficient));
        const body = term.power === 0 ? magnitude : term.power === 1 ? `${magnitude}·x` : `${magnitude}·x^${term.power}`;
        if (index === 0) return `${term.coefficient < 0 ? '−' : ''}${body}`;
        return `${term.coefficient < 0 ? ' − ' : ' + '}${body}`;
      })
      .join('')}`;
  };
  return leastSquaresFit(
    design,
    y,
    'polynomial',
    equation,
    (coefficients, value) => coefficients.reduce((sum, coefficient, power) => sum + coefficient * value ** power, 0),
    order === 1 ? 'A straight line; use the linear regression tool for the slope/intercept form.' : undefined,
  );
}

/**
 * Multiple regression y = b₀ + b₁x₁ + … + b_kx_k.
 * `columns` holds one array per explanatory variable.
 */
export function multipleRegression(columns: readonly (readonly number[])[], y: readonly number[]): FitResult {
  if (columns.length < 1) throw new CalcError('INPUT', 'At least one explanatory variable is needed');
  const length = y.length;
  requirePairs(columns[0]!, y, columns.length + 1);
  for (const column of columns) {
    if (column.length !== length) throw new CalcError('INPUT', 'Every variable must have the same number of values');
  }
  const design = Array.from({ length }, (_, row) => [1, ...columns.map((column) => column[row]!)]);
  const equation = (coefficients: number[]) =>
    `y = ${format(coefficients[0]!)}${coefficients
      .slice(1)
      .map((coefficient, index) => ` ${coefficient < 0 ? '−' : '+'} ${format(Math.abs(coefficient))}·x${index + 1}`)
      .join('')}`;
  return leastSquaresFit(
    design,
    y,
    'multiple',
    equation,
    (coefficients, value) => coefficients[0]! + coefficients.slice(1).reduce((sum, coefficient) => sum + coefficient * value, 0),
    'R² always rises when more variables are added — compare models with the adjusted R².',
  );
}

/** Exponential fit y = a·e^(bx) — needs positive y values (it fits ln y). */
export function exponentialRegression(x: readonly number[], y: readonly number[]): FitResult {
  requirePairs(x, y, 2);
  if (y.some((value) => value <= 0)) {
    throw new CalcError('DOMAIN', 'An exponential fit needs positive y values, because it takes ln y');
  }
  const design = x.map((value) => [1, value]);
  const logY = y.map((value) => Math.log(value));
  const fit = leastSquaresFit(
    design,
    logY,
    'exponential',
    () => 'y = a·e^(b·x)',
    (coefficients, value) => coefficients[0]! + coefficients[1]! * value,
  );
  const a = Math.exp(fit.coefficients[0]!);
  const b = fit.coefficients[1]!;
  const predicted = x.map((value) => a * Math.exp(b * value));
  const residuals = y.map((value, index) => value - predicted[index]!);
  return {
    ...fit,
    coefficients: [a, b],
    equation: `y = ${format(a)}·e^(${format(b)}·x)`,
    predict: (value: number) => a * Math.exp(b * value),
    residuals,
    note: 'The straight line was fitted to ln y, so R² refers to the log scale.',
  };
}

/** Power fit y = a·x^b — needs positive x and y. */
export function powerRegression(x: readonly number[], y: readonly number[]): FitResult {
  requirePairs(x, y, 2);
  if (x.some((value) => value <= 0) || y.some((value) => value <= 0)) {
    throw new CalcError('DOMAIN', 'A power fit needs positive x and y values, because it takes logarithms');
  }
  const design = x.map((value) => [1, Math.log(value)]);
  const logY = y.map((value) => Math.log(value));
  const fit = leastSquaresFit(
    design,
    logY,
    'power',
    () => 'y = a·x^b',
    (coefficients, value) => coefficients[0]! + coefficients[1]! * value,
  );
  const a = Math.exp(fit.coefficients[0]!);
  const b = fit.coefficients[1]!;
  const predicted = x.map((value) => a * value ** b);
  return {
    ...fit,
    coefficients: [a, b],
    equation: `y = ${format(a)}·x^${format(b)}`,
    predict: (value: number) => a * value ** b,
    residuals: y.map((value, index) => value - predicted[index]!),
    note: 'Fitted on log–log axes, so R² refers to the log scale.',
  };
}

/** Logarithmic fit y = a + b·ln x — needs positive x. */
export function logarithmicRegression(x: readonly number[], y: readonly number[]): FitResult {
  requirePairs(x, y, 2);
  if (x.some((value) => value <= 0)) {
    throw new CalcError('DOMAIN', 'A logarithmic fit needs positive x values, because it takes ln x');
  }
  const design = x.map((value) => [1, Math.log(value)]);
  const fit = leastSquaresFit(
    design,
    y,
    'logarithmic',
    (coefficients) => `y = ${format(coefficients[0]!)} + ${format(coefficients[1]!)}·ln(x)`,
    (coefficients, value) => coefficients[0]! + coefficients[1]! * Math.log(value),
  );
  return fit;
}
