import { describe, expect, it } from 'vitest';
import * as trig from './index';
import { CalcError } from '@/core/errors';

const close = (a: number, b: number, digits = 12) => expect(a).toBeCloseTo(b, digits);

describe('exact angles (no floating point noise)', () => {
  it('returns exact values in degree mode', () => {
    expect(trig.sin(180, 'DEG')).toBe(0);
    expect(trig.cos(90, 'DEG')).toBe(0);
    expect(trig.sin(30, 'DEG')).toBe(0.5);
    expect(trig.cos(60, 'DEG')).toBe(0.5);
    expect(trig.sin(270, 'DEG')).toBe(-1);
    expect(trig.cos(180, 'DEG')).toBe(-1);
    expect(trig.tan(45, 'DEG')).toBe(1);
    expect(trig.sin(-90, 'DEG')).toBe(-1);
    expect(trig.cos(720, 'DEG')).toBe(1);
    expect(trig.sin(1080 + 30, 'DEG')).toBe(0.5);
  });

  it('returns exact values in gradian mode', () => {
    expect(trig.sin(100, 'GRAD')).toBe(1);
    expect(trig.cos(200, 'GRAD')).toBe(-1);
    expect(trig.sin(300, 'GRAD')).toBe(-1);
  });

  it('computes intermediate angles numerically', () => {
    expect(trig.sin(45, 'DEG')).toBe(Math.SQRT2 / 2);
    expect(trig.tan(45, 'DEG')).toBe(1);
    expect(trig.tan(225, 'DEG')).toBe(1);
    close(trig.sin(Math.PI / 6, 'RAD'), 0.5);
    close(trig.tan(1, 'RAD'), Math.tan(1));
    close(trig.cos(1.2, 'DEG'), Math.cos((1.2 * Math.PI) / 180));
  });

  it('rejects undefined values instead of returning huge numbers', () => {
    expect(() => trig.tan(90, 'DEG')).toThrowError(/undefined at 90/);
    expect(() => trig.tan(270, 'DEG')).toThrowError(CalcError);
    expect(() => trig.sec(90, 'DEG')).toThrowError(/sec is undefined/);
    expect(() => trig.cot(0, 'DEG')).toThrowError(/cot is undefined/);
    expect(() => trig.csc(180, 'DEG')).toThrowError(/csc is undefined/);
    expect(() => trig.coth(0)).toThrowError(/coth\(0\)/);
    expect(() => trig.atan2(0, 0, 'DEG')).toThrowError(CalcError);
  });
});

describe('inverse and reciprocal functions', () => {
  it('returns angles in the active mode', () => {
    expect(trig.asin(1, 'DEG')).toBe(90);
    expect(trig.asin(0.5, 'DEG')).toBe(30);
    expect(trig.acos(-1, 'DEG')).toBe(180);
    expect(trig.atan(1, 'DEG')).toBe(45);
    expect(trig.acot(-1, 'DEG')).toBe(135);
    close(trig.acos(0, 'GRAD'), 100);
    close(trig.asin(0.5, 'GRAD'), 100 / 3);
    expect(trig.asin(0.5, 'DEG')).toBe(30);
    expect(trig.acos(0.5, 'DEG')).toBe(60);
    close(trig.atan(1, 'RAD'), Math.PI / 4);
    close(trig.atan2(1, -1, 'DEG'), 135);
  });

  it('enforces domains', () => {
    expect(() => trig.asin(1.5, 'DEG')).toThrowError(/between -1 and 1/);
    expect(() => trig.acos(-2, 'DEG')).toThrowError(/between -1 and 1/);
    expect(() => trig.asec(0.5, 'DEG')).toThrowError(/\|x\| >= 1/);
    expect(() => trig.acsc(0, 'DEG')).toThrowError(CalcError);
    expect(() => trig.acosh(0.5)).toThrowError(/x >= 1/);
    expect(() => trig.atanh(1)).toThrowError(/\|x\| < 1/);
  });

  it('agrees with the reciprocal identities', () => {
    close(trig.sec(37, 'DEG'), 1 / trig.cos(37, 'DEG'));
    close(trig.csc(37, 'DEG'), 1 / trig.sin(37, 'DEG'));
    close(trig.cot(37, 'DEG'), 1 / trig.tan(37, 'DEG'));
    close(trig.sinh(1.3), Math.sinh(1.3));
    close(trig.cosh(-0.7), Math.cosh(-0.7));
    close(trig.tanh(2), Math.tanh(2));
    close(trig.asinh(1.5), Math.asinh(1.5));
    close(trig.acosh(2), Math.acosh(2));
    close(trig.atanh(0.25), Math.atanh(0.25));
  });

  it('satisfies Pythagoras within tolerance', () => {
    for (const angle of [0.3, 12, 47.5, 89, 123.4, 359]) {
      close(trig.sin(angle, 'DEG') ** 2 + trig.cos(angle, 'DEG') ** 2, 1, 10);
    }
  });
});
