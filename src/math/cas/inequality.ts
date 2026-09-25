import { limit as calcLimit } from '@/math/calculus';
import { evaluateAt, parseNode, type Node } from './ast';
import { degree, polyDivide, polyEvaluate, polynomialOf, rationalRoots, trim, type Polynomial } from './polyops';
import { roundNice } from './partial';

/**
 * Inequalities in one variable: move everything to one side, factor what can be
 * factored, find every real root (exact for rational roots, bisection for the
 * rest) and read the sign of each interval. The solution is returned as
 * intervals and checked by sampling, so a wrong sign cannot slip through.
 */
export type Comparator = '<' | '<=' | '>' | '>=';

export interface Interval {
  from: number;
  to: number;
  openLeft: boolean;
  openRight: boolean;
}

export interface InequalitySolution {
  /** Standard form: expression on the left, 0 on the right. */
  normalised: string;
  comparator: Comparator;
  boundaries: number[];
  intervals: Interval[];
  /** Interval notation, e.g. `(-∞, 2) ∪ (3, ∞)`. */
  notation: string;
  steps: string[];
  verification: { checked: number; agrees: boolean; note: string };
}

const COMPARATORS: { token: Comparator; pattern: RegExp }[] = [
  { token: '<=', pattern: /<=|≤/ },
  { token: '>=', pattern: />=|≥/ },
  { token: '<', pattern: /</ },
  { token: '>', pattern: />/ },
];

export function parseInequality(source: string): { left: string; right: string; comparator: Comparator } | null {
  const text = source.replace(/\s+/g, ' ').trim();
  for (const { token, pattern } of COMPARATORS) {
    // The comparator is wrapped in a group so an alternation cannot swallow the
    // rest of the pattern (regex precedence would otherwise break `<=`).
    const match = text.match(new RegExp(`^(.*?)(?:${pattern.source})(.*)$`));
    if (match) {
      const left = match[1]!.trim();
      const right = match[2]!.trim();
      if (left && right) return { left, right, comparator: token };
    }
  }
  return null;
}

/** All real roots of a polynomial: exact rationals, then bisection refinements. */
export function realRoots(poly: Polynomial, bounds = 1000): number[] {
  const p = trim(poly);
  if (degree(p) < 1) return [];
  const found = rationalRoots(p);

  // Deflate the rational roots, then scan for sign changes to catch irrational ones.
  let rest = p;
  for (const root of [...found].sort((a, b) => a - b)) {
    let guard = 0;
    while (guard < 8) {
      const { quotient, remainder } = syntheticCheck(rest, root);
      if (Math.abs(remainder) > 1e-9) break;
      rest = trim(quotient);
      guard += 1;
    }
  }

  const scan = (poly: Polynomial, from: number, to: number, depth: number): void => {
    if (depth > 6) return;
    const step = (to - from) / 64;
    let previousX = from;
    let previousValue = polyEvaluate(poly, from);
    for (let i = 1; i <= 64; i += 1) {
      const x = from + step * i;
      const value = polyEvaluate(poly, x);
      if (Number.isFinite(previousValue) && Number.isFinite(value) && Math.sign(previousValue) !== Math.sign(value)) {
        const root = bisect(poly, previousX, x);
        if (found.every((known) => Math.abs(known - root) > 1e-7)) found.push(root);
      }
      previousX = x;
      previousValue = value;
    }
  };
  scan(rest, -bounds, bounds, 0);

  // Catch double roots (no sign change) by scanning the derivative as well.
  const derivative = p.slice(1).map((c, i) => c * (i + 1));
  if (derivative.length > 1) {
    const critical = realRoots(derivative, bounds);
    for (const point of critical) {
      if (found.every((known) => Math.abs(known - point) > 1e-7) && Math.abs(polyEvaluate(p, point)) < 1e-9) {
        found.push(point);
      }
    }
  }

  return found.sort((a, b) => a - b).map(roundNice);
}

function syntheticCheck(poly: Polynomial, root: number): { quotient: Polynomial; remainder: number } {
  const coefficients = trim(poly);
  const out = new Array<number>(Math.max(1, coefficients.length - 1)).fill(0);
  let carry = 0;
  for (let i = coefficients.length - 1; i >= 1; i -= 1) {
    carry = coefficients[i]! + carry * root;
    out[i - 1] = carry;
  }
  return { quotient: trim(out), remainder: coefficients[0]! + carry * root };
}

function bisect(poly: Polynomial, low: number, high: number): number {
  let a = low;
  let b = high;
  let fa = polyEvaluate(poly, a);
  for (let i = 0; i < 200; i += 1) {
    const mid = (a + b) / 2;
    const fm = polyEvaluate(poly, mid);
    if (fm === 0 || (b - a) / 2 < 1e-12) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

function satisfies(value: number, comparator: Comparator): boolean {
  switch (comparator) {
    case '<':
      return value < 0;
    case '<=':
      return value <= 0;
    case '>':
      return value > 0;
    case '>=':
      return value >= 0;
  }
}

export function solveInequality(source: string, variable = 'x'): InequalitySolution | null {
  const parsed = parseInequality(source);
  if (!parsed) return null;

  const leftPoly = polynomialOf(parsed.left, variable);
  const rightPoly = polynomialOf(parsed.right, variable);
  if (!leftPoly || !rightPoly) return null;
  const difference = trim(leftPoly.map((c, i) => c - (rightPoly[i] ?? 0)));

  if (degree(difference) < 1) {
    const constant = difference[0] ?? 0;
    const holds = satisfies(constant, parsed.comparator);
    return {
      normalised: `${roundNice(constant)} ${parsed.comparator} 0`,
      comparator: parsed.comparator,
      boundaries: [],
      intervals: holds ? [{ from: -Infinity, to: Infinity, openLeft: true, openRight: true }] : [],
      notation: holds ? '(-∞, ∞)' : 'no solution',
      steps: holds
        ? ['The variable cancels and the statement is always true']
        : ['The variable cancels and the statement is never true'],
      verification: { checked: 0, agrees: true, note: 'no variable left to check' },
    };
  }

  const boundaries = realRoots(difference);
  const steps: string[] = [
    `Move everything to one side: ${polynomialText(difference, variable)} ${parsed.comparator} 0`,
    boundaries.length === 0
      ? 'No real roots, so the sign is the same everywhere'
      : `Real roots: ${boundaries.map((root) => roundNice(root)).join(', ')}`,
  ];

  // Factor out the roots so repeated roots are visible in the explanation.
  const multiplicities = boundaries.map((root) => multiplicityAt(difference, root));
  if (multiplicities.some((m) => m > 1)) {
    steps.push(
      `Repeated roots: ${boundaries
        .map((root, index) => (multiplicities[index]! > 1 ? `${roundNice(root)} (×${multiplicities[index]})` : null))
        .filter(Boolean)
        .join(', ')}`,
    );
  }

  const cuts = [...boundaries];
  const intervals: Interval[] = [];
  const points = [-Infinity, ...cuts, Infinity];
  const closed = parsed.comparator === '<=' || parsed.comparator === '>=';

  for (let i = 0; i + 1 < points.length; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const probe =
      from === -Infinity && to === Infinity
        ? 0
        : from === -Infinity
          ? to - 1
          : to === Infinity
            ? from + 1
            : (from + to) / 2;
    const value = polyEvaluate(difference, probe);
    const holds = closed ? satisfies(value, parsed.comparator) || Math.abs(value) < 1e-12 : satisfies(value, parsed.comparator);
    if (!holds) continue;
    intervals.push({
      from,
      to,
      openLeft: from === -Infinity ? true : !closed,
      openRight: to === Infinity ? true : !closed,
    });
  }

  // Roots themselves belong to the solution for ≤ and ≥.
  if (closed) {
    for (const root of boundaries) {
      const merged = intervals.some((interval) => root > interval.from && root < interval.to);
      if (!merged) {
        const touching = intervals.find(
          (interval) => Math.abs(interval.to - root) < 1e-9 || Math.abs(interval.from - root) < 1e-9,
        );
        if (touching) {
          if (Math.abs(touching.to - root) < 1e-9) touching.openRight = false;
          if (Math.abs(touching.from - root) < 1e-9) touching.openLeft = false;
        } else {
          intervals.push({ from: root, to: root, openLeft: false, openRight: false });
        }
      }
    }
  }

  const merged = mergeIntervals(intervals);
  const verification = verifyIntervals(difference, parsed.comparator, boundaries, merged);

  return {
    normalised: `${polynomialText(difference, variable)} ${parsed.comparator} 0`,
    comparator: parsed.comparator,
    boundaries,
    intervals: merged,
    notation: toNotation(merged),
    steps: [...steps, `Solution: ${toNotation(merged)}`],
    verification,
  };
}

function multiplicityAt(poly: Polynomial, root: number): number {
  let current = trim(poly);
  let count = 0;
  while (current.length > 1 && count < 20) {
    const { quotient, remainder } = syntheticCheck(current, root);
    if (Math.abs(remainder) > 1e-9) break;
    current = trim(quotient);
    count += 1;
  }
  return count;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  const out: Interval[] = [];
  for (const interval of sorted) {
    const last = out[out.length - 1];
    if (last && interval.from <= last.to + 1e-12 && !(last.openRight && interval.openLeft)) {
      last.to = Math.max(last.to, interval.to);
      last.openRight = interval.openRight;
    } else {
      out.push({ ...interval });
    }
  }
  return out;
}

function verifyIntervals(
  difference: Polynomial,
  comparator: Comparator,
  boundaries: number[],
  intervals: Interval[],
): { checked: number; agrees: boolean; note: string } {
  const inSolution = (x: number): boolean =>
    intervals.some((interval) => x > interval.from - 1e-12 && x < interval.to + 1e-12);
  const margin = boundaries.length > 0 ? Math.max(1, Math.abs(boundaries[0]!)) : 1;
  const samples = [-2.5 * margin, -0.5 * margin, 0.5 * margin, 2.5 * margin].filter(
    (x) => boundaries.every((root) => Math.abs(x - root) > 1e-6),
  );
  let checked = 0;
  let agrees = true;
  for (const x of samples) {
    const value = polyEvaluate(difference, x);
    if (Math.abs(value) < 1e-12) continue;
    checked += 1;
    if (satisfies(value, comparator) !== inSolution(x)) agrees = false;
  }
  return {
    checked,
    agrees: checked >= 2 && agrees,
    note: 'sample points from each interval were substituted back into the inequality',
  };
}

function toNotation(intervals: Interval[]): string {
  if (intervals.length === 0) return 'no solution';
  if (intervals.length === 1 && intervals[0]!.from === -Infinity && intervals[0]!.to === Infinity) return '(-∞, ∞)';
  return intervals
    .map((interval) => {
      const left = interval.from === -Infinity ? '-∞' : roundNice(interval.from);
      const right = interval.to === Infinity ? '∞' : roundNice(interval.to);
      if (interval.from === interval.to && !interval.openLeft && !interval.openRight) return `{${left}}`;
      return `${interval.openLeft ? '(' : '['}${left}, ${right}${interval.openRight ? ')' : ']'}`;
    })
    .join(' ∪ ');
}

function polynomialText(poly: Polynomial, variable: string): string {
  const p = trim(poly);
  const terms: string[] = [];
  for (let power = p.length - 1; power >= 0; power -= 1) {
    const coefficient = roundNice(p[power]!);
    if (coefficient === 0) continue;
    if (power === 0) terms.push(String(coefficient));
    else {
      const variablePart = power === 1 ? variable : `${variable}^${power}`;
      if (coefficient === 1) terms.push(variablePart);
      else if (coefficient === -1) terms.push(`-${variablePart}`);
      else terms.push(`${coefficient}${variablePart}`);
    }
  }
  return terms.length > 0 ? terms.join(' + ').replace(/\+ -/g, '- ') : '0';
}

/** Samples a function's sign; used by the discontinuity reports. */
export function signOf(node: Node, variable: string, x: number): number {
  const value = evaluateAt(node, variable, x);
  return Number.isNaN(value) ? Number.NaN : Math.sign(value);
}

export { parseNode, calcLimit, polyDivide };
