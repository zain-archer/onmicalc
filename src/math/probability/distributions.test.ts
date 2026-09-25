import { describe, expect, it } from 'vitest';
import {
  createRandom,
  describeDistribution,
  DISTRIBUTIONS,
  getDistribution,
  requireDistribution,
  sampleDistribution,
  sampleStats,
} from '@/math/probability/distributions';

/** Reference values produced with SciPy 1.17 (scipy.stats). */
const REFERENCE: [string, number[], 'pdf' | 'cdf' | 'quantile', number, number, number][] = [
  ['normal', [0, 1], 'quantile', 0.975, 0, 1.959963984540054],
  ['normal', [0, 1], 'cdf', 1.96, 0, 0.9750021048517795],
  ['lognormal', [0, 1], 'cdf', 2, 0, 0.7558914042144173],
  ['exponential', [1], 'cdf', 1, 0, 0.6321205588285577],
  ['weibull', [2, 1], 'cdf', 1.5, 0, 0.8946007754381357],
  ['laplace', [0, 1], 'quantile', 0.75, 0, 0.6931471805599453],
  ['cauchy', [0, 1], 'cdf', 1, 0, 0.75],
  ['studentt', [10], 'quantile', 0.975, 0, 2.228138851986274],
  ['studentt', [5], 'cdf', 2, 0, 0.9490302605850708],
  ['studentt', [20], 'quantile', 0.005, 0, -2.8453397097861077],
  ['chisquare', [2], 'quantile', 0.95, 0, 5.991464547107979],
  ['chisquare', [3], 'cdf', 5, 0, 0.8282028557032665],
  ['f', [5, 10], 'quantile', 0.95, 0, 3.3258345304130104],
  ['f', [5, 10], 'cdf', 3, 0, 0.9344424379061559],
  ['gamma', [2, 3], 'quantile', 0.9, 0, 11.669160509602287],
  ['gamma', [2, 3], 'cdf', 4, 0, 0.38494001106330406],
  ['beta', [2, 3], 'quantile', 0.9, 0, 0.6795394162781817],
  ['beta', [2, 3], 'cdf', 0.4, 0, 0.5248],
  ['binomial', [10, 0.5], 'cdf', 3, 0, 0.171875],
  ['binomial', [10, 0.5], 'quantile', 0.975, 0, 8],
  ['poisson', [3], 'cdf', 2, 0, 0.42319008112684364],
  ['poisson', [3], 'quantile', 0.975, 0, 7],
  ['geometric', [0.3], 'cdf', 3, 0, 0.657],
  ['geometric', [0.3], 'quantile', 0.9, 0, 7],
  ['negative-binomial', [3, 0.5], 'cdf', 5, 0, 0.5],
  ['negative-binomial', [3, 0.5], 'quantile', 0.9, 0, 9],
  ['hypergeometric', [50, 10, 5], 'cdf', 2, 0, 0.9517396968037909],
  ['hypergeometric', [50, 10, 5], 'quantile', 0.9, 0, 2],
];

describe('distribution registry', () => {
  it('describes every distribution it offers', () => {
    expect(DISTRIBUTIONS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(DISTRIBUTIONS.map((entry) => entry.id)).size).toBe(DISTRIBUTIONS.length);
    for (const distribution of DISTRIBUTIONS) {
      expect(distribution.parameters.length).toBeGreaterThan(0);
      expect(distribution.use.length).toBeGreaterThan(20);
      for (const parameter of distribution.parameters) {
        expect(parameter.name).not.toBe('');
        expect(parameter.description).not.toBe('');
        expect(Number.isFinite(parameter.default)).toBe(true);
      }
      // A density or mass must never be negative anywhere on the support.
      const support = distribution.support(distribution.parameters.map((p) => p.default));
      for (const x of [support.min, 0, 1, 2.5, support.max]) {
        if (!Number.isFinite(x)) continue;
        expect(distribution.pdf(x, distribution.parameters.map((p) => p.default))).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('reports unknown distributions instead of guessing', () => {
    expect(getDistribution('nope')).toBeUndefined();
    expect(() => requireDistribution('nope')).toThrow(/Unknown distribution/);
  });

  it('matches published values for densities, cumulative values and quantiles', () => {
    for (const [id, parameters, kind, x, , expected] of REFERENCE) {
      const distribution = requireDistribution(id);
      const actual =
        kind === 'pdf' ? distribution.pdf(x, parameters) : kind === 'cdf' ? distribution.cdf(x, parameters) : distribution.quantile(x, parameters);
      const tolerance = Math.max(1e-9, Math.abs(expected) * 1e-7);
      expect(Math.abs(actual - expected), `${id}.${kind}(${x}) = ${actual}, expected ${expected}`).toBeLessThan(tolerance);
    }
  });

  it('round-trips every continuous quantile through its own CDF', () => {
    for (const distribution of DISTRIBUTIONS.filter((entry) => !entry.discrete)) {
      const parameters = distribution.parameters.map((parameter) => parameter.default);
      for (const p of [0.01, 0.25, 0.5, 0.75, 0.99]) {
        const x = distribution.quantile(p, parameters);
        if (!Number.isFinite(x)) continue;
        expect(Math.abs(distribution.cdf(x, parameters) - p), `${distribution.id} at p=${p}`).toBeLessThan(1e-6);
      }
    }
  });

  it('returns the smallest integer whose cumulative value reaches p', () => {
    for (const distribution of DISTRIBUTIONS.filter((entry) => entry.discrete)) {
      const parameters = distribution.parameters.map((parameter) => parameter.default);
      for (const p of [0.05, 0.5, 0.9]) {
        const k = distribution.quantile(p, parameters);
        expect(Number.isInteger(k), `${distribution.id} quantile is not a whole number`).toBe(true);
        expect(distribution.cdf(k, parameters)).toBeGreaterThanOrEqual(p - 1e-12);
        if (k > 0) expect(distribution.cdf(k - 1, parameters)).toBeLessThan(p);
      }
    }
  });

  it('integrates each density to the mass its CDF reports', () => {
    const integrate = (f: (x: number) => number, a: number, b: number, steps = 4000): number => {
      const h = (b - a) / steps;
      let total = f(a) + f(b);
      for (let i = 1; i < steps; i += 1) total += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
      return (total * h) / 3;
    };
    for (const distribution of DISTRIBUTIONS.filter((entry) => !entry.discrete)) {
      const parameters = distribution.parameters.map((parameter) => parameter.default);
      // The central 90 % window is finite for every distribution and avoids
      // integrable singularities at a support endpoint (χ² with k = 1, say).
      const low = distribution.quantile(0.05, parameters);
      const high = distribution.quantile(0.95, parameters);
      const mass = distribution.cdf(high, parameters) - distribution.cdf(low, parameters);
      expect(
        integrate((x) => distribution.pdf(x, parameters), low, high),
        `${distribution.id} density against its own CDF`,
      ).toBeCloseTo(mass, 3);
      expect(mass, `${distribution.id} central mass`).toBeCloseTo(0.9, 9);
    }

    // Bounded supports must integrate to the whole of the mass.
    for (const id of ['uniform', 'beta']) {
      const distribution = requireDistribution(id);
      const parameters = distribution.parameters.map((parameter) => parameter.default);
      const support = distribution.support(parameters);
      expect(
        integrate((x) => distribution.pdf(x, parameters), support.min, support.max, 2000),
        `${id} total mass`,
      ).toBeCloseTo(1, 6);
    }
  });

  it('reports infinite density at a support endpoint where the density diverges', () => {
    expect(requireDistribution('chisquare').pdf(0, [1])).toBe(Number.POSITIVE_INFINITY);
    expect(requireDistribution('chisquare').pdf(0, [2])).toBe(0.5);
    expect(requireDistribution('chisquare').pdf(0, [5])).toBe(0);
    expect(requireDistribution('gamma').pdf(0, [0.5, 1])).toBe(Number.POSITIVE_INFINITY);
    expect(requireDistribution('gamma').pdf(0, [1, 4])).toBe(0.25);
    expect(requireDistribution('beta').pdf(0, [2, 3])).toBe(0);
  });

  it('summarises mean, variance and quartiles for the user', () => {
    const normal = describeDistribution('normal', [0, 1]);
    expect(normal.mean).toBe(0);
    expect(normal.variance).toBe(1);
    expect(normal.median).toBeCloseTo(0, 9);
    expect(normal.quartiles.q1).toBeCloseTo(-0.6744897501960817, 7);
    expect(normal.quartiles.q3).toBeCloseTo(0.6744897501960817, 7);
    expect(normal.approximate).toBe(false);
    expect(normal.discrete).toBe(false);

    const exponential = describeDistribution('exponential', [2]);
    expect(exponential.mean).toBeCloseTo(0.5, 12);
    expect(exponential.variance).toBeCloseTo(0.25, 12);
    expect(exponential.median).toBeCloseTo(Math.log(2) / 2, 12);

    const binomial = describeDistribution('binomial', [10, 0.5]);
    expect(binomial.mean).toBeCloseTo(5, 12);
    expect(binomial.variance).toBeCloseTo(2.5, 12);
    expect(binomial.discrete).toBe(true);

    const cauchy = describeDistribution('cauchy', [0, 1]);
    expect(Number.isNaN(cauchy.mean)).toBe(true);
    expect(cauchy.approximate).toBe(true);
    expect(cauchy.note).toMatch(/no finite mean/);

    const lognormal = describeDistribution('lognormal', [0, 1]);
    expect(lognormal.mean).toBeCloseTo(1.6487212707001282, 12);
  });

  it('refuses parameters outside the distribution it describes', () => {
    expect(() => describeDistribution('normal', [0, 0])).toThrow();
    expect(() => describeDistribution('normal', [0])).toThrow(/needs 2 finite parameters/);
    expect(() => describeDistribution('binomial', [2.5, 0.5])).toThrow(/whole number/);
    expect(() => describeDistribution('binomial', [10, 1.5])).toThrow(/at most/);
    expect(() => describeDistribution('poisson', [-1])).toThrow(/at least|greater than/);
  });
});

describe('sampling', () => {
  it('reproduces exactly from the same seed and stays inside the support', () => {
    const first = sampleDistribution('normal', [10, 2], 200, 7);
    const again = sampleDistribution('normal', [10, 2], 200, 7);
    expect(first).toEqual(again);
    const different = sampleDistribution('normal', [10, 2], 200, 8);
    expect(different).not.toEqual(first);

    const dice = sampleDistribution('discrete-uniform', [1, 6], 500, 3);
    expect(dice.every((value) => Number.isInteger(value) && value >= 1 && value <= 6)).toBe(true);

    const exponential = sampleDistribution('exponential', [2], 300, 5);
    expect(exponential.every((value) => value >= 0)).toBe(true);
  });

  it('produces samples whose mean and variance match the theory', () => {
    const normal = sampleStats(sampleDistribution('normal', [10, 2], 20000, 11));
    expect(normal.mean).toBeCloseTo(10, 1);
    expect(normal.variance).toBeCloseTo(4, 0);

    const poisson = sampleStats(sampleDistribution('poisson', [3], 20000, 12));
    expect(poisson.mean).toBeCloseTo(3, 1);
    expect(poisson.variance).toBeCloseTo(3, 0);

    const beta = sampleStats(sampleDistribution('beta', [2, 3], 20000, 13));
    expect(beta.mean).toBeCloseTo(0.4, 2);
    expect(beta.variance).toBeCloseTo(0.04, 3);

    const binomial = sampleStats(sampleDistribution('binomial', [20, 0.3], 20000, 14));
    expect(binomial.mean).toBeCloseTo(6, 1);
    expect(binomial.variance).toBeCloseTo(4.2, 0);
  });

  it('generates a reproducible random stream', () => {
    const random = createRandom(99);
    const values = Array.from({ length: 5 }, () => random());
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    const repeat = createRandom(99);
    expect(values).toEqual(Array.from({ length: 5 }, () => repeat()));
  });

  it('describes a sample with count, mean, variance and standard error', () => {
    const stats = sampleStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats.count).toBe(8);
    expect(stats.mean).toBeCloseTo(5, 12);
    expect(stats.variance).toBeCloseTo(32 / 7, 12);
    expect(stats.standardError).toBeCloseTo(Math.sqrt(32 / 7 / 8), 12);
    expect(sampleStats([]).count).toBe(0);
  });

  it('rejects an unknown distribution when sampling', () => {
    expect(() => sampleDistribution('nope', [], 10)).toThrow(/Unknown distribution/);
    expect(sampleDistribution('normal', [0, 1], 0)).toEqual([]);
  });
});
