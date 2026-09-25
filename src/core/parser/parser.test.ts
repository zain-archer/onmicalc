import { describe, expect, it } from 'vitest';
import { printExpression } from './print';
import { parse } from './parser';
import { tokenize } from './tokenizer';
import { CalcError } from '@/core/errors';

const roundTrip = (src: string) => printExpression(parse(src));

describe('tokenizer', () => {
  it('reads decimal, leading-dot and exponent numbers', () => {
    const nums = tokenize('1.5 .5 1.2e-5 3E8 2e').filter((t) => t.type === 'number').map((t) => t.num);
    expect(nums).toEqual([1.5, 0.5, 1.2e-5, 3e8, 2]);
    expect(tokenize('2e').some((t) => t.type === 'ident' && t.value === 'e')).toBe(true);
  });

  it('normalises unicode operators, superscripts and symbols', () => {
    expect(tokenize('2×3÷4−1').map((t) => t.value).filter(Boolean).slice(0, 7)).toEqual(['2', '*', '3', '/', '4', '-', '1']);
    expect(roundTrip('2²')).toBe('2 ^ 2');
    expect(roundTrip('3³')).toBe('3 ^ 3');
    expect(printExpression(parse('√9', { functions: new Set(['sqrt']) }))).toBe('sqrt(9)');
  });

  it('treats mod as an operator and keeps other words as identifiers', () => {
    const types = tokenize('7 mod 3 sin').map((t) => t.type);
    expect(types).toEqual(['number', 'op', 'number', 'ident', 'eof']);
  });

  it('rejects unknown characters with a position', () => {
    try {
      tokenize('2+@');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CalcError);
      expect((err as CalcError).code).toBe('SYNTAX');
      expect((err as CalcError).position).toBe(2);
    }
  });
});

describe('parser precedence', () => {
  it('applies * before +', () => {
    expect(roundTrip('2+3*4')).toBe('2 + 3 * 4');
    expect(roundTrip('(2+3)*4')).toBe('(2 + 3) * 4');
  });

  it('makes ^ right-associative and tighter than unary minus', () => {
    expect(roundTrip('2^3^2')).toBe('2 ^ 3 ^ 2');
    expect(roundTrip('-2^2')).toBe('-2 ^ 2');
    expect(roundTrip('2^-3')).toBe('2 ^ -3');
  });

  it('binds implicit multiplication like *', () => {
    expect(roundTrip('2(3+4)')).toBe('2 * (3 + 4)');
    expect(roundTrip('3pi')).toBe('3 * pi');
    expect(roundTrip('(1+2)(3+4)')).toBe('(1 + 2) * (3 + 4)');
  });

  it('parses postfix operators and calls', () => {
    expect(roundTrip('5!+1')).toBe('5! + 1');
    expect(roundTrip('50%')).toBe('50%');
    expect(roundTrip('sqrt(144)+1')).toBe('sqrt(144) + 1');
    expect(roundTrip('mod(7,3)')).toBe('mod(7, 3)');
  });

  it('reports syntax errors with positions', () => {
    const cases: Array<[string, string]> = [
      ['2+', 'Expression ends unexpectedly'],
      ['(2+3', 'Missing closing parenthesis'],
      ['2+3)', 'Unmatched closing parenthesis'],
      ['', 'Enter an expression'],
      ['*2', '"*" needs a value on its left'],
    ];
    for (const [source, message] of cases) {
      expect(() => parse(source)).toThrowError(new RegExp(message));
    }
  });
});
