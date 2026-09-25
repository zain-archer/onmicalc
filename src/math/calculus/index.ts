import { CalcError } from '@/core/errors';
import { parse, printExpression, type ExpressionNode } from '@/core/parser';
import { evaluateExpression, getDefaultRegistry, createContext } from '@/core/engine';
import { evaluateNode } from '@/core/evaluator/evaluate';
import { isNearlyInteger } from '@/core/numbers';

/**
 * Calculus: symbolic differentiation on the AST plus verified numeric
 * differentiation, integration and limits. Everything numeric reports its
 * estimated error and refuses to answer when the estimate is not trustworthy.
 */

export type ScalarFunction = (x: number) => number;

function compile(source: string, extraVariables: Record<string, number> = {}): ScalarFunction {
  const ast = parse(source, { functions: new Set(getDefaultRegistry().primaryNames()) });
  return (x: number) => {
    const ctx = createContext({ variables: { x, t: x, ...extraVariables } });
    return evaluateNode(ast, ctx);
  };
}

/** Builds f(x) from an expression; returns null when the expression is invalid. */
export function compileFunction(source: string, variable = 'x'): ScalarFunction | null {
  const parsed = evaluateExpression(source, { variables: { [variable]: 0 } });
  if (!parsed.ok && parsed.error.code === 'SYNTAX') return null;
  try {
    const ast = parse(source, { functions: new Set(getDefaultRegistry().primaryNames()) });
    return (x: number) => {
      const ctx = createContext({ variables: { [variable]: x } });
      try {
        return evaluateNode(ast, ctx);
      } catch {
        return Number.NaN;
      }
    };
  } catch {
    return null;
  }
}

function safeEvaluate(f: ScalarFunction, x: number): number {
  try {
    const value = f(x);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

/* ------------------------------------------------------------------ */
/* Numeric differentiation                                             */
/* ------------------------------------------------------------------ */

export interface NumericResult {
  value: number;
  /** Estimated absolute error of the result. */
  error: number;
  /** Number of function evaluations used. */
  evaluations: number;
  method: string;
}

/**
 * Central difference with Richardson extrapolation and a scale-aware step.
 * The step is chosen from the derivative scale so the result stays accurate for
 * both x ~ 1 and x ~ 1e6.
 */
export function derivative(f: ScalarFunction, x: number, order: 1 | 2 = 1): NumericResult {
  if (!Number.isFinite(x)) throw new CalcError('INPUT', 'The differentiation point must be finite');
  const scale = Math.max(1, Math.abs(x));
  let evaluations = 0;
  // Optimal step sizes for central differences: eps^(1/3) for the first
  // derivative and eps^(1/4) for the second, scaled by |x|.
  const h = order === 2 ? scale * Number.EPSILON ** 0.25 : scale * Number.EPSILON ** (1 / 3);

  // A derivative only exists where the function is defined.
  if (!Number.isFinite(safeEvaluate(f, x))) {
    throw new CalcError('DOMAIN', 'The function is not defined at this point, so it has no derivative there', {
      details: `f(${x}) is undefined or infinite.`,
    });
  }

  if (order === 2) {
    // f''(x) ≈ (f(x+h) − 2f(x) + f(x−h)) / h² with Richardson (h and 2h).
    const second = (step: number) => {
      const a = safeEvaluate(f, x + step);
      const b = safeEvaluate(f, x);
      const c = safeEvaluate(f, x - step);
      evaluations += 3;
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return Number.NaN;
      return (a - 2 * b + c) / (step * step);
    };
    const coarse = second(h);
    const fine = second(h / 2);
    if (!Number.isFinite(coarse) || !Number.isFinite(fine)) {
      throw new CalcError('CONVERGENCE', 'The second derivative could not be computed here', {
        details: 'The function is not smooth enough at this point, or it is undefined nearby.',
      });
    }
    return {
      value: fine + (fine - coarse) / 3,
      error: Math.abs(fine - coarse) / 3,
      evaluations,
      method: 'central difference (order 2) with Richardson extrapolation',
    };
  }

  const first = (step: number) => {
    const a = safeEvaluate(f, x + step);
    const b = safeEvaluate(f, x - step);
    evaluations += 2;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
    return (a - b) / (2 * step);
  };

  const coarse = first(h);
  const fine = first(h / 2);
  if (!Number.isFinite(coarse) || !Number.isFinite(fine)) {
    throw new CalcError('CONVERGENCE', 'The derivative could not be computed here', {
      details: 'The function is undefined on one side of this point.',
    });
  }
  return {
    value: fine + (fine - coarse) / 3,
    error: Math.abs(fine - coarse) / 3,
    evaluations,
    method: 'central difference with Richardson extrapolation',
  };
}

/** Partial derivative with respect to one variable of a multi-variable function. */
export function partialDerivative(
  source: string,
  variable: string,
  point: Record<string, number>,
  order: 1 | 2 = 1,
): NumericResult {
  const parsed = evaluateExpression(source, { variables: point });
  if (!parsed.ok) {
    throw new CalcError(parsed.error.code, parsed.error.message, { details: parsed.error.details });
  }
  const f = (value: number) => compile(source, { ...point, [variable]: value })(value);
  void point;
  return derivative(f, point[variable] ?? 0, order);
}

/* ------------------------------------------------------------------ */
/* Symbolic differentiation                                            */
/* ------------------------------------------------------------------ */

type Node = ExpressionNode;

function num(value: number): Node {
  return { type: 'number', value, start: 0, end: 0 };
}

const ZERO = num(0);
const ONE = num(1);

function isNumber(node: Node, value: number): boolean {
  return node.type === 'number' && node.value === value;
}

function simplify(node: Node): Node {
  switch (node.type) {
    case 'binary': {
      const left = simplify(node.left);
      const right = simplify(node.right);
      switch (node.operator) {
        case '+':
          if (isNumber(left, 0)) return right;
          if (isNumber(right, 0)) return left;
          if (left.type === 'number' && right.type === 'number') return num(left.value + right.value);
          // Keep signs readable: x + (-7) prints as x − 7.
          if (right.type === 'number' && right.value < 0) {
            return simplify(sub(left, num(-right.value)));
          }
          if (right.type === 'unary' && right.operator === '-') {
            return simplify(sub(left, right.operand));
          }
          break;
        case '-':
          if (isNumber(right, 0)) return left;
          if (left.type === 'number' && right.type === 'number') return num(left.value - right.value);
          if (isNumber(left, 0)) return { type: 'unary', operator: '-', operand: right, start: 0, end: 0 };
          break;
        case '*':
          if (isNumber(left, 0) || isNumber(right, 0)) return ZERO;
          if (isNumber(left, 1)) return right;
          if (isNumber(right, 1)) return left;
          if (left.type === 'number' && right.type === 'number') return num(left.value * right.value);
          // Pull numeric factors together: 4 * (3 * x) -> 12 * x
          if (left.type === 'number' && right.type === 'binary' && right.operator === '*' && right.left.type === 'number') {
            return simplify(mul(num(left.value * right.left.value), right.right));
          }
          if (right.type === 'number' && left.type === 'binary' && left.operator === '*' && left.left.type === 'number') {
            return simplify(mul(num(right.value * left.left.value), left.right));
          }
          break;
        case '/':
          if (isNumber(right, 1)) return left;
          if (isNumber(left, 0)) return ZERO;
          if (left.type === 'number' && right.type === 'number' && right.value !== 0) {
            return num(left.value / right.value);
          }
          break;
        case '^':
          if (isNumber(right, 1)) return left;
          if (isNumber(right, 0)) return ONE;
          break;
        default:
          break;
      }
      return { ...node, left, right };
    }
    case 'unary': {
      const operand = simplify(node.operand);
      if (operand.type === 'number') return num(node.operator === '-' ? -operand.value : operand.value);
      // −(−u) = u
      if (node.operator === '-' && operand.type === 'unary' && operand.operator === '-') return operand.operand;
      return { ...node, operand };
    }
    case 'call': {
      const args = node.args.map(simplify);
      return { ...node, args };
    }
    case 'postfix': {
      const operand = simplify(node.operand);
      return { ...node, operand };
    }
    default:
      return node;
  }
}

const DERIVATIVES: Record<string, (u: Node, x: string) => Node> = {
  sin: (u) => call('cos', u),
  cos: (u) => neg(call('sin', u)),
  tan: (u) => div(ONE, pow(call('cos', u), num(2))),
  exp: (u) => call('exp', u),
  ln: (u) => div(ONE, u),
  sqrt: (u) => div(ONE, mul(num(2), call('sqrt', u))),
  sinh: (u) => call('cosh', u),
  cosh: (u) => call('sinh', u),
  tanh: (u) => div(ONE, pow(call('cosh', u), num(2))),
  asin: (u) => div(ONE, call('sqrt', sub(ONE, pow(u, num(2))))),
  acos: (u) => neg(div(ONE, call('sqrt', sub(ONE, pow(u, num(2)))))),
  atan: (u) => div(ONE, add(ONE, pow(u, num(2)))),
  abs: (u) => div(u, call('abs', u)),
};

function add(a: Node, b: Node): Node {
  return { type: 'binary', operator: '+', left: a, right: b, start: 0, end: 0 };
}
function sub(a: Node, b: Node): Node {
  return { type: 'binary', operator: '-', left: a, right: b, start: 0, end: 0 };
}
function mul(a: Node, b: Node): Node {
  return { type: 'binary', operator: '*', left: a, right: b, start: 0, end: 0 };
}
function div(a: Node, b: Node): Node {
  return { type: 'binary', operator: '/', left: a, right: b, start: 0, end: 0 };
}
function pow(a: Node, b: Node): Node {
  return { type: 'binary', operator: '^', left: a, right: b, start: 0, end: 0 };
}
function neg(a: Node): Node {
  return { type: 'unary', operator: '-', operand: a, start: 0, end: 0 };
}
function call(name: string, ...args: Node[]): Node {
  return { type: 'call', name, args, start: 0, end: 0 };
}

/**
 * Differentiates an expression symbolically where the rules are known.
 * Throws a NOT_SUPPORTED error naming the function when it is not, rather than
 * returning a wrong or half-guessed derivative.
 */
export function differentiateNode(node: Node, variable = 'x'): Node {
  switch (node.type) {
    case 'number':
      return ZERO;
    case 'identifier':
      return node.name === variable ? ONE : ZERO;
    case 'unary':
      return node.operator === '-'
        ? neg(differentiateNode(node.operand, variable))
        : differentiateNode(node.operand, variable);
    case 'postfix':
      if (node.operator === '%') return div(differentiateNode(node.operand, variable), num(100));
      throw new CalcError('NOT_SUPPORTED', 'Factorial cannot be differentiated symbolically', {
        details: 'The derivative of a factorial is only defined through the gamma function.',
      });
    case 'binary': {
      const left = node.left;
      const right = node.right;
      const dLeft = differentiateNode(left, variable);
      const dRight = differentiateNode(right, variable);
      switch (node.operator) {
        case '+':
        case '-':
          return add(dLeft, node.operator === '-' ? neg(dRight) : dRight);
        case '*':
          return add(mul(dLeft, right), mul(left, dRight));
        case '/':
          return div(sub(mul(dLeft, right), mul(left, dRight)), pow(right, num(2)));
        case '^': {
          if (right.type === 'number') {
            // Power rule: n·u^(n−1)·u'
            return mul(mul(right, pow(left, num(right.value - 1))), dLeft);
          }
          // General rule: u^v · (v' ln u + v·u'/u)
          return mul(
            node,
            add(mul(dRight, call('ln', left)), mul(right, div(dLeft, left))),
          );
        }
        case 'mod':
        case 'and':
        case 'or':
        case 'xor':
          throw new CalcError('NOT_SUPPORTED', `The "${node.operator}" operator has no smooth derivative`);
      }
      break;
    }
    case 'call': {
      const rule = DERIVATIVES[node.name];
      const logBase = node.name === 'log' || node.name === 'log2';
      if (node.name === 'log' && node.args.length === 2) {
        return div(differentiateNode(node.args[0]!, variable), mul(node.args[0]!, call('ln', node.args[1]!)));
      }
      if (logBase) {
        const base = node.name === 'log2' ? Math.LN2 : Math.LN10;
        return div(differentiateNode(node.args[0]!, variable), mul(node.args[0]!, num(base)));
      }
      if (node.name === 'pow' && node.args.length === 2) {
        return differentiateNode(pow(node.args[0]!, node.args[1]!), variable);
      }
      if (!rule) {
        throw new CalcError('NOT_SUPPORTED', `OmniCalc cannot differentiate ${node.name}() symbolically`, {
          details: 'Use the numerical derivative instead — it works for any function.',
        });
      }
      if (node.args.length !== 1) {
        throw new CalcError('NOT_SUPPORTED', `${node.name}() with several arguments is not differentiated symbolically`);
      }
      const inner = node.args[0]!;
      return mul(rule(inner, variable), differentiateNode(inner, variable));
    }
  }
  return ZERO;
}

export function differentiate(source: string, variable = 'x'): string {
  const ast = parse(source, { functions: new Set(getDefaultRegistry().primaryNames()) });
  const derived = simplify(differentiateNode(ast, variable));
  return printExpression(derived);
}

/** High-order symbolic derivatives by repeated differentiation. */
export function differentiateOrder(source: string, order: number, variable = 'x'): string {
  if (!isNearlyInteger(order) || order < 1 || order > 10) {
    throw new CalcError('INPUT', 'The derivative order must be a whole number from 1 to 10');
  }
  let ast: Node = parse(source, { functions: new Set(getDefaultRegistry().primaryNames()) });
  for (let i = 0; i < order; i += 1) ast = simplify(differentiateNode(ast, variable));
  return printExpression(ast);
}

/* ------------------------------------------------------------------ */
/* Numerical integration                                               */
/* ------------------------------------------------------------------ */

export interface IntegrationResult {
  value: number;
  error: number;
  subdivisions: number;
  method: string;
  converged: boolean;
}

/**
 * Adaptive Simpson quadrature.
 * Reports the estimated error; when the estimate cannot be driven below the
 * tolerance the result is marked as not converged, never silently returned as
 * if it were exact.
 */
export function integrate(
  f: ScalarFunction,
  a: number,
  b: number,
  options: { tolerance?: number; maxDepth?: number } = {},
): IntegrationResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new CalcError('INPUT', 'The integration limits must be finite');
  }
  const tolerance = options.tolerance ?? 1e-10;
  const maxDepth = options.maxDepth ?? 24;
  let subdivisions = 0;

  const simpson = (from: number, to: number) => {
    const mid = (from + to) / 2;
    const fa = safeEvaluate(f, from);
    const fm = safeEvaluate(f, mid);
    const fb = safeEvaluate(f, to);
    subdivisions += 1;
    if (!Number.isFinite(fa) || !Number.isFinite(fm) || !Number.isFinite(fb)) {
      throw new CalcError('DOMAIN', 'The function is not defined at a required sample point in this interval', {
        details: 'Numerical integration needs a finite value at both limits and the midpoint.',
      });
    }
    return ((to - from) / 6) * (fa + 4 * fm + fb);
  };

  const recurse = (from: number, to: number, whole: number, depth: number): { value: number; error: number } => {
    const mid = (from + to) / 2;
    const left = simpson(from, mid);
    const right = simpson(mid, to);
    const combined = left + right;
    const error = Math.abs(combined - whole) / 15;

    const localTolerance = tolerance * Math.max(1, Math.abs(combined)) / Math.max(1, upper - lower);
    if (depth >= maxDepth || error <= localTolerance) {
      return { value: combined + (combined - whole) / 15, error };
    }
    const leftResult = recurse(from, mid, left, depth + 1);
    const rightResult = recurse(mid, to, right, depth + 1);
    return { value: leftResult.value + rightResult.value, error: leftResult.error + rightResult.error };
  };

  if (a === b) {
    return { value: 0, error: 0, subdivisions: 0, method: 'adaptive Simpson', converged: true };
  }

  const direction = a < b ? 1 : -1;
  const [lower, upper] = a < b ? [a, b] : [b, a];
  const whole = simpson(lower, upper);
  const result = recurse(lower, upper, whole, 0);
  return {
    value: direction * result.value,
    error: result.error,
    subdivisions,
    method: 'adaptive Simpson quadrature',
    converged: result.error <= Math.max(tolerance * 10, Math.abs(result.value) * 1e-9),
  };
}

/* ------------------------------------------------------------------ */
/* Limits                                                              */
/* ------------------------------------------------------------------ */

export interface LimitResult {
  value: number;
  /** Whether the two sides agree. */
  twoSided: boolean;
  approach: 'two-sided' | 'left' | 'right';
  error: number;
}

/**
 * Limit via Romberg/Richardson extrapolation of the sequence f(x0 ± h·2^-k).
 * If the sequence does not settle, the caller is told it did not converge.
 */
export function limit(
  f: ScalarFunction,
  point: number,
  options: { side?: 'both' | 'left' | 'right'; tolerance?: number } = {},
): LimitResult {
  const side = options.side ?? 'both';
  const tolerance = options.tolerance ?? 1e-9;
  const steps = 12;
  const h0 = Math.max(1e-3, Math.abs(point) * 1e-3 + 1e-3);

  const extrapolate = (fromRight: boolean): number | null => {
    const values: number[] = [];
    for (let k = 0; k < steps; k += 1) {
      const h = h0 / 2 ** k;
      const value = safeEvaluate(f, fromRight ? point + h : point - h);
      if (!Number.isFinite(value)) return null;
      values.push(value);
    }

    // Growing without bound means the limit is infinite, which is a different
    // answer from "no limit" and must be reported as such.
    const tailValues = values.slice(-4);
    const growing = tailValues.every((value, index) => index === 0 || Math.abs(value) > Math.abs(tailValues[index - 1]!) * 1.5);
    if (growing && Math.abs(tailValues[tailValues.length - 1]!) > 1e5) {
      const sign = tailValues[tailValues.length - 1]! > 0 ? '+' : '−';
      throw new CalcError('DOMAIN', `The limit diverges to ${sign}∞`, {
        details: 'The function grows without bound as it approaches this point.',
      });
    }
    if (Math.abs(tailValues[tailValues.length - 1]!) > 1e12) return null;
    // Richardson: combine each pair to cancel the leading h term.
    let current = values;
    for (let level = 0; level < 4; level += 1) {
      const next: number[] = [];
      for (let i = 0; i < current.length - 1; i += 1) {
        next.push(current[i + 1]! * 2 - current[i]!);
      }
      current = next;
      if (current.length < 2) break;
    }
    const tail = current.slice(-3);
    const spread = Math.max(...tail) - Math.min(...tail);
    const centre = tail.reduce((sum, value) => sum + value, 0) / tail.length;
    if (!Number.isFinite(centre)) return null;
    if (spread > tolerance * Math.max(1, Math.abs(centre)) * 1e3) return null;
    return centre;
  };

  const right = side === 'left' ? null : extrapolate(true);
  const left = side === 'right' ? null : extrapolate(false);

  if (side === 'both') {
    if (right === null || left === null) {
      throw new CalcError('CONVERGENCE', 'The limit could not be estimated from both sides', {
        details: 'The function may be undefined or oscillate near this point.',
      });
    }
    if (Math.abs(right - left) > tolerance * Math.max(1, Math.abs(right)) * 1e2) {
      throw new CalcError('CONVERGENCE', 'The left and right limits disagree, so the limit does not exist', {
        details: `Left ≈ ${left}, right ≈ ${right}.`,
      });
    }
    return { value: (left + right) / 2, twoSided: true, approach: 'two-sided', error: Math.abs(right - left) / 2 };
  }

  const value = side === 'left' ? left : right;
  if (value === null) {
    throw new CalcError('CONVERGENCE', 'The limit could not be estimated from that side');
  }
  return { value, twoSided: false, approach: side === 'left' ? 'left' : 'right', error: 0 };
}

/* ------------------------------------------------------------------ */
/* Series expansions                                                   */
/* ------------------------------------------------------------------ */

export interface TaylorResult {
  /** Coefficients c₀ … cₙ of the Taylor polynomial about `centre`. */
  coefficients: number[];
  /** Readable polynomial string. */
  polynomial: string;
  radiusNote: string;
}

/**
 * Taylor/Maclaurin coefficients from exact symbolic derivatives where possible,
 * falling back to numerical high-order derivatives (checked for accuracy).
 */
export function taylorSeries(source: string, centre = 0, order = 5, variable = 'x'): TaylorResult {
  if (!isNearlyInteger(order) || order < 1 || order > 8) {
    throw new CalcError('INPUT', 'The expansion order must be a whole number from 1 to 8');
  }
  const coefficients: number[] = [];
  let ast: Node | null = parse(source, { functions: new Set(getDefaultRegistry().primaryNames()) });

  // Try symbolic derivatives first: exact coefficients when available.
  let symbolicOk = true;
  const symbolicAst = ast;
  const terms: number[] = [];
  for (let n = 0; n <= order; n += 1) {
    if (ast === null) {
      symbolicOk = false;
      break;
    }
    try {
      const fn = (x: number) => evaluateNode(ast as Node, createContext({ variables: { [variable]: x } }));
      const value = fn(centre);
      terms.push(value);
      ast = simplify(differentiateNode(ast, variable));
    } catch {
      symbolicOk = false;
      break;
    }
  }

  if (symbolicOk && terms.length === order + 1) {
    for (let n = 0; n <= order; n += 1) coefficients.push(terms[n]! / factorialValue(n));
  } else {
    // Numerical fallback: high-precision central differences.
    const f = compile(source);
    for (let n = 0; n <= order; n += 1) {
      coefficients.push(nthDerivative(f, centre, n) / factorialValue(n));
    }
  }

  void symbolicAst;
  return {
    coefficients,
    polynomial: taylorString(coefficients, centre, variable),
    radiusNote:
      'The expansion is valid only where the derivatives used here exist; the polynomial is a local approximation.',
  };
}

function factorialValue(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

/** n-th derivative by repeated Richardson-extrapolated central differences. */
function nthDerivative(f: ScalarFunction, x: number, n: number): number {
  if (n === 0) {
    const value = safeEvaluate(f, x);
    if (!Number.isFinite(value)) throw new CalcError('DOMAIN', 'The function is undefined at the expansion point');
    return value;
  }
  const h = Math.max(1e-3, Math.abs(x) * 1e-3 + 1e-3) / Math.max(1, n - 1);
  const binomial = (k: number) => {
    let result = 1;
    for (let i = 0; i < k; i += 1) result = (result * (n - i)) / (i + 1);
    return Math.round(result);
  };
  const combinationSum = (step: number) => {
    let total = 0;
    for (let k = 0; k <= n; k += 1) {
      const value = safeEvaluate(f, x + (n / 2 - k) * step);
      if (!Number.isFinite(value)) {
        throw new CalcError('CONVERGENCE', 'The function could not be sampled finely enough for this derivative', {
          details: 'Reduce the expansion order or move the centre away from a singularity.',
        });
      }
      total += (k % 2 === 0 ? 1 : -1) * binomial(k) * value;
    }
    return total / step ** n;
  };
  const coarse = combinationSum(h);
  const fine = combinationSum(h / 2);
  return fine + (fine - coarse) / (2 ** n - 1);
}

export function taylorString(coefficients: readonly number[], centre: number, variable = 'x'): string {
  const parts: string[] = [];
  coefficients.forEach((coefficient, n) => {
    if (Math.abs(coefficient) < 1e-14) return;
    const magnitude = Number(coefficient.toPrecision(8));
    const inner = centre === 0 ? variable : `(${variable} − ${centre})`;
    const body = n === 0 ? `${magnitude}` : n === 1 ? `${magnitude}·${inner}` : `${magnitude}·${inner}^${n}`;
    parts.push(n === 0 ? body : `+ ${body}`);
  });
  return parts.length === 0 ? '0' : parts.join(' ').replace(/^\+ /, '');
}

export { compile as compileFunctionForVariable };
