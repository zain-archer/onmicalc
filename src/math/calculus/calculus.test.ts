import { describe, expect, it } from 'vitest';
import {
  compileFunction,
  derivative,
  differentiate,
  differentiateOrder,
  integrate,
  limit,
  partialDerivative,
  taylorSeries,
} from './index';
import { evaluateExpression } from '@/core/engine';
import { CalcError } from '@/core/errors';

const f = (source: string) => {
  const fn = compileFunction(source);
  if (!fn) throw new Error(`could not compile ${source}`);
  return fn;
};

const numeric = (source: string, x: number) => {
  const result = evaluateExpression(source, { variables: { x } });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
};

describe('symbolic differentiation', () => {
  it('differentiates polynomials exactly', () => {
    expect(differentiate('x^2')).toBe('2 * x');
    expect(differentiate('x^3')).toBe('3 * x ^ 2');
    expect(differentiate('5x^4 + 3x^2 - 7x + 2')).toBe('20 * x ^ 3 + 6 * x - 7');
    expect(differentiate('x')).toBe('1');
    expect(differentiate('7')).toBe('0');
  });

  it('applies the product, quotient and chain rules', () => {
    expect(differentiate('x*sin(x)')).toBe('sin(x) + x * cos(x)');
    expect(differentiate('sin(x^2)')).toBe('cos(x ^ 2) * (2 * x)');
    expect(differentiate('exp(2x)')).toBe('exp(2 * x) * 2');
    expect(differentiate('ln(x)')).toBe('1 / x');
    expect(differentiate('sin(x)/x')).toMatch(/cos\(x\).*x.*sin\(x\)/);
    expect(differentiate('sqrt(x)')).toMatch(/1 \/ \(2 \* sqrt\(x\)\)/);
  });

  it('supports higher orders', () => {
    expect(differentiateOrder('x^4', 2)).toBe('12 * x ^ 2');
    expect(differentiateOrder('sin(x)', 4)).toBe('sin(x)');
    expect(differentiateOrder('x^5', 1)).toBe('5 * x ^ 4');
    expect(() => differentiateOrder('x^2', 0)).toThrowError(/whole number from 1 to 10/);
    expect(() => differentiateOrder('x^2', 11)).toThrowError(CalcError);
  });

  it('verifies the symbolic result against numerical values', () => {
    for (const source of ['x^3 - 2x + 1', 'sin(x)*exp(x)', 'ln(x^2+1)', 'tan(x)', 'x/(x+1)']) {
      const symbolic = differentiate(source);
      for (const point of [0.7, 1.3, 2.5]) {
        const symbolicValue = numeric(symbolic, point);
        const numericValue = derivative(f(source), point).value;
        expect(symbolicValue).toBeCloseTo(numericValue, 6);
      }
    }
  });

  it('refuses to invent derivatives it does not know', () => {
    expect(() => differentiate('fact(x)')).toThrowError(/cannot differentiate/);
    expect(() => differentiate('x!')).toThrowError(/Factorial cannot be differentiated/);
    expect(() => differentiate('round(x)')).toThrowError(CalcError);
  });

  it('handles the general power rule', () => {
    expect(differentiate('x^x')).toMatch(/x \^ x/);
    const symbolic = differentiate('x^x');
    expect(numeric(symbolic, 2)).toBeCloseTo(4 * (Math.log(2) + 1), 6);
  });
});

describe('numerical differentiation', () => {
  it('computes first derivatives accurately', () => {
    const result = derivative(f('x^3'), 2);
    expect(result.value).toBeCloseTo(12, 6);
    expect(result.error).toBeLessThan(1e-6);
    expect(derivative(f('sin(x)'), 0).value).toBeCloseTo(1, 8);
    expect(derivative(f('exp(x)'), 1).value).toBeCloseTo(Math.E, 6);
    expect(derivative(f('ln(x)'), 2).value).toBeCloseTo(0.5, 8);
  });

  it('computes second derivatives', () => {
    expect(derivative(f('x^3'), 2, 2).value).toBeCloseTo(12, 5);
    expect(derivative(f('sin(x)'), 0, 2).value).toBeCloseTo(0, 6);
    expect(derivative(f('exp(x)'), 1, 2).value).toBeCloseTo(Math.E, 5);
  });

  it('stays accurate at large scales', () => {
    expect(derivative(f('x^2'), 1e6).value).toBeCloseTo(2e6, -2);
    expect(derivative(f('x^2'), 1e-6).value).toBeCloseTo(2e-6, 12);
  });

  it('reports failure instead of returning a wrong number', () => {
    expect(() => derivative(f('sqrt(x)'), -1)).toThrowError(/not defined at this point/);
    expect(() => derivative(f('1/x'), 0)).toThrowError(/has no derivative there/);
    expect(() => derivative(f('ln(x)'), 0)).toThrowError(CalcError);
  });

  it('computes partial derivatives', () => {
    const result = partialDerivative('x^2 + y^2', 'y', { x: 1, y: 3 });
    expect(result.value).toBeCloseTo(6, 6);
    expect(partialDerivative('x*y^2', 'x', { x: 2, y: 5 }).value).toBeCloseTo(25, 6);
  });
});

describe('numerical integration', () => {
  it('integrates polynomials and transcendentals accurately', () => {
    const cubic = integrate(f('x^3'), 0, 2);
    expect(cubic.value).toBeCloseTo(4, 9);

    const sine = integrate(f('sin(x)'), 0, Math.PI);
    expect(sine.value).toBeCloseTo(2, 9);

    // ∫ from −3 to 3 equals √π·erf(3); the infinite integral would be √π.
    const gaussian = integrate(f('exp(-x^2)'), -3, 3);
    expect(gaussian.value).toBeCloseTo(1.7724146965190425, 9);
    expect(integrate(f('exp(-x^2)'), -12, 12).value).toBeCloseTo(Math.sqrt(Math.PI), 9);

    expect(integrate(f('x^2'), 1, 1).value).toBe(0);
    expect(integrate(f('x^2'), 2, 0).value).toBeCloseTo(-8 / 3, 9);
  });

  it('reports the estimated error and convergence', () => {
    const result = integrate(f('sin(x)/x'), 0.0001, 10);
    expect(result.converged).toBe(true);
    expect(result.error).toBeLessThan(1e-6);
    expect(result.subdivisions).toBeGreaterThan(1);
  });

  it('refuses intervals that cross a singularity', () => {
    expect(() => integrate(f('1/(x-1)'), 0, 2)).toThrowError(CalcError);
    expect(() => integrate(f('ln(x)'), 0, 1)).toThrowError(/not defined/);
    expect(() => integrate(f('x'), 0, Number.POSITIVE_INFINITY)).toThrowError(/finite/);
  });
});

describe('limits', () => {
  it('computes finite limits from both sides', () => {
    const removable = limit(f('sin(x)/x'), 0);
    expect(removable.value).toBeCloseTo(1, 6);
    expect(removable.twoSided).toBe(true);

    const polynomial = limit(f('x^2 + 3x'), 2);
    expect(polynomial.value).toBeCloseTo(10, 6);

    const zeroOverZero = limit(f('(x^2-1)/(x-1)'), 1);
    expect(zeroOverZero.value).toBeCloseTo(2, 6);
  });

  it('detects one-sided limits and jumps', () => {
    expect(() => limit(f('1/x'), 0, { side: 'right' })).toThrowError(/diverges to \+∞/);
    expect(() => limit(f('1/x'), 0, { side: 'left' })).toThrowError(/diverges to −∞/);
    expect(() => limit(f('1/x'), 0)).toThrowError(CalcError);
  });

  it('reports when it cannot settle on a value', () => {
    expect(() => limit(f('sin(1/x)'), 0)).toThrowError(CalcError);
    expect(() => limit(f('ln(x)'), 0)).toThrowError(CalcError);
  });
});

describe('Taylor series', () => {
  it('reproduces Maclaurin series of known functions', () => {
    const exp = taylorSeries('exp(x)', 0, 4).coefficients;
    expect(exp[0]).toBeCloseTo(1, 10);
    expect(exp[1]).toBeCloseTo(1, 10);
    expect(exp[2]).toBeCloseTo(1 / 2, 10);
    expect(exp[3]).toBeCloseTo(1 / 6, 10);
    expect(exp[4]).toBeCloseTo(1 / 24, 10);

    const sin = taylorSeries('sin(x)', 0, 5).coefficients;
    expect(sin[0]).toBeCloseTo(0, 10);
    expect(sin[1]).toBeCloseTo(1, 10);
    expect(sin[2]).toBeCloseTo(0, 10);
    expect(sin[3]).toBeCloseTo(-1 / 6, 10);
    expect(sin[5]).toBeCloseTo(1 / 120, 10);
  });

  it('expands about a non-zero centre', () => {
    const series = taylorSeries('ln(x)', 1, 3);
    expect(series.coefficients[0]).toBeCloseTo(0, 8);
    expect(series.coefficients[1]).toBeCloseTo(1, 8);
    expect(series.coefficients[2]).toBeCloseTo(-0.5, 8);
    expect(series.coefficients[3]).toBeCloseTo(1 / 3, 8);
    expect(series.polynomial).toMatch(/\(x − 1\)/);
  });

  it('states the accuracy limit of the approximation', () => {
    const series = taylorSeries('sin(x)', 0, 5);
    const approximation = series.polynomial;
    expect(series.radiusNote).toMatch(/local approximation/);
    // The 5th-order Maclaurin polynomial is close to sin near 0 but not far away.
    expect(numeric(approximation.replace(/·/g, '*'), 0.1)).toBeCloseTo(Math.sin(0.1), 6);
  });

  it('rejects impossible orders', () => {
    expect(() => taylorSeries('sin(x)', 0, 0)).toThrowError(/1 to 8/);
    expect(() => taylorSeries('ln(x)', 0, 3)).toThrowError(CalcError);
  });
});
