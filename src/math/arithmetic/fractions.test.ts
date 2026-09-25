import { describe, expect, it } from 'vitest';
import {
  add,
  compare,
  divide,
  equals,
  formatFraction,
  fraction,
  fromDecimal,
  fromMixed,
  gcd,
  lcm,
  multiply,
  negate,
  parseFraction,
  power,
  reciprocal,
  subtract,
  toMixed,
  toNumber,
} from './fractions';
import { CalcError } from '@/core/errors';

describe('fraction basics', () => {
  it('reduces and normalises signs', () => {
    expect(fraction(2, 4)).toEqual({ numerator: 1, denominator: 2 });
    expect(fraction(-6, -8)).toEqual({ numerator: 3, denominator: 4 });
    expect(fraction(6, -8)).toEqual({ numerator: -3, denominator: 4 });
    expect(fraction(5)).toEqual({ numerator: 5, denominator: 1 });
    expect(fraction(0, 7)).toEqual({ numerator: 0, denominator: 1 });
  });

  it('computes gcd and lcm', () => {
    expect(gcd(48, 18)).toBe(6);
    expect(gcd(-48, 18)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(0, 5)).toBe(0);
  });

  it('rejects invalid construction', () => {
    expect(() => fraction(1, 0)).toThrowError(/zero denominator/);
    expect(() => fraction(1.5, 2)).toThrowError(/whole number/);
    expect(() => fraction(2 ** 60, 3)).toThrowError(/too large/);
    expect(() => fraction(Number.NaN, 3)).toThrowError(/finite/);
  });

  it('converts to numbers', () => {
    expect(toNumber(fraction(1, 4))).toBe(0.25);
    expect(toNumber(fraction(-3, 2))).toBe(-1.5);
  });
});

describe('fraction arithmetic', () => {
  it('adds, subtracts, multiplies and divides exactly', () => {
    expect(formatFraction(add(fraction(1, 2), fraction(3, 4)))).toBe('5/4');
    expect(formatFraction(subtract(fraction(1, 2), fraction(3, 4)))).toBe('-1/4');
    expect(formatFraction(multiply(fraction(2, 3), fraction(3, 4)))).toBe('1/2');
    expect(formatFraction(divide(fraction(1, 2), fraction(1, 4)))).toBe('2');
    expect(formatFraction(add(fraction(1, 3), fraction(1, 6)))).toBe('1/2');
    expect(formatFraction(divide(fraction(2, 3), fraction(4, 9)))).toBe('3/2');
  });

  it('handles 1/3 repeated addition without float drift', () => {
    let total = fraction(0, 1);
    for (let i = 0; i < 3; i += 1) total = add(total, fraction(1, 3));
    expect(total).toEqual({ numerator: 1, denominator: 1 });
  });

  it('powers, negates and reciprocates', () => {
    expect(formatFraction(power(fraction(2, 3), 3))).toBe('8/27');
    expect(formatFraction(power(fraction(2, 3), -2))).toBe('9/4');
    expect(formatFraction(power(fraction(5, 7), 0))).toBe('1');
    expect(formatFraction(negate(fraction(3, 4)))).toBe('-3/4');
    expect(formatFraction(reciprocal(fraction(-3, 4)))).toBe('-4/3');
    expect(() => power(fraction(0, 1), -1)).toThrowError(/negative power/);
    expect(() => reciprocal(fraction(0, 1))).toThrowError(/no reciprocal/);
    expect(() => power(fraction(2, 3), 0.5)).toThrowError(/whole number/);
    expect(() => power(fraction(999999, 999998), 20)).toThrowError(CalcError);
  });

  it('compares and checks equality', () => {
    expect(compare(fraction(1, 2), fraction(2, 3))).toBeLessThan(0);
    expect(compare(fraction(3, 4), fraction(6, 8))).toBe(0);
    expect(equals(fraction(1, 3), fraction(2, 6))).toBe(true);
    expect(compare(fraction(5, 4), fraction(1, 2))).toBeGreaterThan(0);
  });

  it('refuses division by zero', () => {
    expect(() => divide(fraction(1, 2), fraction(0, 5))).toThrowError(/Division by zero/);
  });
});

describe('mixed numbers', () => {
  it('converts to mixed form and back', () => {
    expect(toMixed(fraction(7, 4))).toEqual({ whole: 1, numerator: 3, denominator: 4 });
    expect(formatFraction(fraction(7, 4), 'mixed')).toBe('1 3/4');
    expect(formatFraction(fraction(-7, 4), 'mixed')).toBe('-1 3/4');
    expect(formatFraction(fraction(3, 4), 'mixed')).toBe('3/4');
    expect(formatFraction(fraction(-3, 4), 'mixed')).toBe('-3/4');
    expect(fromMixed(1, 3, 4)).toEqual({ numerator: 7, denominator: 4 });
    expect(fromMixed(-1, 3, 4)).toEqual({ numerator: -7, denominator: 4 });
  });

  it('renders integers without a denominator', () => {
    expect(formatFraction(fraction(8, 4))).toBe('2');
    expect(formatFraction(fraction(8, 4), 'mixed')).toBe('2');
  });
});

describe('parsing fractions from text', () => {
  it('accepts improper, negative, mixed and whole inputs', () => {
    expect(parseFraction('3/4')).toEqual({ numerator: 3, denominator: 4 });
    expect(parseFraction(' -7/2 ')).toEqual({ numerator: -7, denominator: 2 });
    expect(parseFraction('1 1/2')).toEqual({ numerator: 3, denominator: 2 });
    expect(parseFraction('2_3/4')).toEqual({ numerator: 11, denominator: 4 });
    expect(parseFraction('5')).toEqual({ numerator: 5, denominator: 1 });
    expect(parseFraction('-1 1/2')).toEqual({ numerator: -3, denominator: 2 });
  });

  it('rejects malformed input instead of guessing', () => {
    expect(parseFraction('1/0')).toBeNull();
    expect(parseFraction('abc')).toBeNull();
    expect(parseFraction('1/2/3')).toBeNull();
    expect(parseFraction('')).toBeNull();
    expect(parseFraction('1.5')).toBeNull();
  });
});

describe('decimal to fraction', () => {
  it.each([
    [0.5, '1/2'],
    [0.25, '1/4'],
    [0.75, '3/4'],
    [0.1, '1/10'],
    [0.3333333333333333, '1/3'],
    [0.6666666666666666, '2/3'],
    [0.125, '1/8'],
    [1.5, '3/2'],
    [-0.375, '-3/8'],
    [2, '2'],
    [0, '0'],
    [3.1415929203539825, '355/113'],
  ])('%s -> %s', (decimal, expected) => {
    const result = fromDecimal(decimal as number);
    expect(result.exact).toBe(true);
    expect(formatFraction(result.fraction)).toBe(expected);
  });

  it('respects the denominator limit and reports inexactness', () => {
    const limited = fromDecimal(0.3333333333333333, { maxDenominator: 2 });
    expect(limited.exact).toBe(false);
    expect(limited.fraction.denominator).toBeLessThanOrEqual(2);
    // 1/2 is the best approximation with denominator <= 2.
    expect(toNumber(limited.fraction)).toBe(0.5);

    const pi = fromDecimal(3.141592653589793, { maxDenominator: 1000 });
    expect(pi.exact).toBe(false);
    expect(formatFraction(pi.fraction)).toBe('355/113');

    const exactWithinLimit = fromDecimal(0.3333333333333333, { maxDenominator: 10 });
    expect(exactWithinLimit.exact).toBe(true);
    expect(formatFraction(exactWithinLimit.fraction)).toBe('1/3');
  });

  it('round-trips through a number', () => {
    for (const value of [1 / 7, 22 / 7, 0.0625, -5 / 16, 1234.5]) {
      const { fraction: frac } = fromDecimal(value);
      expect(toNumber(frac)).toBeCloseTo(value, 10);
    }
  });

  it('rejects non-finite input', () => {
    expect(() => fromDecimal(Number.NaN)).toThrowError(/non-finite/);
    expect(() => fromDecimal(Number.POSITIVE_INFINITY)).toThrowError(CalcError);
  });
});
