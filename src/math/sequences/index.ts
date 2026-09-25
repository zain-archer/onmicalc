import { CalcError } from '@/core/errors';
import { createContext } from '@/core/engine';
import { evaluateNode } from '@/core/evaluator/evaluate';
import { parseNode } from '@/math/cas/ast';

/**
 * Sequences and series: arithmetic, geometric, Fibonacci and arbitrary linear
 * recurrences such as a(n) = a(n−1) + a(n−2), evaluated exactly where the
 * numbers stay small and as doubles when they grow. Closed forms are given only
 * where a real formula exists, and sums are reported with both the exact
 * integer (when it fits) and the floating value.
 */
export interface SequenceTerm {
  n: number;
  value: number;
  /** Exact text when the value is an integer that fits comfortably. */
  text: string;
}

export interface SequenceResult {
  kind: 'arithmetic' | 'geometric' | 'fibonacci' | 'recurrence';
  terms: SequenceTerm[];
  /** Sum of the terms shown. */
  partialSum: number;
  closedForm: string | null;
  nthTerm: string | null;
  ratio: number | null;
  difference: number | null;
  notes: string[];
}

const term = (n: number, value: number): SequenceTerm => ({
  n,
  value,
  text: Number.isInteger(value) && Math.abs(value) < 1e15 ? String(value) : value.toPrecision(12),
});

export function arithmeticSequence(first: number, difference: number, count = 10): SequenceResult {
  const terms = Array.from({ length: Math.max(1, count) }, (_, index) => term(index + 1, first + index * difference));
  const last = terms[terms.length - 1]!.value;
  return {
    kind: 'arithmetic',
    terms,
    partialSum: ((first + last) * terms.length) / 2,
    closedForm: `a(n) = ${first} + (n - 1)·${difference}`,
    nthTerm: String(first + (count - 1) * difference),
    ratio: null,
    difference,
    notes: ['Each term is the previous one plus a fixed difference'],
  };
}

export function geometricSequence(first: number, ratio: number, count = 10): SequenceResult {
  const terms = Array.from({ length: Math.max(1, count) }, (_, index) => term(index + 1, first * ratio ** index));
  const sum = ratio === 1 ? first * terms.length : (first * (ratio ** terms.length - 1)) / (ratio - 1);
  return {
    kind: 'geometric',
    terms,
    partialSum: sum,
    closedForm: `a(n) = ${first}·${ratio}^(n - 1)`,
    nthTerm: String(first * ratio ** (count - 1)),
    ratio,
    difference: null,
    notes: [
      'Each term is the previous one multiplied by a fixed ratio',
      Math.abs(ratio) < 1 ? `Infinite sum (|r| < 1): ${first} / (1 - ${ratio})` : 'The infinite sum only converges when |r| < 1',
    ],
  };
}

/** Fibonacci, optionally generalised to other starting pairs (Lucas numbers, …). */
export function fibonacciSequence(count = 12, first = 0, second = 1): SequenceResult {
  const length = Math.max(2, count);
  const values: number[] = [first, second];
  for (let i = 2; i < length; i += 1) values.push(values[i - 1]! + values[i - 2]!);
  const terms = values.slice(0, length).map((value, index) => term(index + 1, value));
  const isFibonacci = first === 0 && second === 1;
  return {
    kind: 'fibonacci',
    terms,
    partialSum: values.reduce((total, value) => total + value, 0),
    closedForm: isFibonacci ? 'a(n) = (φⁿ − ψⁿ)/√5 with φ = (1 + √5)/2' : null,
    nthTerm: String(values[length - 1]),
    ratio: values[length - 2] !== 0 ? values[length - 1]! / values[length - 2]! : null,
    difference: null,
    notes: [
      isFibonacci ? 'The ratio of consecutive terms approaches φ ≈ 1.6180339887' : 'A Fibonacci-style recurrence with your starting values',
    ],
  };
}

export interface RecurrenceSpec {
  /** Expression for a(n) using earlier terms, e.g. `a(n-1) + a(n-2)`. */
  expression: string;
  /** Initial values in order: a(0), a(1), … */
  initial: number[];
  count: number;
}

/**
 * Evaluates a linear recurrence such as a(n) = a(n−1) + a(n−2) by substituting
 * the earlier terms into the expression with the engine. Terms are recomputed
 * inside the expression text, so there is no loss of precision from a numeric
 * closed form the user did not ask for.
 */
export function evaluateRecurrence(spec: RecurrenceSpec): SequenceResult {
  const { expression, initial } = spec;
  if (initial.length === 0) throw new CalcError('INPUT', 'At least one starting value is needed');
  const count = Math.max(initial.length, Math.min(spec.count || 10, 500));
  const values = [...initial];

  // Rewrite a(n - k) into the previous-term values, keeping the expression explicit.
  const rewrite = (index: number): string => {
    let text = expression.replace(/\ba\s*\(\s*n\s*\)/gi, 'a(n)');
    text = text.replace(/\ba\s*\(\s*n\s*-\s*(\d+)\s*\)/gi, (_match, offset: string) => {
      const back = Number(offset);
      const target = index - back;
      if (target < 0) throw new CalcError('INPUT', `a(n - ${back}) reaches before the first term at n = ${index}`);
      return `(${values[target]!})`;
    });
    text = text.replace(/\ba\s*\(\s*n\s*\+\s*(\d+)\s*\)/gi, () => {
      throw new CalcError('NOT_SUPPORTED', 'Forward references such as a(n + 1) are not supported');
    });
    return text;
  };

  for (let index = initial.length; index < count; index += 1) {
    const source = rewrite(index);
    const ast = parseNode(source);
    const value = evaluateNode(ast, createContext({ variables: { n: index, x: index } }));
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new CalcError('DOMAIN', `The recurrence did not produce a number at n = ${index}`);
    }
    values.push(value);
  }

  const terms = values.slice(0, count).map((value, index) => term(index, value));
  const differences = values.slice(1).map((value, index) => value - values[index]!);
  const ratios = values.slice(1).map((value, index) => (values[index] === 0 ? Number.NaN : value / values[index]!));
  const constantDifference = differences.every((value) => Math.abs(value - differences[0]!) < 1e-12);
  const constantRatio = ratios.every((value) => Math.abs(value - ratios[0]!) < 1e-12);

  const notes: string[] = [`Evaluated ${count} terms from a(n) = ${expression}`];
  if (constantDifference) notes.push(`The terms form an arithmetic sequence with difference ${differences[0]}`);
  if (constantRatio && Number.isFinite(ratios[0]!)) notes.push(`The terms form a geometric sequence with ratio ${ratios[0]}`);
  if (!constantDifference && !constantRatio) notes.push('No simple arithmetic or geometric pattern was detected');

  return {
    kind: 'recurrence',
    terms,
    partialSum: values.reduce((total, value) => total + value, 0),
    closedForm: null,
    nthTerm: String(values[count - 1]),
    ratio: constantRatio ? ratios[0]! : null,
    difference: constantDifference ? differences[0]! : null,
    notes,
  };
}

/** Partial sums with their running value, for both sequence kinds above. */
export function partialSums(values: number[]): { n: number; value: number; sum: number }[] {
  let running = 0;
  return values.map((value, index) => {
    running += value;
    return { n: index, value, sum: running };
  });
}

/** Recognises the common patterns in a list of numbers (used by the UI and Ask). */
export function recognise(
  values: number[],
): { kind: 'arithmetic' | 'geometric' | 'fibonacci' | 'polynomial' | 'unknown'; detail: string } {
  if (values.length < 3) return { kind: 'unknown', detail: 'at least three terms are needed' };
  const differences = values.slice(1).map((value, index) => value - values[index]!);
  if (differences.every((value) => Math.abs(value - differences[0]!) < 1e-9)) {
    return { kind: 'arithmetic', detail: `common difference ${differences[0]}` };
  }
  const secondDifferences = differences.slice(1).map((value, index) => value - differences[index]!);
  // At least four terms: with three terms *any* list fits a quadratic, so the
  // "constant second difference" test would carry no information.
  if (
    values.length >= 4 &&
    secondDifferences.every((value) => Math.abs(value - secondDifferences[0]!) < 1e-9)
  ) {
    return { kind: 'polynomial', detail: `constant second difference ${secondDifferences[0]} (quadratic)` };
  }
  const ratios = values.slice(1).map((value, index) => (values[index] === 0 ? Number.NaN : value / values[index]!));
  if (ratios.every((value) => Math.abs(value - ratios[0]!) < 1e-9)) {
    return { kind: 'geometric', detail: `common ratio ${ratios[0]}` };
  }
  const isFibonacci = values
    .slice(2)
    .every((value, index) => Math.abs(value - (values[index]! + values[index + 1]!)) < 1e-9);
  if (isFibonacci) return { kind: 'fibonacci', detail: 'each term is the sum of the two before it' };
  return { kind: 'unknown', detail: 'no simple pattern matched' };
}
