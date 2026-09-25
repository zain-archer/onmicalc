import { CalcError } from '@/core/errors';
import { isNearlyInteger } from './index';

/** Largest integer whose factorial is still representable as a double. */
export const MAX_EXACT_FACTORIAL = 170;

/** Exact factorial for integers 0..170; throws a typed error otherwise. */
export function factorial(value: number): number {
  if (!Number.isFinite(value)) {
    throw new CalcError('DOMAIN', 'Factorial needs a finite number');
  }
  if (value < 0) {
    throw new CalcError('DOMAIN', 'Factorial is not defined for negative numbers');
  }
  if (!isNearlyInteger(value)) {
    throw new CalcError('DOMAIN', 'Factorial is only defined for whole numbers in OmniCalc', {
      details: 'Non-integer factorial requires the gamma function, which is not yet implemented.',
    });
  }
  const n = Math.round(value);
  if (n > MAX_EXACT_FACTORIAL) {
    throw new CalcError('OVERFLOW', `Factorial is limited to ${MAX_EXACT_FACTORIAL}! in exact arithmetic`, {
      details: `${n}! exceeds the largest exactly representable double value (~1.8e308).`,
    });
  }
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}
