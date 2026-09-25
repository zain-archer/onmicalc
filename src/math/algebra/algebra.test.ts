import { describe, expect, it } from 'vitest';
import {
  findVariables,
  makeDifference,
  parseEquation,
  polynomialToString,
  solveLinear,
  solveLinearSystem,
  solvePolynomial,
} from './index';
import { CalcError } from '@/core/errors';

describe('equation parsing', () => {
  it('splits on the top-level equals sign', () => {
    expect(parseEquation('2x + 5 = 15')).toMatchObject({ left: '2x + 5', right: '15', variables: ['x'] });
    expect(parseEquation('y = x^2 + 1').variables).toEqual(['x', 'y']);
    expect(parseEquation('2*(x+1) = 4')).toMatchObject({ left: '2*(x+1)', right: '4' });
  });

  it('rejects malformed input', () => {
    expect(() => parseEquation('2x + 5')).toThrowError(/needs an "=" sign/);
    expect(() => parseEquation('= 5')).toThrowError(/Both sides/);
    expect(() => parseEquation('')).toThrowError(CalcError);
  });

  it('ignores constants and function names when finding unknowns', () => {
    expect(findVariables('sin(x) + pi')).toEqual(['x']);
    expect(findVariables('sqrt(y) + e')).toEqual(['y']);
    expect(findVariables('a + b*2')).toEqual(['a', 'b']);
    expect(findVariables('log2(m4)')).toEqual(['m4']);
  });

  it('builds a difference function', () => {
    const equation = parseEquation('2x + 5 = 15');
    const f = makeDifference(equation, 'x');
    expect(f(0)).toBe(-10);
    expect(f(5)).toBe(0);
  });
});

describe('linear equations', () => {
  it('solves the documented examples', () => {
    const result = solveLinear(parseEquation('2x + 5 = 15'), 'x');
    expect(result.value).toBe(5);
    expect(result.exact).toBe(true);
    expect(result.steps.length).toBeGreaterThan(2);
    expect(result.steps[result.steps.length - 1]).toBe('x = 5');
  });

  it('solves negatives, fractions and rearranged forms', () => {
    expect(solveLinear(parseEquation('3x - 7 = 2'), 'x').value).toBeCloseTo(3, 12);
    expect(solveLinear(parseEquation('x/4 = 0.25'), 'x').value).toBeCloseTo(1, 12);
    expect(solveLinear(parseEquation('5 - x = 2'), 'x').value).toBeCloseTo(3, 12);
    expect(solveLinear(parseEquation('2(x+3) = 10'), 'x').value).toBeCloseTo(2, 12);
    expect(solveLinear(parseEquation('x = 7'), 'x').value).toBe(7);
    expect(solveLinear(parseEquation('y = 7'), 'y').value).toBe(7);
  });

  it('reports contradictions and identities instead of inventing a root', () => {
    expect(() => solveLinear(parseEquation('x + 1 = x + 2'), 'x')).toThrowError(/no solution/);
    expect(() => solveLinear(parseEquation('2x = 2x'), 'x')).toThrowError(/true for every value/);
  });
});

describe('polynomial equations', () => {
  it('solves the documented quadratic example', () => {
    const result = solvePolynomial(parseEquation('x^2 + 5x + 6 = 0'), 'x', 2);
    expect(result.coefficients).toEqual([1, 5, 6]);
    expect(result.roots).toEqual([-3, -2]);
    expect(result.complexPairs).toBe(0);
    expect(result.steps[0]).toMatch(/x\^2 \+ 5x \+ 6 = 0/);
  });

  it('handles double roots and rearranged quadratics', () => {
    expect(solvePolynomial(parseEquation('x^2 - 4x + 4 = 0'), 'x', 2).roots).toEqual([2]);
    expect(solvePolynomial(parseEquation('x^2 = 9'), 'x', 2).roots).toEqual([-3, 3]);
    expect(solvePolynomial(parseEquation('2x^2 + 3x - 2 = 0'), 'x', 2).roots.map((r) => Math.round(r * 1000) / 1000)).toEqual([-2, 0.5]);
    expect(solvePolynomial(parseEquation('x^2 + 1 = 0'), 'x', 2).roots).toEqual([]);
  });

  it('detects when no real roots exist and says so', () => {
    const result = solvePolynomial(parseEquation('x^2 + 1 = 0'), 'x', 2);
    expect(result.complexPairs).toBe(2);
    expect(result.steps.join(' ')).toMatch(/No real roots/);
  });

  it('solves cubics, quartics and higher degrees it can verify', () => {
    const cubic = solvePolynomial(parseEquation('x^3 - 6x^2 + 11x - 6 = 0'), 'x', 3);
    expect(cubic.roots).toEqual([1, 2, 3]);

    const quartic = solvePolynomial(parseEquation('x^4 - 5x^2 + 4 = 0'), 'x', 4);
    expect(quartic.roots).toEqual([-2, -1, 1, 2]);

    const quintic = solvePolynomial(parseEquation('x^5 - 3x^4 - 5x^3 + 15x^2 + 4x - 12 = 0'), 'x', 5);
    expect(quintic.roots).toEqual([-2, -1, 1, 2, 3]);
  });

  it('refuses equations that are not polynomials of the requested degree', () => {
    expect(() => solvePolynomial(parseEquation('sin(x) = 0.5'), 'x', 2)).toThrowError(CalcError);
    expect(() => solvePolynomial(parseEquation('1/x = 2'), 'x', 2)).toThrowError(CalcError);
  });

  it('formats polynomials readably', () => {
    expect(polynomialToString([1, 5, 6])).toBe('x^2 + 5x + 6');
    expect(polynomialToString([1, -5, 0])).toBe('x^2 − 5x');
    expect(polynomialToString([1, 0, -4])).toBe('x^2 − 4');
    expect(polynomialToString([0])).toBe('0');
  });
});

describe('linear systems', () => {
  it('solves the documented 2×2 system', () => {
    const result = solveLinearSystem(['2x+y=10', 'x-y=2'], ['x', 'y']);
    expect(result.status).toBe('unique');
    expect(result.values[0]).toBeCloseTo(4, 10);
    expect(result.values[1]).toBeCloseTo(2, 10);
    expect(result.determinant).toBeCloseTo(-3, 10);
  });

  it('solves 3×3 systems', () => {
    const result = solveLinearSystem(['x+y+z=6', '2x-y+z=3', 'x+2y-z=2'], ['x', 'y', 'z']);
    expect(result.status).toBe('unique');
    expect(result.values[0]).toBeCloseTo(1, 9);
    expect(result.values[1]).toBeCloseTo(2, 9);
    expect(result.values[2]).toBeCloseTo(3, 9);
  });

  it('reports rank problems rather than guessing', () => {
    const infinite = solveLinearSystem(['x+y=2', '2x+2y=4'], ['x', 'y']);
    expect(infinite.status).toBe('infinite');
    expect(infinite.steps.join(' ')).toMatch(/underdetermined/);

    const inconsistent = solveLinearSystem(['x+y=2', 'x+y=3'], ['x', 'y']);
    expect(inconsistent.status).toBe('none');
    expect(inconsistent.steps.join(' ')).toMatch(/inconsistent/);
  });

  it('requires one equation per unknown', () => {
    expect(() => solveLinearSystem(['x+y=1'], ['x', 'y'])).toThrowError(/one equation per unknown/);
  });
});
