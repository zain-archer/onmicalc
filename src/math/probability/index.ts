import { CalcError } from '@/core/errors';

/**
 * Probability distributions.
 * Cumulative values come from high-accuracy numeric algorithms (Lanczos gamma,
 * continued-fraction incomplete beta, series/continued-fraction incomplete
 * gamma) — chosen because they are verifiable against published tables.
 */

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Lanczos approximation of ln Γ(z) for z > 0.5. */
export function logGamma(z: number): number {
  if (z <= 0) throw new CalcError('DOMAIN', 'The gamma function is not defined for non-positive integers');
  if (z < 0.5) {
    // Reflection formula keeps accuracy for small arguments.
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const x = z - 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i += 1) a += LANCZOS[i]! / (x + i + 1);
  const t = x + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export function gamma(z: number): number {
  return Math.exp(logGamma(z));
}

/** Regularised lower incomplete gamma P(a, x) via series / continued fraction. */
export function regularizedGammaP(a: number, x: number): number {
  if (a <= 0) throw new CalcError('DOMAIN', 'The shape parameter must be positive');
  if (x < 0) throw new CalcError('DOMAIN', 'The argument must be non-negative');
  if (x === 0) return 0;
  if (x < a + 1) {
    // Series representation.
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 1000; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction (Lentz's algorithm) for the complementary function.
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  return 1 - q;
}

/** Regularised incomplete beta I_x(a, b) — used by the binomial/Student t CDFs. */
export function regularizedBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) throw new CalcError('DOMAIN', 'The beta argument must be between 0 and 1');
  if (a <= 0 || b <= 0) throw new CalcError('DOMAIN', 'Beta parameters must be positive');
  if (x === 0) return 0;
  if (x === 1) return 1;

  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  const continuedFraction = (aa: number, bb: number, xx: number): number => {
    const tiny = 1e-300;
    const qab = aa + bb;
    const qap = aa + 1;
    const qam = aa - 1;
    let c = 1;
    let d = 1 - (qab * xx) / qap;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m += 1) {
      const m2 = 2 * m;
      let numerator = (m * (bb - m) * xx) / ((qam + m2) * (aa + m2));
      d = 1 + numerator * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + numerator / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      h *= d * c;
      numerator = (-(aa + m) * (qab + m) * xx) / ((aa + m2) * (qap + m2));
      d = 1 + numerator * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + numerator / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    return h;
  };

  // Symmetry keeps the continued fraction in its convergent region.
  return x < (a + 1) / (a + b + 2)
    ? (front * continuedFraction(a, b, x)) / a
    : 1 - (front * continuedFraction(b, a, 1 - x)) / b;
}

/**
 * Error function via the (high accuracy) regularised incomplete gamma function:
 * erf(x) = sign(x) · P(1/2, x²). Accurate to ~1e-15, unlike the classic
 * Abramowitz–Stegun polynomial (good to only 1e-7).
 */
function erf(x: number): number {
  if (x === 0) return 0;
  const value = regularizedGammaP(0.5, x * x);
  return x > 0 ? value : -value;
}

export function normalPdf(x: number, meanValue = 0, sd = 1): number {
  requirePositive(sd, 'standard deviation');
  const z = (x - meanValue) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

export function normalCdf(x: number, meanValue = 0, sd = 1): number {
  requirePositive(sd, 'standard deviation');
  const z = (x - meanValue) / (sd * Math.SQRT2);
  return 0.5 * (1 + erf(z));
}

function requirePositive(value: number, label: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new CalcError('DOMAIN', `The ${label} must be a positive, finite number`, {
      details: `Received ${value}.`,
    });
  }
}

/** Inverse standard normal CDF (Acklam's algorithm, ~1e-9 accuracy). */
export function inverseNormal(p: number, meanValue = 0, sd = 1): number {
  if (p <= 0 || p >= 1) throw new CalcError('DOMAIN', 'The probability must be between 0 and 1 (exclusive)');
  requirePositive(sd, 'standard deviation');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      meanValue +
      sd *
        (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      meanValue +
      sd *
        ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
        (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    meanValue -
    sd *
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/* ------------------------------------------------------------------ */
/* Binomial                                                            */
/* ------------------------------------------------------------------ */

export function combinations(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k)) {
    throw new CalcError('INPUT', 'Combinations need whole numbers');
  }
  if (n < 0 || k < 0) throw new CalcError('DOMAIN', 'Combinations are defined for non-negative integers');
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  const smaller = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= smaller; i += 1) result = (result * (n - smaller + i)) / i;
  return Math.round(result);
}

export function permutations(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k)) {
    throw new CalcError('INPUT', 'Permutations need whole numbers');
  }
  if (k > n) return 0;
  if (n > 170) throw new CalcError('OVERFLOW', 'Permutations above 170! cannot be represented');
  let result = 1;
  for (let i = 0; i < k; i += 1) result *= n - i;
  return result;
}

function requireBinomial(n: number, p: number): void {
  if (!Number.isInteger(n) || n < 0) throw new CalcError('DOMAIN', 'The number of trials must be a non-negative whole number');
  if (p < 0 || p > 1) throw new CalcError('DOMAIN', 'The probability must be between 0 and 1');
}

export function binomialPmf(k: number, n: number, p: number): number {
  requireBinomial(n, p);
  if (!Number.isInteger(k) || k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(
    Math.log(combinations(n, k)) + k * Math.log(p) + (n - k) * Math.log(1 - p),
  );
}

export function binomialCdf(k: number, n: number, p: number): number {
  requireBinomial(n, p);
  const upper = Math.min(Math.max(Math.floor(k), -1), n);
  if (upper < 0) return 0;
  if (upper >= n) return 1;
  // Regularised incomplete beta identity: P(X ≤ k) = I_{1−p}(n−k, k+1)
  return regularizedBeta(1 - p, n - upper, upper + 1);
}

/* ------------------------------------------------------------------ */
/* Poisson                                                             */
/* ------------------------------------------------------------------ */

function requireLambda(lambda: number): void {
  if (!(lambda > 0) || !Number.isFinite(lambda)) {
    throw new CalcError('DOMAIN', 'The rate λ must be a positive number', { details: `Received ${lambda}.` });
  }
}

export function poissonPmf(k: number, lambda: number): number {
  requireLambda(lambda);
  if (!Number.isInteger(k) || k < 0) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logGamma(k + 1));
}

export function poissonCdf(k: number, lambda: number): number {
  requireLambda(lambda);
  const upper = Math.floor(k);
  if (upper < 0) return 0;
  // P(X ≤ k) = Q(k+1, λ) = 1 − P(k+1, λ)
  return 1 - regularizedGammaP(upper + 1, lambda);
}

/* ------------------------------------------------------------------ */
/* Uniform, exponential and Student t                                  */
/* ------------------------------------------------------------------ */

export function uniformPdf(x: number, low: number, high: number): number {
  if (!(high > low)) throw new CalcError('DOMAIN', 'The upper bound must exceed the lower bound');
  return x >= low && x <= high ? 1 / (high - low) : 0;
}

export function uniformCdf(x: number, low: number, high: number): number {
  if (!(high > low)) throw new CalcError('DOMAIN', 'The upper bound must exceed the lower bound');
  if (x <= low) return 0;
  if (x >= high) return 1;
  return (x - low) / (high - low);
}

export function exponentialPdf(x: number, rate: number): number {
  requirePositive(rate, 'rate');
  return x < 0 ? 0 : rate * Math.exp(-rate * x);
}

export function exponentialCdf(x: number, rate: number): number {
  requirePositive(rate, 'rate');
  return x <= 0 ? 0 : 1 - Math.exp(-rate * x);
}

export function tPdf(t: number, df: number): number {
  requirePositive(df, 'degrees of freedom');
  const numerator = gamma((df + 1) / 2);
  const denominator = Math.sqrt(df * Math.PI) * gamma(df / 2);
  return (numerator / denominator) * (1 + (t * t) / df) ** (-(df + 1) / 2);
}

export function tCdf(t: number, df: number): number {
  requirePositive(df, 'degrees of freedom');
  const x = df / (df + t * t);
  const probability = 0.5 * regularizedBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - probability : probability;
}

/** Mean, variance and standard deviation for the supported distributions. */
export interface Moments {
  mean: number;
  variance: number;
  sd: number;
}

export function normalMoments(meanValue: number, sd: number): Moments {
  requirePositive(sd, 'standard deviation');
  return { mean: meanValue, variance: sd * sd, sd };
}

export function binomialMoments(n: number, p: number): Moments {
  requireBinomial(n, p);
  return { mean: n * p, variance: n * p * (1 - p), sd: Math.sqrt(n * p * (1 - p)) };
}

export function poissonMoments(lambda: number): Moments {
  requireLambda(lambda);
  return { mean: lambda, variance: lambda, sd: Math.sqrt(lambda) };
}

export function uniformMoments(low: number, high: number): Moments {
  if (!(high > low)) throw new CalcError('DOMAIN', 'The upper bound must exceed the lower bound');
  const variance = (high - low) ** 2 / 12;
  return { mean: (low + high) / 2, variance, sd: Math.sqrt(variance) };
}

export function exponentialMoments(rate: number): Moments {
  requirePositive(rate, 'rate');
  return { mean: 1 / rate, variance: 1 / (rate * rate), sd: 1 / rate };
}

export { erf };
