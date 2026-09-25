import { CalcError } from '@/core/errors';
import { toNumber } from '@/math/numbertheory';

/**
 * Combinatorics with exact integers wherever the answer is a count. Values that
 * overflow 2^53 are returned as BigInt text rather than a rounded double, and
 * anything that needs a non-integer input is rejected instead of approximated.
 */
export interface ExactCount {
  /** Plain number when it fits, otherwise null. */
  value: number | null;
  /** Exact decimal text of the result. */
  text: string;
}

const count = (value: bigint): ExactCount => {
  let number: number | null = null;
  try {
    number = toNumber(value);
  } catch {
    number = null;
  }
  return { value: number, text: value.toString() };
};

const requireWhole = (value: number, name: string): bigint => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new CalcError('INPUT', `${name} must be a whole number`);
  }
  return BigInt(value);
};

export function factorialBig(n: number): bigint {
  const value = requireWhole(n, 'The factorial argument');
  if (value < 0n) throw new CalcError('DOMAIN', 'Factorial is only defined for whole numbers of 0 or more');
  if (value > 100000n) throw new CalcError('OVERFLOW', 'That factorial is too large to compute here');
  let total = 1n;
  for (let i = 2n; i <= value; i += 1n) total *= i;
  return total;
}

/** Binomial coefficient C(n, k) — exact, and zero when k is out of range. */
export function binomial(n: number, k: number): ExactCount {
  const top = requireWhole(n, 'n');
  const bottom = requireWhole(k, 'k');
  if (top < 0n || bottom < 0n) throw new CalcError('INPUT', 'n and k must not be negative');
  if (bottom > top) return count(0n);
  let result = 1n;
  for (let i = 0n; i < bottom; i += 1n) {
    result = (result * (top - i)) / (i + 1n);
  }
  return count(result);
}

export const permutations = (n: number, k: number): ExactCount => {
  const top = requireWhole(n, 'n');
  const take = requireWhole(k, 'k');
  if (top < 0n || take < 0n) throw new CalcError('INPUT', 'n and k must not be negative');
  if (take > top) return count(0n);
  let result = 1n;
  for (let i = 0n; i < take; i += 1n) result *= top - i;
  return count(result);
};

/** C(n + k − 1, k): ways to choose k items from n types with repetition. */
export const combinationsWithRepetition = (n: number, k: number): ExactCount => {
  const types = requireWhole(n, 'n');
  const take = requireWhole(k, 'k');
  if (types <= 0n && take > 0n) throw new CalcError('INPUT', 'n must be positive');
  return binomial(Number(types + take - 1n), Number(take));
};

/** Multinomial coefficient (n; k₁, k₂, …) with the parts checked against n. */
export function multinomial(parts: number[]): ExactCount {
  const total = parts.reduce((sum, part) => sum + requireWhole(part, 'Each group size'), 0n);
  let remaining = total;
  let result = 1n;
  for (const part of parts) {
    const size = requireWhole(part, 'Each group size');
    const choose = binomial(Number(remaining), Number(size));
    result *= BigInt(choose.text);
    remaining -= size;
  }
  return count(result);
}

/** Derangements !n = n! Σ(−1)^k/k! — counts permutations with no fixed point. */
export function derangements(n: number): ExactCount {
  const value = requireWhole(n, 'n');
  if (value < 0n) throw new CalcError('INPUT', 'n must not be negative');
  const total = factorialBig(n);
  let result = total;
  for (let k = 1n; k <= value; k += 1n) {
    const term = total / factorialBig(Number(k));
    result += k % 2n === 1n ? -term : term;
  }
  return count(result);
}

/** Catalan number Cₙ = (1/(n+1))·C(2n, n). */
export function catalan(n: number): ExactCount {
  const value = requireWhole(n, 'n');
  if (value < 0n) throw new CalcError('INPUT', 'n must not be negative');
  const central = binomial(Number(2n * value), Number(value));
  return count(BigInt(central.text) / (value + 1n));
}

/** Catalan via the recurrence, used for lists of values. */
export function catalanSequence(n: number): ExactCount[] {
  return Array.from({ length: Math.max(0, n) }, (_, index) => catalan(index));
}

/** Stirling numbers of the second kind: ways to partition n items into k blocks. */
export function stirlingSecond(n: number, k: number): ExactCount {
  const items = requireWhole(n, 'n');
  const blocks = requireWhole(k, 'k');
  if (items < 0n || blocks < 0n) throw new CalcError('INPUT', 'n and k must not be negative');
  if (blocks === 0n) return count(items === 0n ? 1n : 0n);
  if (blocks > items) return count(0n);
  // S(n, k) = 1/k! · Σ_{j=0..k} (−1)^j C(k, j)(k − j)^n
  let total = 0n;
  for (let j = 0n; j <= blocks; j += 1n) {
    const term = BigInt(binomial(Number(blocks), Number(j)).text) * (blocks - j) ** items;
    total += j % 2n === 0n ? term : -term;
  }
  return count(total / factorialBig(Number(blocks)));
}

/** Unsigned Stirling numbers of the first kind: permutations of n with k cycles. */
export function stirlingFirst(n: number, k: number): ExactCount {
  const items = requireWhole(n, 'n');
  const cycles = requireWhole(k, 'k');
  if (items < 0n || cycles < 0n) throw new CalcError('INPUT', 'n and k must not be negative');
  if (items === 0n && cycles === 0n) return count(1n);
  if (cycles === 0n || cycles > items) return count(0n);
  let row: bigint[] = [1n];
  for (let i = 1n; i <= items; i += 1n) {
    const next = new Array<bigint>(Number(i) + 1).fill(0n);
    for (let j = 1n; j <= i; j += 1n) {
      const fromPrevious = row[Number(j) - 1] ?? 0n;
      const fromSame = row[Number(j)] ?? 0n;
      next[Number(j)] = fromPrevious + (i - 1n) * fromSame;
    }
    row = next;
  }
  return count(row[Number(cycles)] ?? 0n);
}

/** Bell number Bₙ — the number of partitions of n items — from the Stirling triangle. */
export function bell(n: number): ExactCount {
  const value = requireWhole(n, 'n');
  if (value < 0n) throw new CalcError('INPUT', 'n must not be negative');
  let total = 0n;
  for (let k = 0n; k <= value; k += 1n) total += BigInt(stirlingSecond(Number(value), Number(k)).text);
  return count(total);
}

export function bellTriangle(rows: number): ExactCount[][] {
  const triangle: bigint[][] = [[1n]];
  for (let i = 1; i < Math.max(1, rows); i += 1) {
    const previous = triangle[i - 1]!;
    const row: bigint[] = [previous[previous.length - 1]!];
    for (let j = 1; j <= i; j += 1) row.push(row[j - 1]! + previous[j - 1]!);
    triangle.push(row);
  }
  return triangle.map((row) => row.map((value) => count(value)));
}

export { count };
