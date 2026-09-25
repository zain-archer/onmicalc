import { describe, expect, it } from 'vitest';
import { evaluateExpression, modulo, power } from '@/core/engine';

function value(source: string, options = {}): number {
  const result = evaluateExpression(source, options);
  if (!result.ok) throw new Error(`expected success for ${source}: ${result.error.message}`);
  return result.value;
}

function fail(source: string, options = {}) {
  const result = evaluateExpression(source, options);
  if (result.ok) throw new Error(`expected failure for ${source}, got ${result.value}`);
  return result.error;
}

describe('core arithmetic (spec examples)', () => {
  it.each([
    ['2+3*4', 14],
    ['(2+3)*4', 20],
    ['2^10', 1024],
    ['sqrt(144)', 12],
    ['5!', 120],
    ['1.2e-5', 1.2e-5],
    ['7 mod 3', 1],
    ['2.5+2.5', 5],
    ['-5+3', -2],
    ['3*-4', -12],
    ['1/8', 0.125],
    ['0.1+0.2', 0.3],
    ['2^0.5', Math.SQRT2],
    ['10 mod 2', 0],
    ['2(3+4)', 14],
    ['1.5e3+500', 2000],
  ])('%s = %s', (source, expected) => {
    expect(value(source)).toBeCloseTo(expected, 12);
  });

  it('supports percent, reciprocal, powers and roots', () => {
    expect(value('50%')).toBe(0.5);
    expect(value('200*15%')).toBe(30);
    expect(value('15%')).toBe(0.15);
    expect(value('1/(2+2)')).toBe(0.25);
    expect(value('sqrt 16')).toBe(4);
    expect(value('cbrt(-8)')).toBe(-2);
    expect(value('abs(-3)+floor(2.9)+ceil(2.1)')).toBe(3 + 2 + 3);
    expect(value('round(3.14159, 2)')).toBe(3.14);
    expect(value('hypot(3,4)')).toBe(5);
  });

  it('uses floored modulo consistent with mod()', () => {
    expect(modulo(-7, 3)).toBe(2);
    expect(value('-7 mod 3')).toBe(2);
    expect(value('mod(-7,3)')).toBe(2);
    expect(value('7 mod -3')).toBe(-2);
  });

  it('resolves constants, including multi-character names', () => {
    expect(value('pi')).toBeCloseTo(Math.PI, 12);
    expect(value('2π')).toBeCloseTo(2 * Math.PI, 12);
    expect(value('tau/2')).toBeCloseTo(Math.PI, 12);
    expect(value('phi')).toBeCloseTo((1 + Math.sqrt(5)) / 2, 12);
    expect(value('sqrt2 * sqrt2')).toBeCloseTo(2, 12);
  });

  it('treats 5·(3-1) as multiplication', () => {
    expect(value('5·(3-1)')).toBe(10);
    expect(value('6÷3')).toBe(2);
  });
});

describe('core arithmetic errors', () => {
  it('flags division by zero', () => {
    expect(fail('1/0').code).toBe('DIV_ZERO');
    expect(fail('1/(2-2)').code).toBe('DIV_ZERO');
    expect(fail('5 mod 0').code).toBe('DIV_ZERO');
    expect(fail('0^-1').code).toBe('DIV_ZERO');
  });

  it('flags domain errors instead of returning NaN', () => {
    const sqrtError = fail('sqrt(-1)');
    expect(sqrtError.code).toBe('DOMAIN');
    expect(sqrtError.details).toMatch(/complex/i);

    const power = fail('(-8)^(1/3)');
    expect(power.code).toBe('DOMAIN');
    expect(power.details).toMatch(/cbrt/);

    expect(fail('(-2)!').code).toBe('DOMAIN');
    expect(fail('2.5!').code).toBe('DOMAIN');
  });

  it('flags overflow for values beyond doubles', () => {
    const overflow = fail('171!');
    expect(overflow.code).toBe('OVERFLOW');
    expect(overflow.message).toMatch(/170/);
    expect(fail('1e308*10').code).toBe('OVERFLOW');
  });

  it('reports unknown identifiers, bad arity and syntax', () => {
    expect(fail('nope+1').code).toBe('UNKNOWN_IDENTIFIER');
    expect(fail('nope(2)').code).toBe('UNKNOWN_IDENTIFIER');
    expect(fail('sqrt(1,2)').code).toBe('BAD_ARITY');
    expect(fail('2+').code).toBe('SYNTAX');
    expect(fail('(1+2').code).toBe('SYNTAX');
  });

  it('explains rather than fabricates unsupported bitwise operators', () => {
    const err = fail('5 and 3');
    expect(err.code).toBe('NOT_SUPPORTED');
    expect(err.details).toMatch(/Programmer/i);
  });

  it('positions errors inside the source', () => {
    const err = fail('1 + 1/0');
    expect(err.position).toBe(6);
  });

  it('keeps 0^0 = 1 by convention', () => {
    expect(value('0^0')).toBe(1);
    expect(power(0, 0)).toBe(1);
  });
});

describe('formatting integration', () => {
  it('formats results with the requested precision and notation', () => {
    const exact = evaluateExpression('1/3', { precision: 15 });
    expect(exact.ok && exact.display.startsWith('0.333333333333')).toBe(true);

    const low = evaluateExpression('1/3', { precision: 4 });
    expect(low.ok && low.display).toBe('0.3333');

    const sci = evaluateExpression('12345', { numberFormat: 'scientific', precision: 4 });
    expect(sci.ok && sci.display).toBe('1.235e+4');

    const grouped = evaluateExpression('1234567', { thousandsSeparator: true });
    expect(grouped.ok && grouped.display).toBe('1,234,567');

    const plain = evaluateExpression('1234567', { thousandsSeparator: false });
    expect(plain.ok && plain.display).toBe('1234567');
  });

  it('accepts caller-supplied variables', () => {
    const result = evaluateExpression('2x+1', { variables: { x: 5 } });
    expect(result.ok && result.value).toBe(11);
  });
});

describe('scientific functions through the engine', () => {
  const deg = { angleMode: 'DEG' as const };

  it('respects the angle mode', () => {
    expect(value('sin(30)', deg)).toBe(0.5);
    expect(value('cos(45)', deg)).toBeCloseTo(Math.SQRT2 / 2, 15);
    expect(value('sin(60)', deg)).toBeCloseTo(Math.sqrt(3) / 2, 15);
    expect(value('sin(30)', { angleMode: 'RAD' })).toBeCloseTo(Math.sin(30), 12);
    expect(value('sin(100)', { angleMode: 'GRAD' })).toBe(1);
    expect(value('tan(180)', deg)).toBe(0);
    expect(value('asin(0.5)', deg)).toBe(30);
    expect(value('asin(0.5)', { angleMode: 'RAD' })).toBeCloseTo(Math.PI / 6, 12);
  });

  it('defaults to radians when no mode is given', () => {
    expect(value('sin(pi/2)')).toBe(1);
    expect(value('cos(0)')).toBe(1);
  });

  it('supports reciprocal and hyperbolic functions', () => {
    expect(value('cot(45)', deg)).toBeCloseTo(1, 12);
    expect(value('sec(60)', deg)).toBeCloseTo(2, 12);
    expect(value('csc(30)', deg)).toBeCloseTo(2, 12);
    expect(value('sinh(0)')).toBe(0);
    expect(value('cosh(0)')).toBe(1);
    expect(value('tanh(0)')).toBe(0);
    expect(value('atanh(0)')).toBe(0);
  });

  it('supports logarithms and roots', () => {
    expect(value('log(1000)')).toBe(3);
    expect(value('log(81,3)')).toBe(4);
    expect(value('log2(8)')).toBe(3);
    expect(value('ln(e)')).toBeCloseTo(1, 12);
    expect(value('exp(0)')).toBe(1);
    expect(value('exp(ln(5))')).toBeCloseTo(5, 12);
    expect(value('root(3,27)')).toBeCloseTo(3, 12);
    expect(value('pow(2,10)')).toBe(1024);
    expect(value('log 1000')).toBe(3);
    expect(value('sqrt 16 + log2 8')).toBe(7);
  });

  it('reports domain errors with messages and positions', () => {
    expect(fail('tan(90)', deg).code).toBe('DOMAIN');
    expect(fail('log(0)').message).toMatch(/positive/);
    expect(fail('asin(2)').code).toBe('DOMAIN');
    expect(fail('acosh(0.5)').code).toBe('DOMAIN');
    const positioned = evaluateExpression('1+ln(-1)');
    expect(positioned.ok).toBe(false);
    if (!positioned.ok) {
      expect(positioned.error.position).toBe(2);
      expect(positioned.error.details).toMatch(/Received -1/);
    }
  });

  it('keeps trigonometry accurate at exact angles', () => {
    expect(value('sin(180) + cos(90)', deg)).toBe(0);
    expect(value('tan(45)', deg)).toBe(1);
    expect(evaluateExpression('sin(180)', deg).ok && evaluateExpression('sin(180)', deg)).toBeTruthy();
    const display = evaluateExpression('sin(180)', deg);
    expect(display.ok && display.display).toBe('0');
  });
});
