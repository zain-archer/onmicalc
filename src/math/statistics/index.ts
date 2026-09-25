import { CalcError } from '@/core/errors';

/** Descriptive statistics and regression. All functions are pure. */

function requireData(values: readonly number[], minimum = 1, label = 'data set'): void {
  if (values.length < minimum) {
    throw new CalcError('INPUT', `The ${label} needs at least ${minimum} value${minimum === 1 ? '' : 's'}`, {
      details: `Received ${values.length}.`,
    });
  }
  if (!values.every(Number.isFinite)) {
    throw new CalcError('INPUT', 'Every data point must be a finite number');
  }
}

export function sum(values: readonly number[]): number {
  requireData(values);
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: readonly number[]): number {
  requireData(values);
  return sum(values) / values.length;
}

export function median(values: readonly number[]): number {
  requireData(values);
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/** All values that appear most often (a data set can be multimodal). */
export function mode(values: readonly number[]): number[] {
  requireData(values);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const highest = Math.max(...counts.values());
  if (highest === 1) return [];
  return [...counts.entries()]
    .filter(([, count]) => count === highest)
    .map(([value]) => value)
    .sort((a, b) => a - b);
}

export const min = (values: readonly number[]): number => {
  requireData(values);
  return Math.min(...values);
};

export const max = (values: readonly number[]): number => {
  requireData(values);
  return Math.max(...values);
};

export const range = (values: readonly number[]): number => max(values) - min(values);

/** Sample variance (n − 1 denominator) — the default in scientific work. */
export function variance(values: readonly number[], kind: 'sample' | 'population' = 'sample'): number {
  requireData(values, kind === 'sample' ? 2 : 1);
  const average = mean(values);
  const squares = values.reduce((total, value) => total + (value - average) ** 2, 0);
  return squares / (kind === 'sample' ? values.length - 1 : values.length);
}

export function standardDeviation(
  values: readonly number[],
  kind: 'sample' | 'population' = 'sample',
): number {
  return Math.sqrt(variance(values, kind));
}

export function quartiles(values: readonly number[]): { q1: number; q2: number; q3: number } {
  requireData(values, 2);
  const sorted = [...values].sort((a, b) => a - b);
  return { q1: percentile(sorted, 25), q2: median(sorted), q3: percentile(sorted, 75) };
}

/** Linear-interpolation percentile (the method used by most statistical software). */
export function percentile(values: readonly number[], p: number): number {
  requireData(values);
  if (p < 0 || p > 100) throw new CalcError('INPUT', 'Percentiles are between 0 and 100');
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const position = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function interquartileRange(values: readonly number[]): number {
  const { q1, q3 } = quartiles(values);
  return q3 - q1;
}

export function zScore(value: number, values: readonly number[], kind: 'sample' | 'population' = 'sample'): number {
  const deviation = standardDeviation(values, kind);
  if (deviation === 0) {
    throw new CalcError('DOMAIN', 'The z-score is undefined when the deviation is zero');
  }
  return (value - mean(values)) / deviation;
}

export function covariance(a: readonly number[], b: readonly number[], kind: 'sample' | 'population' = 'sample'): number {
  if (a.length !== b.length) throw new CalcError('DIMENSION', 'Both data sets need the same length');
  requireData(a, 2);
  const meanA = mean(a);
  const meanB = mean(b);
  const total = a.reduce((acc, value, index) => acc + (value - meanA) * (b[index]! - meanB), 0);
  return total / (kind === 'sample' ? a.length - 1 : a.length);
}

export function correlation(a: readonly number[], b: readonly number[]): number {
  const denominator = standardDeviation(a) * standardDeviation(b);
  if (denominator === 0) {
    throw new CalcError('DOMAIN', 'Correlation is undefined when a data set has no variation');
  }
  return covariance(a, b) / denominator;
}

export interface Regression {
  slope: number;
  intercept: number;
  /** Coefficient of determination. */
  r2: number;
  r: number;
  equation: string;
  /** Predicted value for an x, using the fitted line. */
  predict: (x: number) => number;
  residuals: number[];
}

/** Ordinary least-squares linear regression with R². */
export function linearRegression(x: readonly number[], y: readonly number[]): Regression {
  if (x.length !== y.length) throw new CalcError('DIMENSION', 'x and y must have the same length');
  requireData(x, 2, 'x data');
  requireData(y, 2, 'y data');

  const meanX = mean(x);
  const meanY = mean(y);
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < x.length; i += 1) {
    sxx += (x[i]! - meanX) ** 2;
    sxy += (x[i]! - meanX) * (y[i]! - meanY);
  }
  if (sxx === 0) {
    throw new CalcError('DOMAIN', 'Regression needs at least two distinct x values');
  }

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const predicted = x.map((value) => slope * value + intercept);
  const residuals = y.map((value, index) => value - predicted[index]!);
  const ssTotal = y.reduce((total, value) => total + (value - meanY) ** 2, 0);
  const ssResidual = residuals.reduce((total, value) => total + value ** 2, 0);
  const r2 = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;
  const r = correlation(x, y);

  return {
    slope,
    intercept,
    r2,
    r,
    equation: `y = ${trim(slope)}x ${intercept < 0 ? '−' : '+'} ${trim(Math.abs(intercept))}`,
    predict: (value: number) => slope * value + intercept,
    residuals,
  };
}

function trim(value: number): string {
  return String(Number(value.toPrecision(8)));
}

export interface Summary {
  count: number;
  sum: number;
  mean: number;
  median: number;
  modes: number[];
  min: number;
  max: number;
  range: number;
  varianceSample: number;
  variancePopulation: number;
  sdSample: number;
  sdPopulation: number;
  q1: number;
  q3: number;
  iqr: number;
  standardError: number;
}

/** One-call summary used by the statistics panel. */
export function summarize(values: readonly number[]): Summary {
  requireData(values, 2);
  const { q1, q2, q3 } = quartiles(values);
  const sd = standardDeviation(values, 'sample');
  return {
    count: values.length,
    sum: sum(values),
    mean: mean(values),
    median: q2,
    modes: mode(values),
    min: min(values),
    max: max(values),
    range: range(values),
    varianceSample: variance(values, 'sample'),
    variancePopulation: variance(values, 'population'),
    sdSample: sd,
    sdPopulation: standardDeviation(values, 'population'),
    q1,
    q3,
    iqr: q3 - q1,
    standardError: sd / Math.sqrt(values.length),
  };
}

/** Parses "1, 2 3\n4" into numbers. Returns null when a token is not numeric. */
export function parseDataset(input: string): number[] | null {
  const tokens = input.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const values: number[] = [];
  for (const token of tokens) {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(token)) return null;
    values.push(Number(token));
  }
  return values;
}

export * from './descriptive';
export * from './regression';
export * from './inference';
