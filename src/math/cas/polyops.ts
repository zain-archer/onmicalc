import {
  add as addNode,
  sub as subNode,
  canonical,
  containsVariable,
  evaluateAt,
  format,
  id,
  isNumber,
  mul as mulNode,
  num,
  parseNode,
  pow as powNode,
  type Node,
} from './ast';

/**
 * Polynomials whose coefficients are numbers are the backbone of the CAS:
 * extraction, arithmetic, division, gcd, square-free factorisation, Sturm
 * sequences and root counting. Coefficients are stored ascending, so
 * `[1, 0, 2]` is 1 + 0·x + 2·x².
 */
export type Polynomial = number[];

export class PolynomialError extends Error {}

/** Drops trailing (highest-order) zero coefficients. */
export function trim(poly: Polynomial): Polynomial {
  const out = [...poly];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out.length === 0 ? [0] : out;
}

export const isZeroPoly = (poly: Polynomial): boolean => poly.every((c) => c === 0);
export const degree = (poly: Polynomial): number => trim(poly).length - 1;

export const polyAdd = (a: Polynomial, b: Polynomial): Polynomial =>
  trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0)));

export const polySub = (a: Polynomial, b: Polynomial): Polynomial =>
  trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) - (b[i] ?? 0)));

export const polyScale = (a: Polynomial, factor: number): Polynomial => trim(a.map((c) => c * factor));

export function polyMultiply(a: Polynomial, b: Polynomial): Polynomial {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) out[i + j] += a[i]! * b[j]!;
  }
  return trim(out);
}

export function polyDerivative(poly: Polynomial): Polynomial {
  if (poly.length <= 1) return [0];
  return trim(poly.slice(1).map((c, i) => c * (i + 1)));
}

export function polyEvaluate(poly: Polynomial, x: number): number {
  let total = 0;
  for (let i = poly.length - 1; i >= 0; i -= 1) total = total * x + poly[i]!;
  return total;
}

export interface Division {
  quotient: Polynomial;
  remainder: Polynomial;
}

/** Long division; throws only for a zero divisor. */
/** Flushes coefficients that are zero up to floating-point noise. */
export function snap(poly: Polynomial): Polynomial {
  const scale = Math.max(1, ...poly.map((c) => Math.abs(c)));
  return trim(poly.map((c) => (Math.abs(c) < 1e-10 * scale ? 0 : c)));
}

/** Long division; throws only for a zero divisor. Bounded so it can never hang. */
export function polyDivide(numerator: Polynomial, denominator: Polynomial): Division {
  const divisor = trim(denominator);
  if (isZeroPoly(divisor)) throw new PolynomialError('Cannot divide by the zero polynomial');
  let remainder = trim(numerator);
  const quotient = new Array<number>(Math.max(1, remainder.length - divisor.length + 1)).fill(0);
  const lead = divisor[divisor.length - 1]!;
  let guard = 0;
  while (!isZeroPoly(remainder) && remainder.length >= divisor.length && guard < 500) {
    guard += 1;
    const shift = remainder.length - divisor.length;
    const factor = remainder[remainder.length - 1]! / lead;
    quotient[shift] = factor;
    // Ascending-order arrays: multiplying by x^shift prepends zeros.
    const product = (new Array<number>(shift).fill(0) as number[]).concat(polyScale(divisor, factor));
    remainder = snap(trim(polySub(remainder, product)));
  }
  return { quotient: snap(trim(quotient)), remainder: snap(remainder) };
}

/** Synthetic division by (x - root); returns quotient and the remainder value. */
export function syntheticDivide(poly: Polynomial, root: number): { quotient: Polynomial; remainder: number } {
  const coefficients = trim(poly);
  const out = new Array<number>(Math.max(1, coefficients.length - 1)).fill(0);
  let carry = 0;
  for (let i = coefficients.length - 1; i >= 1; i -= 1) {
    carry = coefficients[i]! + carry * root;
    out[i - 1] = carry;
  }
  return { quotient: trim(out), remainder: coefficients[0]! + carry * root };
}

/** Monic polynomial gcd over the rationals (Euclidean algorithm, scaled to monic). */
export function polyGcd(a: Polynomial, b: Polynomial): Polynomial {
  let left = monic(trim(a));
  let right = monic(trim(b));
  let guard = 0;
  while (!isZeroPoly(right) && guard < 200) {
    const { remainder } = polyDivide(left, right);
    left = right;
    right = monic(trim(remainder));
    guard += 1;
  }
  return isZeroPoly(left) ? [1] : left;
}

export const polyLcm = (a: Polynomial, b: Polynomial): Polynomial => {
  const g = polyGcd(a, b);
  if (isZeroPoly(g) || isZeroPoly(a) || isZeroPoly(b)) return [0];
  const { quotient } = polyDivide(polyMultiply(a, b), g);
  return monic(quotient);
};

export function monic(poly: Polynomial): Polynomial {
  const p = trim(poly);
  const lead = p[p.length - 1]!;
  if (lead === 0 || lead === 1) return p;
  return trim(p.map((c) => c / lead));
}

export function rationalRoots(poly: Polynomial): number[] {
  const p = trim(poly);
  if (p.length <= 1) return [];
  const a0 = Math.round(p[0]!);
  const an = Math.round(p[p.length - 1]!);
  if (a0 === 0) return [0];
  if (an === 0) return [];
  const divisors = (n: number): number[] => {
    const abs = Math.round(Math.abs(n));
    const out: number[] = [];
    // Bounded: a coefficient beyond 10^7 is not a realistic rational root puzzle,
    // and an unbounded loop here would freeze the app.
    for (let d = 1; d <= Math.min(abs, 10_000_000); d += 1) if (abs % d === 0) out.push(d);
    return out;
  };
  const found: number[] = [];
  // p/q in lowest terms: p divides the constant term, q divides the leading one.
  for (const p1 of divisors(a0)) {
    for (const q1 of divisors(an)) {
      for (const sign of [1, -1]) {
        const candidate = (sign * p1) / q1;
        if (found.includes(candidate)) continue;
        if (Math.abs(polyEvaluate(p, candidate)) < 1e-9) found.push(candidate);
      }
    }
  }
  return found.sort((x, y) => x - y);
}

/** Multiplicity of a root, by repeated synthetic division. */
export function rootMultiplicity(poly: Polynomial, root: number): number {
  let p = trim(poly);
  let count = 0;
  while (p.length > 1) {
    const { quotient, remainder } = syntheticDivide(p, root);
    if (Math.abs(remainder) > 1e-9) break;
    count += 1;
    p = trim(quotient);
  }
  return count;
}

/**
 * Square-free decomposition over the rationals.
 *
 * Every rational root is extracted with its multiplicity; whatever polynomial
 * is left over is reported once, flagged when it still contains repeated
 * (irrational or complex) factors — the caller can then see exactly what the
 * exact factorisation does and does not cover.
 */
export function squareFree(poly: Polynomial): { factor: Polynomial; multiplicity: number; squareFree?: boolean }[] {
  const factors: { factor: Polynomial; multiplicity: number; squareFree?: boolean }[] = [];
  let remaining = trim(poly);

  for (let guard = 0; guard < 32 && degree(remaining) > 0; guard += 1) {
    const roots = rationalRoots(remaining);
    if (roots.length === 0) break;
    const root = roots[0]!;
    const multiplicity = rootMultiplicity(remaining, root);
    if (multiplicity === 0) break;
    factors.push({ factor: [-root, 1], multiplicity });
    for (let i = 0; i < multiplicity; i += 1) {
      remaining = trim(polyDivide(remaining, [-root, 1]).quotient);
    }
  }

  if (degree(remaining) > 0) {
    const shared = polyGcd(remaining, polyDerivative(remaining));
    factors.push({ factor: monic(remaining), multiplicity: 1, squareFree: degree(shared) === 0 });
  }
  return factors;
}

/** Discriminant of a quadratic or cubic (the cases with a closed formula). */
export function discriminant(poly: Polynomial): number | null {
  const p = trim(poly);
  if (p.length === 3) return p[1]! ** 2 - 4 * p[2]! * p[0]!;
  if (p.length === 4) {
    const [d, c, b, a] = [p[0]!, p[1]!, p[2]!, p[3]!];
    return 18 * a * b * c * d - 4 * a * c ** 3 - 27 * a * a * d * d + b * b * c * c - 4 * b ** 3 * d;
  }
  return null;
}

/** Sturm sequence — how many distinct real roots a polynomial has in (a, b]. */
export function sturmSequence(poly: Polynomial): Polynomial[] {
  const sequence: Polynomial[] = [trim(poly)];
  if (degree(poly) < 1) return sequence;
  sequence.push(polyDerivative(poly));
  let guard = 0;
  while (degree(sequence[sequence.length - 1]!) > 0 && guard < 200) {
    const { remainder } = polyDivide(sequence[sequence.length - 2]!, sequence[sequence.length - 1]!);
    if (isZeroPoly(remainder)) break;
    sequence.push(polyScale(trim(remainder), -1));
    guard += 1;
  }
  return sequence;
}

const signChanges = (sequence: Polynomial[], x: number): number => {
  let changes = 0;
  let previous = 0;
  for (const poly of sequence) {
    const value = polyEvaluate(poly, x);
    const sign = Math.abs(value) < 1e-12 ? 0 : Math.sign(value);
    if (sign === 0) continue;
    if (previous !== 0 && sign !== previous) changes += 1;
    previous = sign;
  }
  return changes;
};

/** Distinct real roots in the half-open interval (a, b], via Sturm's theorem. */
export function realRootsBetween(poly: Polynomial, a: number, b: number): number {
  const sequence = sturmSequence(poly);
  return Math.max(0, signChanges(sequence, a) - signChanges(sequence, b));
}

/* ------------------------------------------------------------------ */
/* AST ↔ polynomial                                                    */
/* ------------------------------------------------------------------ */

/**
 * Reads a node as a polynomial in `variable`. Returns null when the expression
 * is not a polynomial (a trig call, a negative or symbolic power, …), which is
 * how the CAS decides to fall back instead of guessing.
 */
export function toPolynomial(node: Node, variable: string): Polynomial | null {
  switch (node.type) {
    case 'number':
      return [node.value];
    case 'identifier':
      if (node.name === variable) return [0, 1];
      return null;
    case 'unary': {
      const inner = toPolynomial(node.operand, variable);
      if (!inner) return null;
      return node.operator === '-' ? polyScale(inner, -1) : inner;
    }
    case 'binary': {
      switch (node.operator) {
        case '+':
        case '-': {
          const left = toPolynomial(node.left, variable);
          const right = toPolynomial(node.right, variable);
          if (!left || !right) return null;
          return node.operator === '+' ? polyAdd(left, right) : polySub(left, right);
        }
        case '*': {
          const left = toPolynomial(node.left, variable);
          const right = toPolynomial(node.right, variable);
          if (!left || !right) return null;
          return polyMultiply(left, right);
        }
        case '/': {
          const left = toPolynomial(node.left, variable);
          const right = toPolynomial(node.right, variable);
          if (!left || !right || degree(right) !== 0) return null;
          const divisor = right[0]!;
          return divisor === 0 ? null : polyScale(left, 1 / divisor);
        }
        case '^': {
          const base = toPolynomial(node.left, variable);
          if (!base) return null;
          const exponent = isNumber(node.right)
            ? node.right.value
            : (() => {
                const poly = toPolynomial(node.right, variable);
                return poly && degree(poly) === 0 ? poly[0]! : null;
              })();
          if (exponent === null || !Number.isInteger(exponent) || exponent < 0 || exponent > 64) return null;
          let out: Polynomial = [1];
          for (let i = 0; i < exponent; i += 1) out = polyMultiply(out, base);
          return out;
        }
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

/** Polynomial source text → coefficients, or null when it is not polynomial. */
export function polynomialOf(source: string, variable = 'x'): Polynomial | null {
  try {
    return toPolynomial(parseNode(source), variable);
  } catch {
    return null;
  }
}

export function polynomialToNode(poly: Polynomial, variable: string): Node {
  const p = trim(poly);
  let result: Node | null = null;
  // Highest power first, the way a textbook writes a polynomial.
  for (let power = p.length - 1; power >= 0; power -= 1) {
    const coefficient = p[power]!;
    if (coefficient === 0) continue;
    const magnitude = Math.abs(coefficient);
    let term: Node;
    if (power === 0) term = num(magnitude);
    else {
      const variablePart = power === 1 ? id(variable) : powNode(id(variable), num(power));
      term = magnitude === 1 ? variablePart : mulNode(num(magnitude), variablePart);
    }
    if (result === null) result = coefficient < 0 ? { type: 'unary', operator: '-', operand: term, start: 0, end: 0 } : term;
    else result = coefficient < 0 ? subNode(result, term) : addNode(result, term);
  }
  return canonical(result ?? num(0));
}

export function polynomialToString(poly: Polynomial, variable = 'x'): string {
  return format(polynomialToNode(poly, variable));
}

/** Convenience: is this node a polynomial in the variable with rational coefficients? */
export const isPolynomialIn = (node: Node, variable = 'x'): boolean => toPolynomial(node, variable) !== null;

/** True when the node mentions the variable at all. */
export const mentions = (node: Node, variable = 'x'): boolean => containsVariable(node, variable);

export { evaluateAt };
