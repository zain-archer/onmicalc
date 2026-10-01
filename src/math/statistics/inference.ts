import { CalcError } from '@/core/errors';
import { normalCdf } from '@/math/probability/normal';
import { requireDistribution } from '@/math/probability/distributions';
import { mean, standardDeviation, variance } from './moments';

/**
 * Classical hypothesis tests and confidence intervals.
 *
 * Every test reports the statistic, its degrees of freedom, an exact p-value
 * (from the same distribution code the rest of the app uses), a plain-language
 * conclusion and the assumptions it relies on — so a result is never presented
 * without the conditions under which it is valid.
 */

export type Alternative = 'two-sided' | 'greater' | 'less';

// The distributions the tests need, taken from the shared registry so a fix to
// one of them reaches every test at once.
const tDistribution = requireDistribution('studentt');
const chiSquareDistribution = requireDistribution('chisquare');
const fDistribution = requireDistribution('f');

export interface TestResult {
  test: string;
  statisticName: string;
  statistic: number;
  df: number[];
  pValue: number;
  alpha: number;
  alternative: Alternative;
  conclusion: string;
  /** Confidence interval for the estimated quantity, when one makes sense. */
  interval?: { level: number; low: number; high: number; of: string };
  estimate?: { name: string; value: number };
  assumptions: string;
}

function requireData(values: readonly number[], minimum: number, label: string): void {
  if (values.length < minimum) {
    throw new CalcError('INPUT', `At least ${minimum} values of ${label} are needed`, {
      details: `Received ${values.length}.`,
    });
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new CalcError('INPUT', `Every value of ${label} must be a finite number`);
  }
}

function pValueFrom(statistic: number, df: number[], alternative: Alternative): number {
  const t = tDistribution.cdf(statistic, df);
  if (alternative === 'two-sided') return 2 * Math.min(t, 1 - t);
  return alternative === 'greater' ? 1 - t : t;
}

function describe(p: number, alpha: number, alternative: Alternative): string {
  const direction = alternative === 'greater' ? 'larger' : alternative === 'less' ? 'smaller' : 'different from';
  return p < alpha
    ? `Reject the null hypothesis at the ${(alpha * 100).toFixed(0)} % level: the evidence says the value is ${direction} the hypothesised one (p = ${p.toPrecision(4)}).`
    : `Do not reject the null hypothesis at the ${(alpha * 100).toFixed(0)} % level: the evidence is not strong enough (p = ${p.toPrecision(4)}).`;
}

/** One-sample t test: is the mean of this sample a given value? */
export function oneSampleTTest(
  values: readonly number[],
  hypothesisedMean = 0,
  options: { alternative?: Alternative; alpha?: number; level?: number } = {},
): TestResult {
  requireData(values, 2, 'the data');
  const alternative = options.alternative ?? 'two-sided';
  const alpha = options.alpha ?? 0.05;
  const level = options.level ?? 1 - alpha;
  const n = values.length;
  const centre = mean(values);
  const sd = standardDeviation(values, 'sample');
  if (sd < 1e-300) throw new CalcError('DOMAIN', 'The data do not vary, so no t statistic exists');
  const standardError = sd / Math.sqrt(n);
  const statistic = (centre - hypothesisedMean) / standardError;
  const df = [n - 1];
  const pValue = pValueFrom(statistic, df, alternative);
  const critical = tDistribution.quantile(1 - (1 - level) / 2, df);
  return {
    test: `One-sample t test (H₀: μ = ${hypothesisedMean})`,
    statisticName: 't',
    statistic,
    df,
    pValue,
    alpha,
    alternative,
    conclusion: describe(pValue, alpha, alternative),
    estimate: { name: 'sample mean', value: centre },
    interval: {
      level,
      low: centre - critical * standardError,
      high: centre + critical * standardError,
      of: 'the mean',
    },
    assumptions: 'Independent observations, roughly normal data (or a large sample), unknown σ.',
  };
}

/** One-sample z test: like the t test, but σ is taken as known. */
export function oneSampleZTest(
  values: readonly number[],
  hypothesisedMean = 0,
  sigma: number,
  options: { alternative?: Alternative; alpha?: number; level?: number } = {},
): TestResult {
  requireData(values, 2, 'the data');
  if (!(sigma > 0)) throw new CalcError('DOMAIN', 'The known standard deviation must be positive');
  const alternative = options.alternative ?? 'two-sided';
  const alpha = options.alpha ?? 0.05;
  const level = options.level ?? 1 - alpha;
  const centre = mean(values);
  const standardError = sigma / Math.sqrt(values.length);
  const statistic = (centre - hypothesisedMean) / standardError;
  const pValue = alternative === 'two-sided' ? 2 * (1 - normalCdf(Math.abs(statistic))) : alternative === 'greater' ? 1 - normalCdf(statistic) : normalCdf(statistic);
  const critical = quantileNormal(1 - (1 - level) / 2);
  return {
    test: `One-sample z test (H₀: μ = ${hypothesisedMean}, σ = ${sigma})`,
    statisticName: 'z',
    statistic,
    df: [],
    pValue,
    alpha,
    alternative,
    conclusion: describe(pValue, alpha, alternative),
    estimate: { name: 'sample mean', value: centre },
    interval: { level, low: centre - critical * standardError, high: centre + critical * standardError, of: 'the mean' },
    assumptions: 'Independent observations and a *known* σ (or a large sample with σ replaced by s).',
  };
}

function quantileNormal(p: number): number {
  // Inverse of the standard normal CDF, via the same bisection used elsewhere.
  let low = -40;
  let high = 40;
  for (let i = 0; i < 200; i += 1) {
    const middle = (low + high) / 2;
    if (!(middle > low && middle < high)) break;
    if (normalCdf(middle) < p) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Two-sample t test — Welch's version by default, pooled (Student) on request. */
export function twoSampleTTest(
  first: readonly number[],
  second: readonly number[],
  options: { welch?: boolean; alternative?: Alternative; alpha?: number; level?: number } = {},
): TestResult {
  requireData(first, 2, 'the first sample');
  requireData(second, 2, 'the second sample');
  const welch = options.welch ?? true;
  const alternative = options.alternative ?? 'two-sided';
  const alpha = options.alpha ?? 0.05;
  const level = options.level ?? 1 - alpha;
  const n1 = first.length;
  const n2 = second.length;
  const v1 = variance(first, 'sample');
  const v2 = variance(second, 'sample');
  const difference = mean(first) - mean(second);
  let statistic: number;
  let df: number;
  if (welch) {
    const se = Math.sqrt(v1 / n1 + v2 / n2);
    if (se < 1e-300) throw new CalcError('DOMAIN', 'Both samples are constant, so no t statistic exists');
    statistic = difference / se;
    df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  } else {
    const pooled = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    const se = Math.sqrt(pooled * (1 / n1 + 1 / n2));
    if (se < 1e-300) throw new CalcError('DOMAIN', 'Both samples are constant, so no t statistic exists');
    statistic = difference / se;
    df = n1 + n2 - 2;
  }
  const pValue = pValueFrom(statistic, [df], alternative);
  const critical = tDistribution.quantile(1 - (1 - level) / 2, [df]);
  const standardError = welch ? Math.sqrt(v1 / n1 + v2 / n2) : Math.sqrt((((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2)) * (1 / n1 + 1 / n2));
  return {
    test: `${welch ? "Welch's" : 'Pooled'} two-sample t test`,
    statisticName: 't',
    statistic,
    df: [df],
    pValue,
    alpha,
    alternative,
    conclusion: describe(pValue, alpha, alternative),
    estimate: { name: 'difference of means (first − second)', value: difference },
    interval: {
      level,
      low: difference - critical * standardError,
      high: difference + critical * standardError,
      of: 'the difference of means',
    },
    assumptions: welch
      ? 'Independent samples; either roughly normal data or large samples. Variances need not be equal.'
      : 'Independent samples, equal variances, and roughly normal data or large samples.',
  };
}

/** Paired t test: is the mean of (after − before) zero? */
export function pairedTTest(
  before: readonly number[],
  after: readonly number[],
  options: { alternative?: Alternative; alpha?: number; level?: number } = {},
): TestResult {
  if (before.length !== after.length) {
    throw new CalcError('INPUT', `Paired samples must have the same length (${before.length} and ${after.length})`);
  }
  requireData(before, 2, 'the first set');
  const differences = before.map((value, index) => after[index]! - value);
  const result = oneSampleTTest(differences, 0, options);
  return {
    ...result,
    test: 'Paired t test (H₀: mean difference = 0)',
    estimate: { name: 'mean difference (after − before)', value: mean(differences) },
    assumptions: 'Paired observations, and the differences roughly normal (or many pairs).',
  };
}

export interface ChiSquareResult extends TestResult {
  table?: { observed: number[][]; expected: number[][] };
  degreesOfFreedom: number;
}

/** Goodness of fit: do the observed counts match the expected ones? */
export function chiSquareGoodnessOfFit(
  observed: readonly number[],
  expected?: readonly number[],
  options: { alpha?: number } = {},
): ChiSquareResult {
  requireData(observed, 2, 'the observed counts');
  if (observed.some((count) => count < 0)) throw new CalcError('DOMAIN', 'Counts cannot be negative');
  const alpha = options.alpha ?? 0.05;
  const total = observed.reduce((sum, count) => sum + count, 0);
  const expectedCounts = expected ? [...expected] : observed.map(() => total / observed.length);
  if (expectedCounts.length !== observed.length) {
    throw new CalcError('INPUT', 'The expected counts must match the observed counts in number');
  }
  if (expectedCounts.some((count) => !(count > 0))) {
    throw new CalcError('DOMAIN', 'Every expected count must be positive, otherwise the statistic divides by zero');
  }
  let statistic = 0;
  for (let i = 0; i < observed.length; i += 1) {
    statistic += (observed[i]! - expectedCounts[i]!) ** 2 / expectedCounts[i]!;
  }
  const degreesOfFreedom = observed.length - 1;
  const pValue = 1 - chiSquareDistribution.cdf(statistic, [degreesOfFreedom]);
  const smallest = Math.min(...expectedCounts);
  return {
    test: 'Chi-square goodness of fit',
    statisticName: 'χ²',
    statistic,
    df: [degreesOfFreedom],
    degreesOfFreedom,
    pValue,
    alpha,
    alternative: 'greater',
    conclusion:
      pValue < alpha
        ? `Reject the null hypothesis at the ${(alpha * 100).toFixed(0)} % level: the observed counts do not fit the expected ones (p = ${pValue.toPrecision(4)}).`
        : `No significant difference between the observed and expected counts (p = ${pValue.toPrecision(4)}).`,
    assumptions: smallest >= 5
      ? 'Independent observations; every expected count is at least 5.'
      : 'Independent observations. At least one expected count is below 5, so the χ² approximation is rough — consider combining categories.',
  };
}

/** Chi-square test of independence for a contingency table (rows × columns). */
export function chiSquareIndependence(
  table: readonly (readonly number[])[],
  options: { alpha?: number } = {},
): ChiSquareResult {
  if (table.length < 2) throw new CalcError('INPUT', 'A contingency table needs at least two rows');
  const columns = table[0]!.length;
  if (columns < 2) throw new CalcError('INPUT', 'A contingency table needs at least two columns');
  for (const row of table) {
    if (row.length !== columns) throw new CalcError('INPUT', 'Every row of the table must have the same number of columns');
    if (row.some((count) => count < 0)) throw new CalcError('DOMAIN', 'Counts cannot be negative');
  }
  const rowTotals = table.map((row) => row.reduce((sum, count) => sum + count, 0));
  const columnTotals = Array.from({ length: columns }, (_, j) => table.reduce((sum, row) => sum + row[j]!, 0));
  const total = rowTotals.reduce((sum, count) => sum + count, 0);
  if (total <= 0) throw new CalcError('DOMAIN', 'The table is empty');
  const expected = table.map((_, i) => columnTotals.map((columnTotal) => (rowTotals[i]! * columnTotal) / total));
  let statistic = 0;
  let smallest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < table.length; i += 1) {
    for (let j = 0; j < columns; j += 1) {
      const expectedValue = expected[i]![j]!;
      if (expectedValue <= 0) throw new CalcError('DOMAIN', 'A row or column adds up to zero, so independence cannot be tested');
      smallest = Math.min(smallest, expectedValue);
      statistic += (table[i]![j]! - expectedValue) ** 2 / expectedValue;
    }
  }
  const degreesOfFreedom = (table.length - 1) * (columns - 1);
  const pValue = 1 - chiSquareDistribution.cdf(statistic, [degreesOfFreedom]);
  return {
    test: 'Chi-square test of independence',
    statisticName: 'χ²',
    statistic,
    df: [degreesOfFreedom],
    degreesOfFreedom,
    pValue,
    alpha: options.alpha ?? 0.05,
    alternative: 'greater',
    conclusion:
      pValue < (options.alpha ?? 0.05)
        ? `The two variables are significantly associated (p = ${pValue.toPrecision(4)}).`
        : `No significant association detected (p = ${pValue.toPrecision(4)}).`,
    table: { observed: table.map((row) => [...row]), expected },
    assumptions: smallest >= 5
      ? 'Independent observations; every expected count is at least 5.'
      : 'Independent observations. Some expected counts are below 5, so treat the p-value with care.',
  };
}

/** F test for the ratio of two variances (two-sided by default). */
export function fTestVarianceRatio(
  first: readonly number[],
  second: readonly number[],
  options: { alpha?: number } = {},
): TestResult {
  requireData(first, 2, 'the first sample');
  requireData(second, 2, 'the second sample');
  const v1 = variance(first, 'sample');
  const v2 = variance(second, 'sample');
  if (v1 <= 0 || v2 <= 0) throw new CalcError('DOMAIN', 'A variance of zero makes the ratio undefined');
  const statistic = v1 / v2;
  const df = [first.length - 1, second.length - 1];
  const lower = fDistribution.cdf(statistic, df);
  const pValue = Math.min(1, 2 * Math.min(lower, 1 - lower));
  const alpha = options.alpha ?? 0.05;
  return {
    test: 'F test for the ratio of two variances',
    statisticName: 'F',
    statistic,
    df,
    pValue,
    alpha,
    alternative: 'two-sided',
    conclusion:
      pValue < alpha
        ? `The variances differ significantly (p = ${pValue.toPrecision(4)}).`
        : `No significant difference between the variances (p = ${pValue.toPrecision(4)}).`,
    estimate: { name: 'variance ratio s₁²/s₂²', value: statistic },
    assumptions: 'Independent, roughly normal samples — the F test is sensitive to non-normality.',
  };
}

/** One-proportion z test: is the success rate a given value? */
export function proportionZTest(
  successes: number,
  trials: number,
  hypothesised = 0.5,
  options: { alternative?: Alternative; alpha?: number; level?: number } = {},
): TestResult {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) || trials <= 0 || successes < 0 || successes > trials) {
    throw new CalcError('INPUT', 'Successes and trials must be whole numbers with 0 ≤ successes ≤ trials');
  }
  if (!(hypothesised > 0 && hypothesised < 1)) throw new CalcError('DOMAIN', 'The hypothesised proportion must be between 0 and 1');
  const alternative = options.alternative ?? 'two-sided';
  const alpha = options.alpha ?? 0.05;
  const level = options.level ?? 1 - alpha;
  const estimate = successes / trials;
  const standardError = Math.sqrt((hypothesised * (1 - hypothesised)) / trials);
  const statistic = (estimate - hypothesised) / standardError;
  const pValue = alternative === 'two-sided' ? 2 * (1 - normalCdf(Math.abs(statistic))) : alternative === 'greater' ? 1 - normalCdf(statistic) : normalCdf(statistic);
  const interval = confidenceIntervalProportion(successes, trials, level);
  return {
    test: `One-proportion z test (H₀: p = ${hypothesised})`,
    statisticName: 'z',
    statistic,
    df: [],
    pValue,
    alpha,
    alternative,
    conclusion: describe(pValue, alpha, alternative),
    estimate: { name: 'observed proportion', value: estimate },
    interval: { level, low: interval.low, high: interval.high, of: 'the proportion' },
    assumptions: 'Independent trials, and n·p and n·(1 − p) both at least about 10.',
  };
}

/** t-based confidence interval for a mean. */
export function confidenceIntervalMean(
  values: readonly number[],
  level = 0.95,
): { level: number; low: number; high: number; centre: number; standardError: number; df: number } {
  requireData(values, 2, 'the data');
  if (!(level > 0 && level < 1)) throw new CalcError('DOMAIN', 'The confidence level must be between 0 and 1');
  const n = values.length;
  const centre = mean(values);
  const standardError = standardDeviation(values, 'sample') / Math.sqrt(n);
  const critical = tDistribution.quantile(1 - (1 - level) / 2, [n - 1]);
  return {
    level,
    low: centre - critical * standardError,
    high: centre + critical * standardError,
    centre,
    standardError,
    df: n - 1,
  };
}

/** Wilson score interval for a proportion — reliable even for small counts. */
export function confidenceIntervalProportion(
  successes: number,
  trials: number,
  level = 0.95,
): { level: number; low: number; high: number; estimate: number; method: string } {
  if (!(trials > 0) || successes < 0 || successes > trials) {
    throw new CalcError('INPUT', 'Successes and trials must satisfy 0 ≤ successes ≤ trials and trials > 0');
  }
  if (!(level > 0 && level < 1)) throw new CalcError('DOMAIN', 'The confidence level must be between 0 and 1');
  const estimate = successes / trials;
  const z = quantileNormal(1 - (1 - level) / 2);
  const denominator = 1 + (z * z) / trials;
  const centre = estimate + (z * z) / (2 * trials);
  const spread = z * Math.sqrt((estimate * (1 - estimate)) / trials + (z * z) / (4 * trials * trials));
  return {
    level,
    low: Math.max(0, (centre - spread) / denominator),
    high: Math.min(1, (centre + spread) / denominator),
    estimate,
    method: 'Wilson score interval',
  };
}

/** How many observations a mean estimate needs (normal approximation). */
export function requiredSampleSizeForMean(margin: number, sd: number, level = 0.95): number {
  if (!(margin > 0)) throw new CalcError('DOMAIN', 'The margin of error must be positive');
  if (!(sd > 0)) throw new CalcError('DOMAIN', 'The standard deviation must be positive');
  const z = quantileNormal(1 - (1 - level) / 2);
  return Math.ceil(((z * sd) / margin) ** 2);
}

/** How many observations a proportion estimate needs (worst case p = 0.5). */
export function requiredSampleSizeForProportion(margin: number, proportion = 0.5, level = 0.95): number {
  if (!(margin > 0)) throw new CalcError('DOMAIN', 'The margin of error must be positive');
  if (!(proportion > 0 && proportion < 1)) throw new CalcError('DOMAIN', 'The expected proportion must be between 0 and 1');
  const z = quantileNormal(1 - (1 - level) / 2);
  return Math.ceil((z * z * proportion * (1 - proportion)) / (margin * margin));
}

/** Significance test for Pearson's correlation coefficient. */
export function correlationTest(
  a: readonly number[],
  b: readonly number[],
  options: { alternative?: Alternative; alpha?: number } = {},
): TestResult {
  if (a.length !== b.length) throw new CalcError('INPUT', 'The two variables must have the same number of values');
  requireData(a, 3, 'the first variable');
  const n = a.length;
  const meanA = mean(a);
  const meanB = mean(b);
  let numerator = 0;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    numerator += da * db;
    sumA += da * da;
    sumB += db * db;
  }
  if (sumA < 1e-300 || sumB < 1e-300) throw new CalcError('DOMAIN', 'A correlation needs values that vary');
  const r = numerator / Math.sqrt(sumA * sumB);
  if (Math.abs(r) >= 1) {
    return {
      test: 'Significance of Pearson correlation',
      statisticName: 't',
      statistic: Number.POSITIVE_INFINITY,
      df: [n - 2],
      pValue: 0,
      alpha: options.alpha ?? 0.05,
      alternative: options.alternative ?? 'two-sided',
      conclusion: 'The variables are perfectly linearly related, so the test is degenerate.',
      estimate: { name: 'correlation r', value: r },
      assumptions: 'Both variables roughly normal, and a linear relationship.',
    };
  }
  const statistic = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  const alternative = options.alternative ?? 'two-sided';
  const alpha = options.alpha ?? 0.05;
  const pValue = pValueFrom(statistic, [n - 2], alternative);
  return {
    test: 'Significance of Pearson correlation',
    statisticName: 't',
    statistic,
    df: [n - 2],
    pValue,
    alpha,
    alternative,
    conclusion: describe(pValue, alpha, alternative),
    estimate: { name: 'correlation r', value: r },
    assumptions: 'Both variables roughly normal, and a linear relationship.',
  };
}
