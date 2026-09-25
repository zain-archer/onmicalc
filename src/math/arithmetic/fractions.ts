import { CalcError } from '@/core/errors';

/**
 * Exact rational arithmetic on 64-bit-safe integers.
 * Denominators are always positive and fractions are always reduced.
 */

export interface Fraction {
  numerator: number;
  denominator: number;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a / gcd(a, b)) * b);
}

function requireInteger(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new CalcError('INPUT', `${label} must be a finite number`);
  if (!Number.isInteger(value)) {
    throw new CalcError('INPUT', `${label} must be a whole number`, {
      details: `Received ${value}. Fractions only accept integer numerators and denominators.`,
    });
  }
  if (!Number.isSafeInteger(value)) {
    throw new CalcError('OVERFLOW', `${label} is too large for exact fraction arithmetic`, {
      details: 'Exact fractions are limited to integers below 2^53.',
    });
  }
  return value;
}

/** Build a reduced fraction. Throws on a zero denominator. */
export function fraction(numerator: number, denominator = 1): Fraction {
  const n = requireInteger(numerator, 'Numerator');
  const d = requireInteger(denominator, 'Denominator');
  if (d === 0) {
    throw new CalcError('DIV_ZERO', 'A fraction cannot have a zero denominator');
  }
  const sign = d < 0 ? -1 : 1;
  const divisor = gcd(n, d) || 1;
  return { numerator: (sign * n) / divisor, denominator: Math.abs(d) / divisor };
}

export function toNumber(value: Fraction): number {
  return value.numerator / value.denominator;
}

export function add(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

export function subtract(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}

export function multiply(a: Fraction, b: Fraction): Fraction {
  return fraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function divide(a: Fraction, b: Fraction): Fraction {
  if (b.numerator === 0) throw new CalcError('DIV_ZERO', 'Division by zero in fraction arithmetic');
  return fraction(a.numerator * b.denominator, a.denominator * b.numerator);
}

/** Integer power; negative exponents swap the numerator and denominator. */
export function power(base: Fraction, exponent: number): Fraction {
  const n = requireInteger(exponent, 'Exponent');
  if (n === 0) return fraction(1, 1);
  if (base.numerator === 0 && n < 0) {
    throw new CalcError('DIV_ZERO', 'Zero cannot be raised to a negative power');
  }
  const magnitude = Math.abs(n);
  const numerator = base.numerator ** magnitude;
  const denominator = base.denominator ** magnitude;
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new CalcError('OVERFLOW', 'The powered fraction is too large to represent exactly');
  }
  return n < 0 ? fraction(denominator, numerator) : fraction(numerator, denominator);
}

export function negate(a: Fraction): Fraction {
  return { numerator: -a.numerator, denominator: a.denominator };
}

export function reciprocal(a: Fraction): Fraction {
  if (a.numerator === 0) throw new CalcError('DIV_ZERO', 'Zero has no reciprocal');
  return fraction(a.denominator, a.numerator);
}

export function abs(a: Fraction): Fraction {
  return { numerator: Math.abs(a.numerator), denominator: a.denominator };
}

export function compare(a: Fraction, b: Fraction): number {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left === right ? 0 : left > right ? 1 : -1;
}

export function equals(a: Fraction, b: Fraction): boolean {
  return compare(a, b) === 0;
}

/** Proper mixed form: 7/4 -> { whole: 1, numerator: 3, denominator: 4 }. */
export function toMixed(a: Fraction): { whole: number; numerator: number; denominator: number } {
  const whole = Math.trunc(a.numerator / a.denominator);
  const remainder = Math.abs(a.numerator % a.denominator);
  return { whole, numerator: remainder, denominator: a.denominator };
}

export function fromMixed(whole: number, numerator: number, denominator: number): Fraction {
  const sign = whole < 0 ? -1 : 1;
  return fraction(whole * denominator + sign * numerator, denominator);
}

/** Render as "a/b", or the integer when the denominator is 1. */
export function formatFraction(a: Fraction, style: 'improper' | 'mixed' = 'improper'): string {
  if (a.denominator === 1) return String(a.numerator);
  if (style === 'mixed' && Math.abs(a.numerator) > a.denominator) {
    const { whole, numerator, denominator } = toMixed(a);
    const sign = whole < 0 || a.numerator < 0 ? '-' : '';
    const magnitude = Math.abs(whole);
    return magnitude === 0
      ? `${sign}${numerator}/${denominator}`
      : `${sign}${magnitude} ${numerator}/${denominator}`;
  }
  return `${a.numerator}/${a.denominator}`;
}

/**
 * Parse a fraction from text: "3/4", "-7/2", "1 1/2", "2_3/4" or "5".
 * Returns null when the input is not a valid fraction (callers decide the error).
 */
export function parseFraction(input: string): Fraction | null {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  const mixed = /^(-?\d+)[\s_](\d+)\/(\d+)$/.exec(text);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (denominator === 0) return null;
    return fromMixed(whole, numerator, denominator);
  }

  const simple = /^(-?\d+)\s*\/\s*(-?\d+)$/.exec(text);
  if (simple) {
    const denominator = Number(simple[2]);
    if (denominator === 0) return null;
    return fraction(Number(simple[1]), denominator);
  }

  if (/^-?\d+$/.test(text)) return fraction(Number(text), 1);
  return null;
}

export interface DecimalToFractionOptions {
  /** Largest denominator to consider (default 1e6). */
  maxDenominator?: number;
  /** Maximum relative error accepted (default 1e-12). */
  tolerance?: number;
}

export interface DecimalToFractionResult {
  fraction: Fraction;
  /** False when no fraction within tolerance was found (best approximation returned). */
  exact: boolean;
}

/**
 * Continued-fraction expansion (Stern–Brocot style) — the same method used by
 * CAS tools, so 0.333333333333 gives 1/3 rather than 333333333333/1e12.
 */
export function fromDecimal(value: number, options: DecimalToFractionOptions = {}): DecimalToFractionResult {
  if (!Number.isFinite(value)) throw new CalcError('DOMAIN', 'Cannot convert a non-finite value to a fraction');
  const maxDenominator = Math.max(1, Math.min(options.maxDenominator ?? 1e6, 1e15));
  const tolerance = options.tolerance ?? 1e-12;

  if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
    return { fraction: fraction(value, 1), exact: true };
  }

  const sign = value < 0 ? -1 : 1;
  const target = Math.abs(value);
  let x = target;

  // Convergents of the continued-fraction expansion.
  let hPrev = 0;
  let kPrev = 1;
  let hCur = 1;
  let kCur = 0;

  const withinTolerance = (n: number, d: number) => Math.abs(n / d - target) <= tolerance * Math.max(1, target);

  for (let i = 0; i < 64; i += 1) {
    const a = Math.floor(x);
    const hNext = a * hCur + hPrev;
    const kNext = a * kCur + kPrev;

    if (kNext > maxDenominator || !Number.isSafeInteger(hNext) || !Number.isSafeInteger(kNext)) {
      // Best rational approximation with a bounded denominator: take the largest
      // semiconvergent that still fits, then keep whichever candidate is closer.
      const t = kCur > 0 ? Math.floor((maxDenominator - kPrev) / kCur) : 0;
      const hAlt = t * hCur + hPrev;
      const kAlt = t * kCur + kPrev;
      const candidates: Fraction[] = [];
      if (kCur > 0) candidates.push(fraction(sign * hCur, kCur));
      if (kAlt > 0 && kAlt <= maxDenominator) candidates.push(fraction(sign * hAlt, kAlt));
      if (candidates.length === 0) candidates.push(fraction(sign, 1));
      const best = candidates.reduce((left, right) =>
        Math.abs(toNumber(left) - value) <= Math.abs(toNumber(right) - value) ? left : right,
      );
      return { fraction: best, exact: false };
    }

    hPrev = hCur;
    kPrev = kCur;
    hCur = hNext;
    kCur = kNext;

    if (withinTolerance(hCur, kCur)) {
      return { fraction: fraction(sign * hCur, kCur), exact: true };
    }

    const fractionPart = x - a;
    if (fractionPart < 1e-15) break;
    x = 1 / fractionPart;
  }

  const fallback = fraction(sign * hCur, kCur || 1);
  return { fraction: fallback, exact: withinTolerance(fallback.numerator, fallback.denominator) };
}
