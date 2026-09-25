import { describe, expect, it } from 'vitest';
import { formatExponential, formatFixed, formatNumber } from './format';

describe('formatNumber', () => {
  it('removes floating point noise at the requested precision', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1 / 3)).toBe('0.333333333333');
  });

  it('keeps exact integers exact', () => {
    expect(formatNumber(2 ** 53 - 1, { thousandsSeparator: false })).toBe('9007199254740991');
    expect(formatNumber(1024)).toBe('1,024');
    expect(formatNumber(-4200)).toBe('-4,200');
  });

  it('switches notation in auto mode only outside a readable range', () => {
    expect(formatNumber(1e15)).toBe('1,000,000,000,000,000');
    expect(formatNumber(1e16)).toBe('1e+16');
    expect(formatNumber(999999999999)).toBe('999,999,999,999');
    expect(formatNumber(1e-9)).toBe('1e-9');
    expect(formatNumber(5e-8)).toBe('0.00000005');
  });

  it('supports engineering exponents in multiples of three', () => {
    expect(formatNumber(12345, { numberFormat: 'engineering', precision: 4 })).toBe('12.35e+3');
    expect(formatNumber(0.00012, { numberFormat: 'engineering', precision: 3 })).toBe('120e-6');
  });

  it('honours significant digits', () => {
    expect(formatNumber(1234.5678, { precision: 5, thousandsSeparator: false })).toBe('1234.6');
    expect(formatNumber(1234.5678, { precision: 2, thousandsSeparator: false })).toBe('1200');
  });

  it('never throws on extreme or special inputs', () => {
    expect(formatNumber(5e-324)).toMatch(/e-324/);
    expect(formatNumber(-1e308)).toMatch(/e\+308/);
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('∞');
    expect(formatNumber(Number.NaN)).toBe('NaN');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-0)).toBe('0');
  });
});

describe('format helpers', () => {
  it('formats exponential values with trimmed mantissa', () => {
    expect(formatExponential(1234.5, 4)).toBe('1.235e+3');
    expect(formatExponential(0)).toBe('0');
  });

  it('formats fixed decimals for money-style output', () => {
    expect(formatFixed(1234.5, 2)).toBe('1234.50');
    expect(formatFixed(2, 0)).toBe('2');
  });
});
