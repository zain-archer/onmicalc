import { CalcError } from '@/core/errors';
import { regularisedGammaP } from '@/math/special';

/**
 * The normal distribution — the base every other continuous distribution here
 * borrows its accuracy checks from, so it lives in its own module.
 */

/**
 * Error function via the (high accuracy) regularised incomplete gamma function:
 * erf(x) = sign(x) · P(1/2, x²). Accurate to ~1e-15, unlike the classic
 * Abramowitz–Stegun polynomial (good to only 1e-7).
 */
export function erf(x: number): number {
  if (x === 0) return 0;
  const value = regularisedGammaP(0.5, x * x);
  return x > 0 ? value : -value;
}

export function requirePositive(value: number, label: string): void {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new CalcError('DOMAIN', `The ${label} must be a positive, finite number`, {
      details: `Received ${value}.`,
    });
  }
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

/** Standard normal quantile with one Newton refinement on the exact CDF. */
export function standardNormalQuantile(p: number): number {
  const rough = inverseNormal(p);
  const correction = (normalCdf(rough) - p) / Math.max(1e-300, normalPdf(rough));
  return rough - correction;
}
