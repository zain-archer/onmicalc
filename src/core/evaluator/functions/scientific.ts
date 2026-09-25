import type { EvalContext, FunctionDef } from '../registry';
import * as trig from '@/math/trigonometry';
import * as sci from '@/math/scientific';
import { power } from '../evaluate';

/** Wraps an angle-aware trig function as an engine function definition. */
function trigDef(
  name: string,
  fn: (angle: number, mode: EvalContext['angleMode']) => number,
  description: string,
  aliases: readonly string[] = [],
): FunctionDef {
  return {
    name,
    aliases,
    signature: `${name}(x)`,
    minArgs: 1,
    maxArgs: 1,
    description,
    category: 'trigonometry',
    fn: ([x], ctx) => fn(x!, ctx.angleMode),
  };
}

function inverseTrigDef(
  name: string,
  fn: (x: number, mode: EvalContext['angleMode']) => number,
  description: string,
  aliases: readonly string[] = [],
): FunctionDef {
  return {
    name,
    aliases,
    signature: `${name}(x)`,
    minArgs: 1,
    maxArgs: 1,
    description,
    category: 'trigonometry',
    fn: ([x], ctx) => fn(x!, ctx.angleMode),
  };
}

function logDef(
  name: string,
  fn: (x: number, base?: number) => number,
  description: string,
  aliases: readonly string[] = [],
  minArgs = 1,
  maxArgs = 1,
): FunctionDef {
  return {
    name,
    aliases,
    signature: maxArgs === 2 ? `${name}(x, base?)` : `${name}(x)`,
    minArgs,
    maxArgs,
    description,
    category: 'logarithm',
    fn: (args) => fn(args[0]!, args[1]),
  };
}

export const SCIENTIFIC_FUNCTIONS: readonly FunctionDef[] = [
  // --- trigonometry (angle mode aware) ---
  trigDef('sin', trig.sin, 'Sine of an angle.'),
  trigDef('cos', trig.cos, 'Cosine of an angle.'),
  trigDef('tan', trig.tan, 'Tangent of an angle.'),
  trigDef('cot', trig.cot, 'Cotangent (1/tan).'),
  trigDef('sec', trig.sec, 'Secant (1/cos).'),
  trigDef('csc', trig.csc, 'Cosecant (1/sin).'),
  inverseTrigDef('asin', trig.asin, 'Inverse sine, result in the current angle mode.', ['arcsin']),
  inverseTrigDef('acos', trig.acos, 'Inverse cosine, result in the current angle mode.', ['arccos']),
  inverseTrigDef('atan', trig.atan, 'Inverse tangent, result in the current angle mode.', ['arctan']),
  inverseTrigDef('acot', trig.acot, 'Inverse cotangent.', ['arccot']),
  inverseTrigDef('asec', trig.asec, 'Inverse secant.', ['arcsec']),
  inverseTrigDef('acsc', trig.acsc, 'Inverse cosecant.', ['arccsc']),
  {
    name: 'atan2',
    signature: 'atan2(y, x)',
    minArgs: 2,
    maxArgs: 2,
    description: 'Angle of the point (x, y) measured from the positive x-axis.',
    category: 'trigonometry',
    fn: ([y, x], ctx) => trig.atan2(y!, x!, ctx.angleMode),
  },
  // --- hyperbolics ---
  {
    name: 'sinh',
    signature: 'sinh(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Hyperbolic sine.',
    category: 'trigonometry',
    fn: ([x]) => trig.sinh(x!),
  },
  {
    name: 'cosh',
    signature: 'cosh(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Hyperbolic cosine.',
    category: 'trigonometry',
    fn: ([x]) => trig.cosh(x!),
  },
  {
    name: 'tanh',
    signature: 'tanh(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Hyperbolic tangent.',
    category: 'trigonometry',
    fn: ([x]) => trig.tanh(x!),
  },
  {
    name: 'coth',
    signature: 'coth(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Hyperbolic cotangent.',
    category: 'trigonometry',
    fn: ([x]) => trig.coth(x!),
  },
  {
    name: 'asinh',
    aliases: ['arsinh', 'arcsinh'],
    signature: 'asinh(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Inverse hyperbolic sine.',
    category: 'trigonometry',
    fn: ([x]) => trig.asinh(x!),
  },
  {
    name: 'acosh',
    aliases: ['arcosh', 'arccosh'],
    signature: 'acosh(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Inverse hyperbolic cosine.',
    category: 'trigonometry',
    fn: ([x]) => trig.acosh(x!),
  },
  {
    name: 'atanh',
    aliases: ['artanh', 'arctanh'],
    signature: 'atanh(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'Inverse hyperbolic tangent.',
    category: 'trigonometry',
    fn: ([x]) => trig.atanh(x!),
  },

  // --- logarithms and exponentials ---
  logDef('ln', sci.ln, 'Natural logarithm (base e).'),
  logDef('log', sci.logBase, 'Logarithm: log(x) is base 10, log(x, b) uses base b.', ['log10', 'lg'], 1, 2),
  logDef('log2', sci.log2, 'Base 2 logarithm.', ['lb']),
  {
    name: 'exp',
    aliases: ['e^'],
    signature: 'exp(x)',
    minArgs: 1,
    maxArgs: 1,
    description: 'e raised to the power x.',
    category: 'logarithm',
    fn: ([x]) => sci.exp(x!),
  },
  {
    name: 'pow',
    signature: 'pow(base, exponent)',
    minArgs: 2,
    maxArgs: 2,
    description: 'Power function; identical semantics to base^exponent.',
    category: 'logarithm',
    fn: ([base, exponent]) => power(base!, exponent!),
  },
  {
    name: 'root',
    aliases: ['nthroot'],
    signature: 'root(n, x)',
    minArgs: 2,
    maxArgs: 2,
    description: 'n-th root of x; odd roots accept negative values.',
    category: 'logarithm',
    fn: ([n, x]) => sci.nthRoot(x!, n!),
  },
];
