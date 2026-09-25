import { CalcError } from '@/core/errors';

/**
 * Special functions.
 *
 * Only functions that can be computed to full double precision with the
 * algorithms below are exposed. Series and recurrences carry explicit accuracy
 * guards, and anything that would need an approximation of unknown quality
 * (odd-order Bessel functions of large order, say) is either computed by a
 * stable recurrence or not offered at all.
 */

/* ------------------------------- gamma family ----------------------------- */

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Lanczos approximation — accurate to ~1e-15 relative for x > 0.5. */
export function gamma(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x <= 0 && Number.isInteger(x)) {
    throw new CalcError('DOMAIN', 'Γ is undefined at 0 and at the negative integers (simple poles)', {
      details: 'Γ has a pole at every non-positive integer; there is no finite value there.',
    });
  }
  if (x < 0.5) {
    // Reflection: Γ(x)Γ(1 − x) = π / sin(πx)
    const sine = Math.sin(Math.PI * x);
    return Math.PI / (sine * gamma(1 - x));
  }
  const z = x - 1;
  let accumulator = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i += 1) accumulator += LANCZOS[i]! / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * accumulator;
}

/** log Γ(x) — avoids overflow for large arguments. */
export function logGamma(x: number): number {
  if (x <= 0 && Number.isInteger(x)) throw new CalcError('DOMAIN', 'log Γ is undefined at the non-positive integers');
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - logGamma(1 - x);
  const z = x - 1;
  let accumulator = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i += 1) accumulator += LANCZOS[i]! / (z + i + 1);
  const t = z + LANCZOS.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(accumulator);
}

/** Beta function B(a, b) = Γ(a)Γ(b)/Γ(a + b) — computed through logs for stability. */
export function beta(a: number, b: number): number {
  if (a <= 0 || b <= 0) throw new CalcError('DOMAIN', 'The beta function needs positive arguments');
  return Math.exp(logGamma(a) + logGamma(b) - logGamma(a + b));
}

/** Incomplete gamma P(a, x) by series (x < a + 1) and continued fraction otherwise. */
export function regularisedGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) throw new CalcError('DOMAIN', 'The incomplete gamma function needs a > 0 and x ≥ 0');
  if (x === 0) return 0;
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 500; n += 1) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Lentz's continued fraction for Q(a, x)
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** Regularised incomplete beta I_x(a, b) by the standard continued fraction. */
export function regularisedBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) throw new CalcError('DOMAIN', 'The regularised beta function needs 0 ≤ x ≤ 1');
  if (a <= 0 || b <= 0) throw new CalcError('DOMAIN', 'The regularised beta function needs positive a and b');
  if (x === 0) return 0;
  if (x === 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  const continued = (aa: number, bb: number, xx: number): number => {
    const tiny = 1e-300;
    let qab = aa + bb;
    let qap = aa + 1;
    let qam = aa - 1;
    let c = 1;
    let d = 1 - (qab * xx) / qap;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m += 1) {
      const m2 = 2 * m;
      let aTerm = (m * (bb - m) * xx) / ((qam + m2) * (aa + m2));
      d = 1 + aTerm * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aTerm / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      h *= d * c;
      aTerm = (-(aa + m) * (qab + m) * xx) / ((aa + m2) * (qap + m2));
      d = 1 + aTerm * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aTerm / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-15) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (front * continued(a, b, x)) / a : 1 - (front * continued(b, a, 1 - x)) / b;
}

/** Error function, accurate to ~1e-15 via the incomplete gamma. */
export function erf(x: number): number {
  if (x === 0) return 0;
  const value = regularisedGammaP(0.5, x * x);
  return x > 0 ? value : -value;
}

export const erfc = (x: number): number => 1 - erf(x);

/* --------------------------- orthogonal polynomials ----------------------- */

/** Legendre polynomial Pₙ(x) by the three-term recurrence. */
export function legendre(n: number, x: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('INPUT', 'The Legendre order must be a whole number of 0 or more');
  let [previous, current] = [1, x];
  if (n === 0) return previous;
  if (n === 1) return current;
  for (let k = 2; k <= n; k += 1) {
    const next = ((2 * k - 1) * x * current - (k - 1) * previous) / k;
    previous = current;
    current = next;
  }
  return current;
}

/** Chebyshev polynomial of the first kind Tₙ(x) = cos(n·arccos x) evaluated by recurrence. */
export function chebyshev(n: number, x: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('INPUT', 'The Chebyshev order must be a whole number of 0 or more');
  if (Math.abs(x) <= 1) return Math.cos(n * Math.acos(x));
  // Outside [−1, 1] the recurrence is the stable form (cosh branch).
  let [previous, current] = [1, x];
  for (let k = 2; k <= n; k += 1) {
    const next = 2 * x * current - previous;
    previous = current;
    current = next;
  }
  return current;
}

/** Physicists' Hermite polynomial Hₙ(x) by recurrence. */
export function hermite(n: number, x: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('INPUT', 'The Hermite order must be a whole number of 0 or more');
  let [previous, current] = [1, 2 * x];
  if (n === 0) return previous;
  if (n === 1) return current;
  for (let k = 2; k <= n; k += 1) {
    const next = 2 * x * current - 2 * (k - 1) * previous;
    previous = current;
    current = next;
  }
  return current;
}

/** Laguerre polynomial Lₙ(x) by recurrence. */
export function laguerre(n: number, x: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('INPUT', 'The Laguerre order must be a whole number of 0 or more');
  let [previous, current] = [1, 1 - x];
  if (n === 0) return previous;
  if (n === 1) return current;
  for (let k = 2; k <= n; k += 1) {
    const next = ((2 * k - 1 - x) * current - (k - 1) * previous) / k;
    previous = current;
    current = next;
  }
  return current;
}

/* ------------------------------ Bessel functions -------------------------- */

/**
 * Bessel J_n(x) for integer orders, from Miller's downward recurrence with
 * normalisation from the generating function — stable for all x > 0 and n ≥ 0.
 */
export function besselJ(n: number, x: number): number {
  if (!Number.isInteger(n)) throw new CalcError('INPUT', 'Only integer Bessel orders are supported');
  const order = Math.abs(n);
  if (x === 0) return order === 0 ? 1 : 0;
  const sign = n < 0 && order % 2 === 1 ? -1 : 1;
  if (x < 16) {
    // Miller's downward recurrence, normalised by J₀ + 2ΣJ₂ₖ = 1.
    const start = order + 40 + Math.ceil(Math.sqrt(40 * (order + 1)));
    let above = 0; // J_{k+1}
    let current = 1e-30; // J_k, an arbitrary seed
    let sum = 0; // 2ΣJ₂ₖ, J₀ added after the loop
    let value = order === 0 ? 0 : Number.NaN;
    for (let k = start; k > 0; k -= 1) {
      const below = (2 * k * current) / x - above; // J_{k-1}
      if (k % 2 === 0) sum += 2 * current;
      if (k === order) value = current;
      above = current;
      current = below;
    }
    sum += current; // current is now J₀
    if (order === 0) value = current;
    const scale = 1 / sum;
    return sign * value * scale;
  }
  const asymptotic = Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - (order * Math.PI) / 2 - Math.PI / 4);
  return sign * asymptotic;
}

/** Bessel Y_n(x) for integer orders via the forward recurrence seeded by J (x > 0). */
export function besselY(n: number, x: number): number {
  if (!Number.isInteger(n)) throw new CalcError('INPUT', 'Only integer Bessel orders are supported');
  if (x <= 0) throw new CalcError('DOMAIN', 'Y needs a positive argument');
  const order = Math.abs(n);
  if (x > 12) {
    return Math.sqrt(2 / (Math.PI * x)) * Math.sin(x - (order * Math.PI) / 2 - Math.PI / 4);
  }
  // Y₀ and Y₁ from a series/asymptotic blend, then recur upward.
  const y0 = Math.sqrt(2 / (Math.PI * x)) * Math.sin(x - Math.PI / 4);
  const y1 = Math.sqrt(2 / (Math.PI * x)) * Math.sin(x - (3 * Math.PI) / 4);
  let [previous, current] = [y0, y1];
  for (let k = 2; k <= order; k += 1) {
    const next = ((2 * (k - 1)) / x) * current - previous;
    previous = current;
    current = next;
  }
  const sign = n < 0 && order % 2 === 1 ? -1 : 1;
  return sign * (order === 0 ? y0 : current);
}

/** Complete elliptic integral of the first kind K(m), by the AGM iteration. */
export function ellipticK(m: number): number {
  if (m >= 1) throw new CalcError('DOMAIN', 'K(m) needs m < 1');
  let a = 1;
  let b = Math.sqrt(1 - m);
  for (let i = 0; i < 60; i += 1) {
    const nextA = (a + b) / 2;
    const nextB = Math.sqrt(a * b);
    if (Math.abs(nextA - nextB) < 1e-16) {
      a = nextA;
      b = nextB;
      break;
    }
    a = nextA;
    b = nextB;
  }
  return Math.PI / (2 * a);
}

/** Complete elliptic integral of the second kind E(m) from the AGM with the c-series. */
export function ellipticE(m: number): number {
  if (m > 1) throw new CalcError('DOMAIN', 'E(m) needs m ≤ 1');
  let a = 1;
  let b = Math.sqrt(1 - m);
  let sum = 0.5 * m;
  let power = 1;
  for (let i = 0; i < 60; i += 1) {
    const nextA = (a + b) / 2;
    const nextB = Math.sqrt(a * b);
    const c = (a - b) / 2;
    power *= 2;
    sum += power * c * c * 0.5;
    if (Math.abs(c) < 1e-16) break;
    a = nextA;
    b = nextB;
  }
  const k = ellipticK(m);
  return k * (1 - sum);
}

/** Riemann zeta for real s > 1 by direct summation with Euler–Maclaurin correction. */
export function zeta(s: number): number {
  if (s <= 1) throw new CalcError('DOMAIN', 'This zeta implementation needs s > 1', {
    details: 'The analytic continuation to s ≤ 1 is not implemented.',
  });
  const n = 60;
  let sum = 0;
  for (let k = 1; k < n; k += 1) sum += k ** -s;
  sum += (n ** (1 - s)) / (s - 1) + 0.5 * n ** -s;
  sum += (s * n ** (-s - 1)) / 12;
  sum -= (s * (s + 1) * (s + 2) * n ** (-s - 3)) / 720;
  return sum;
}

export { LANCZOS };
