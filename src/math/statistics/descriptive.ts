import { CalcError } from '@/core/errors';
import { mean, standardDeviation, variance } from './index';

/**
 * Descriptive statistics beyond the basic summary: shape, spread, spread
 * relative to size, ranks, association and distribution shape of a dataset.
 * Every function checks its input and explains what is missing rather than
 * returning NaN silently.
 */

function requireValues(values: readonly number[], minimum = 1, label = 'data'): void {
  if (values.length < minimum) {
    throw new CalcError('INPUT', `At least ${minimum} value${minimum === 1 ? '' : 's'} of ${label} are needed`, {
      details: `Received ${values.length}.`,
    });
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new CalcError('INPUT', `Every value of ${label} must be a finite number`);
  }
}

function requirePositive(values: readonly number[], label: string): void {
  requireValues(values, 1, label);
  if (values.some((value) => value <= 0)) {
    throw new CalcError('DOMAIN', `Every value of ${label} must be positive for this average`);
  }
}

/** Geometric mean: the average growth factor (all values must be positive). */
export function geometricMean(values: readonly number[]): number {
  requirePositive(values, 'the data');
  return Math.exp(values.reduce((total, value) => total + Math.log(value), 0) / values.length);
}

/** Harmonic mean: the right average for rates and ratios (all values positive). */
export function harmonicMean(values: readonly number[]): number {
  requirePositive(values, 'the data');
  return values.length / values.reduce((total, value) => total + 1 / value, 0);
}

/** Weighted mean: weights must match the data in length and not cancel out. */
export function weightedMean(values: readonly number[], weights: readonly number[]): number {
  requireValues(values, 1);
  if (values.length !== weights.length) {
    throw new CalcError('INPUT', `There must be one weight for every value (${values.length} values, ${weights.length} weights)`);
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new CalcError('DOMAIN', 'Weights must be finite and not negative');
  }
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) throw new CalcError('DOMAIN', 'The weights add up to zero, so no weighted average exists');
  return values.reduce((sum, value, index) => sum + value * weights[index]!, 0) / total;
}

/** Midpoint between the smallest and largest value. */
export function midrange(values: readonly number[]): number {
  requireValues(values);
  return (Math.min(...values) + Math.max(...values)) / 2;
}

/** Mean absolute deviation from the mean — spread without squaring. */
export function meanAbsoluteDeviation(values: readonly number[]): number {
  requireValues(values);
  const centre = mean(values);
  return values.reduce((total, value) => total + Math.abs(value - centre), 0) / values.length;
}

/** Relative spread: standard deviation ÷ |mean|. Needs a non-zero mean. */
export function coefficientOfVariation(
  values: readonly number[],
  kind: 'sample' | 'population' = 'sample',
): number {
  requireValues(values, kind === 'sample' ? 2 : 1);
  const centre = mean(values);
  if (Math.abs(centre) < 1e-300) {
    throw new CalcError('DOMAIN', 'The coefficient of variation is undefined when the mean is zero');
  }
  return standardDeviation(values, kind) / Math.abs(centre);
}

/** Standard error of the mean, s / √n. */
export function standardErrorOfMean(values: readonly number[]): number {
  requireValues(values, 2);
  return standardDeviation(values, 'sample') / Math.sqrt(values.length);
}

export interface Shape {
  skewness: number;
  /** Excess kurtosis: 0 for a normal distribution. */
  excessKurtosis: number;
  /** Plain (non-excess) kurtosis: 3 for a normal distribution. */
  kurtosis: number;
  /** What the shape suggests, in words. */
  description: string;
}

/**
 * Skewness and kurtosis. `kind` picks the sample correction (the usual
 * statistics-package default) or the raw population moments.
 */
export function describeShape(values: readonly number[], kind: 'sample' | 'population' = 'sample'): Shape {
  requireValues(values, kind === 'sample' ? 4 : 3);
  const n = values.length;
  const centre = mean(values);
  // Standardised moments use the *population* standard deviation, then the
  // Fisher–Pearson correction turns them into the unbiased sample estimates
  // that statistical software reports.
  const sd = standardDeviation(values, 'population');
  if (sd < 1e-300) {
    return { skewness: 0, excessKurtosis: -3, kurtosis: 0, description: 'every value is the same' };
  }
  const m3 = values.reduce((total, value) => total + ((value - centre) / sd) ** 3, 0) / n;
  const m4 = values.reduce((total, value) => total + ((value - centre) / sd) ** 4, 0) / n;
  const skewness = kind === 'sample' ? (m3 * Math.sqrt(n * (n - 1))) / (n - 2) : m3;
  const excessKurtosis =
    kind === 'sample' ? (((n + 1) * (m4 - 3) + 6) * (n - 1)) / ((n - 2) * (n - 3)) : m4 - 3;
  const kurtosis = excessKurtosis + 3;
  const direction = Math.abs(skewness) < 0.5 ? 'roughly symmetric' : skewness > 0 ? 'skewed to the right (a long upper tail)' : 'skewed to the left (a long lower tail)';
  const tail =
    Math.abs(excessKurtosis) < 0.5
      ? 'tail weight close to a normal distribution'
      : excessKurtosis > 0
        ? 'heavier tails than a normal distribution (more outliers)'
        : 'lighter tails than a normal distribution (flatter than normal)';
  return { skewness, excessKurtosis, kurtosis, description: `${direction}; ${tail}` };
}

export interface FiveNumberSummary {
  minimum: number;
  q1: number;
  median: number;
  q3: number;
  maximum: number;
  interquartileRange: number;
  /** Values beyond 1.5 × IQR from the quartiles. */
  outliers: number[];
}

/** The box-plot summary, including the usual 1.5 × IQR outlier rule. */
export function fiveNumberSummary(values: readonly number[]): FiveNumberSummary {
  requireValues(values);
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number) => quantileOfSorted(sorted, p);
  const q1 = quantile(0.25);
  const median = quantile(0.5);
  const q3 = quantile(0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  return {
    minimum: sorted[0]!,
    q1,
    median,
    q3,
    maximum: sorted[sorted.length - 1]!,
    interquartileRange: iqr,
    outliers: sorted.filter((value) => value < lowFence || value > highFence),
  };
}

function quantileOfSorted(sorted: readonly number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/** Outliers by either rule: the IQR fence or a z-score cut-off. */
export function findOutliers(
  values: readonly number[],
  options: { method?: 'iqr' | 'z-score'; threshold?: number } = {},
): { value: number; index: number; score: number; rule: 'iqr' | 'z-score' }[] {
  requireValues(values);
  const method = options.method ?? 'iqr';
  if (method === 'iqr') {
    const { q1, q3, interquartileRange } = fiveNumberSummary(values);
    const threshold = options.threshold ?? 1.5;
    const low = q1 - threshold * interquartileRange;
    const high = q3 + threshold * interquartileRange;
    return values
      .map((value, index) => ({ value, index, score: value < low ? (low - value) / (interquartileRange || 1) : value > high ? (value - high) / (interquartileRange || 1) : 0, rule: 'iqr' as const }))
      .filter((entry) => entry.score > 0);
  }
  const sd = standardDeviation(values, 'sample');
  const centre = mean(values);
  const threshold = options.threshold ?? 2.5;
  if (sd < 1e-300) return [];
  return values
    .map((value, index) => ({ value, index, score: Math.abs((value - centre) / sd), rule: 'z-score' as const }))
    .filter((entry) => entry.score >= threshold);
}

/** Ranks with ties averaged — the input for rank-based statistics. */
export function ranks(values: readonly number[]): number[] {
  requireValues(values);
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  let position = 0;
  while (position < order.length) {
    let end = position;
    while (end + 1 < order.length && order[end + 1]!.value === order[position]!.value) end += 1;
    const averageRank = (position + end) / 2 + 1;
    for (let i = position; i <= end; i += 1) result[order[i]!.index] = averageRank;
    position = end + 1;
  }
  return result;
}

/** Spearman's rank correlation: Pearson's r applied to the ranks. */
export function spearmanCorrelation(a: readonly number[], b: readonly number[]): number {
  requireValues(a, 2, 'the first set');
  requireValues(b, 2, 'the second set');
  if (a.length !== b.length) {
    throw new CalcError('INPUT', `The two sets must be the same length (${a.length} and ${b.length})`);
  }
  const rankA = ranks(a);
  const rankB = ranks(b);
  const meanA = mean(rankA);
  const meanB = mean(rankB);
  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;
  for (let i = 0; i < rankA.length; i += 1) {
    const da = rankA[i]! - meanA;
    const db = rankB[i]! - meanB;
    numerator += da * db;
    denominatorA += da * da;
    denominatorB += db * db;
  }
  if (denominatorA < 1e-300 || denominatorB < 1e-300) {
    throw new CalcError('DOMAIN', 'A correlation needs values that actually vary');
  }
  return numerator / Math.sqrt(denominatorA * denominatorB);
}

/** Covariance matrix of a table: one array per variable. */
export function covarianceMatrix(
  columns: readonly (readonly number[])[],
  kind: 'sample' | 'population' = 'sample',
): number[][] {
  requireColumns(columns);
  return columns.map((_row, i) =>
    columns.map((_column, j) => {
      const left = columns[i]!;
      const right = columns[j]!;
      const meanLeft = mean(left);
      const meanRight = mean(right);
      const divisor = kind === 'sample' ? left.length - 1 : left.length;
      let total = 0;
      for (let k = 0; k < left.length; k += 1) total += (left[k]! - meanLeft) * (right[k]! - meanRight);
      return total / divisor;
    }),
  );
}

/** Correlation matrix of a table: one array per variable, diagonal exactly 1. */
export function correlationMatrix(columns: readonly (readonly number[])[]): number[][] {
  requireColumns(columns);
  const covariance = covarianceMatrix(columns, 'population');
  return covariance.map((row, i) =>
    row.map((value, j) => {
      const denominator = Math.sqrt(covariance[i]![i]! * covariance[j]![j]!);
      return denominator < 1e-300 ? (i === j ? 1 : 0) : value / denominator;
    }),
  );
}

function requireColumns(columns: readonly (readonly number[])[]): void {
  if (columns.length < 1) throw new CalcError('INPUT', 'At least one variable is needed');
  const length = columns[0]!.length;
  for (const column of columns) {
    requireValues(column, 2, 'each variable');
    if (column.length !== length) {
      throw new CalcError('INPUT', 'Every variable must have the same number of values');
    }
  }
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  /** Count ÷ total, so the bars add up to 1. */
  relative: number;
}

/** Equal-width histogram bins; the number of bins defaults to Sturges' rule. */
export function histogram(values: readonly number[], binCount?: number): HistogramBin[] {
  requireValues(values);
  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;
  if (high === low) return [{ from: low, to: high, count: values.length, relative: 1 }];
  const bins = Math.max(1, Math.min(200, Math.floor(binCount ?? Math.ceil(Math.log2(values.length) + 1))));
  const width = (high - low) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor((value - low) / width));
    counts[index] += 1;
  }
  return counts.map((count, index) => ({
    from: low + index * width,
    to: low + (index + 1) * width,
    count,
    relative: count / values.length,
  }));
}

export interface FrequencyRow {
  value: number;
  count: number;
  relative: number;
  /** Running total of `relative`. */
  cumulative: number;
}

/** Frequency table for discrete data, sorted by value. */
export function frequencyTable(values: readonly number[]): FrequencyRow[] {
  requireValues(values);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const rows = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value, count, relative: count / values.length, cumulative: 0 }));
  let running = 0;
  for (const row of rows) {
    running += row.relative;
    row.cumulative = running;
  }
  return rows;
}

/** Simple moving average; the window must fit inside the data. */
export function movingAverage(values: readonly number[], window: number): number[] {
  requireValues(values);
  const size = Math.floor(window);
  if (!(size >= 1) || size > values.length) {
    throw new CalcError('INPUT', `The window must be between 1 and ${values.length}`);
  }
  const result: number[] = [];
  let running = 0;
  for (let i = 0; i < values.length; i += 1) {
    running += values[i]!;
    if (i >= size) running -= values[i - size]!;
    if (i >= size - 1) result.push(running / size);
  }
  return result;
}

/** Sample covariance between two equal-length datasets. */
export function covarianceOf(a: readonly number[], b: readonly number[]): number {
  return covarianceMatrix([a, b])[0]![1]!;
}

/** Standard deviation of a dataset given as a frequency table. */
export function groupedStandardDeviation(rows: readonly FrequencyRow[]): number {
  if (rows.length === 0) throw new CalcError('INPUT', 'A frequency table needs at least one row');
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) throw new CalcError('DOMAIN', 'The frequencies add up to zero');
  const centre = rows.reduce((sum, row) => sum + row.value * row.count, 0) / total;
  const varianceValue = rows.reduce((sum, row) => sum + row.count * (row.value - centre) ** 2, 0) / (total - 1 || 1);
  return Math.sqrt(varianceValue);
}

export { mean, variance };
