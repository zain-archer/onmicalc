import { describe, expect, it } from 'vitest';
import {
  beta,
  besselJ,
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
} from './index';

/**
 * Direct tests for the special functions.
 *
 * The module had no test file of its own, which is how a wrong unexposed
 * function can sit here unnoticed (see the `it.todo` entries at the bottom).
 *
 * `gamma`, `logGamma`, `regularisedGammaP` and `regularisedBeta` matter most:
 * every continuous distribution in `@/math/probability` computes its pdf/CDF
 * from them, and `erf` is the accuracy base of the normal CDF. `erf` was also
 * duplicated in `math/probability/normal.ts` until the architecture pass, so
 * these values are the regression lock against a second, drifting copy.
 *
 * Every expected value was computed with MPFR via Python `mpmath` (30–40
 * significant digits) rather than recalled or copied between cases — an earlier
 * draft of this file had `J₀(12)` set to the `J₀(10)` value, which the test
 * caught immediately. Tolerances are relative, because absolute differences are
 * meaningless for `logGamma(1000)`.
 */

/** |got − want| / |want|, so one tolerance works at every magnitude. */
function relError(got: number, want: number): number {
  return Math.abs(got - want) / Math.abs(want);
}

describe('erf and erfc', () => {
  const ERF: [number, number][] = [
    [0.1, 0.1124629160182848984],
    [0.5, 0.52049987781304653768],
    [1, 0.84270079294971486934],
    [2, 0.99532226501895273416],
    [3, 0.99997790950300141456],
    [5, 0.99999999999846254021],
  ];

  it.each(ERF)('erf(%f) matches the reference to 15 digits', (x, want) => {
    expect(relError(erf(x), want)).toBeLessThan(1e-15);
  });

  it('is odd, exactly zero at zero, and saturates', () => {
    expect(erf(0)).toBe(0);
    for (const x of [0.1, 0.5, 1, 2, 3, 5]) expect(erf(-x)).toBe(-erf(x));
    expect(erf(6)).toBe(1);
    expect(erf(-6)).toBe(-1);
  });

  it('erfc is the complement of erf', () => {
    // erfc = 1 − erf loses digits at large x through cancellation, so the
    // tolerance is loosened there rather than pretending precision is flat.
    expect(relError(erfc(0.5), 0.47950012218695346232)).toBeLessThan(1e-14);
    expect(relError(erfc(1), 0.15729920705028513066)).toBeLessThan(1e-14);
    expect(relError(erfc(3), 0.000022090496998585441373)).toBeLessThan(1e-10);
  });

  it('agrees with the normal CDF, which is built from it', () => {
    // Φ(x) = ½(1 + erf(x/√2))
    for (const [x, phi] of [
      [0, 0.5],
      [1, 0.84134474606854294859],
      [1.96, 0.97500210485177956379],
      [-1.96, 0.024997895148220436213],
    ] as [number, number][]) {
      expect(relError(0.5 * (1 + erf(x / Math.SQRT2)), phi)).toBeLessThan(1e-15);
    }
  });
});

describe('gamma and logGamma', () => {
  it.each([
    [0.5, 1.7724538509055160273], // √π
    [1, 1],
    [5, 24],
    [4.5, 11.631728396567448929],
    [10, 362880], // 9!
    [0.1, 9.5135076986687312858],
  ] as [number, number][])('gamma(%f) matches the reference', (x, want) => {
    expect(relError(gamma(x), want)).toBeLessThan(1e-14);
  });

  it.each([
    [0.5, 0.57236494292470008707],
    [10, 12.801827480081469611],
    [100, 359.13420536957539878],
    [1000, 5905.2204232091812118],
  ] as [number, number][])('logGamma(%f) stays accurate for large arguments', (x, want) => {
    expect(relError(logGamma(x), want)).toBeLessThan(1e-14);
  });

  it('refuses the poles rather than returning Infinity', () => {
    for (const pole of [0, -1, -2, -100]) expect(() => gamma(pole)).toThrow(/undefined/);
    expect(() => logGamma(0)).toThrow(/undefined/);
    expect(() => logGamma(-3)).toThrow(/undefined/);
  });
});

describe('regularised incomplete gamma and beta', () => {
  it.each([
    [0.5, 0.25, 0.52049987781304653768], // P(½, x²) = erf(x) at x = 0.5
    [1, 1, 0.6321205588285576784], // 1 − e⁻¹
    [2, 3, 0.80085172652854422808],
  ] as [number, number, number][])('P(%f, %f) matches the reference', (a, x, want) => {
    expect(relError(regularisedGammaP(a, x), want)).toBeLessThan(1e-14);
  });

  it('P(1/2, x²) agrees with erf(x) — two independent implementations', () => {
    // The two are computed differently, so this cross-check catches a
    // regression in either one.
    for (const x of [0.1, 0.5, 1, 2]) {
      expect(relError(regularisedGammaP(0.5, x * x), erf(x))).toBeLessThan(1e-14);
    }
  });

  it.each([
    [0.5, 0.5, 0.5, 0.5],
    [0.3, 1, 1, 0.2999999999999999889], // I_x(1, 1) = x
    [0.4, 2, 3, 0.52480000000000003837],
  ] as [number, number, number, number][])(
    'I_%f(%f, %f) matches the reference',
    (x, a, b, want) => {
      expect(relError(regularisedBeta(x, a, b), want)).toBeLessThan(1e-14);
    },
  );

  it('is monotonic in x, as a CDF must be', () => {
    let previous = 0;
    for (let i = 0; i <= 20; i += 1) {
      const value = regularisedBeta(i / 20, 2, 3);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(regularisedBeta(0, 2, 3)).toBe(0);
    expect(regularisedBeta(1, 2, 3)).toBe(1);
  });

  it('rejects arguments outside its domain', () => {
    expect(() => regularisedBeta(-0.1, 1, 1)).toThrow(/0 ≤ x ≤ 1/);
    expect(() => regularisedBeta(1.1, 1, 1)).toThrow(/0 ≤ x ≤ 1/);
    expect(() => regularisedBeta(0.5, 0, 1)).toThrow(/positive/);
    expect(() => regularisedGammaP(0, 1)).toThrow(/a > 0/);
    expect(() => regularisedGammaP(1, -1)).toThrow(/x ≥ 0/);
  });

  it('beta is the normalisation the regularised form divides out', () => {
    expect(relError(beta(2, 3), 0.083333333333333333333)).toBeLessThan(1e-14);
    expect(relError(beta(0.5, 0.5), Math.PI)).toBeLessThan(1e-15);
    expect(() => beta(0, 1)).toThrow(/positive/);
  });
});

describe('orthogonal polynomials', () => {
  it.each([
    [2, 0.5, -0.125],
    [3, 0.5, -0.4375],
    [4, 0.3, 0.072937500000000019734],
  ] as [number, number, number][])('Legendre P_%i(%f)', (n, x, want) => {
    expect(relError(legendre(n, x), want)).toBeLessThan(1e-14);
  });

  it.each([
    [2, 0.5, -0.5],
    [3, 0.5, -1],
    [5, 0.25, 0.953125],
  ] as [number, number, number][])('Chebyshev T_%i(%f)', (n, x, want) => {
    expect(relError(chebyshev(n, x), want)).toBeLessThan(1e-14);
  });

  it.each([
    [2, 0.5, -1],
    [3, 0.5, -5],
    [4, 0.3, 7.8096000000000003006],
  ] as [number, number, number][])('Hermite H_%i(%f)', (n, x, want) => {
    expect(relError(hermite(n, x), want)).toBeLessThan(1e-14);
  });

  it.each([
    [2, 0.5, 0.125],
    [3, 0.5, -0.14583333333333333333],
    [4, 0.3, 0.052337500000000026373],
  ] as [number, number, number][])('Laguerre L_%i(%f)', (n, x, want) => {
    expect(relError(laguerre(n, x), want)).toBeLessThan(1e-14);
  });
});

describe('elliptic integrals and zeta', () => {
  it.each([
    [0, Math.PI / 2], // K(0) = E(0) = π/2
    [0.5, 1.8540746773013719184],
    [0.9, 2.5780921133481732927],
  ] as [number, number][])('K(%f)', (m, want) => {
    expect(relError(ellipticK(m), want)).toBeLessThan(1e-14);
  });

  it.each([
    [0, Math.PI / 2],
    [0.5, 1.3506438810476755025],
    [0.9, 1.1047747327040733079],
  ] as [number, number][])('E(%f)', (m, want) => {
    expect(relError(ellipticE(m), want)).toBeLessThan(1e-14);
  });

  it('refuses m ≥ 1 where K(m) diverges', () => {
    expect(() => ellipticK(1)).toThrow(/m < 1/);
    expect(() => ellipticK(1.5)).toThrow(/m < 1/);
  });

  it.each([
    [2, 1.6449340668482264365], // π²/6
    [3, 1.2020569031595942854],
    [4, 1.0823232337111381915], // π⁴/90
    [1.5, 2.6123753486854883433],
  ] as [number, number][])('zeta(%f)', (s, want) => {
    expect(relError(zeta(s), want)).toBeLessThan(1e-13);
  });

  it('states its limitation instead of returning a wrong value below s = 1', () => {
    expect(() => zeta(0.5)).toThrow(/s > 1/);
    expect(() => zeta(-1)).toThrow(/s > 1/);
    expect(() => zeta(1)).toThrow(/s > 1/);
  });
});

describe('besselJ', () => {
  // Only the x < 16 Miller-recurrence branch is tested: the asymptotic branch
  // used for larger x is inaccurate and is recorded as a known defect below.
  it.each([
    [0, 1, 0.76519768655796655145],
    [1, 1, 0.44005058574493351596],
    [2, 3, 0.48609126058589107691],
    [0, 5, -0.17759677131433830435],
    [0, 12, 0.047689310796833536624],
    [3, 4.5, 0.42470397297745560025],
  ] as [number, number, number][])('J_%i(%f)', (n, x, want) => {
    expect(relError(besselJ(n, x), want)).toBeLessThan(1e-11);
  });

  it('is exact at the origin and honours J₋ₙ = (−1)ⁿ Jₙ', () => {
    expect(besselJ(0, 0)).toBe(1);
    expect(besselJ(1, 0)).toBe(0);
    expect(besselJ(-1, 1)).toBeCloseTo(-besselJ(1, 1), 14);
    expect(besselJ(-2, 1)).toBeCloseTo(besselJ(2, 1), 14);
  });

  it('is correct for negative arguments through the parity of J, in range', () => {
    // The Miller branch is used for every negative x, and the recurrence is
    // homogeneous, so J carries its parity: J_n(−x) = (−1)ⁿJ_n(x). True only
    // where the branch itself is accurate, hence the bounded arguments.
    expect(relError(besselJ(0, -1), besselJ(0, 1))).toBeLessThan(1e-14);
    expect(relError(besselJ(1, -1), -besselJ(1, 1))).toBeLessThan(1e-14);
    expect(relError(besselJ(2, -3), besselJ(2, 3))).toBeLessThan(1e-14);
  });

  it('rejects non-integer orders', () => {
    expect(() => besselJ(0.5, 1)).toThrow(/integer Bessel orders/);
    expect(() => besselJ(1.5, 2)).toThrow(/integer Bessel orders/);
  });
});

/*
 * KNOWN DEFECTS — not reachable by a user today, because `@/math/special` is
 * imported only by `@/math/probability`, which uses gamma/logGamma/erf/the
 * regularised forms and none of the Bessel functions. The values are wrong
 * nonetheless, and must not be baked in as "expected" until they are fixed.
 * References and the recommended fix are in ARCHITECTURE_AUDIT.md (B1).
 */
describe('known numerical defects (documented, not fixed)', () => {
  it.todo(
    'besselY seeds Y₀/Y₁ with a large-x asymptotic where it has not converged: Y_0(1) returns 0.1699162315486493 against 0.088256964215676958 (93% off)',
  );
  it.todo(
    'besselJ and besselY fall back to a single asymptotic term for x ≥ 16, losing accuracy as order grows: J_5(20) is ~58% off and J_5(200) is still ~2% off',
  );
});
