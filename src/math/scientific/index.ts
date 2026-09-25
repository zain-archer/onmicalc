import { CalcError } from '@/core/errors';

function requirePositive(name: string, x: number): void {
  if (!(x > 0)) {
    throw new CalcError('DOMAIN', `${name}() is only defined for positive numbers`, {
      details: x === 0 ? 'The logarithm of zero is undefined (−∞).' : `Received ${x}.`,
    });
  }
}

export function log10(x: number): number {
  requirePositive('log', x);
  return Math.log10(x);
}

export function log2(x: number): number {
  requirePositive('log2', x);
  return Math.log2(x);
}

export function ln(x: number): number {
  requirePositive('ln', x);
  return Math.log(x);
}

/** Logarithm of `x` in an arbitrary base (defaults to 10). */
export function logBase(x: number, base = 10): number {
  requirePositive('log', x);
  if (!(base > 0)) throw new CalcError('DOMAIN', 'The logarithm base must be positive', { details: `Received ${base}.` });
  if (Math.abs(base - 1) < 1e-15) {
    throw new CalcError('DOMAIN', 'Base 1 is not a valid logarithm base', {
      details: 'log₁(x) has no finite value for any x ≠ 1.',
    });
  }
  const value = Math.log(x) / Math.log(base);
  // Exact results for integer powers of the base (log2(8) = 3, not 2.9999999999999996).
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-12 && Number.isFinite(rounded)) return rounded;
  return value;
}

export function exp(x: number): number {
  const value = Math.exp(x);
  if (!Number.isFinite(value)) {
    throw new CalcError('OVERFLOW', 'exp() result is too large to represent', { details: `exp(${x})` });
  }
  return value;
}

/** n-th root, defined for odd roots of negative numbers. */
export function nthRoot(x: number, n: number): number {
  if (n === 0) throw new CalcError('DOMAIN', 'The 0th root is undefined');
  const degree = Math.round(n);
  if (Math.abs(n - degree) > 1e-12) {
    throw new CalcError('DOMAIN', 'OmniCalc supports whole-number roots only', {
      details: `Received degree ${n}. Use x^(1/n) for fractional roots of positive numbers.`,
    });
  }
  if (x < 0 && degree % 2 === 0) {
    throw new CalcError('DOMAIN', `The ${degree}th root of a negative number is not real`, {
      details: 'Even roots of negative numbers require complex numbers.',
    });
  }
  if (x < 0) return -Math.pow(-x, 1 / degree);
  return Math.pow(x, 1 / degree);
}

/** Power of ten, used by the engineering notation tools. */
export function tenPow(x: number): number {
  const value = 10 ** x;
  if (!Number.isFinite(value)) {
    throw new CalcError('OVERFLOW', '10^x is too large to represent', { details: `10^${x}` });
  }
  return value;
}
