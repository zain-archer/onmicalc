import { CalcError } from '@/core/errors';

/**
 * Input guards and the core moments — the base every other statistics module
 * builds on.
 *
 * These live in their own module, rather than in `index.ts`, to keep the
 * dependency graph acyclic: `descriptive.ts` and `inference.ts` need `mean`,
 * `variance` and `standardDeviation`, and `index.ts` re-exports both of them.
 * When the moments lived in `index.ts`, importing them from a sibling created a
 * real runtime cycle (`index → descriptive → index`) whose behaviour depended on
 * module initialisation order.
 *
 * All functions are pure.
 */

export function requireData(values: readonly number[], minimum = 1, label = 'data set'): void {
  if (values.length < minimum) {
    throw new CalcError('INPUT', `The ${label} needs at least ${minimum} value${minimum === 1 ? '' : 's'}`, {
      details: `Received ${values.length}.`,
    });
  }
  if (!values.every(Number.isFinite)) {
    throw new CalcError('INPUT', 'Every data point must be a finite number');
  }
}

export function sum(values: readonly number[]): number {
  requireData(values);
  return values.reduce((total, value) => total + value, 0);
}

export function mean(values: readonly number[]): number {
  requireData(values);
  return sum(values) / values.length;
}

/** Sample variance (n − 1 denominator) — the default in scientific work. */
export function variance(values: readonly number[], kind: 'sample' | 'population' = 'sample'): number {
  requireData(values, kind === 'sample' ? 2 : 1);
  const average = mean(values);
  const squares = values.reduce((total, value) => total + (value - average) ** 2, 0);
  return squares / (kind === 'sample' ? values.length - 1 : values.length);
}

export function standardDeviation(
  values: readonly number[],
  kind: 'sample' | 'population' = 'sample',
): number {
  return Math.sqrt(variance(values, kind));
}
