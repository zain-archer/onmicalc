import { describe, expect, it } from 'vitest';
import * as c from './index';
import { CalcError } from '@/core/errors';

const close = (value: c.Complex, re: number, im: number, digits = 10) => {
  expect(value.re).toBeCloseTo(re, digits);
  expect(value.im).toBeCloseTo(im, digits);
};

describe('complex arithmetic', () => {
  const a = c.complex(3, 4);
  const b = c.complex(1, -2);

  it('adds, subtracts and multiplies', () => {
    close(c.add(a, b), 4, 2);
    close(c.subtract(a, b), 2, 6);
    close(c.multiply(a, b), 11, -2);
    close(c.multiply(c.complex(0, 1), c.complex(0, 1)), -1, 0);
  });

  it('divides with the conjugate method', () => {
    close(c.divide(a, b), -1, 2);
    close(c.divide(c.complex(1, 0), c.complex(0, 1)), 0, -1);
    expect(() => c.divide(a, c.complex(0, 0))).toThrowError(/Division by zero/);
  });

  it('computes magnitude, argument and conjugate', () => {
    expect(c.magnitude(a)).toBe(5);
    expect(c.magnitude(c.complex(0, 0))).toBe(0);
    expect(c.argument(c.complex(0, 1))).toBeCloseTo(Math.PI / 2, 12);
    expect(c.argument(c.complex(-1, 0))).toBeCloseTo(Math.PI, 12);
    close(c.conjugate(a), 3, -4);
    expect(() => c.argument(c.complex(0, 0))).toThrowError(CalcError);
  });

  it('round-trips polar and rectangular form', () => {
    const z = c.complex(-2, 5);
    const polar = c.toPolar(z);
    close(c.fromPolar(polar.r, polar.theta), -2, 5);
    expect(polar.r).toBeCloseTo(Math.hypot(2, 5), 12);
    expect(() => c.fromPolar(-1, 0)).toThrowError(/cannot be negative/);
  });

  it('handles large and small magnitudes without overflow', () => {
    expect(c.magnitude(c.complex(1e200, 1e200))).toBeCloseTo(Math.SQRT2 * 1e200, -190);
    expect(c.magnitude(c.complex(1e-200, 1e-200))).toBeGreaterThan(0);
  });
});

describe('complex powers, roots and logs', () => {
  it('computes integer powers exactly', () => {
    close(c.powInt(c.complex(0, 1), 4), 1, 0);
    close(c.powInt(c.complex(1, 1), 2), 0, 2);
    close(c.powInt(c.complex(2, 0), 10), 1024, 0);
    close(c.powInt(c.complex(1, 1), -1), 0.5, -0.5);
    close(c.powInt(c.complex(5, 5), 0), 1, 0);
    expect(() => c.powInt(c.complex(1, 1), 1.5)).toThrowError(/whole-number/);
  });

  it('computes the principal square root', () => {
    close(c.sqrt(c.complex(4, 0)), 2, 0);
    close(c.sqrt(c.complex(-4, 0)), 0, 2);
    close(c.sqrt(c.complex(-9, 0)), 0, 3);
    close(c.sqrt(c.complex(0, 9)), 3 * Math.SQRT1_2, 3 * Math.SQRT1_2);
    close(c.sqrt(c.complex(3, 4)), 2, 1);
  });

  it('returns all n distinct roots that satisfy z^n = original', () => {
    const z = c.complex(-8, 0);
    const cube = c.roots(z, 3);
    expect(cube).toHaveLength(3);
    for (const root of cube) close(c.powInt(root, 3), -8, 0, 8);
    const first = cube[0]!;
    close(first, 1, Math.sqrt(3), 8);

    const unity = c.roots(c.complex(1, 0), 4);
    expect(unity).toHaveLength(4);
    for (const root of unity) close(c.powInt(root, 4), 1, 0, 8);
    expect(() => c.roots(z, 0)).toThrowError(/positive whole number/);
    expect(() => c.roots(z, 2.5)).toThrowError(CalcError);
    expect(c.roots(c.complex(0, 0), 2)).toEqual([{ re: 0, im: 0 }, { re: 0, im: 0 }]);
  });

  it('computes exp, log and general powers', () => {
    close(c.expOf(c.complex(0, Math.PI)), -1, 0);
    close(c.expOf(c.complex(1, 0)), Math.E, 0);
    close(c.log(c.complex(Math.E, 0)), 1, 0);
    close(c.log(c.complex(0, 1)), 0, Math.PI / 2);
    expect(() => c.log(c.complex(0, 0))).toThrowError(/zero/);
    close(c.pow(c.complex(2, 0), c.complex(3, 0)), 8, 0);
  });

  it('computes complex trigonometry', () => {
    close(c.sin(c.complex(0, 0)), 0, 0);
    close(c.cos(c.complex(0, 0)), 1, 0);
    close(c.sin(c.complex(0, Math.PI)), 0, Math.sinh(Math.PI), 8);
    close(c.sinh(c.complex(0, 0)), 0, 0);
    close(c.cosh(c.complex(0, 0)), 1, 0);
    // sin² + cos² = 1 for complex arguments too.
    const z = c.complex(0.7, 0.4);
    const sum = c.add(c.multiply(c.sin(z), c.sin(z)), c.multiply(c.cos(z), c.cos(z)));
    close(sum, 1, 0, 10);
    close(c.tan(c.complex(0, 0)), 0, 0);
  });
});

describe('complex formatting and parsing', () => {
  it('formats real, imaginary and mixed values', () => {
    expect(c.formatComplex(c.complex(3, 0))).toBe('3');
    expect(c.formatComplex(c.complex(0, 1))).toBe('i');
    expect(c.formatComplex(c.complex(0, -1))).toBe('-i');
    expect(c.formatComplex(c.complex(2, 3))).toBe('2+3i');
    expect(c.formatComplex(c.complex(2, -3))).toBe('2−3i');
    expect(c.formatComplex(c.complex(-2, -3))).toBe('-2−3i');
    expect(c.formatComplex(c.complex(1e-16, 1))).toBe('i');
  });

  it('formats polar form in every angle mode', () => {
    expect(c.formatPolar(c.complex(0, 1), 6, 'DEG')).toBe('1 ∠ 90°');
    expect(c.formatPolar(c.complex(1, 0), 6, 'RAD')).toBe('1 ∠ 0 rad');
    expect(c.formatPolar(c.complex(0, 1), 4, 'GRAD')).toContain('100');
  });

  it('parses rectangular text', () => {
    expect(c.parseComplex('3+4i')).toEqual({ re: 3, im: 4 });
    expect(c.parseComplex('1-i')).toEqual({ re: 1, im: -1 });
    expect(c.parseComplex('-2i')).toEqual({ re: 0, im: -2 });
    expect(c.parseComplex('i')).toEqual({ re: 0, im: 1 });
    expect(c.parseComplex('-i')).toEqual({ re: 0, im: -1 });
    expect(c.parseComplex('5')).toEqual({ re: 5, im: 0 });
    expect(c.parseComplex('2.5+0.5i')).toEqual({ re: 2.5, im: 0.5 });
    expect(c.parseComplex('banana')).toBeNull();
    expect(c.parseComplex('3+4')).toBeNull();
    expect(c.parseComplex('')).toBeNull();
  });
});
