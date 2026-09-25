import { describe, expect, it } from 'vitest';
import {
  binomialCdf,
  binomialMoments,
  binomialPmf,
  combinations,
  exponentialCdf,
  exponentialMoments,
  exponentialPdf,
  gamma,
  inverseNormal,
  logGamma,
  normalCdf,
  normalMoments,
  normalPdf,
  permutations,
  poissonCdf,
  poissonMoments,
  poissonPmf,
  regularizedBeta,
  regularizedGammaP,
  tCdf,
  uniformCdf,
  uniformMoments,
  uniformPdf,
} from './index';
import { CalcError } from '@/core/errors';

describe('special functions', () => {
  it('computes log-gamma and gamma at known points', () => {
    expect(gamma(1)).toBeCloseTo(1, 12);
    expect(gamma(5)).toBeCloseTo(24, 9);
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 12);
    expect(logGamma(10)).toBeCloseTo(Math.log(362880), 10);
    expect(() => logGamma(0)).toThrowError(CalcError);
  });

  it('computes the regularised incomplete gamma against known values', () => {
    expect(regularizedGammaP(1, 1)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(regularizedGammaP(2, 1)).toBeCloseTo(1 - 2 * Math.exp(-1), 12);
    expect(regularizedGammaP(3, 5)).toBeCloseTo(0.8753479805169189, 12);
    expect(() => regularizedGammaP(0, 1)).toThrowError(/positive/);
  });

  it('computes the regularised incomplete beta against known values', () => {
    expect(regularizedBeta(0.5, 1, 1)).toBeCloseTo(0.5, 12);
    expect(regularizedBeta(0.5, 2, 3)).toBeCloseTo(0.6875, 12);
    expect(regularizedBeta(0.3, 5, 2)).toBeCloseTo(0.010935, 5);
    expect(() => regularizedBeta(1.5, 1, 1)).toThrowError(/between 0 and 1/);
  });
});

describe('normal distribution', () => {
  it('matches the standard normal table', () => {
    expect(normalPdf(0)).toBeCloseTo(0.3989422804014327, 12);
    expect(normalCdf(0)).toBe(0.5);
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 12);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 10);
    expect(normalCdf(-1.645)).toBeCloseTo(0.04998490783443084, 8);
    expect(normalCdf(3)).toBeCloseTo(0.9986501019683699, 10);
    expect(normalCdf(100)).toBeCloseTo(1, 9);
  });

  it('supports shifted and scaled variables', () => {
    expect(normalCdf(110, 100, 10)).toBeCloseTo(0.8413447460685429, 10);
    expect(normalPdf(100, 100, 10)).toBeCloseTo(0.03989422804014327, 12);
    expect(normalMoments(100, 10)).toEqual({ mean: 100, variance: 100, sd: 10 });
  });

  it('inverts its own CDF', () => {
    expect(inverseNormal(0.5)).toBeCloseTo(0, 9);
    expect(inverseNormal(0.975)).toBeCloseTo(1.959963985, 6);
    expect(inverseNormal(0.025)).toBeCloseTo(-1.959963985, 6);
    expect(inverseNormal(normalCdf(1.3), 0, 1)).toBeCloseTo(1.3, 6);
    expect(() => inverseNormal(0)).toThrowError(/between 0 and 1/);
  });

  it('rejects invalid deviations', () => {
    expect(() => normalCdf(1, 0, 0)).toThrowError(/positive/);
    expect(() => normalCdf(1, 0, -1)).toThrowError(CalcError);
  });
});

describe('binomial distribution', () => {
  it('computes combinations and permutations', () => {
    expect(combinations(5, 2)).toBe(10);
    expect(combinations(52, 5)).toBe(2598960);
    expect(combinations(5, 0)).toBe(1);
    expect(combinations(3, 4)).toBe(0);
    expect(permutations(5, 2)).toBe(20);
    expect(permutations(5, 5)).toBe(120);
    expect(() => combinations(1.5, 1)).toThrowError(/whole numbers/);
    expect(() => combinations(-1, 1)).toThrowError(CalcError);
    expect(() => permutations(200, 2)).toThrowError(/170/);
  });

  it('computes pmf and cdf against published values', () => {
    expect(binomialPmf(2, 5, 0.5)).toBeCloseTo(0.3125, 12);
    expect(binomialPmf(0, 10, 0.3)).toBeCloseTo(0.0282475249, 9);
    expect(binomialPmf(3, 10, 0)).toBe(0);
    expect(binomialPmf(0, 10, 0)).toBe(1);
    expect(binomialCdf(2, 5, 0.5)).toBeCloseTo(0.5, 10);
    expect(binomialCdf(1, 5, 0.5)).toBeCloseTo(0.1875, 10);
    // 1 − P(9) − P(10) with n = 10, p = 0.3
    expect(binomialCdf(8, 10, 0.3)).toBeCloseTo(1 - 0.000143686, 8);
    expect(binomialCdf(-1, 10, 0.3)).toBe(0);
    expect(binomialCdf(10, 10, 0.3)).toBe(1);
  });

  it('matches the sum of individual probabilities', () => {
    let total = 0;
    for (let k = 0; k <= 4; k += 1) total += binomialPmf(k, 12, 0.35);
    expect(binomialCdf(4, 12, 0.35)).toBeCloseTo(total, 10);
  });

  it('reports moments', () => {
    const moments = binomialMoments(100, 0.25);
    expect(moments.mean).toBeCloseTo(25, 10);
    expect(moments.variance).toBeCloseTo(18.75, 10);
    expect(() => binomialPmf(1, 3, 1.5)).toThrowError(/between 0 and 1/);
  });
});

describe('poisson distribution', () => {
  it('computes pmf and cdf against published values', () => {
    expect(poissonPmf(0, 2)).toBeCloseTo(Math.exp(-2), 12);
    expect(poissonPmf(3, 2)).toBeCloseTo(0.18044704431548356, 10);
    expect(poissonCdf(3, 2)).toBeCloseTo(0.857123460498547, 10);
    expect(poissonCdf(-1, 2)).toBe(0);
    expect(poissonPmf(1.5, 2)).toBe(0);
  });

  it('reports moments and rejects bad rates', () => {
    expect(poissonMoments(4)).toEqual({ mean: 4, variance: 4, sd: 2 });
    expect(() => poissonPmf(1, 0)).toThrowError(/positive/);
    expect(() => poissonCdf(1, -3)).toThrowError(CalcError);
  });
});

describe('uniform and exponential distributions', () => {
  it('computes uniform pdf/cdf', () => {
    expect(uniformPdf(0.5, 0, 1)).toBe(1);
    expect(uniformPdf(2, 0, 1)).toBe(0);
    expect(uniformCdf(0.25, 0, 1)).toBeCloseTo(0.25, 12);
    expect(uniformCdf(-1, 0, 1)).toBe(0);
    expect(uniformCdf(2, 0, 1)).toBe(1);
    expect(uniformMoments(0, 12)).toEqual({ mean: 6, variance: 12, sd: Math.sqrt(12) });
    expect(() => uniformPdf(0, 1, 0)).toThrowError(/upper bound/);
  });

  it('computes exponential pdf/cdf and moments', () => {
    expect(exponentialPdf(1, 2)).toBeCloseTo(2 * Math.exp(-2), 12);
    expect(exponentialPdf(-1, 2)).toBe(0);
    expect(exponentialCdf(1, 1)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(exponentialCdf(0, 1)).toBe(0);
    expect(exponentialMoments(0.5)).toEqual({ mean: 2, variance: 4, sd: 2 });
  });
});

describe('Student t distribution', () => {
  it('converges to the normal distribution for large df', () => {
    expect(tCdf(1.96, 100000)).toBeCloseTo(0.975, 3);
    expect(tCdf(0, 5)).toBeCloseTo(0.5, 10);
    expect(tCdf(-1.96, 100000)).toBeCloseTo(0.025, 3);
  });

  it('matches published two-sided values', () => {
    // t(0.975, df = 10) = 2.228
    expect(tCdf(2.228, 10)).toBeCloseTo(0.975, 4);
    // t(0.95, df = 5) = 2.015
    expect(tCdf(2.015, 5)).toBeCloseTo(0.95, 4);
    expect(() => tCdf(1, 0)).toThrowError(/positive/);
  });
});
