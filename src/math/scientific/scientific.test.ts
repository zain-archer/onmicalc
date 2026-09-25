import { describe, expect, it } from 'vitest';
import * as sci from './index';
import { CalcError } from '@/core/errors';

describe('logarithms', () => {
  it('computes exact integer results without float noise', () => {
    expect(sci.log10(1000)).toBe(3);
    expect(sci.log10(0.001)).toBe(-3);
    expect(sci.log2(8)).toBe(3);
    expect(sci.log2(1024)).toBe(10);
    expect(sci.logBase(81, 3)).toBe(4);
    expect(sci.ln(1)).toBe(0);
    expect(sci.logBase(7, 7)).toBe(1);
  });

  it('computes general values', () => {
    expect(sci.log10(2)).toBeCloseTo(0.3010299956639812, 15);
    expect(sci.ln(Math.E ** 3)).toBeCloseTo(3, 12);
    expect(sci.logBase(2, 10)).toBeCloseTo(Math.LN2 / Math.LN10, 15);
  });

  it('enforces domains', () => {
    expect(() => sci.log10(0)).toThrowError(/only defined for positive/);
    expect(() => sci.log10(-5)).toThrowError(CalcError);
    expect(() => sci.ln(-1)).toThrowError(CalcError);
    expect(() => sci.log2(0)).toThrowError(CalcError);
    expect(() => sci.logBase(10, 0)).toThrowError(/base must be positive/);
    expect(() => sci.logBase(10, 1)).toThrowError(/Base 1/);
  });
});

describe('exponentials and roots', () => {
  it('computes exp and powers of ten', () => {
    expect(sci.exp(0)).toBe(1);
    expect(sci.exp(1)).toBeCloseTo(Math.E, 15);
    expect(sci.tenPow(3)).toBe(1000);
    expect(sci.tenPow(-2)).toBe(0.01);
    expect(() => sci.exp(1000)).toThrowError(/too large/);
    expect(() => sci.tenPow(400)).toThrowError(CalcError);
  });

  it('computes n-th roots, including odd roots of negatives', () => {
    expect(sci.nthRoot(27, 3)).toBeCloseTo(3, 12);
    expect(sci.nthRoot(-27, 3)).toBeCloseTo(-3, 12);
    expect(sci.nthRoot(16, 4)).toBeCloseTo(2, 12);
    expect(sci.nthRoot(0, 5)).toBe(0);
    expect(() => sci.nthRoot(-16, 4)).toThrowError(/not real/);
    expect(() => sci.nthRoot(9, 0)).toThrowError(/0th root/);
    expect(() => sci.nthRoot(9, 2.5)).toThrowError(/whole-number roots/);
  });
});
