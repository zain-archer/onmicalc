import { describe, expect, it } from 'vitest';
import { integrateSymbolic, integrateDefinite, verifyIntegral } from './integrate';
import { partialFractions, partialFractionToString } from './partial';
import {
  discriminant,
  polyDivide,
  polyEvaluate,
  polyGcd,
  polyLcm,
  polynomialOf,
  rationalRoots,
  realRootsBetween,
  rootMultiplicity,
  polynomialToNode,
  squareFree,
  syntheticDivide,
  toPolynomial,
} from './polyops';
import { symbolicLimit, oneSidedLimits } from './limits';
import { series, popularSeries } from './series';
import { solveInequality, realRoots } from './inequality';
import { solveNonlinearSystem } from './nonlinear';
import { canonical, evaluateAt, format, formatNice, parseNode } from './ast';
import { differentiateNode } from '@/math/calculus';

/** Integrand → expected antiderivative up to the constant. */
const INTEGRALS: [string, string][] = [
  ['x^2', 'x ^ 3 / 3'],
  ['x', 'x ^ 2 / 2'],
  ['5', '5 * x'],
  ['sin(x)', '-cos(x)'],
  ['cos(x)', 'sin(x)'],
  ['e^x', 'e ^ x'],
  ['1/x', 'ln(abs(x))'],
  ['x^3 + 2*x', 'x ^ 4 / 4 + x ^ 2'],
  ['cos(2*x)', 'sin(2 * x) / 2'],
  ['e^(3*x)', 'e ^ (3 * x) / 3'],
  ['ln(x)', 'x * ln(x) - x'],
  ['sqrt(x)', '2 * x ^ 1.5 / 3'],
  ['2*x/(x^2+1)', 'ln(abs(x ^ 2 + 1))'],
  ['1/(x^2+1)', 'atan(x)'],
  ['tan(x)', '-ln(abs(cos(x)))'],
  ['x*e^x', 'x * e ^ x - e ^ x'],
  ['1/(x+2)', 'ln(abs(x + 2))'],
];

describe('symbolic integration', () => {
  it.each(INTEGRALS)('integrates %s', (input, expected) => {
    const result = integrateSymbolic(input);
    expect(result, `${input} should have a closed form`).not.toBeNull();
    expect(result!.expression).toBe(expected);
    expect(result!.verification.agrees).toBe(true);
    expect(result!.verification.checked).toBeGreaterThanOrEqual(3);
  });

  it('verifies the antiderivative by differentiating it back', () => {
    const result = integrateSymbolic('x^2*e^x')!;
    expect(result).not.toBeNull();
    // The rule chain gets long here, so compare numerically rather than by text.
    expect(result.verification.maxError).toBeLessThan(1e-7);
    const derivative = differentiateNode(result.antiderivative, 'x');
    const at = 1.7;
    expect(evaluateAt(derivative, 'x', at)).toBeCloseTo(at ** 2 * Math.exp(at), 6);
  });

  it('integrates rational functions through partial fractions', () => {
    const result = integrateSymbolic('1/((x+1)*(x+2))')!;
    expect(result.method).toMatch(/partial fraction/i);
    const antiderivative = result.antiderivative;
    // ln(x+1) − ln(x+2) at 0 is ln(1) − ln(2).
    expect(evaluateAt(antiderivative, 'x', 0)).toBeCloseTo(-Math.log(2), 9);
    expect(result.verification.agrees).toBe(true);
  });

  it('handles improper rational functions by dividing first', () => {
    const result = integrateSymbolic('(x^2+1)/x')!;
    expect(result.expression).toContain('ln(abs(x))');
    expect(result.verification.agrees).toBe(true);
  });

  it('refuses to invent a closed form when there is none', () => {
    expect(integrateSymbolic('sin(x^2)')).toBeNull();
    expect(integrateSymbolic('e^(x^2)')).toBeNull();
    expect(integrateSymbolic('x^x')).toBeNull();
  });

  it('gives exact definite integrals and checks them numerically', () => {
    const result = integrateDefinite('x^2', 0, 3);
    expect(result.exact).toBeCloseTo(9, 12);
    expect(result.numeric.value).toBeCloseTo(9, 8);
    expect(result.note).toMatch(/confirmed numerically/);
    expect(result.antiderivative?.expression).toBe('x ^ 3 / 3');
  });

  it('falls back to the numeric integral when no rule applies', () => {
    const result = integrateDefinite('sin(x^2)', 0, 1);
    expect(result.exact).toBeNull();
    expect(result.antiderivative).toBeNull();
    expect(result.numeric.value).toBeGreaterThan(0.3);
    expect(result.numeric.value).toBeLessThan(0.4);
    expect(result.note).toMatch(/numeric/i);
  });

  it('detects a wrong antiderivative instead of trusting it', () => {
    const integrand = parseNode('x^2');
    const wrong = parseNode('x^3'); // d/dx x^3 = 3x^2, not x^2
    const check = verifyIntegral(integrand, wrong, 'x');
    expect(check.agrees).toBe(false);
    expect(check.maxError).toBeGreaterThan(0.1);
  });
});

describe('partial fractions', () => {
  it('decomposes a product of distinct linear factors', () => {
    const result = partialFractions([1], polynomialOf('(x+1)*(x+2)')!)!;
    expect(result).not.toBeNull();
    const text = partialFractionToString(result);
    expect(text).toContain('1 / (x + 1)');
    expect(text).toContain('1 / (x + 2)');
    expect(text).not.toContain('+ -');
    // 1/(x+1) − 1/(x+2): at x = 0 that is 1/1 − 1/2.
    const rebuilt = result.terms.reduce((total, term) => {
      const numerator = polyEvaluate(term.numerator, 0);
      const denominator = polyEvaluate(term.factor, 0) ** term.power;
      return total + numerator / denominator;
    }, 0);
    expect(rebuilt).toBeCloseTo(0.5, 12);
  });

  it('extracts the polynomial part of an improper fraction', () => {
    const result = partialFractions(polynomialOf('x^3 + 1')!, polynomialOf('x')!)!;
    expect(result.terms.map((term) => term.power)).toEqual([1]);
    expect(result.polynomial).toEqual([0, 0, 1]);
  });

  it('refuses a denominator it cannot factor into the supported shapes', () => {
    expect(partialFractions([1], polynomialOf('x^4 + x + 1')!)).toBeNull();
  });
});

describe('polynomial algebra', () => {
  it('divides with a remainder', () => {
    const division = polyDivide(polynomialOf('x^3+2*x^2+3*x+4')!, polynomialOf('x+1')!);
    expect(division.quotient).toEqual([2, 1, 1]);
    expect(division.remainder).toEqual([2]);
  });

  it('divides synthetically', () => {
    const result = syntheticDivide(polynomialOf('x^3-6*x^2+11*x-6')!, 3);
    expect(result.remainder).toBeCloseTo(0, 12);
    expect(result.quotient).toEqual([2, -3, 1]);
  });

  it('computes gcd and lcm', () => {
    expect(polyGcd(polynomialOf('x^2-1')!, polynomialOf('x^2+2*x+1')!)).toEqual([1, 1]);
    // lcm is returned monic: x² − 1 has leading coefficient +1.
    expect(polyLcm(polynomialOf('x^2-1')!, polynomialOf('x-1')!)).toEqual([-1, 0, 1]);
  });

  it('finds rational roots and their multiplicity', () => {
    expect(rationalRoots(polynomialOf('x^2-5*x+6')!)).toEqual([2, 3]);
    expect(rationalRoots(polynomialOf('2*x^3-3*x^2-8*x+12')!).sort((a, b) => a - b)).toEqual([-2, 1.5, 2]);
    expect(rootMultiplicity(polynomialOf('(x-1)^2*(x+2)')!, 1)).toBe(2);
  });

  it('factorises square-free parts, including repeated roots', () => {
    const factors = squareFree(polynomialOf('(x-1)^2*(x+2)')!);
    expect(factors).toHaveLength(2);
    const repeated = factors.find((entry) => entry.multiplicity === 2)!;
    expect(repeated).toBeDefined();
    expect(formatNice(polynomialToNode(repeated.factor, 'x'))).toBe('x - 1');
    const single = factors.find((entry) => entry.multiplicity === 1)!;
    expect(formatNice(polynomialToNode(single.factor, 'x'))).toBe('x + 2');
    // An irreducible quotient is reported once and flagged.
    const irreducible = squareFree(polynomialOf('(x^2+1)^2')!);
    expect(irreducible).toHaveLength(1);
    expect(irreducible[0]!.squareFree).toBe(false);
  });

  it('computes discriminants', () => {
    expect(discriminant(polynomialOf('x^2-5*x+6')!)).toBeCloseTo(1, 12);
    expect(discriminant(polynomialOf('x^2+1')!)).toBeCloseTo(-4, 12);
    // Roots 1, 2, 3 give disc = ((2−1)(3−1)(3−2))² = 4.
    expect(discriminant(polynomialOf('x^3-6*x^2+11*x-6')!)).toBeCloseTo(4, 9);
    expect(discriminant(polynomialOf('x^4+1')!)).toBeNull();
  });

  it('counts real roots with Sturm sequences', () => {
    expect(realRootsBetween(polynomialOf('x^3-6*x^2+11*x-6')!, -10, 10)).toBe(3);
    expect(realRootsBetween(polynomialOf('x^2+1')!, -10, 10)).toBe(0);
    expect(realRootsBetween(polynomialOf('x^3-x')!, -2, 2)).toBe(3);
  });

  it('finds every real root of a polynomial, rational or not', () => {
    const roots = realRoots(polynomialOf('x^3-6*x^2+11*x-6')!);
    expect(roots).toEqual([1, 2, 3]);
    const irrational = realRoots(polynomialOf('x^2-2')!);
    expect(irrational).toHaveLength(2);
    expect(Math.abs(irrational[1]! - Math.SQRT2)).toBeLessThan(1e-6);
  });
});

describe('symbolic limits', () => {
  it('cancels a removable discontinuity and shows the cancellation', () => {
    const result = symbolicLimit('(x^2 - 1)/(x - 1)', 1)!;
    expect(result.value).toBeCloseTo(2, 12);
    expect(result.method).toBe('cancellation');
    expect(result.exact).toBe(true);
    expect(result.steps.join(' ')).toMatch(/cancel/i);
  });

  it("applies L'Hôpital's rule on 0/0", () => {
    const result = symbolicLimit('sin(x)/x', 0)!;
    expect(result.value).toBeCloseTo(1, 12);
    expect(result.method).toBe("l'hopital");
    const second = symbolicLimit('(1 - cos(x))/x^2', 0)!;
    expect(second.value).toBeCloseTo(0.5, 12);
    expect(second.exact).toBe(true);
  });

  it('compares leading terms at infinity', () => {
    const result = symbolicLimit('(2*x^2 + 3*x)/(5*x^2 - x)', Infinity)!;
    expect(result.value).toBeCloseTo(0.4, 12);
    expect(result.exact).toBe(true);
    expect(symbolicLimit('1/x', Infinity)!.value).toBe(0);
    expect(symbolicLimit('x^3/x', Infinity)!.value).toBe(Infinity);
    expect(symbolicLimit('x/(x^2+1)', -Infinity)!.value).toBe(0);
  });

  it('reports a two-sided limit that does not exist', () => {
    const result = symbolicLimit('1/x', 0)!;
    expect(result.exists).toBe(false);
    expect(result.sides?.left).toBe(-Infinity);
    expect(result.sides?.right).toBe(Infinity);
    expect(result.note).toMatch(/does not exist/);
  });

  it('gives one-sided limits separately', () => {
    const sides = oneSidedLimits('1/x', 0);
    expect(sides.left!.value).toBe(-Infinity);
    expect(sides.right!.value).toBe(Infinity);
    expect(sides.agrees).toBe(false);
    expect(sides.twoSided).toBeNull();
    expect(sides.steps.join(' ')).toMatch(/differ/i);
    const agreeing = oneSidedLimits('sin(x)/x', 0);
    expect(agreeing.agrees).toBe(true);
    expect(agreeing.twoSided!.value).toBeCloseTo(1, 9);
  });

  it('handles limits at infinity of non-polynomial expressions', () => {
    const exponential = symbolicLimit('e^x/x', Infinity);
    expect(exponential).not.toBeNull();
    expect(exponential!.value).toBe(Infinity);
    expect(symbolicLimit('e^-x', Infinity)!.value).toBe(0);
  });

  it('says so when it cannot work it out', () => {
    // sin(1/x) oscillates: the engine must not pretend to know a value.
    const oscillating = symbolicLimit('sin(1/x)', 0);
    expect(oscillating?.exists ?? false).toBe(false);
    expect(symbolicLimit('x^(x^x)', Infinity)?.exists ?? false).toBe(false);
  });
});

describe('series expansion', () => {
  it('expands sin, cos and exp exactly', () => {
    const sine = series('sin(x)', { order: 7 })!;
    expect(sine.polynomial).toBe('x - x^3/6 + x^5/120 - x^7/5040');
    expect(sine.exact).toBe(true);
    expect(sine.radius.value).toBe('infinite');
    expect(sine.terms[3]!.coefficient).toBeCloseTo(-1 / 6, 12);

    const cosine = series('cos(x)', { order: 6 })!;
    expect(cosine.polynomial).toBe('1 - x^2/2 + x^4/24 - x^6/720');
    const exponential = series('e^x', { order: 4 })!;
    expect(exponential.polynomial).toBe('1 + x + x^2/2 + x^3/6 + x^4/24');
  });

  it('detects a finite radius of convergence', () => {
    const geometric = series('1/(1-x)', { order: 6 })!;
    expect(geometric.polynomial).toBe('1 + x + x^2 + x^3 + x^4 + x^5 + x^6');
    expect(geometric.radius.value).toBe(1);
    expect(geometric.radius.note).toMatch(/geometric|ratio/i);
  });

  it('expands about a non-zero centre (Taylor, not Maclaurin)', () => {
    const result = series('ln(x)', { centre: 1, order: 4 })!;
    expect(result.kind).toBe('taylor');
    expect(result.polynomial).toBe('(x - 1) - (x - 1)^2/2 + (x - 1)^3/3 - (x - 1)^4/4');
    expect(result.verification.agrees).toBe(true);
  });

  it('checks the truncated polynomial against the function', () => {
    const result = series('exp(x)', { centre: 1, order: 6 })!;
    expect(result.verification.checked).toBeGreaterThan(0);
    expect(result.verification.agrees).toBe(true);
    expect(result.verification.maxError).toBeLessThan(1e-3);
  });

  it('lists the standard series with their radii', () => {
    const table = popularSeries();
    expect(table.length).toBeGreaterThan(8);
    expect(table.find((entry) => entry.name === 'sin')!.radius).toBe('all x');
    expect(table.find((entry) => entry.name === 'atan')!.radius).toBe('|x| < 1');
  });
});

describe('inequalities', () => {
  it('solves quadratic inequalities with interval notation', () => {
    const above = solveInequality('x^2 - 5x + 6 > 0')!;
    expect(above.notation).toBe('(-∞, 2) ∪ (3, ∞)');
    expect(above.boundaries).toEqual([2, 3]);
    expect(above.verification.agrees).toBe(true);

    const below = solveInequality('x^2 - 5x + 6 <= 0')!;
    expect(below.notation).toBe('[2, 3]');
    expect(below.verification.agrees).toBe(true);
  });

  it('solves linear and cubic inequalities', () => {
    expect(solveInequality('2x + 3 < 7')!.notation).toBe('(-∞, 2)');
    expect(solveInequality('x^3 - x >= 0')!.notation).toBe('[-1, 0] ∪ [1, ∞)');
    expect(solveInequality('x^3 - x > 0')!.notation).toBe('(-1, 0) ∪ (1, ∞)');
  });

  it('reports an impossible inequality as having no solution', () => {
    const none = solveInequality('x^2 + 1 < 0')!;
    expect(none.notation).toBe('no solution');
    expect(none.intervals).toHaveLength(0);
  });

  it('handles compound and always-true cases', () => {
    expect(solveInequality('x^2 + 1 > 0')!.notation).toBe('(-∞, ∞)');
    expect(solveInequality('x + 1 > x')!.notation).toBe('(-∞, ∞)');
    expect(solveInequality('x <= x - 1')!.notation).toBe('no solution');
  });

  it('rejects input that is not an inequality', () => {
    expect(solveInequality('x^2 + 1')).toBeNull();
    expect(solveInequality('sin(x) > 0')).toBeNull();
  });
});

describe('nonlinear systems', () => {
  it('solves a circle and a line, finding both intersections', () => {
    const result = solveNonlinearSystem(['x^2 + y^2 = 25', 'x - y = 1']);
    expect(result.solved).toBe(true);
    expect(result.variables).toEqual(['x', 'y']);
    expect(result.solutions).toHaveLength(2);
    const pairs = result.solutions.map((solution) => solution.values.join(','));
    expect(pairs).toContain('4,3');
    expect(pairs).toContain('-3,-4');
    for (const solution of result.solutions) {
      expect(solution.maxResidual).toBeLessThan(1e-6);
    }
    expect(result.method).toMatch(/Newton/i);
  });

  it('solves a trigonometric/exponential system numerically and verifies it', () => {
    const result = solveNonlinearSystem(['y = sin(x)', 'y = x/2']);
    expect(result.solved).toBe(true);
    for (const solution of result.solutions) {
      const [x, y] = solution.values as [number, number];
      expect(y).toBeCloseTo(Math.sin(x), 6);
      expect(y).toBeCloseTo(x / 2, 6);
    }
  });

  it('handles three unknowns', () => {
    const result = solveNonlinearSystem(['x + y + z = 6', 'x*y = 2', 'z - x = 1']);
    expect(result.variables).toHaveLength(3);
    for (const solution of result.solutions) {
      const [x, y, z] = solution.values as [number, number, number];
      expect(x + y + z).toBeCloseTo(6, 6);
      expect(x * y).toBeCloseTo(2, 6);
      expect(z - x).toBeCloseTo(1, 6);
    }
  });

  it('is honest when it cannot help', () => {
    const tooMany = solveNonlinearSystem(['a+b+c+d = 1', 'a = 1', 'b = 2', 'c = 3']);
    expect(tooMany.solved).toBe(false);
    expect(tooMany.notes.join(' ')).toMatch(/up to three/);
    const noRoots = solveNonlinearSystem(['x^2 + y^2 = -1', 'x = 0']);
    expect(noRoots.solved).toBe(false);
    expect(noRoots.notes.join(' ')).toMatch(/no solution was found/i);
  });
});

describe('CAS core', () => {
  it('canonicalises without changing values, including signs', () => {
    const cases = ['-(x + 1)', '-(x - 1)', '2 * (x + 1)', '-2 * x + 3', 'x * 1', 'x / x', 'x^1', 'x^0', '2 * x / 2'];
    for (const source of cases) {
      const node = parseNode(source);
      for (const value of [0.5, 1.7, -2.3]) {
        const raw = evaluateAt(node, 'x', value);
        const simplified = evaluateAt(canonical(node), 'x', value);
        if (Number.isFinite(raw)) expect(simplified).toBeCloseTo(raw, 12);
      }
    }
  });

  it('prints coefficients as fractions where a textbook would', () => {
    expect(formatNice(parseNode('0.3333333333333333 * x^3'))).toBe('x ^ 3 / 3');
    expect(formatNice(parseNode('0.5 * x^2'))).toBe('x ^ 2 / 2');
  });

  it('reads a polynomial only when it really is one', () => {
    expect(toPolynomial(parseNode('3*x^2 - 4*x + 1'), 'x')).toEqual([1, -4, 3]);
    expect(format(parseNode('3*x^2 - 4*x + 1'))).toBe('3 * x ^ 2 - 4 * x + 1');
    expect(toPolynomial(parseNode('sin(x)'), 'x')).toBeNull();
    expect(toPolynomial(parseNode('x^-1'), 'x')).toBeNull();
  });
});
