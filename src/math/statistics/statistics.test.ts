import { describe, expect, it } from 'vitest';
import {
  correlation,
  covariance,
  interquartileRange,
  linearRegression,
  max,
  mean,
  median,
  min,
  mode,
  parseDataset,
  percentile,
  quartiles,
  range,
  standardDeviation,
  sum,
  summarize,
  variance,
  zScore,
} from './index';
import { CalcError } from '@/core/errors';

const data = [2, 4, 4, 4, 5, 5, 7, 9];

describe('descriptive statistics', () => {
  it('computes central tendency', () => {
    expect(sum(data)).toBe(40);
    expect(mean(data)).toBe(5);
    expect(median(data)).toBe(4.5);
    expect(mode(data)).toEqual([4]);
    expect(mode([1, 2, 3])).toEqual([]);
    expect(mode([1, 1, 2, 2])).toEqual([1, 2]);
    expect(mean([3])).toBe(3);
  });

  it('computes spread with both denominators', () => {
    expect(min(data)).toBe(2);
    expect(max(data)).toBe(9);
    expect(range(data)).toBe(7);
    expect(variance(data, 'population')).toBeCloseTo(4, 12);
    expect(variance(data, 'sample')).toBeCloseTo(32 / 7, 12);
    expect(standardDeviation(data, 'population')).toBeCloseTo(2, 12);
    expect(standardDeviation(data, 'sample')).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  it('computes quartiles, percentiles and IQR', () => {
    expect(quartiles([1, 2, 3, 4, 5])).toEqual({ q1: 2, q2: 3, q3: 4 });
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
    expect(percentile([1, 2, 3, 4], 25)).toBeCloseTo(1.75, 12);
    expect(interquartileRange([1, 2, 3, 4, 5])).toBe(2);
    expect(percentile([7], 30)).toBe(7);
    expect(() => percentile([1, 2], 101)).toThrowError(/between 0 and 100/);
  });

  it('computes z-scores', () => {
    expect(zScore(5, data, 'population')).toBe(0);
    expect(zScore(7, data, 'population')).toBeCloseTo(1, 12);
    expect(zScore(6, [2, 4, 6], 'population')).toBeCloseTo(2 / Math.sqrt(8 / 3), 12);
    expect(() => zScore(1, [5, 5, 5])).toThrowError(/deviation is zero/);
  });

  it('computes covariance and correlation', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(correlation(x, y)).toBeCloseTo(1, 12);
    expect(correlation(x, y.map((v) => -v))).toBeCloseTo(-1, 12);
    expect(covariance(x, x, 'population')).toBeCloseTo(variance(x, 'population'), 12);
    expect(() => correlation(x, [1, 1, 1, 1, 1])).toThrowError(/no variation/);
  });

  it('validates input instead of returning NaN', () => {
    expect(() => mean([])).toThrowError(CalcError);
    expect(() => variance([5], 'sample')).toThrowError(/at least 2/);
    expect(() => mean([1, Number.NaN])).toThrowError(/finite/);
    expect(() => covariance([1, 2], [1])).toThrowError(/same length/);
  });
});

describe('linear regression', () => {
  it('fits a perfect line and reports R² = 1', () => {
    const result = linearRegression([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(result.slope).toBeCloseTo(2, 10);
    expect(result.intercept).toBeCloseTo(1, 10);
    expect(result.r2).toBeCloseTo(1, 12);
    expect(result.equation).toBe('y = 2x + 1');
    expect(result.predict(5)).toBeCloseTo(11, 10);
    expect(result.residuals.every((value) => Math.abs(value) < 1e-12)).toBe(true);
  });

  it('fits noisy data with the documented formula', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 5, 4, 5];
    const result = linearRegression(x, y);
    expect(result.slope).toBeCloseTo(0.6, 12);
    expect(result.intercept).toBeCloseTo(2.2, 12);
    expect(result.r2).toBeCloseTo(0.6, 12);
    expect(result.r).toBeCloseTo(result.r, 12);
    expect(result.equation).toBe('y = 0.6x + 2.2');
  });

  it('rejects degenerate inputs', () => {
    expect(() => linearRegression([1, 1, 1], [1, 2, 3])).toThrowError(/distinct x/);
    expect(() => linearRegression([1, 2], [1])).toThrowError(/same length/);
  });
});

describe('dataset parsing and summary', () => {
  it('parses separators and rejects bad tokens', () => {
    expect(parseDataset('1, 2 3\n4')).toEqual([1, 2, 3, 4]);
    expect(parseDataset('-1.5;2e3')).toEqual([-1.5, 2000]);
    expect(parseDataset('1, a')).toBeNull();
    expect(parseDataset('')).toBeNull();
  });

  it('summarises a data set completely', () => {
    const summary = summarize([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(summary.count).toBe(8);
    expect(summary.mean).toBe(5);
    expect(summary.median).toBe(4.5);
    expect(summary.modes).toEqual([4]);
    expect(summary.range).toBe(7);
    expect(summary.iqr).toBeCloseTo(1.5, 12);
    expect(summary.sdPopulation).toBeCloseTo(2, 12);
    expect(summary.sdSample).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(summary.standardError).toBeCloseTo(summary.sdSample / Math.sqrt(8), 12);
  });
});
