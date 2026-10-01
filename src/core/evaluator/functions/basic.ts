import { CalcError } from '@/core/errors';
import { factorial } from '@/core/numbers/factorial';
import { isNearlyInteger } from '@/core/numbers';
import type { FunctionDef } from '../registry';

function require(condition: boolean, message: string, details?: string): void {
  if (!condition) throw new CalcError('DOMAIN', message, details ? { details } : {});
}

export const BASIC_FUNCTIONS: readonly FunctionDef[] = [
  {
    name: 'abs',
    signature: 'abs(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Absolute value.',
    category: 'basic',
    fn: ([x]) => Math.abs(x!),
  },
  {
    name: 'sqrt',
    signature: 'sqrt(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Square root.',
    category: 'basic',
    fn: ([x]) => {
      require(
        x! >= 0,
        'Square root of a negative number is not a real number',
        'Use the complex number tools for imaginary results.',
      );
      return Math.sqrt(x!);
    },
  },
  {
    name: 'cbrt',
    signature: 'cbrt(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Cube root (defined for negative inputs).',
    category: 'basic',
    fn: ([x]) => Math.cbrt(x!),
  },
  {
    name: 'sign',
    signature: 'sign(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Sign: -1, 0 or 1.',
    category: 'basic',
    fn: ([x]) => Math.sign(x!),
  },
  {
    name: 'floor',
    signature: 'floor(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Round down to the nearest whole number.',
    category: 'basic',
    fn: ([x]) => Math.floor(x!),
  },
  {
    name: 'ceil',
    signature: 'ceil(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Round up to the nearest whole number.',
    category: 'basic',
    fn: ([x]) => Math.ceil(x!),
  },
  {
    name: 'round',
    signature: 'round(x, digits?)',
    minArgs: 1,
    maxArgs: 2,
    description: 'Round to a number of decimal places (default 0).',
    category: 'basic',
    fn: ([x, digits]) => {
      const places = digits ?? 0;
      require(isNearlyInteger(places), 'round() digits must be a whole number');
      const safe = Math.max(-15, Math.min(15, Math.round(places)));
      const factor = 10 ** safe;
      // Round half away from zero (round(-2.5) = -3, round(2.5) = 3), which is
      // the convention taught in school and used by spreadsheet ROUND().
      // `Math.round` alone rounds half towards +∞, so -2.5 would give -2.
      const scaled = x! * factor;
      return (scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)) / factor;
    },
  },
  {
    name: 'fact',
    aliases: ['factorial'],
    signature: 'fact(n)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Factorial of a whole number (same as n!).',
    category: 'basic',
    fn: ([n]) => factorial(n!),
  },
  {
    name: 'mod',
    signature: 'mod(a, b)',
    minArgs: 2,
    maxArgs: 2,
    description: 'Remainder with the sign of the divisor.',
    category: 'basic',
    fn: ([a, b]) => {
      require(b! !== 0, 'Division by zero in mod()');
      return ((a! % b!) + b!) % b!;
    },
  },
  {
    name: 'hypot',
    signature: 'hypot(x, y)',
    minArgs: 2,
    maxArgs: 2,
    description: 'Length of the hypotenuse, sqrt(x^2 + y^2).',
    category: 'basic',
    fn: ([x, y]) => Math.hypot(x!, y!),
  },
  {
    name: 'min',
    signature: 'min(a, b, ...)',
    minArgs: 1,
    maxArgs: 64,
    description: 'Smallest value.',
    category: 'basic',
    fn: (args) => Math.min(...args),
  },
  {
    name: 'max',
    signature: 'max(a, b, ...)',
    minArgs: 1,
    maxArgs: 64,
    description: 'Largest value.',
    category: 'basic',
    fn: (args) => Math.max(...args),
  },
];
