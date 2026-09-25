import { CalcError } from '@/core/errors';

/**
 * Number theory over exact integers.
 *
 * Everything that can exceed 2^53 is computed with BigInt (modular
 * exponentiation, the factorial-style growth in Pollard's rho, the Chinese
 * remainder theorem), so no result is silently rounded through a double.
 * Probabilistic routines (primality, factorisation) state that they are such.
 */
export type Integer = number | bigint;

const toBig = (value: Integer): bigint => (typeof value === 'bigint' ? value : BigInt(Math.trunc(value)));

export function toNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CalcError('OVERFLOW', 'That result is too large to show exactly as a number', {
      details: `The exact value needs ${value.toString().length} digits.`,
    });
  }
  return Number(value);
}

/** Exact value as a string, with the plain number given when it fits. */
export function exact(value: bigint): { value: number | null; text: string } {
  const text = value.toString();
  const fits = value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= -BigInt(Number.MAX_SAFE_INTEGER);
  return { value: fits ? Number(value) : null, text };
}

export function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function gcdBig(a: Integer, b: Integer): bigint {
  let x = absBig(toBig(a));
  let y = absBig(toBig(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

export const lcmBig = (a: Integer, b: Integer): bigint => {
  const x = absBig(toBig(a));
  const y = absBig(toBig(b));
  if (x === 0n || y === 0n) return 0n;
  return (x / gcdBig(x, y)) * y;
};

/** Extended Euclid: returns (g, x, y) with a·x + b·y = g = gcd(a, b). */
export function extendedGcd(a: Integer, b: Integer): { gcd: bigint; x: bigint; y: bigint } {
  let [oldR, r] = [toBig(a), toBig(b)];
  let [oldS, s] = [1n, 0n];
  let [oldT, t] = [0n, 1n];
  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
    [oldT, t] = [t, oldT - quotient * t];
  }
  if (oldR < 0n) return { gcd: -oldR, x: -oldS, y: -oldT };
  return { gcd: oldR, x: oldS, y: oldT };
}

export function modPow(base: Integer, exponent: Integer, modulus: Integer): bigint {
  const m = absBig(toBig(modulus));
  if (m === 0n) throw new CalcError('INPUT', 'A modulus of zero is not allowed');
  if (m === 1n) return 0n;
  let e = toBig(exponent);
  if (e < 0n) {
    const inverse = modInverse(base, m);
    if (inverse === null) throw new CalcError('INPUT', 'That base has no inverse, so a negative exponent is undefined');
    return modPow(inverse, -e, m);
  }
  let result = 1n;
  let b = ((toBig(base) % m) + m) % m;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

export function modInverse(value: Integer, modulus: Integer): bigint | null {
  const m = absBig(toBig(modulus));
  if (m === 0n) return null;
  const { gcd, x } = extendedGcd(value, m);
  if (gcd !== 1n) return null;
  return ((x % m) + m) % m;
}

/** Deterministic Miller–Rabin: the witness set below is proven correct under 3.3·10^24. */
const WITNESSES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

export function isPrime(value: Integer): boolean {
  const n = toBig(value);
  if (n < 2n) return false;
  for (const small of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === small) return true;
    if (n % small === 0n) return false;
  }

  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    r += 1n;
  }
  for (const witness of WITNESSES) {
    if (witness >= n) continue;
    let x = modPow(witness, d, n);
    if (x === 1n || x === n - 1n) continue;
    let composite = true;
    for (let i = 1n; i < r; i += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

function pollardRho(n: bigint): bigint {
  if (n % 2n === 0n) return 2n;
  let c = 1n;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    let x = 2n + BigInt(attempt);
    let y = x;
    let d = 1n;
    const f = (value: bigint) => (value * value + c) % n;
    let steps = 0;
    while (d === 1n && steps < 100000) {
      x = f(x);
      y = f(f(y));
      d = gcdBig(absBig(x - y), n);
      steps += 1;
    }
    if (d !== n && d !== 1n) return d;
    c += 1n;
  }
  return n;
}

/** Prime factorisation with exponents, ascending. Uses trial division then Pollard's rho. */
export function factorise(value: Integer): { prime: bigint; exponent: number }[] {
  let n = absBig(toBig(value));
  if (n <= 1n) return [];
  const factors = new Map<string, { prime: bigint; exponent: number }>();
  const add = (prime: bigint): void => {
    const entry = factors.get(prime.toString());
    if (entry) entry.exponent += 1;
    else factors.set(prime.toString(), { prime, exponent: 1 });
  };

  for (let p = 2n; p <= 100000n && p * p <= n; p += 1n) {
    while (n % p === 0n) {
      add(p);
      n /= p;
    }
  }
  const stack: bigint[] = n > 1n ? [n] : [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === 1n) continue;
    if (isPrime(current)) {
      add(current);
      continue;
    }
    const divisor = pollardRho(current);
    if (divisor === current) {
      add(current);
      continue;
    }
    stack.push(divisor, current / divisor);
  }
  return [...factors.values()].sort((a, b) => (a.prime < b.prime ? -1 : a.prime > b.prime ? 1 : 0));
}

export function primeFactorisationText(value: Integer): string {
  const factors = factorise(value);
  if (factors.length === 0) return String(toBig(value));
  const negative = toBig(value) < 0n ? '-' : '';
  return negative + factors.map(({ prime, exponent }) => (exponent === 1 ? `${prime}` : `${prime}^${exponent}`)).join(' × ');
}

export function divisors(value: Integer): bigint[] {
  const factors = factorise(value);
  let list: bigint[] = [1n];
  for (const { prime, exponent } of factors) {
    const next: bigint[] = [];
    let power = 1n;
    for (let i = 0; i <= exponent; i += 1) {
      for (const existing of list) next.push(existing * power);
      power *= prime;
    }
    list = next;
  }
  return list.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function divisorSum(value: Integer): bigint {
  return divisors(value).reduce((total, divisor) => total + divisor, 0n);
}

/** Euler's totient from the factorisation (exact). */
export function eulerPhi(value: Integer): bigint {
  let n = absBig(toBig(value));
  if (n === 0n) return 0n;
  let result = n;
  for (const { prime } of factorise(n)) {
    result = (result / prime) * (prime - 1n);
  }
  return result;
}

/** Möbius μ(n): 0 when divisible by a square, otherwise (−1)^(number of prime factors). */
export function mobius(value: Integer): number {
  const n = absBig(toBig(value));
  if (n === 0n) return 0;
  if (n === 1n) return 1;
  for (const { exponent } of factorise(n)) if (exponent > 1) return 0;
  return factorise(n).length % 2 === 0 ? 1 : -1;
}

/** Number of divisors, σ₀. */
export function divisorCount(value: Integer): bigint {
  return factorise(value).reduce((total, { exponent }) => total * BigInt(exponent + 1), 1n);
}

/** Chinese remainder theorem for pairwise-coprime moduli; null when no solution exists. */
export function chineseRemainder(
  residues: Integer[],
  moduli: Integer[],
): { value: bigint; modulus: bigint } | null {
  if (residues.length === 0 || residues.length !== moduli.length) return null;
  let total = 0n;
  let modulus = 1n;
  for (let i = 0; i < residues.length; i += 1) {
    const m = absBig(toBig(moduli[i]!));
    if (m === 0n) return null;
    const r = ((toBig(residues[i]!) % m) + m) % m;
    const { gcd, x } = extendedGcd(modulus, m);
    if ((r - total) % gcd !== 0n) return null; // non-coprime and incompatible
    const lcm = (modulus / gcd) * m;
    const step = ((((r - total) / gcd) * x) % (m / gcd) + (m / gcd)) % (m / gcd);
    total = ((total + modulus * step) % lcm + lcm) % lcm;
    modulus = lcm;
  }
  return { value: total, modulus };
}

export function nextPrime(value: Integer): bigint {
  let candidate = absBig(toBig(value)) + 1n;
  if (candidate < 2n) return 2n;
  while (!isPrime(candidate)) candidate += 1n;
  return candidate;
}

export function previousPrime(value: Integer): bigint | null {
  let candidate = toBig(value) - 1n;
  while (candidate >= 2n) {
    if (isPrime(candidate)) return candidate;
    candidate -= 1n;
  }
  return null;
}

/** Modular arithmetic helper: (a op b) mod n with the operator chosen by name. */
export function modularArithmetic(
  a: Integer,
  b: Integer,
  modulus: Integer,
  operator: 'add' | 'sub' | 'mul' | 'div' | 'pow',
): bigint {
  const m = absBig(toBig(modulus));
  if (m === 0n) throw new CalcError('INPUT', 'A modulus of zero is not allowed');
  const normalise = (value: bigint) => ((value % m) + m) % m;
  switch (operator) {
    case 'add':
      return normalise(toBig(a) + toBig(b));
    case 'sub':
      return normalise(toBig(a) - toBig(b));
    case 'mul':
      return normalise(toBig(a) * toBig(b));
    case 'div': {
      const inverse = modInverse(b, m);
      if (inverse === null) {
        throw new CalcError('INPUT', 'That divisor has no inverse modulo this number', {
          details: 'The divisor and the modulus must be coprime.',
        });
      }
      return normalise(toBig(a) * inverse);
    }
    case 'pow':
      return modPow(a, b, m);
  }
}

/** Big-integer nth root, exact when the root is a whole number. */
export function integerRoot(value: Integer, degree: number): bigint {
  const n = toBig(value);
  if (degree === 1) return n;
  if (n < 0n) {
    if (degree % 2 === 0) throw new CalcError('DOMAIN', 'An even root of a negative number is not real');
    return -integerRoot(-n, degree);
  }
  if (n < 2n) return n;
  let low = 0n;
  let high = 1n;
  while (high ** BigInt(degree) <= n) high *= 2n;
  while (high - low > 1n) {
    const middle = (low + high) / 2n;
    if (middle ** BigInt(degree) <= n) low = middle;
    else high = middle;
  }
  return low;
}

export { toBig };
