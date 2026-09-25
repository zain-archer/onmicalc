import { describe, expect, it } from 'vitest';
import {
  coefficientOfVariation,
  correlationMatrix,
  covarianceOf,
  describeShape,
  findOutliers,
  fiveNumberSummary,
  frequencyTable,
  geometricMean,
  groupedStandardDeviation,
  harmonicMean,
  histogram,
  meanAbsoluteDeviation,
  midrange,
  movingAverage,
  ranks,
  spearmanCorrelation,
  weightedMean,
} from '@/math/statistics/descriptive';
import {
  chiSquareGoodnessOfFit,
  chiSquareIndependence,
  confidenceIntervalMean,
  confidenceIntervalProportion,
  correlationTest,
  fTestVarianceRatio,
  oneSampleTTest,
  oneSampleZTest,
  pairedTTest,
  proportionZTest,
  requiredSampleSizeForMean,
  requiredSampleSizeForProportion,
  twoSampleTTest,
} from '@/math/statistics/inference';
import {
  exponentialRegression,
  logarithmicRegression,
  multipleRegression,
  polynomialRegression,
  powerRegression,
} from '@/math/statistics/regression';

/** Reference values produced with SciPy 1.17. */
const A = [2, 4, 4, 4, 5, 5, 7, 9];
const B = [1, 2, 3, 4, 5];
const C = [4, 5, 6, 7, 8];

const close = (actual: number, expected: number, digits = 9, label = '') => {
  expect(Math.abs(actual - expected), `${label} ${actual} vs ${expected}`).toBeLessThan(10 ** -digits);
};

describe('descriptive statistics', () => {
  it('computes the alternative averages', () => {
    close(geometricMean([1, 4, 16]), 4, 12);
    close(harmonicMean([1, 2, 4]), 12 / 7, 12);
    close(weightedMean([1, 2, 3], [1, 1, 2]), 2.25, 12);
    close(midrange([2, 9]), 5.5, 12);
    close(meanAbsoluteDeviation(A), 1.5, 12);
    close(coefficientOfVariation(A), 2.13808993529956 / 5, 10, 'coefficient of variation');
  });

  it('explains bad input instead of returning NaN', () => {
    expect(() => geometricMean([1, -2])).toThrow(/positive/);
    expect(() => weightedMean([1, 2], [1])).toThrow(/one weight for every value/);
    expect(() => weightedMean([1, 2], [0, 0])).toThrow(/add up to zero/);
    expect(coefficientOfVariation([3, 3, 3])).toBe(0); // no spread, so no relative spread
    expect(() => coefficientOfVariation([-2, 0, 2])).toThrow(/mean is zero/);
    expect(() => describeShape([1, 2, 3])).toThrow(/At least 4/);
  });

  it('measures the shape of a distribution', () => {
    const sample = describeShape(A, 'sample');
    close(sample.skewness, 0.8184875533567996, 9, 'sample skewness');
    close(sample.excessKurtosis, 0.940625, 9, 'sample excess kurtosis');
    close(sample.kurtosis, 3.940625, 9, 'sample kurtosis');
    expect(sample.description).toMatch(/skewed to the right|roughly symmetric/);

    const population = describeShape(A, 'population');
    close(population.skewness, 0.65625, 9, 'population skewness');
    close(population.excessKurtosis, -0.21875, 9, 'population excess kurtosis');
    close(population.kurtosis, 2.78125, 9, 'population kurtosis');

    expect(describeShape([7, 7, 7, 7]).description).toBe('every value is the same');
  });

  it('builds the five-number summary and flags outliers', () => {
    const summary = fiveNumberSummary(A);
    expect(summary.minimum).toBe(2);
    expect(summary.q1).toBeCloseTo(4, 12);
    expect(summary.median).toBeCloseTo(4.5, 12);
    expect(summary.q3).toBeCloseTo(5.5, 12);
    expect(summary.maximum).toBe(9);
    expect(summary.interquartileRange).toBeCloseTo(1.5, 12);
    expect(summary.outliers).toEqual([9]);

    expect(findOutliers(A).map((entry) => entry.value)).toEqual([9]);
    expect(findOutliers(A, { method: 'z-score', threshold: 1.4 }).map((entry) => entry.value)).toEqual([2, 9]);
    expect(findOutliers([2, 3, 4, 5, 6])).toEqual([]);
  });

  it('ranks, correlates and measures association between variables', () => {
    expect(ranks([4, 4, 1])).toEqual([2.5, 2.5, 1]);
    expect(ranks([10, 20, 30])).toEqual([1, 2, 3]);
    close(spearmanCorrelation(A, [3, 1, 5, 4, 6, 8, 7, 9]), 0.8838515090524254, 9, 'spearman');
    expect(spearmanCorrelation(B, C)).toBeCloseTo(1, 12);

    expect(covarianceOf(B, C)).toBeCloseTo(2.5, 12);
    const correlation = correlationMatrix([B, C]);
    expect(correlation[0]![0]).toBeCloseTo(1, 12);
    expect(correlation[0]![1]).toBeCloseTo(1, 12);
    const independent = correlationMatrix([B, [1, 4, 2, 5, 3]]);
    expect(independent[0]![1]).toBeCloseTo(0.5, 12);
    expect(() => correlationMatrix([B, [1, 2]])).toThrow(/same number of values/);
  });

  it('tabulates data with histograms and frequency tables', () => {
    const rows = frequencyTable(A);
    expect(rows.map((row) => row.value)).toEqual([2, 4, 5, 7, 9]);
    expect(rows[1]!.count).toBe(3);
    expect(rows[rows.length - 1]!.cumulative).toBeCloseTo(1, 12);
    expect(rolledUpCount(rows)).toBe(A.length);
    expect(groupedStandardDeviation(frequencyTable(A))).toBeCloseTo(2.13808993529956, 9);

    const bins = histogram(B, 4);
    expect(bins).toHaveLength(4);
    expect(bins.reduce((total, bin) => total + bin.count, 0)).toBe(B.length);
    expect(bins.reduce((total, bin) => total + bin.relative, 0)).toBeCloseTo(1, 12);
    expect(histogram([3, 3, 3])).toEqual([{ from: 3, to: 3, count: 3, relative: 1 }]);

    expect(movingAverage([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]);
    expect(() => movingAverage(B, 9)).toThrow(/window/);
  });
});

function rolledUpCount(rows: readonly { count: number }[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

describe('hypothesis tests', () => {
  it('runs one-sample t and z tests against published values', () => {
    const nullResult = oneSampleTTest(A, 5);
    close(nullResult.statistic, 0, 12, 't statistic');
    expect(nullResult.pValue).toBe(1);
    expect(nullResult.df).toEqual([7]);
    expect(nullResult.conclusion).toMatch(/Do not reject/);
    close(nullResult.interval!.low, 3.21251208176379, 9, 'interval low');
    close(nullResult.interval!.high, 6.787487918236209, 9, 'interval high');

    const shifted = oneSampleTTest(A, 6);
    close(shifted.statistic, -1.3228756555322954, 9, 't statistic');
    close(shifted.pValue, 0.22745281805976297, 9, 'p value');

    const z = oneSampleZTest(A, 5, 2);
    close(z.statistic, 0, 12, 'z statistic');
    expect(z.pValue).toBeCloseTo(1, 12);
    expect(z.assumptions).toMatch(/known/);
  });

  it('compares two samples with Welch and pooled t tests', () => {
    const welch = twoSampleTTest(C, B);
    close(welch.statistic, 3, 9, 'Welch t');
    close(welch.df[0]!, 8, 9, 'Welch df');
    close(welch.pValue, 0.01707168123378265, 9, 'Welch p');
    expect(welch.conclusion).toMatch(/Reject/);

    const pooled = twoSampleTTest(C, B, { welch: false });
    close(pooled.statistic, 3, 9, 'pooled t');
    expect(pooled.df).toEqual([8]);
    close(pooled.pValue, 0.01707168123378265, 9, 'pooled p');
    expect(() => twoSampleTTest([1], B)).toThrow(/At least 2/);
  });

  it('pairs observations and reports the difference interval', () => {
    const paired = pairedTTest(B, [2, 4, 6, 8, 10]);
    close(paired.statistic, 4.242640687119285, 9, 'paired t');
    close(paired.pValue, 0.01323559956368269, 9, 'paired p');
    expect(paired.estimate!.value).toBeCloseTo(3, 12);
    expect(() => pairedTTest([1, 2, 3], [1, 2])).toThrow(/same length/);
    // A constant difference has no spread, so the test says so rather than dividing by zero.
    expect(() => pairedTTest(B, C)).toThrow(/do not vary/);
  });

  it('runs chi-square tests for fit and independence', () => {
    const fit = chiSquareGoodnessOfFit([10, 20, 30]);
    close(fit.statistic, 10, 12, 'chi-square');
    expect(fit.df).toEqual([2]);
    close(fit.pValue, 0.006737946999085468, 12, 'chi-square p');
    expect(fit.conclusion).toMatch(/Reject/);

    const independence = chiSquareIndependence([
      [10, 20],
      [30, 15],
    ]);
    close(independence.statistic, 8.035714285714285, 9, 'independence statistic');
    close(independence.pValue, 0.0045863920802535025, 9, 'independence p');
    expect(independence.df).toEqual([1]);
    close(independence.table!.expected[0]![0]!, 16, 9, 'expected count');
    close(independence.table!.expected[1]![0]!, 24, 9, 'expected count (second row)');
    expect(() => chiSquareIndependence([[1, 2]])).toThrow(/two rows/);
    expect(() => chiSquareIndependence([[0, 0], [3, 4]])).toThrow(/adds up to zero/);
  });

  it('compares variances and proportions', () => {
    const ratio = fTestVarianceRatio(A, B);
    close(ratio.statistic, 1.8285714285714285, 9, 'F statistic');
    close(ratio.pValue, 0.5844544847607716, 9, 'F p value');
    expect(ratio.df).toEqual([7, 4]);
    expect(fTestVarianceRatio(B, C).statistic).toBeCloseTo(1, 12);

    const proportion = proportionZTest(60, 100, 0.5);
    close(proportion.statistic, 2, 9, 'z statistic');
    close(proportion.pValue, 0.04550026389635842, 9, 'z p value');
    close(proportion.interval!.low, 0.5020025867910617, 9, 'proportion interval low');
    close(proportion.interval!.high, 0.6905987135675411, 9, 'proportion interval high');
    expect(() => proportionZTest(5, 4)).toThrow(/0 ≤ successes ≤ trials/);
  });

  it('builds confidence intervals and sample-size plans', () => {
    const meanInterval = confidenceIntervalMean(B, 0.9);
    close(meanInterval.low, 1.4925566809376762, 9, 'mean interval low');
    close(meanInterval.high, 4.507443319062323, 9, 'mean interval high');

    const ninetyFive = confidenceIntervalMean(B);
    close(ninetyFive.low, 1.0367568385224428, 9, '95 % low');
    close(ninetyFive.high, 4.963243161477557, 9, '95 % high');

    const proportion = confidenceIntervalProportion(30, 50, 0.9);
    close(proportion.low, 0.48375270593523306, 9, 'Wilson low');
    close(proportion.high, 0.7059806569075129, 9, 'Wilson high');
    expect(proportion.method).toBe('Wilson score interval');

    expect(requiredSampleSizeForMean(0.5, 2)).toBe(62);
    expect(requiredSampleSizeForProportion(0.03)).toBe(1068);
    expect(() => requiredSampleSizeForMean(0, 1)).toThrow(/margin/);
  });

  it('tests whether a correlation could be chance', () => {
    const weak = correlationTest(B, [1, 4, 2, 5, 3]);
    close(weak.statistic, 1, 9, 'correlation t');
    expect(weak.df).toEqual([3]);
    close(weak.pValue, 0.39100221895577064, 9, 'correlation p');

    const perfect = correlationTest(B, C);
    expect(perfect.statistic).toBe(Number.POSITIVE_INFINITY);
    expect(perfect.pValue).toBe(0);
    expect(perfect.conclusion).toMatch(/perfectly linearly related/);
  });
});

describe('curve fitting', () => {
  it('recovers an exact polynomial', () => {
    const x = [0, 1, 2, 3, 4, 5];
    const y = x.map((value) => 2 + 3 * value - 0.5 * value * value);
    const fit = polynomialRegression(x, y, 2);
    close(fit.coefficients[0]!, 2, 9, 'constant');
    close(fit.coefficients[1]!, 3, 9, 'linear');
    close(fit.coefficients[2]!, -0.5, 9, 'quadratic');
    expect(fit.r2).toBeCloseTo(1, 9);
    expect(fit.equation).toMatch(/^y = −0\.5·x\^2 \+ 3·x \+ 2$/);
    expect(fit.predict(3)).toBeCloseTo(6.5, 6);
  });

  it('fits noisy data and reports honest quality numbers', () => {
    const x = [0, 1, 2, 3, 4];
    const y = [1.1, 2.9, 5.2, 6.8, 9.3];
    const fit = polynomialRegression(x, y, 2);
    close(fit.coefficients[0]!, 1.1, 6, 'constant');
    close(fit.coefficients[1]!, 1.83, 6, 'linear');
    close(fit.coefficients[2]!, 0.05, 6, 'quadratic');
    close(fit.r2, 0.9969061200812144, 9, 'r²');
    close(fit.adjustedR2, 0.9938122401624288, 9, 'adjusted r²');
    close(fit.standardError, 0.25298221281347044, 9, 'standard error');
    expect(fit.residuals).toHaveLength(5);
    expect(fit.points).toBe(5);
    expect(fit.termCount).toBe(3);
    expect(() => polynomialRegression([1, 2], [1, 2], 3)).toThrow(/At least 4 points/);
    expect(() => polynomialRegression([1, 2, 3], [1, 2, 3], 0)).toThrow(/degree/);
  });

  it('fits several explanatory variables at once', () => {
    const x1 = [1, 2, 3, 4, 5, 6];
    const x2 = [0, 1, 1, 2, 3, 0];
    const y = x1.map((value, index) => 1 + 2 * value - 3 * x2[index]!);
    const fit = multipleRegression([x1, x2], y);
    close(fit.coefficients[0]!, 1, 8, 'intercept');
    close(fit.coefficients[1]!, 2, 8, 'first variable');
    close(fit.coefficients[2]!, -3, 8, 'second variable');
    expect(fit.equation).toBe('y = 1 + 2·x1 − 3·x2');
    expect(fit.note).toMatch(/adjusted R²/);
    expect(() => multipleRegression([[1, 2, 3], [4, 5]], [1, 2, 3])).toThrow(/same number of values/);
  });

  it('fits exponential, power and logarithmic curves on the right scales', () => {
    const x = [0, 1, 2, 3];
    const exponential = exponentialRegression(x, x.map((value) => 3 * Math.exp(0.5 * value)));
    close(exponential.coefficients[0]!, 3, 8, 'a');
    close(exponential.coefficients[1]!, 0.5, 8, 'b');
    expect(exponential.equation).toMatch(/e\^\(0\.5·x\)/);
    expect(exponential.note).toMatch(/log scale/);
    expect(() => exponentialRegression([1, 2], [0, -1])).toThrow(/positive y values/);

    const power = powerRegression([1, 2, 4, 8], [1, 2, 4, 8].map((value) => 2 * value ** 1.5));
    close(power.coefficients[0]!, 2, 8, 'a');
    close(power.coefficients[1]!, 1.5, 8, 'b');
    expect(() => powerRegression([0, 1], [1, 2])).toThrow(/positive x and y/);

    const logarithmic = logarithmicRegression([1, 2, 4, 8], [1, 2, 4, 8].map((value) => 5 + 2 * Math.log(value)));
    close(logarithmic.coefficients[0]!, 5, 8, 'intercept');
    close(logarithmic.coefficients[1]!, 2, 8, 'slope');
    expect(logarithmic.equation).toMatch(/ln\(x\)/);
    expect(() => logarithmicRegression([-1, 1], [1, 2])).toThrow(/positive x/);
  });
});
