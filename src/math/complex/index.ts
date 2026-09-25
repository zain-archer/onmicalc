import { CalcError } from '@/core/errors';
import { EPSILON } from '@/core/numbers';

/** Complex number a + bi. All functions are pure and return new objects. */
export interface Complex {
  re: number;
  im: number;
}

export const complex = (re: number, im = 0): Complex => ({ re, im });
export const isReal = (z: Complex): boolean => Math.abs(z.im) <= EPSILON;

function requireFinite(z: Complex, label = 'value'): Complex {
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) {
    throw new CalcError('DOMAIN', `${label} must be finite`, { details: `Received ${formatComplex(z)}.` });
  }
  return z;
}

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function subtract(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function multiply(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

export function divide(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  if (denominator === 0) throw new CalcError('DIV_ZERO', 'Division by zero in complex arithmetic');
  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

export function negate(z: Complex): Complex {
  return { re: -z.re, im: -z.im };
}

export function conjugate(z: Complex): Complex {
  return { re: z.re, im: -z.im };
}

/** Modulus |z|. Uses hypot so huge/tiny magnitudes do not overflow. */
export function magnitude(z: Complex): number {
  return Math.hypot(z.re, z.im);
}

/** Argument (phase) in radians, in (-π, π]. */
export function argument(z: Complex): number {
  if (z.re === 0 && z.im === 0) {
    throw new CalcError('DOMAIN', 'The argument of zero is undefined');
  }
  return Math.atan2(z.im, z.re);
}

export interface Polar {
  r: number;
  /** Radians. */
  theta: number;
}

export function toPolar(z: Complex): Polar {
  return { r: magnitude(z), theta: argument(z) };
}

export function fromPolar(r: number, theta: number): Complex {
  if (r < 0) throw new CalcError('DOMAIN', 'The polar radius cannot be negative');
  return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
}

/** Exact square root for real inputs, so sqrt(-4) gives exactly 2i. */
export function sqrt(z: Complex): Complex {
  if (isReal(z)) {
    const x = z.re;
    if (x >= 0) return { re: Math.sqrt(x), im: 0 };
    return { re: 0, im: Math.sqrt(-x) };
  }
  const r = magnitude(z);
  const re = Math.sqrt((r + z.re) / 2);
  const im = Math.sign(z.im) * Math.sqrt((r - z.re) / 2);
  return { re, im };
}

/** Integer power via repeated multiplication (exact for small exponents). */
export function powInt(z: Complex, exponent: number): Complex {
  if (!Number.isInteger(exponent)) {
    throw new CalcError('INPUT', 'Complex integer powers need a whole-number exponent', {
      details: 'Use complexPow() for fractional exponents.',
    });
  }
  if (exponent === 0) return { re: 1, im: 0 };
  if (exponent < 0) return divide({ re: 1, im: 0 }, powInt(z, -exponent));
  let result: Complex = { re: 1, im: 0 };
  let base = z;
  let n = exponent;
  while (n > 0) {
    if (n & 1) result = multiply(result, base);
    base = multiply(base, base);
    n >>= 1;
  }
  return result;
}

/** Principal power z^w = exp(w · log z). */
export function pow(z: Complex, w: Complex): Complex {
  if (isReal(w)) return powInt(z, Math.round(w.re));
  return expOf(multiply(w, log(z)));
}

export function expOf(z: Complex): Complex {
  const scale = Math.exp(z.re);
  if (!Number.isFinite(scale)) throw new CalcError('OVERFLOW', 'exp(z) is too large to represent');
  return { re: scale * Math.cos(z.im), im: scale * Math.sin(z.im) };
}

/** Principal logarithm, branch cut along the negative real axis. */
export function log(z: Complex): Complex {
  const r = magnitude(z);
  if (r === 0) throw new CalcError('DOMAIN', 'The logarithm of zero is undefined');
  return { re: Math.log(r), im: argument(z) };
}

/** All n distinct n-th roots, k = 0 … n−1. */
export function roots(z: Complex, n: number): Complex[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new CalcError('INPUT', 'The root index must be a positive whole number');
  }
  if (z.re === 0 && z.im === 0) return Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  const { r, theta } = toPolar(z);
  const rootR = r ** (1 / n);
  return Array.from({ length: n }, (_, k) => fromPolar(rootR, (theta + 2 * Math.PI * k) / n));
}

export function sin(z: Complex): Complex {
  return { re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im) };
}

export function cos(z: Complex): Complex {
  return { re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im) };
}

export function tan(z: Complex): Complex {
  const denominator = add(cos(multiply(z, { re: 2, im: 0 })), { re: 1, im: 0 });
  if (magnitude(denominator) <= EPSILON) {
    throw new CalcError('DOMAIN', 'tan(z) is undefined at this point');
  }
  const numerator = sin(multiply(z, { re: 2, im: 0 }));
  return divide(numerator, denominator);
}

export function sinOf(z: Complex): Complex {
  return sin(z);
}

export function sinh(z: Complex): Complex {
  return { re: Math.sinh(z.re) * Math.cos(z.im), im: Math.cosh(z.re) * Math.sin(z.im) };
}

export function cosh(z: Complex): Complex {
  return { re: Math.cosh(z.re) * Math.cos(z.im), im: Math.sinh(z.re) * Math.sin(z.im) };
}

/** Formats z as a+bi, -i, 2, etc. Rounding is applied for readability only. */
export function formatComplex(z: Complex, precision = 10): string {
  // Values negligible against the larger component are treated as zero so that
  // 1e-16 + 1i prints as "i" rather than "1e-16+i".
  const scale = Math.max(1, Math.abs(z.re), Math.abs(z.im));
  const round = (value: number) =>
    Math.abs(value) < 1e-12 * scale ? 0 : Number(value.toPrecision(precision));
  const re = round(z.re);
  const im = round(z.im);

  if (im === 0) return String(re);
  const imPart =
    im === 1 ? 'i' : im === -1 ? '-i' : `${im}i`;
  if (re === 0) return imPart;
  return `${re}${im >= 0 ? '+' : '−'}${imPart.startsWith('-') ? imPart.slice(1) : imPart}`;
}

export function formatPolar(z: Complex, precision = 6, mode: 'RAD' | 'DEG' | 'GRAD' = 'RAD'): string {
  const { r, theta } = toPolar(z);
  const factor = mode === 'DEG' ? 180 / Math.PI : mode === 'GRAD' ? 200 / Math.PI : 1;
  return `${Number(r.toPrecision(precision))} ∠ ${Number((theta * factor).toPrecision(precision))}${mode === 'DEG' ? '°' : mode === 'GRAD' ? ' grad' : ' rad'}`;
}

/** Parses "3+4i", "-2i", "5", "1-i", "2.5+0.5i". Returns null when invalid. */
export function parseComplex(input: string): Complex | null {
  const text = input.replace(/\s+/g, '').replace(/−/g, '-').replace(/\*/g, '');
  if (!text) return null;

  const pureImaginary = /^([+-]?(?:\d+\.?\d*|\.\d+)?)i$/.exec(text);
  if (pureImaginary) {
    const coefficient = pureImaginary[1];
    if (coefficient === '' || coefficient === '+') return { re: 0, im: 1 };
    if (coefficient === '-') return { re: 0, im: -1 };
    return { re: 0, im: Number(coefficient) };
  }

  const both = /^([+-]?(?:\d+\.?\d*|\.\d+))([+-])((?:\d+\.?\d*|\.\d+)?)i$/.exec(text);
  if (both) {
    const coefficient = both[3];
    const im = coefficient === '' ? (both[2] === '-' ? -1 : 1) : Number(`${both[2]}${coefficient}`);
    return { re: Number(both[1]), im };
  }

  const real = /^[+-]?(?:\d+\.?\d*|\.\d+)$/.exec(text);
  if (real) return { re: Number(text), im: 0 };

  return null;
}

export function assertFiniteComplex(z: Complex): Complex {
  return requireFinite(z);
}
