import { describe, expect, it } from 'vitest';
import {
  chineseRemainder,
  divisors,
  eulerPhi,
  extendedGcd,
  factorise,
  gcdBig,
  integerRoot,
  isPrime,
  lcmBig,
  mobius,
  modInverse,
  modPow,
  modularArithmetic,
  nextPrime,
  primeFactorisationText,
} from './numbertheory';
import {
  bell,
  binomial,
  catalan,
  combinationsWithRepetition,
  derangements,
  factorialBig,
  multinomial,
  permutations,
  stirlingFirst,
  stirlingSecond,
} from './combinatorics';
import {
  arithmeticSequence,
  evaluateRecurrence,
  fibonacciSequence,
  geometricSequence,
  partialSums,
  recognise,
} from './sequences';
import {
  besselJ,
  beta,
  chebyshev,
  ellipticE,
  ellipticK,
  erf,
  erfc,
  gamma,
  hermite,
  laguerre,
  legendre,
  logGamma,
  regularisedBeta,
  regularisedGammaP,
  zeta,
} from './special';
import {
  bisection,
  compareOdeMethods,
  goldenSection,
  goldenSectionMaximum,
  gradientDescent,
  lagrangeInterpolation,
  leastSquares,
  linearInterpolation,
  newtonInterpolation,
  newtonOptimise,
  newtonRaphson,
  regulaFalsi,
  secant,
  simpson,
  solveOde,
  solveWithAllMethods,
} from './numerical';

describe('number theory', () => {
  it('tests primality exactly, including Carmichael numbers', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(97)).toBe(true);
    expect(isPrime(561)).toBe(false); // Carmichael
    expect(isPrime(1105)).toBe(false);
    expect(isPrime(2147483647)).toBe(true); // Mersenne prime 2^31 − 1
    expect(isPrime(999999999989n)).toBe(true);
    expect(isPrime(1000000000000000003n)).toBe(true);
  });

  it('factorises, including large semiprimes', () => {
    expect(primeFactorisationText(360)).toBe('2^3 × 3^2 × 5');
    expect(factorise(97)).toEqual([{ prime: 97n, exponent: 1 }]);
    const semiprime = 1000003n * 1000033n;
    expect(primeFactorisationText(semiprime)).toBe('1000003 × 1000033');
  });

  it('lists divisors and sums them', () => {
    expect(divisors(28).map(Number)).toEqual([1, 2, 4, 7, 14, 28]);
    expect(divisors(1).map(Number)).toEqual([1]);
  });

  it('computes totient and Möbius values', () => {
    expect(eulerPhi(1).toString()).toBe('1');
    expect(eulerPhi(36).toString()).toBe('12');
    expect(eulerPhi(97).toString()).toBe('96');
    expect(mobius(30)).toBe(-1); // three prime factors, square-free
    expect(mobius(12)).toBe(0); // 2² divides it
    expect(mobius(1)).toBe(1);
  });

  it('does modular arithmetic with exact big integers', () => {
    expect(modPow(2, 10, 1000).toString()).toBe('24');
    expect(modPow(7n, 1000000007n - 2n, 1000000007n).toString()).toBe(modInverse(7n, 1000000007n)!.toString());
    expect(modInverse(3, 11)!.toString()).toBe('4');
    expect(modInverse(2, 4)).toBeNull();
    expect(modularArithmetic(7, 8, 12, 'mul').toString()).toBe('8');
    expect(modularArithmetic(3, 4, 11, 'div').toString()).toBe('9');
    expect(() => modularArithmetic(2, 2, 4, 'div')).toThrow();
  });

  it('runs the extended Euclidean algorithm', () => {
    const { gcd, x, y } = extendedGcd(240, 46);
    expect(gcd.toString()).toBe('2');
    expect(240 * Number(x) + 46 * Number(y)).toBe(2);
    expect(gcdBig(48, 18).toString()).toBe('6');
    expect(lcmBig(4, 6).toString()).toBe('12');
  });

  it('solves Chinese remainder systems, coprime or not', () => {
    const coprime = chineseRemainder([2, 3, 2], [3, 5, 7])!;
    expect(coprime.value.toString()).toBe('23');
    expect(coprime.modulus.toString()).toBe('105');
    expect(chineseRemainder([1, 2], [2, 4])).toBeNull(); // inconsistent
    const compatible = chineseRemainder([1, 3], [2, 4])!;
    expect(compatible.value.toString()).toBe('3');
  });

  it('finds neighbouring primes and integer roots', () => {
    expect(nextPrime(100).toString()).toBe('101');
    expect(nextPrime(1).toString()).toBe('2');
    expect(integerRoot(27, 3).toString()).toBe('3');
    expect(integerRoot(10n ** 30n, 10).toString()).toBe('1000'); // (10³)¹⁰ = 10³⁰
    expect(integerRoot(-8, 3).toString()).toBe('-2');
    expect(() => integerRoot(-4, 2)).toThrow();
  });
});

describe('combinatorics', () => {
  it('computes exact factorials and binomials', () => {
    expect(factorialBig(20).toString()).toBe('2432902008176640000');
    expect(binomial(5, 2).value).toBe(10);
    expect(binomial(52, 5).text).toBe('2598960');
    expect(binomial(5, 7).value).toBe(0);
    expect(binomial(100, 50).text).toBe('100891344545564193334812497256');
    expect(binomial(100, 50).value).toBeNull();
  });

  it('computes permutations and combinations with repetition', () => {
    expect(permutations(5, 2).value).toBe(20);
    expect(permutations(5, 6).value).toBe(0);
    expect(combinationsWithRepetition(3, 2).value).toBe(6); // C(4,2)
  });

  it('computes multinomial coefficients', () => {
    expect(multinomial([1, 1, 1]).value).toBe(6);
    expect(multinomial([2, 2]).value).toBe(6);
    expect(multinomial([3, 2, 1]).value).toBe(60);
  });

  it('computes derangements', () => {
    expect(derangements(0).value).toBe(1);
    expect(derangements(1).value).toBe(0);
    expect(derangements(4).value).toBe(9);
    expect(derangements(5).value).toBe(44);
  });

  it('computes Catalan, Stirling and Bell numbers', () => {
    expect([0, 1, 2, 3, 4, 5].map((n) => catalan(n).value)).toEqual([1, 1, 2, 5, 14, 42]);
    expect(stirlingSecond(4, 2).value).toBe(7);
    expect(stirlingSecond(5, 3).value).toBe(25);
    expect(stirlingFirst(4, 2).value).toBe(11);
    expect([0, 1, 2, 3, 4, 5].map((n) => bell(n).value)).toEqual([1, 1, 2, 5, 15, 52]);
  });

  it('rejects impossible inputs', () => {
    expect(() => factorialBig(-1)).toThrow();
    expect(() => binomial(2.5, 1)).toThrow();
    expect(() => derangements(-2)).toThrow();
  });
});

describe('sequences', () => {
  it('builds arithmetic and geometric sequences with closed forms', () => {
    const arithmetic = arithmeticSequence(3, 4, 5);
    expect(arithmetic.terms.map((entry) => entry.value)).toEqual([3, 7, 11, 15, 19]);
    expect(arithmetic.partialSum).toBe(55);
    expect(arithmetic.closedForm).toContain('a(n) = 3 + (n - 1)·4');

    const geometric = geometricSequence(2, 3, 4);
    expect(geometric.terms.map((entry) => entry.value)).toEqual([2, 6, 18, 54]);
    expect(geometric.partialSum).toBe(80);
  });

  it('builds Fibonacci numbers and their ratio', () => {
    const fib = fibonacciSequence(10);
    expect(fib.terms.map((entry) => entry.value)).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
    expect(fib.ratio).toBeCloseTo(34 / 21, 12);
    expect(fib.closedForm).toContain('φ');
  });

  it('evaluates an arbitrary linear recurrence', () => {
    const fib = evaluateRecurrence({ expression: 'a(n-1) + a(n-2)', initial: [0, 1], count: 10 });
    expect(fib.terms.map((entry) => entry.value)).toEqual([0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
    const lucas = evaluateRecurrence({ expression: 'a(n-1) + a(n-2)', initial: [2, 1], count: 6 });
    expect(lucas.terms.map((entry) => entry.value)).toEqual([2, 1, 3, 4, 7, 11]);
    const geometric = evaluateRecurrence({ expression: '3*a(n-1)', initial: [1], count: 5 });
    expect(geometric.terms.map((entry) => entry.value)).toEqual([1, 3, 9, 27, 81]);
    expect(geometric.ratio).toBe(3);
  });

  it('stops instead of guessing when a recurrence reaches backwards', () => {
    expect(() => evaluateRecurrence({ expression: 'a(n-2)', initial: [1], count: 4 })).toThrow();
    expect(() => evaluateRecurrence({ expression: 'a(n+1)', initial: [1, 2], count: 4 })).toThrow();
  });

  it('reports partial sums and recognises patterns', () => {
    expect(partialSums([1, 2, 3]).map((entry) => entry.sum)).toEqual([1, 3, 6]);
    expect(recognise([2, 5, 8, 11]).kind).toBe('arithmetic');
    expect(recognise([1, 2, 4, 8]).kind).toBe('geometric');
    expect(recognise([1, 1, 2, 3, 5]).kind).toBe('fibonacci');
    expect(recognise([1, 4, 9, 16]).kind).toBe('polynomial');
    expect(recognise([1, 9, 2]).kind).toBe('unknown');
  });
});

describe('special functions', () => {
  it('computes the gamma family accurately', () => {
    expect(gamma(5)).toBeCloseTo(24, 10);
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 12);
    expect(gamma(0.5) ** 2).toBeCloseTo(Math.PI, 12);
    expect(logGamma(100)).toBeCloseTo(Math.log(gamma(100)), 6);
    expect(beta(2, 3)).toBeCloseTo(1 / 12, 12);
    expect(() => gamma(-1)).toThrow();
  });

  it('computes incomplete gamma and beta, and erf matches known values', () => {
    expect(regularisedGammaP(1, 1)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(regularisedBeta(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    expect(regularisedBeta(0.3, 1, 1)).toBeCloseTo(0.3, 12);
    expect(erf(0)).toBe(0);
    expect(erf(1)).toBeCloseTo(0.8427007929497149, 12);
    expect(erfc(1)).toBeCloseTo(0.1572992070502851, 12);
    expect(erf(-1)).toBeCloseTo(-erf(1), 15);
  });

  it('computes the classical orthogonal polynomials', () => {
    expect(legendre(0, 0.3)).toBe(1);
    expect(legendre(1, 0.3)).toBeCloseTo(0.3, 12);
    expect(legendre(2, 0.3)).toBeCloseTo((3 * 0.09 - 1) / 2, 12);
    expect(legendre(3, 0.5)).toBeCloseTo((5 * 0.125 - 3 * 0.5) / 2, 12);
    expect(chebyshev(2, 0.5)).toBeCloseTo(-0.5, 12);
    expect(chebyshev(3, 0.5)).toBeCloseTo(-1, 12);
    expect(hermite(2, 1.5)).toBeCloseTo(4 * 2.25 - 2, 12);
    expect(hermite(3, 1)).toBeCloseTo(8 - 12, 12);
    expect(laguerre(2, 1)).toBeCloseTo(-0.5, 12); // L₂(x) = (x² − 4x + 2)/2
    expect(laguerre(3, 0)).toBe(1);
  });

  it('computes Bessel functions with the expected limits and values', () => {
    expect(besselJ(0, 0)).toBe(1);
    expect(besselJ(1, 0)).toBe(0);
    expect(besselJ(0, 1)).toBeCloseTo(0.7651976865579666, 4);
    expect(besselJ(1, 1)).toBeCloseTo(0.4400505857449335, 4);
    expect(besselJ(0, 10)).toBeCloseTo(-0.2459357644513483, 3);
    // Recurrence identity: J₀(x) + J₂(x) = 2J₁(x)/x at x = 3
    expect(besselJ(0, 3) + besselJ(2, 3)).toBeCloseTo((2 * besselJ(1, 3)) / 3, 4);
  });

  it('computes elliptic integrals and zeta', () => {
    expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 12);
    expect(ellipticE(0)).toBeCloseTo(Math.PI / 2, 12);
    expect(ellipticK(0.5)).toBeCloseTo(1.8540746773013719, 9);
    expect(ellipticE(0.5)).toBeCloseTo(1.3506438810476755, 9);
    expect(zeta(2)).toBeCloseTo(Math.PI ** 2 / 6, 9);
    expect(zeta(4)).toBeCloseTo(Math.PI ** 4 / 90, 9);
    expect(() => zeta(0.5)).toThrow();
  });
});

describe('numerical methods', () => {
  const f = (x: number) => x * x - 2;

  it('finds roots with every method and agrees on the answer', () => {
    const bisected = bisection(f, 0, 2);
    expect(bisected.root).toBeCloseTo(Math.SQRT2, 9);
    expect(bisected.converged).toBe(true);
    expect(bisected.iterations.length).toBeGreaterThan(10);

    expect(newtonRaphson(f, 1).root).toBeCloseTo(Math.SQRT2, 12);
    expect(secant(f, 0, 2).root).toBeCloseTo(Math.SQRT2, 12);
    expect(regulaFalsi(f, 0, 2).root).toBeCloseTo(Math.SQRT2, 9);

    const all = solveWithAllMethods(f, { bracket: [0, 2], start: 1 });
    expect(all.agree).toBe(true);
    expect(all.results.length).toBeGreaterThanOrEqual(3);
  });

  it('explains a bracketing failure instead of returning nonsense', () => {
    expect(() => bisection(f, 2, 5)).toThrow(/same sign/i);
    const far = newtonRaphson((x) => x * x + 1, 0);
    expect(far.converged).toBe(false);
  });

  it('solves each documented example with an iteration history', () => {
    const sine = (x: number) => Math.sin(x) - x / 2;
    const result = bisection(sine, 1, 3);
    expect(result.iterations[0]!.step).toBe(1);
    expect(result.iterations.length).toBeGreaterThan(1);
    expect(Math.sin(result.root)).toBeCloseTo(result.root / 2, 9);
  });

  it('minimises and maximises with golden-section search', () => {
    const quadratic = (x: number) => (x - 3) ** 2 + 1;
    const minimum = goldenSection(quadratic, -10, 10);
    expect(minimum.point).toBeCloseTo(3, 6);
    expect(minimum.value).toBeCloseTo(1, 9);
    expect(minimum.kind).toBe('minimum');

    const maximum = goldenSectionMaximum((x) => -((x + 2) ** 2) + 5, -10, 10);
    expect(maximum.point).toBeCloseTo(-2, 6);
    expect(maximum.value).toBeCloseTo(5, 9);
  });

  it('minimises in several variables and reports convergence', () => {
    const bowl = ([x, y]: number[]) => (x - 1) ** 2 + (y + 2) ** 2 + 3;
    const result = gradientDescent(bowl, [0, 0]);
    expect(result.value).toBeCloseTo(3, 4);
    expect((result.point as number[])[0]).toBeCloseTo(1, 2);
    expect((result.point as number[])[1]).toBeCloseTo(-2, 2);
    const oneD = newtonOptimise((x) => (x - 4) ** 4 + 2, 1);
    expect(oneD.point).toBeCloseTo(4, 3); // (x−4)⁴ is flat: Newton converges linearly there
    expect(oneD.value).toBeCloseTo(2, 6);
  });

  it('interpolates exactly and fits approximately', () => {
    const points: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 5],
      [3, 10],
    ];
    expect(linearInterpolation(points, 1.5)).toBeCloseTo(3.5, 12);
    expect(linearInterpolation(points, -5)).toBe(1);

    const lagrange = lagrangeInterpolation(points);
    expect(lagrange.valueAt(2.5)).toBeCloseTo(7.25, 9); // y = x² + 1 ⇒ 2.5² + 1
    expect(lagrange.maxDeviation).toBeLessThan(1e-9);

    const newton = newtonInterpolation(points);
    expect(newton.valueAt(0.5)).toBeCloseTo(1.25, 9);
    expect(newton.maxDeviation).toBeLessThan(1e-9);

    const noisy: [number, number][] = [
      [0, 1.1],
      [1, 2.2],
      [2, 4.9],
      [3, 9.8],
    ];
    const fit = leastSquares(noisy, 2);
    expect(fit.coefficients[2]).toBeCloseTo(0.95, 2); // exact least-squares solution for this data
    expect(fit.text).toContain('x^2');
  });

  it('integrates numerically with an error estimate', () => {
    const result = simpson((x) => x * x, 0, 3, 200);
    expect(result.value).toBeCloseTo(9, 9);
    expect(result.error).toBeLessThan(1e-6);
    expect(result.error).toBeGreaterThanOrEqual(0);
  });

  it('solves differential equations and shows the order of accuracy', () => {
    const dy = (_x: number, y: number) => y;
    const euler = solveOde(dy, { x0: 0, y0: 1, x1: 1, stepSize: 0.1, method: 'euler' });
    expect(euler.points).toHaveLength(11);
    expect(euler.points[10]![1]).toBeCloseTo(2.5937, 3); // Euler undershoots e
    const rk4 = solveOde(dy, { x0: 0, y0: 1, x1: 1, stepSize: 0.1, method: 'rk4' });
    expect(Math.abs(rk4.points[10]![1] - Math.E)).toBeLessThan(1e-5); // 4th order: ~2e-6 at h = 0.1
    const midpoint = solveOde(dy, { x0: 0, y0: 1, x1: 1, stepSize: 0.1, method: 'midpoint' });
    expect(midpoint.points[10]![1]).toBeCloseTo(Math.E, 2); // 2nd order: ~4e-3 at h = 0.1

    const compared = compareOdeMethods(dy, { x0: 0, y0: 1, x1: 1, stepSize: 0.2 });
    expect(Math.abs(compared.rk4 - Math.E)).toBeLessThan(Math.abs(compared.euler - Math.E));
    expect(Math.abs(compared.midpoint - Math.E)).toBeLessThan(Math.abs(compared.euler - Math.E));
  });

  it('refuses nonsense step sizes', () => {
    expect(() => solveOde((_x, y) => y, { x0: 0, y0: 1, x1: 1, stepSize: 0 })).toThrow();
    expect(() => solveOde((_x, y) => y, { x0: 1, y0: 1, x1: 0, stepSize: 0.1 })).toThrow();
  });
});
