import { describe, expect, it } from 'vitest';
import { factorial, MAX_EXACT_FACTORIAL } from './factorial';
import { CalcError } from '@/core/errors';

describe('factorial', () => {
  it('computes exact values', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(1)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(factorial(10)).toBe(3628800);
    expect(factorial(170)).toBeGreaterThan(7e306);
  });

  it('rejects invalid inputs with typed errors', () => {
    expect(() => factorial(-1)).toThrowError(CalcError);
    expect(() => factorial(2.5)).toThrowError(/whole numbers/);
    expect(() => factorial(MAX_EXACT_FACTORIAL + 1)).toThrowError(/limited to 170/);
    expect(() => factorial(Number.POSITIVE_INFINITY)).toThrowError(/finite/);
  });
});
