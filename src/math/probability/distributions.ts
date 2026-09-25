import { CalcError } from '@/core/errors';
import {
  gamma as gammaFunction,
  logGamma,
  regularisedBeta,
  regularisedGammaP,
} from '@/math/special';
import { inverseNormal, normalCdf, normalPdf, requirePositive } from './normal';

/**
 * One registry for every distribution the app knows.
 *
 * Each entry carries its own density, cumulative value, quantile, mean,
 * variance, support and a plain-language note, so the UI, the intent layer and
 * the statistics tests all work from the same data — there is no second list to
 * keep in step. Continuous quantiles are found by bisection on the exact CDF,
 * which is slower than a closed form but never less accurate.
 */

export interface DistributionParameter {
  name: string;
  /** Short description used as the field hint. */
  description: string;
  default: number;
  min?: number;
  max?: number;
  integer?: boolean;
  /** Inclusive bounds are allowed for parameters such as a binomial's p = 0. */
  inclusiveMin?: boolean;
  inclusiveMax?: boolean;
}

export interface Distribution {
  id: string;
  name: string;
  discrete: boolean;
  /** Number of parameters, in the order the functions below expect them. */
  parameters: DistributionParameter[];
  /** Closed support: ±Infinity where unbounded. */
  support: (parameters: number[]) => { min: number; max: number };
  pdf: (x: number, parameters: number[]) => number;
  cdf: (x: number, parameters: number[]) => number;
  quantile: (p: number, parameters: number[]) => number;
  mean: (parameters: number[]) => number;
  variance: (parameters: number[]) => number;
  /** When you would reach for this distribution. */
  use: string;
  /** True when the mean/variance genuinely do not exist (heavy tails). */
  undefinedMoments?: boolean;
}

/* ------------------------------ generic tools ----------------------------- */

function checkParameters(parameters: number[], count: number, name: string): void {
  if (parameters.length !== count || parameters.some((value) => !Number.isFinite(value))) {
    throw new CalcError('INPUT', `${name} needs ${count} finite parameter${count === 1 ? '' : 's'}`, {
      details: `Received ${JSON.stringify(parameters)}.`,
    });
  }
}

/** Enforces the declared bounds (and whole-number parameters) before any maths. */
function validateParameters(distribution: Distribution, parameters: number[]): void {
  checkParameters(parameters, distribution.parameters.length, distribution.name);
  distribution.parameters.forEach((parameter, index) => {
    const value = parameters[index]!;
    const label = `${distribution.name}: ${parameter.name} (${parameter.description})`;
    if (parameter.integer && !Number.isInteger(value)) {
      throw new CalcError('INPUT', `${label} must be a whole number`, { details: `Received ${value}.` });
    }
    if (parameter.min !== undefined && (parameter.inclusiveMin ? value < parameter.min : value <= parameter.min)) {
      throw new CalcError('DOMAIN', `${label} must be ${parameter.inclusiveMin ? 'at least' : 'greater than'} ${parameter.min}`, {
        details: `Received ${value}.`,
      });
    }
    if (parameter.max !== undefined && (parameter.inclusiveMax ? value > parameter.max : value >= parameter.max)) {
      throw new CalcError('DOMAIN', `${label} must be ${parameter.inclusiveMax ? 'at most' : 'less than'} ${parameter.max}`, {
        details: `Received ${value}.`,
      });
    }
  });
}

/** Bisection quantile on a monotone CDF; expands the bracket until it traps p. */
function bisectQuantile(cdf: (x: number) => number, p: number, guess: number, spread: number): number {
  if (p <= 0 || p >= 1) throw new CalcError('DOMAIN', 'The probability must be between 0 and 1 (exclusive)');
  const width = Number.isFinite(spread) && spread > 0 ? spread : Math.max(1, Math.abs(guess));
  let low = guess - 10 * width - 1;
  let high = guess + 10 * width + 1;
  for (let i = 0; i < 200 && (cdf(low) > p || cdf(high) < p); i += 1) {
    const grow = Math.max(1, Math.abs(low), Math.abs(high)) * 2;
    if (cdf(low) > p) low -= grow;
    if (cdf(high) < p) high += grow;
  }
  for (let i = 0; i < 200; i += 1) {
    const middle = (low + high) / 2;
    if (!(middle > low && middle < high)) break;
    if (cdf(middle) < p) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Smallest integer k with cdf(k) ≥ p, found by binary search on a safe range. */
function discreteQuantile(
  cdf: (k: number) => number,
  p: number,
  guess: number,
  spread: number,
  upper: number,
): number {
  const ceiling = Math.max(0, Math.floor(upper));
  if (p <= 0) return 0;
  if (p >= 1) return ceiling;
  if (cdf(0) >= p) return 0;
  let high = Math.min(ceiling, Math.max(1, Math.ceil(guess + spread * 12)));
  while (high < ceiling && cdf(high) < p) high = Math.min(ceiling, high * 2 + 8);
  let low = 0;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (cdf(middle) < p) low = middle;
    else high = middle;
  }
  return high;
}

/* ------------------------------- definitions ------------------------------ */

const normalDistribution: Distribution = {
  id: 'normal',
  name: 'Normal (Gaussian)',
  discrete: false,
  parameters: [
    { name: 'μ', description: 'mean', default: 0 },
    { name: 'σ', description: 'standard deviation', default: 1, min: 0 },
  ],
  support: () => ({ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [mean = 0, sd = 1]) => normalPdf(x, mean, sd),
  cdf: (x, [mean = 0, sd = 1]) => normalCdf(x, mean, sd),
  quantile: (p, [mean = 0, sd = 1]) => mean + sd * inverseNormal(p),
  mean: ([mean = 0]) => mean,
  variance: ([, sd = 1]) => sd * sd,
  use: 'Measurements, test scores, heights — anything that is a sum of many small effects.',
};

const lognormalDistribution: Distribution = {
  id: 'lognormal',
  name: 'Log-normal',
  discrete: false,
  parameters: [
    { name: 'μ', description: 'mean of ln X', default: 0 },
    { name: 'σ', description: 'standard deviation of ln X', default: 1, min: 0 },
  ],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [mu = 0, sigma = 1]) => {
    requirePositive(sigma, 'standard deviation');
    if (x <= 0) return 0;
    const z = (Math.log(x) - mu) / sigma;
    return Math.exp(-0.5 * z * z) / (x * sigma * Math.sqrt(2 * Math.PI));
  },
  cdf: (x, [mu = 0, sigma = 1]) => {
    requirePositive(sigma, 'standard deviation');
    return x <= 0 ? 0 : normalCdf(Math.log(x), mu, sigma);
  },
  quantile: (p, [mu = 0, sigma = 1]) => Math.exp(mu + sigma * inverseNormal(p)),
  mean: ([mu = 0, sigma = 1]) => Math.exp(mu + (sigma * sigma) / 2),
  variance: ([mu = 0, sigma = 1]) =>
    (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma),
  use: 'Positive, right-skewed quantities: incomes, particle sizes, share prices.',
};

const exponentialDistribution: Distribution = {
  id: 'exponential',
  name: 'Exponential',
  discrete: false,
  parameters: [{ name: 'λ', description: 'rate (per unit)', default: 1, min: 0 }],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [rate = 1]) => {
    requirePositive(rate, 'rate');
    return x < 0 ? 0 : rate * Math.exp(-rate * x);
  },
  cdf: (x, [rate = 1]) => {
    requirePositive(rate, 'rate');
    return x <= 0 ? 0 : 1 - Math.exp(-rate * x);
  },
  quantile: (p, [rate = 1]) => -Math.log1p(-p) / rate,
  mean: ([rate = 1]) => 1 / rate,
  variance: ([rate = 1]) => 1 / (rate * rate),
  use: 'Waiting times between events that happen at a constant rate.',
};

const uniformDistribution: Distribution = {
  id: 'uniform',
  name: 'Continuous uniform',
  discrete: false,
  parameters: [
    { name: 'a', description: 'lower bound', default: 0 },
    { name: 'b', description: 'upper bound', default: 1 },
  ],
  support: ([a = 0, b = 1]) => ({ min: a, max: b }),
  pdf: (x, [a = 0, b = 1]) => {
    if (!(b > a)) throw new CalcError('DOMAIN', 'The upper bound must be larger than the lower bound');
    return x < a || x > b ? 0 : 1 / (b - a);
  },
  cdf: (x, [a = 0, b = 1]) => {
    if (!(b > a)) throw new CalcError('DOMAIN', 'The upper bound must be larger than the lower bound');
    if (x <= a) return 0;
    if (x >= b) return 1;
    return (x - a) / (b - a);
  },
  quantile: (p, [a = 0, b = 1]) => a + p * (b - a),
  mean: ([a = 0, b = 1]) => (a + b) / 2,
  variance: ([a = 0, b = 1]) => ((b - a) * (b - a)) / 12,
  use: 'Rounding errors and any value known only to lie inside a range.',
};

const weibullDistribution: Distribution = {
  id: 'weibull',
  name: 'Weibull',
  discrete: false,
  parameters: [
    { name: 'k', description: 'shape', default: 2, min: 0 },
    { name: 'λ', description: 'scale', default: 1, min: 0 },
  ],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [k = 1, lambda = 1]) => {
    requirePositive(k, 'shape');
    requirePositive(lambda, 'scale');
    if (x < 0) return 0;
    const z = x / lambda;
    return x === 0 && k < 1 ? Number.POSITIVE_INFINITY : (k / lambda) * z ** (k - 1) * Math.exp(-(z ** k));
  },
  cdf: (x, [k = 1, lambda = 1]) => {
    requirePositive(k, 'shape');
    requirePositive(lambda, 'scale');
    return x <= 0 ? 0 : 1 - Math.exp(-((x / lambda) ** k));
  },
  quantile: (p, [k = 1, lambda = 1]) => lambda * (-Math.log1p(-p)) ** (1 / k),
  mean: ([k = 1, lambda = 1]) => lambda * gammaFunction(1 + 1 / k),
  variance: ([k = 1, lambda = 1]) =>
    lambda * lambda * (gammaFunction(1 + 2 / k) - gammaFunction(1 + 1 / k) ** 2),
  use: 'Component lifetimes and wind speeds — the standard reliability distribution.',
};

const cauchyDistribution: Distribution = {
  id: 'cauchy',
  name: 'Cauchy (Lorentz)',
  discrete: false,
  undefinedMoments: true,
  parameters: [
    { name: 'x₀', description: 'location (median)', default: 0 },
    { name: 'γ', description: 'scale (half-width at half-maximum)', default: 1, min: 0 },
  ],
  support: () => ({ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [location = 0, scale = 1]) => {
    requirePositive(scale, 'scale');
    return 1 / (Math.PI * scale * (1 + ((x - location) / scale) ** 2));
  },
  cdf: (x, [location = 0, scale = 1]) => {
    requirePositive(scale, 'scale');
    return 0.5 + Math.atan((x - location) / scale) / Math.PI;
  },
  quantile: (p, [location = 0, scale = 1]) => location + scale * Math.tan(Math.PI * (p - 0.5)),
  mean: () => Number.NaN,
  variance: () => Number.NaN,
  use: 'Resonance curves — and a reminder that heavy tails break the mean.',
};

const laplaceDistribution: Distribution = {
  id: 'laplace',
  name: 'Laplace (double exponential)',
  discrete: false,
  parameters: [
    { name: 'μ', description: 'location', default: 0 },
    { name: 'b', description: 'scale', default: 1, min: 0 },
  ],
  support: () => ({ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [mu = 0, scale = 1]) => {
    requirePositive(scale, 'scale');
    return Math.exp(-Math.abs(x - mu) / scale) / (2 * scale);
  },
  cdf: (x, [mu = 0, scale = 1]) => {
    requirePositive(scale, 'scale');
    const z = (x - mu) / scale;
    return z < 0 ? 0.5 * Math.exp(z) : 1 - 0.5 * Math.exp(-z);
  },
  quantile: (p, [mu = 0, scale = 1]) =>
    mu - scale * Math.sign(p - 0.5) * Math.log1p(-2 * Math.abs(p - 0.5)),
  mean: ([mu = 0]) => mu,
  variance: ([, scale = 1]) => 2 * scale * scale,
  use: 'Errors with sharper peaks than the normal distribution (LASSO priors).',
};

const studentTDistribution: Distribution = {
  id: 'studentt',
  name: 'Student t',
  discrete: false,
  parameters: [{ name: 'ν', description: 'degrees of freedom', default: 10, min: 0 }],
  support: () => ({ min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [df = 1]) => {
    requirePositive(df, 'degrees of freedom');
    return (
      Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2)) /
      Math.sqrt(df * Math.PI) *
      (1 + (x * x) / df) ** (-(df + 1) / 2)
    );
  },
  cdf: (x, [df = 1]) => {
    requirePositive(df, 'degrees of freedom');
    const t = (1 + (x * x) / df) ** -1;
    const tail = 0.5 * regularisedBeta(t, df / 2, 0.5);
    return x >= 0 ? 1 - tail : tail;
  },
  quantile: (p, [df = 1]) => {
    if (p <= 0 || p >= 1) throw new CalcError('DOMAIN', 'The probability must be between 0 and 1 (exclusive)');
    if (p === 0.5) return 0;
    // Bisection on the exact CDF: robust for every ν, including ν < 2.
    const sign = p < 0.5 ? -1 : 1;
    const target = sign < 0 ? 1 - p : p;
    let low = 0;
    let high = 2;
    for (let i = 0; i < 200 && studentTDistribution.cdf(high, [df]) < target; i += 1) high *= 2;
    for (let i = 0; i < 200; i += 1) {
      const middle = (low + high) / 2;
      if (!(middle > low && middle < high)) break;
      if (studentTDistribution.cdf(middle, [df]) < target) low = middle;
      else high = middle;
    }
    return (sign * (low + high)) / 2;
  },
  mean: ([df = 1]) => (df > 1 ? 0 : Number.NaN),
  variance: ([df = 1]) => (df > 2 ? df / (df - 2) : Number.NaN),
  use: 'Means estimated from small samples — the basis of the t tests.',
};

const chiSquareDistribution: Distribution = {
  id: 'chisquare',
  name: 'Chi-square (χ²)',
  discrete: false,
  parameters: [{ name: 'k', description: 'degrees of freedom', default: 1, min: 0 }],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [k = 1]) => {
    requirePositive(k, 'degrees of freedom');
    if (x < 0) return 0;
    if (x === 0) return k < 2 ? Number.POSITIVE_INFINITY : k === 2 ? 0.5 : 0;
    return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - logGamma(k / 2) - (k / 2) * Math.LN2);
  },
  cdf: (x, [k = 1]) => {
    requirePositive(k, 'degrees of freedom');
    return x <= 0 ? 0 : regularisedGammaP(k / 2, x / 2);
  },
  quantile: (p, [k = 1]) => {
    requirePositive(k, 'degrees of freedom');
    return bisectQuantile((x) => chiSquareDistribution.cdf(x, [k]), p, k, Math.sqrt(2 * k) + 1);
  },
  mean: ([k = 1]) => k,
  variance: ([k = 1]) => 2 * k,
  use: 'Goodness-of-fit and independence tests; the sum of squared standard normals.',
};

const fDistribution: Distribution = {
  id: 'f',
  name: 'F (Fisher–Snedecor)',
  discrete: false,
  parameters: [
    { name: 'd₁', description: 'numerator degrees of freedom', default: 5, min: 0 },
    { name: 'd₂', description: 'denominator degrees of freedom', default: 10, min: 0 },
  ],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [d1 = 1, d2 = 1]) => {
    requirePositive(d1, 'numerator degrees of freedom');
    requirePositive(d2, 'denominator degrees of freedom');
    if (x <= 0) return 0;
    const logBeta = logGamma(d1 / 2) + logGamma(d2 / 2) - logGamma((d1 + d2) / 2);
    return Math.exp(
      (d1 / 2) * Math.log(d1 / d2) +
        (d1 / 2 - 1) * Math.log(x) -
        logBeta -
        ((d1 + d2) / 2) * Math.log1p((d1 * x) / d2),
    );
  },
  cdf: (x, [d1 = 1, d2 = 1]) => {
    requirePositive(d1, 'numerator degrees of freedom');
    requirePositive(d2, 'denominator degrees of freedom');
    if (x <= 0) return 0;
    const y = (d1 * x) / (d1 * x + d2);
    return regularisedBeta(y, d1 / 2, d2 / 2);
  },
  quantile: (p, [d1 = 1, d2 = 1]) =>
    bisectQuantile((x) => fDistribution.cdf(x, [d1, d2]), p, 1, 2 + 4 / Math.max(1, d1)),
  mean: ([, d2 = 1]) => (d2 > 2 ? d2 / (d2 - 2) : Number.NaN),
  variance: ([d1 = 1, d2 = 1]) =>
    d2 > 4 ? (2 * d2 * d2 * (d1 + d2 - 2)) / (d1 * (d2 - 2) ** 2 * (d2 - 4)) : Number.NaN,
  use: 'Comparing two variances — ANOVA and regression model checks.',
};

const gammaDistribution: Distribution = {
  id: 'gamma',
  name: 'Gamma',
  discrete: false,
  parameters: [
    { name: 'k', description: 'shape', default: 2, min: 0 },
    { name: 'θ', description: 'scale', default: 1, min: 0 },
  ],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (x, [k = 1, theta = 1]) => {
    requirePositive(k, 'shape');
    requirePositive(theta, 'scale');
    if (x < 0) return 0;
    if (x === 0) return k < 1 ? Number.POSITIVE_INFINITY : k === 1 ? 1 / theta : 0;
    return Math.exp((k - 1) * Math.log(x) - x / theta - logGamma(k) - k * Math.log(theta));
  },
  cdf: (x, [k = 1, theta = 1]) => {
    requirePositive(k, 'shape');
    requirePositive(theta, 'scale');
    return x <= 0 ? 0 : regularisedGammaP(k, x / theta);
  },
  quantile: (p, [k = 1, theta = 1]) =>
    bisectQuantile((x) => gammaDistribution.cdf(x, [k, theta]), p, k * theta, Math.sqrt(k) * theta + 1),
  mean: ([k = 1, theta = 1]) => k * theta,
  variance: ([k = 1, theta = 1]) => k * theta * theta,
  use: 'Waiting time for several events, rainfall totals, insurance claims.',
};

const betaDistribution: Distribution = {
  id: 'beta',
  name: 'Beta',
  discrete: false,
  parameters: [
    { name: 'α', description: 'first shape', default: 2, min: 0 },
    { name: 'β', description: 'second shape', default: 2, min: 0 },
  ],
  support: () => ({ min: 0, max: 1 }),
  pdf: (x, [a = 1, b = 1]) => {
    requirePositive(a, 'first shape');
    requirePositive(b, 'second shape');
    if (x < 0 || x > 1) return 0;
    if (x === 0) return a < 1 ? Number.POSITIVE_INFINITY : a === 1 ? b : 0;
    if (x === 1) return b < 1 ? Number.POSITIVE_INFINITY : b === 1 ? a : 0;
    const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - logBeta);
  },
  cdf: (x, [a = 1, b = 1]) => {
    requirePositive(a, 'first shape');
    requirePositive(b, 'second shape');
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return regularisedBeta(x, a, b);
  },
  quantile: (p, [a = 1, b = 1]) =>
    bisectQuantile((x) => betaDistribution.cdf(x, [a, b]), p, a / (a + b), 0.5),
  mean: ([a = 1, b = 1]) => a / (a + b),
  variance: ([a = 1, b = 1]) => (a * b) / ((a + b) ** 2 * (a + b + 1)),
  use: 'A proportion or probability you are learning about (Bayesian updating).',
};

const binomialDistribution: Distribution = {
  id: 'binomial',
  name: 'Binomial',
  discrete: true,
  parameters: [
    { name: 'n', description: 'number of trials', default: 10, min: 0, integer: true },
    { name: 'p', description: 'success probability', default: 0.5, min: 0, max: 1, inclusiveMin: true, inclusiveMax: true },
  ],
  support: ([n = 0]) => ({ min: 0, max: n }),
  pdf: (k, [n = 0, p = 0.5]) => {
    if (!Number.isInteger(k) || k < 0 || k > n) return 0;
    const logTerm = logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    return Math.exp(logTerm + k * Math.log(p) + (n - k) * Math.log1p(-p));
  },
  cdf: (k, [n = 0, p = 0.5]) => {
    if (k < 0) return 0;
    if (k >= n) return 1;
    // Iₚ(n − k, k + 1) is the exact binomial CDF.
    if (p === 0) return 1;
    if (p === 1) return 0;
    const x = Math.floor(k);
    return regularisedBeta(1 - p, n - x, x + 1);
  },
  quantile: (p, [n = 0, probability = 0.5]) =>
    discreteQuantile(
      (k) => binomialDistribution.cdf(k, [n, probability]),
      p,
      n * probability,
      Math.sqrt(n * probability * (1 - probability)) + 1,
      n,
    ),
  mean: ([n = 0, p = 0.5]) => n * p,
  variance: ([n = 0, p = 0.5]) => n * p * (1 - p),
  use: 'Number of successes in a fixed number of independent trials.',
};

const bernoulliDistribution: Distribution = {
  id: 'bernoulli',
  name: 'Bernoulli',
  discrete: true,
  parameters: [{ name: 'p', description: 'success probability', default: 0.5, min: 0, max: 1, inclusiveMin: true, inclusiveMax: true }],
  support: () => ({ min: 0, max: 1 }),
  pdf: (k, [p = 0.5]) => (k === 0 ? 1 - p : k === 1 ? p : 0),
  cdf: (k, [p = 0.5]) => (k < 0 ? 0 : k < 1 ? 1 - p : 1),
  quantile: (p, [probability = 0.5]) => (p <= 1 - probability ? 0 : 1),
  mean: ([p = 0.5]) => p,
  variance: ([p = 0.5]) => p * (1 - p),
  use: 'A single yes/no trial — the coin the binomial is built from.',
};

const discreteUniformDistribution: Distribution = {
  id: 'discrete-uniform',
  name: 'Discrete uniform',
  discrete: true,
  parameters: [
    { name: 'a', description: 'lowest value', default: 1, integer: true },
    { name: 'b', description: 'highest value', default: 6, integer: true },
  ],
  support: ([a = 1, b = 6]) => ({ min: a, max: b }),
  pdf: (k, [a = 1, b = 6]) =>
    Number.isInteger(k) && k >= a && k <= b ? 1 / (b - a + 1) : 0,
  cdf: (k, [a = 1, b = 6]) => {
    const x = Math.floor(k);
    if (x < a) return 0;
    if (x >= b) return 1;
    return (x - a + 1) / (b - a + 1);
  },
  quantile: (p, [a = 1, b = 6]) =>
    Math.min(b, Math.max(a, a + Math.ceil(Math.max(0, p) * (b - a + 1)) - 1)),
  mean: ([a = 1, b = 6]) => (a + b) / 2,
  variance: ([a = 1, b = 6]) => ((b - a + 1) ** 2 - 1) / 12,
  use: 'A fair die, a random integer, an index drawn without weighting.',
};

const poissonDistribution: Distribution = {
  id: 'poisson',
  name: 'Poisson',
  discrete: true,
  parameters: [{ name: 'λ', description: 'mean number of events', default: 3, min: 0 }],
  support: () => ({ min: 0, max: Number.POSITIVE_INFINITY }),
  pdf: (k, [lambda = 1]) => {
    if (!Number.isInteger(k) || k < 0) return 0;
    return Math.exp(-lambda + k * Math.log(lambda) - logGamma(k + 1));
  },
  cdf: (k, [lambda = 1]) => {
    if (k < 0) return 0;
    return 1 - regularisedGammaP(Math.floor(k) + 1, lambda);
  },
  quantile: (p, [lambda = 1]) =>
    discreteQuantile((k) => poissonDistribution.cdf(k, [lambda]), p, lambda, Math.sqrt(lambda) + 1, Math.ceil(lambda * 100 + 400)),
  mean: ([lambda = 1]) => lambda,
  variance: ([lambda = 1]) => lambda,
  use: 'Counts of rare events in a fixed window: arrivals, defects, accidents.',
};

const geometricDistribution: Distribution = {
  id: 'geometric',
  name: 'Geometric',
  discrete: true,
  parameters: [{ name: 'p', description: 'success probability', default: 0.3, min: 0, max: 1 }],
  support: () => ({ min: 1, max: Number.POSITIVE_INFINITY }),
  pdf: (k, [p = 0.5]) => {
    if (!Number.isInteger(k) || k < 1) return 0;
    if (p === 1) return k === 1 ? 1 : 0;
    return p * (1 - p) ** (k - 1);
  },
  cdf: (k, [p = 0.5]) => (k < 1 ? 0 : 1 - (1 - p) ** Math.floor(k)),
  quantile: (p, [probability = 0.5]) =>
    discreteQuantile((k) => geometricDistribution.cdf(k, [probability]), p, 1 / probability, 1 / probability + 1, 100000),
  mean: ([p = 0.5]) => 1 / p,
  variance: ([p = 0.5]) => (1 - p) / (p * p),
  use: 'Number of trials until the first success (counting the success).',
};

const negativeBinomialDistribution: Distribution = {
  id: 'negative-binomial',
  name: 'Negative binomial',
  discrete: true,
  parameters: [
    { name: 'r', description: 'successes needed', default: 3, min: 0, integer: true },
    { name: 'p', description: 'success probability', default: 0.5, min: 0, max: 1 },
  ],
  support: ([r = 1]) => ({ min: r, max: Number.POSITIVE_INFINITY }),
  pdf: (k, [r = 1, p = 0.5]) => {
    if (!Number.isInteger(k) || k < r) return 0;
    const logTerm = logGamma(k) - logGamma(r) - logGamma(k - r + 1);
    return Math.exp(logTerm + r * Math.log(p) + (k - r) * Math.log1p(-p));
  },
  cdf: (k, [r = 1, p = 0.5]) => {
    if (k < r) return 0;
    return regularisedBeta(p, r, Math.floor(k) - r + 1);
  },
  quantile: (p, params) => {
    const [r = 1, probability = 0.5] = params;
    return discreteQuantile(
      (k) => negativeBinomialDistribution.cdf(k, [r, probability]),
      p,
      r / probability,
      Math.sqrt(r * (1 - probability)) / probability + 1,
      Math.ceil(r * 200 + 2000),
    );
  },
  mean: ([r = 1, p = 0.5]) => r / p,
  variance: ([r = 1, p = 0.5]) => (r * (1 - p)) / (p * p),
  use: 'Trials needed for r successes; over-dispersed counts.',
};

const hypergeometricDistribution: Distribution = {
  id: 'hypergeometric',
  name: 'Hypergeometric',
  discrete: true,
  parameters: [
    { name: 'N', description: 'population size', default: 50, min: 0, integer: true },
    { name: 'K', description: 'successes in the population', default: 10, min: 0, integer: true },
    { name: 'n', description: 'draws', default: 5, min: 0, integer: true },
  ],
  support: ([N = 0, K = 0, n = 0]) => ({
    min: Math.max(0, n - (N - K)),
    max: Math.min(n, K),
  }),
  pdf: (k, [N = 0, K = 0, n = 0]) => {
    const low = Math.max(0, n - (N - K));
    const high = Math.min(n, K);
    if (!Number.isInteger(k) || k < low || k > high) return 0;
    return Math.exp(
      logChoose(K, k) + logChoose(N - K, n - k) - logChoose(N, n),
    );
  },
  cdf: (k, params) => {
    let total = 0;
    for (let value = 0; value <= Math.floor(k); value += 1) total += hypergeometricDistribution.pdf(value, params);
    return Math.min(1, total);
  },
  quantile: (p, params) => {
    const { min = 0, max = 1 } = hypergeometricDistribution.support(params);
    return discreteQuantile((k) => hypergeometricDistribution.cdf(k, params), p, (min + max) / 2, max - min + 1, max);
  },
  mean: ([N = 1, K = 0, n = 0]) => (n * K) / N,
  variance: ([N = 1, K = 0, n = 0]) => (n * (K / N) * (1 - K / N) * (N - n)) / (N - 1),
  use: 'Sampling without replacement — card hands, quality-control batches.',
};

function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

export const DISTRIBUTIONS: readonly Distribution[] = [
  normalDistribution,
  lognormalDistribution,
  exponentialDistribution,
  uniformDistribution,
  weibullDistribution,
  laplaceDistribution,
  cauchyDistribution,
  studentTDistribution,
  chiSquareDistribution,
  fDistribution,
  gammaDistribution,
  betaDistribution,
  binomialDistribution,
  bernoulliDistribution,
  discreteUniformDistribution,
  poissonDistribution,
  geometricDistribution,
  negativeBinomialDistribution,
  hypergeometricDistribution,
];

export function getDistribution(id: string): Distribution | undefined {
  return DISTRIBUTIONS.find((distribution) => distribution.id === id);
}

export function requireDistribution(id: string): Distribution {
  const distribution = getDistribution(id);
  if (!distribution) {
    throw new CalcError('INPUT', `Unknown distribution “${id}”`, {
      details: `Known distributions: ${DISTRIBUTIONS.map((entry) => entry.id).join(', ')}.`,
    });
  }
  return distribution;
}

export interface DistributionProfile {
  id: string;
  name: string;
  discrete: boolean;
  support: { min: number; max: number };
  mean: number;
  variance: number;
  sd: number;
  median: number;
  /** Values at the quartiles: a ready-made summary of the shape. */
  quartiles: { q1: number; q3: number };
  /** True when the quantiles are not finite (an odd support or shape). */
  approximate: boolean;
  use: string;
  note?: string;
}

/** Shape summary for the UI: support, moments and quartiles in one call. */
export function describeDistribution(id: string, parameters: number[]): DistributionProfile {
  const distribution = requireDistribution(id);
  validateParameters(distribution, parameters);
  const support = distribution.support(parameters);
  const quantile = (p: number) => {
    if (p <= 0) return support.min;
    if (p >= 1) return support.max;
    return distribution.quantile(p, parameters);
  };
  const mean = distribution.mean(parameters);
  const variance = distribution.variance(parameters);
  const median = quantile(0.5);
  const q1 = quantile(0.25);
  const q3 = quantile(0.75);
  const finite = [mean, variance, median, q1, q3].every((value) => Number.isFinite(value));
  return {
    id: distribution.id,
    name: distribution.name,
    discrete: distribution.discrete,
    support,
    mean,
    variance,
    sd: Number.isFinite(variance) ? Math.sqrt(Math.max(0, variance)) : Number.NaN,
    median,
    quartiles: { q1, q3 },
    approximate: !finite,
    use: distribution.use,
    note: distribution.undefinedMoments
      ? 'This distribution has no finite mean or variance — the tails are too heavy.'
      : undefined,
  };
}

/* -------------------------------- sampling ------------------------------- */

/** Deterministic PRNG (mulberry32) so simulations reproduce exactly. */
export function createRandom(seed = 12345): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleNormal(meanValue: number, sd: number, random: () => number): number {
  // Box–Muller, using both outputs of one pair so nothing is thrown away.
  const u1 = Math.max(1e-12, random());
  const u2 = random();
  return meanValue + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Draws `count` values from a distribution. Continuous values come from inverse
 * transform sampling on the exact quantile, the normal by Box–Muller; the same
 * seed always gives the same sample.
 */
export function sampleDistribution(
  id: string,
  parameters: number[],
  count: number,
  seed = 12345,
): number[] {
  const distribution = requireDistribution(id);
  validateParameters(distribution, parameters);
  const size = Math.max(0, Math.min(200000, Math.floor(count)));
  const random = createRandom(seed);
  const values: number[] = [];
  if (id === 'normal') {
    const [meanValue = 0, sd = 1] = parameters;
    for (let i = 0; i < size; i += 1) values.push(sampleNormal(meanValue, sd, random));
    return values;
  }
  const support = distribution.support(parameters);
  for (let i = 0; i < size; i += 1) {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, random()));
    let value = distribution.quantile(u, parameters);
    if (distribution.discrete) value = Math.floor(value);
    if (support.min !== Number.NEGATIVE_INFINITY && value < support.min) value = support.min;
    if (support.max !== Number.POSITIVE_INFINITY && value > support.max) value = support.max;
    if (!Number.isFinite(value)) value = 0;
    values.push(value);
  }
  return values;
}

/** Sample mean, variance and standard error — the numbers a simulation reports. */
export function sampleStats(values: readonly number[]): {
  count: number;
  mean: number;
  variance: number;
  sd: number;
  standardError: number;
} {
  const count = values.length;
  if (count === 0) return { count: 0, mean: Number.NaN, variance: Number.NaN, sd: Number.NaN, standardError: Number.NaN };
  const mean = values.reduce((total, value) => total + value, 0) / count;
  const variance = count > 1 ? values.reduce((total, value) => total + (value - mean) ** 2, 0) / (count - 1) : 0;
  return { count, mean, variance, sd: Math.sqrt(variance), standardError: Math.sqrt(variance / count) };
}
