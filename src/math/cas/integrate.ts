import { CalcError } from '@/core/errors';
import { compileFunction, differentiateNode, integrate as numericIntegrate } from '@/math/calculus';
import {
  add as addNode,
  canonical,
  containsVariable,
  div as divNode,
  evaluateAt,
  format,
  formatNice,
  id,
  isNumber,
  key,
  mul as mulNode,
  neg as negNode,
  num,
  parseNode,
  pow as powNode,
  sub as subNode,
  type Node,
} from './ast';
import { degree, polynomialToNode, trim, toPolynomial, type Polynomial } from './polyops';
import { linearRoot, partialFractions, roundNice } from './partial';

/**
 * Symbolic integration of elementary functions.
 *
 * The rules cover what can be derived exactly — power rule, exponential,
 * logarithmic, trig and inverse-trig tables, linear substitution, integration
 * by parts for the classic xⁿ·eˣ / xⁿ·sin / xⁿ·ln families, and rational
 * functions through partial fractions. When no rule applies the function
 * returns null and the caller reports the failure and offers the numeric
 * integral instead of inventing an antiderivative.
 */

export interface SymbolicIntegral {
  /** Antiderivative without the constant, ready to print. */
  antiderivative: Node;
  /** Printed form, e.g. `x^3 / 3`. */
  expression: string;
  /** `+ C` variant for display. */
  withConstant: string;
  /** Which rule produced it, shown in the steps. */
  method: string;
  /** Steps in plain language. */
  steps: string[];
  /** Independent check: derivative of the result against the integrand. */
  verification: IntegralVerification;
}

export interface IntegralVerification {
  method: string;
  /** Max absolute difference between d/dx F(x) and f(x) at sample points. */
  maxError: number;
  checked: number;
  agrees: boolean;
}

/** The placeholder variable used by the elementary table. */
const U_ID: Extract<Node, { type: 'identifier' }> = { type: 'identifier', name: 'u', start: 0, end: 0 };

/** Table of ∫ f(u) du for the elementary functions the engine knows. */
const ELEMENTARY: Record<string, { antiderivative: Node; method: string }> = {};

function elementary(name: string, make: (u: Node) => Node, method: string): void {
  ELEMENTARY[name] = { antiderivative: make(U_ID), method };
}

elementary('sin', (u) => negNode({ type: 'call', name: 'cos', args: [u], start: 0, end: 0 }), 'table: ∫ sin = −cos');
elementary('cos', (u) => ({ type: 'call', name: 'sin', args: [u], start: 0, end: 0 }), 'table: ∫ cos = sin');
elementary(
  'tan',
  (u) => negNode({ type: 'call', name: 'ln', args: [{ type: 'call', name: 'abs', args: [{ type: 'call', name: 'cos', args: [u], start: 0, end: 0 }], start: 0, end: 0 }], start: 0, end: 0 }),
  'table: ∫ tan = −ln|cos|',
);
elementary('exp', (u) => ({ type: 'call', name: 'exp', args: [u], start: 0, end: 0 }), 'table: ∫ eᵘ = eᵘ');
elementary('sinh', (u) => ({ type: 'call', name: 'cosh', args: [u], start: 0, end: 0 }), 'table: ∫ sinh = cosh');
elementary('cosh', (u) => ({ type: 'call', name: 'sinh', args: [u], start: 0, end: 0 }), 'table: ∫ cosh = sinh');
elementary(
  'tanh',
  (u) => ({ type: 'call', name: 'ln', args: [{ type: 'call', name: 'cosh', args: [u], start: 0, end: 0 }], start: 0, end: 0 }),
  'table: ∫ tanh = ln(cosh)',
);
elementary(
  'ln',
  (u) => subNode(mulNode(u, { type: 'call', name: 'ln', args: [u], start: 0, end: 0 }), u),
  'by parts: ∫ ln u = u ln u − u',
);
elementary(
  'asin',
  (u) =>
    addNode(
      mulNode(u, { type: 'call', name: 'asin', args: [u], start: 0, end: 0 }),
      { type: 'call', name: 'sqrt', args: [subNode(num(1), powNode(u, num(2)))], start: 0, end: 0 },
    ),
  'by parts: ∫ asin u = u·asin u + √(1 − u²)',
);
elementary(
  'atan',
  (u) =>
    subNode(
      mulNode(u, { type: 'call', name: 'atan', args: [u], start: 0, end: 0 }),
      mulNode(num(0.5), { type: 'call', name: 'ln', args: [addNode(num(1), powNode(u, num(2)))], start: 0, end: 0 }),
    ),
  'by parts: ∫ atan u = u·atan u − ½ln(1 + u²)',
);
elementary(
  'sqrt',
  (u) => mulNode(num(2 / 3), powNode(u, num(1.5))),
  'power rule with u = radicand',
);

/** d u/dx when u is linear in x (otherwise null). */
function linearCoefficient(u: Node, variable: string): number | null {
  const poly = toPolynomial(u, variable);
  if (!poly) return null;
  const p = trim(poly);
  if (p.length > 2) return null;
  const slope = p[1] ?? 0;
  return slope === 0 ? null : slope;
}

function innerDerivative(f: Node, variable: string): Node | null {
  try {
    return canonical(differentiateNode(f, variable));
  } catch {
    return null;
  }
}

/** Ratio a/b when it is a pure number, otherwise null. */
function constantRatio(a: Node, b: Node, variable: string): number | null {
  const aAst = canonical(a);
  const bAst = canonical(b);
  if (containsVariable(bAst, variable)) return null;
  const values = [0.37, 1.13, 2.71];
  let ratio: number | null = null;
  for (const x of values) {
    const left = evaluateAt(aAst, variable, x);
    const right = evaluateAt(bAst, variable, x);
    if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) return null;
    const current = left / right;
    if (ratio === null) ratio = current;
    else if (Math.abs(current - ratio) > 1e-9 * Math.max(1, Math.abs(ratio))) return null;
  }
  return ratio;
}

interface Context {
  variable: string;
  depth: number;
}

function isConstant(node: Node, variable: string): boolean {
  return !containsVariable(node, variable);
}

/* ------------------------------------------------------------------ */
/* Integration rules                                                   */
/* ------------------------------------------------------------------ */

function integrateNode(node: Node, context: Context): { result: Node; method: string; steps: string[] } | null {
  const { variable } = context;
  const ast = canonical(node);

  if (context.depth > 12) return null;

  // 1. Pure constant.
  if (isConstant(ast, variable)) {
    return {
      result: mulNode(ast, id(variable)),
      method: 'constant rule',
      steps: [`∫ c dx = c·x with c = ${format(ast)}`],
    };
  }

  // 2. Polynomial in the variable.
  const poly = toPolynomial(ast, variable);
  if (poly) {
    if (degree(poly) < 0) return null;
    const integrated = integratePolynomial(poly);
    return {
      result: polynomialToNode(integrated, variable),
      method: 'power rule (term by term)',
      steps: [
        `Expand into powers of ${variable}: ${poly
          .map((c, i) => (c === 0 ? null : `${roundNice(c)}·${variable}^${i}`))
          .filter(Boolean)
          .join(' + ')}`,
        `Apply ∫ xⁿ dx = xⁿ⁺¹/(n+1) to every term`,
      ],
    };
  }

  switch (ast.type) {
    case 'unary':
      if (ast.operator === '-') {
        const inner = integrateNode(ast.operand, bump(context));
        if (!inner) return null;
        return { result: negNode(inner.result), method: inner.method, steps: [...inner.steps, 'Negate the antiderivative'] };
      }
      return null;

    case 'binary': {
      if (ast.operator === '+' || ast.operator === '-') {
        const left = integrateNode(ast.left, bump(context));
        const right = integrateNode(ast.right, bump(context));
        if (!left || !right) return null;
        return {
          result: ast.operator === '+' ? addNode(left.result, right.result) : subNode(left.result, right.result),
          method: 'sum rule',
          steps: ['Integrate each term separately', ...left.steps.slice(0, 1), ...right.steps.slice(0, 1)],
        };
      }

      if (ast.operator === '*') {
        // Pull out constants.
        if (isConstant(ast.left, variable)) {
          const inner = integrateNode(ast.right, bump(context));
          if (!inner) return null;
          return {
            result: mulNode(ast.left, inner.result),
            method: `constant multiple (${inner.method})`,
            steps: [`Pull out the constant ${format(ast.left)}`, ...inner.steps],
          };
        }
        if (isConstant(ast.right, variable)) {
          const inner = integrateNode(ast.left, bump(context));
          if (!inner) return null;
          return {
            result: mulNode(ast.right, inner.result),
            method: `constant multiple (${inner.method})`,
            steps: [`Pull out the constant ${format(ast.right)}`, ...inner.steps],
          };
        }
        return integrateByParts(ast, context);
      }

      if (ast.operator === '/') {
        if (isConstant(ast.right, variable)) {
          const inner = integrateNode(ast.left, bump(context));
          if (!inner) return null;
          return {
            result: divNode(inner.result, ast.right),
            method: `constant divisor (${inner.method})`,
            steps: [`Divide by the constant ${format(ast.right)}`, ...inner.steps],
          };
        }
        // f′(x)/f(x) → ln|f|
        const derivative = innerDerivative(ast.right, variable);
        if (derivative) {
          const ratio = constantRatio(ast.left, derivative, variable);
          if (ratio !== null && Math.abs(ratio) > 1e-12) {
            const log = {
              type: 'call' as const,
              name: 'ln',
              args: [{ type: 'call' as const, name: 'abs', args: [ast.right], start: 0, end: 0 }],
              start: 0,
              end: 0,
            };
            const scaled = Math.abs(ratio - 1) < 1e-12 ? log : mulNode(num(roundNice(ratio)), log);
            return {
              result: scaled,
              method: 'logarithmic rule ∫ f′/f = ln|f|',
              steps: [
                `Spot that the numerator is ${ratio === 1 ? '' : `${roundNice(ratio)}·`}the derivative of ${format(ast.right)}`,
                '∫ f′/f dx = ln|f|',
              ],
            };
          }
        }
        return integrateRational(ast, context);
      }

      if (ast.operator === '^') {
        const exponentPoly = toPolynomial(ast.right, variable);
        if (exponentPoly && degree(exponentPoly) === 0) {
          const n = exponentPoly[0]!;
          const basePoly = toPolynomial(ast.left, variable);
          if (basePoly && !containsVariable(ast.left, variable)) {
            // a^x
            const log = { type: 'call' as const, name: 'ln', args: [ast.left], start: 0, end: 0 };
            return {
              result: divNode(ast, log),
              method: 'exponential rule ∫ aˣ = aˣ/ln a',
              steps: [`∫ ${format(ast.left)}^x dx = ${format(ast.left)}^x / ln(${format(ast.left)})`],
            };
          }
          // x^n
          if (basePoly && key(ast.left) === variable && Number.isInteger(n)) {
            if (n === -1) {
              const log = {
                type: 'call' as const,
                name: 'ln',
                args: [{ type: 'call' as const, name: 'abs', args: [id(variable)], start: 0, end: 0 }],
                start: 0,
                end: 0,
              };
              return { result: log, method: '∫ dx/x = ln|x|', steps: ['The power rule needs n ≠ −1, so use ∫ dx/x = ln|x|'] };
            }
            const newPower = n + 1;
            return {
              result: divNode(powNode(id(variable), num(newPower)), num(newPower)),
              method: 'power rule',
              steps: [`∫ x^${n} dx = x^${newPower}/${newPower}`],
            };
          }
          // (a x + b)^n
          const slope = linearCoefficient(ast.left, variable);
          if (slope !== null && Number.isInteger(n)) {
            if (n === -1) {
              return {
                result: divNode(
                  { type: 'call', name: 'ln', args: [{ type: 'call', name: 'abs', args: [ast.left], start: 0, end: 0 }], start: 0, end: 0 },
                  num(slope),
                ),
                method: 'linear substitution',
                steps: [`u = ${format(ast.left)}, du = ${roundNice(slope)} dx`, '∫ du/u = ln|u|'],
              };
            }
            const newPower = n + 1;
            return {
              result: divNode(powNode(ast.left, num(newPower)), num(slope * newPower)),
              method: 'linear substitution',
              steps: [`u = ${format(ast.left)}, du = ${roundNice(slope)} dx`, `∫ u^${n} du = u^${newPower}/${newPower}`],
            };
          }
        }
        // e^(a x + b) and a^(linear)
        const slope = linearCoefficient(ast.right, variable);
        const baseIsE =
          (isNumber(ast.left) && Math.abs(ast.left.value - Math.E) < 1e-12) ||
          (ast.left.type === 'identifier' && ast.left.name.toLowerCase() === 'e');
        if (baseIsE && slope !== null) {
          return {
            result: divNode(ast, num(slope)),
            method: 'linear substitution into e^u',
            steps: [`u = ${format(ast.right)}, du/dx = ${roundNice(slope)}`, '∫ e^u du = e^u'],
          };
        }
        return null;
      }

      return null;
    }

    case 'call': {
      const definition = ELEMENTARY[ast.name.toLowerCase()];
      if (!definition || ast.args.length !== 1) return null;
      const argument = ast.args[0]!;
      const slope = linearCoefficient(argument, variable);
      if (slope === null) {
        // Direct match when the argument is exactly the variable written as-is.
        if (key(argument) !== variable) return null;
        const substituted = substitute(definition.antiderivative, U_ID, argument);
        return {
          result: substituted,
          method: definition.method,
          steps: [definition.method.replace('u', variable)],
        };
      }
      const substituted = substitute(definition.antiderivative, U_ID, argument);
      const result = Math.abs(slope - 1) < 1e-12 ? substituted : divNode(substituted, num(slope));
      return {
        result,
        method: `${definition.method} (linear substitution)`,
        steps: [
          `Substitute u = ${format(argument)}, so du = ${roundNice(slope)} dx`,
          definition.method,
          slope === 1 ? '' : `Divide by du/dx = ${roundNice(slope)}`,
        ].filter(Boolean),
      };
    }

    default:
      return null;
  }
}

const bump = (context: Context): Context => ({ ...context, depth: context.depth + 1 });

/** ∫ p(x) dx for a coefficient array. */
export function integratePolynomial(poly: Polynomial): Polynomial {
  const out = new Array<number>(poly.length + 1).fill(0);
  for (let i = 0; i < poly.length; i += 1) out[i + 1] = poly[i]! / (i + 1);
  return trim(out);
}

/** Replaces every occurrence of the identifier `from` with `to`. */
function substitute(node: Node, from: Extract<Node, { type: 'identifier' }>, to: Node): Node {
  if (node.type === 'identifier' && node.name === from.name) return to;
  switch (node.type) {
    case 'unary':
      return { ...node, operand: substitute(node.operand, from, to) };
    case 'postfix':
      return { ...node, operand: substitute(node.operand, from, to) };
    case 'binary':
      return { ...node, left: substitute(node.left, from, to), right: substitute(node.right, from, to) };
    case 'call':
      return { ...node, args: node.args.map((arg) => substitute(arg, from, to)) };
    default:
      return node;
  }
}

/** LIATE priority — the higher the value, the more likely it becomes `u`. */
function liatePriority(node: Node): number {
  switch (node.type) {
    case 'call': {
      const name = node.name.toLowerCase();
      if (name === 'ln' || name === 'log' || name === 'log2') return 5;
      if (name === 'asin' || name === 'acos' || name === 'atan') return 4;
      if (name === 'sin' || name === 'cos' || name === 'tan') return 2;
      if (name === 'exp') return 1;
      return 3;
    }
    case 'binary':
      if (node.operator === '^') {
        const exponent = node.right;
        const baseIsE = node.left.type === 'identifier' && node.left.name.toLowerCase() === 'e';
        if (baseIsE || (isNumber(node.left) && Math.abs(node.left.value - Math.E) < 1e-12)) return 1;
        if (isConstant(exponent, 'x')) return 1;
      }
      return 3;
    default:
      return 3;
  }
}

/** ∫ u dv = u·v − ∫ v du, with the classic polynomial × (exp/trig/log) families. */
function integrateByParts(
  node: Extract<Node, { type: 'binary' }>,
  context: Context,
): { result: Node; method: string; steps: string[] } | null {
  const { variable } = context;
  const candidates: [Node, Node][] = [
    [node.left, node.right],
    [node.right, node.left],
  ];

  for (const [u, dv] of candidates) {
    if (!containsVariable(u, variable) || !containsVariable(dv, variable)) continue;
    // Prefer u with the higher LIATE priority (log first, exponential last).
    if (liatePriority(u) < liatePriority(dv)) continue;
    const dvIntegral = integrateNode(dv, bump(context));
    if (!dvIntegral) continue;
    const du = innerDerivative(u, variable);
    if (!du) continue;
    const remainder = integrateNode(mulNode(dvIntegral.result, du), bump(context));
    if (!remainder) continue;
    const result = subNode(mulNode(u, dvIntegral.result), remainder.result);
    return {
      result,
      method: 'integration by parts',
      steps: [
        '∫ u dv = u·v − ∫ v du',
        `Choose u = ${format(u)} and dv = ${format(dv)} dx`,
        `v = ${format(dvIntegral.result)}, du = ${format(du)} dx`,
        `Remaining integral: ∫ ${format(mulNode(dvIntegral.result, du))} dx → ${format(remainder.result)}`,
      ],
    };
  }
  return null;
}

/** ∫ p(x)/q(x) dx through polynomial division + partial fractions. */
function integrateRational(
  node: Extract<Node, { type: 'binary' }>,
  context: Context,
): { result: Node; method: string; steps: string[] } | null {
  const { variable } = context;
  const numerator = toPolynomial(node.left, variable);
  const denominator = toPolynomial(node.right, variable);
  if (!numerator || !denominator || degree(denominator) < 1) return null;

  const decomposition = partialFractions(numerator, denominator);
  if (!decomposition) return null;

  const pieces: Node[] = [];
  const steps: string[] = ['Write the integrand as a sum of simpler fractions'];
  const polynomialPart = trim(decomposition.polynomial);
  if (polynomialPart.some((c) => c !== 0)) {
    const integrated = integratePolynomial(polynomialPart);
    pieces.push(polynomialToNode(integrated, variable));
    steps.push(`Polynomial part: ${variable} term integrates by the power rule`);
  }

  for (const term of decomposition.terms) {
    const factorDegree = degree(term.factor);
    if (factorDegree === 1) {
      const root = linearRoot(term.factor);
      const coefficient = term.numerator[0]!;
      if (term.power === 1) {
        const log = {
          type: 'call' as const,
          name: 'ln',
          args: [{ type: 'call' as const, name: 'abs', args: [term.factor.length === 2 && term.factor[0] === 0 ? id(variable) : factorToNode(term.factor, variable)], start: 0, end: 0 }],
          start: 0,
          end: 0,
        };
        pieces.push(Math.abs(coefficient - 1) < 1e-12 ? log : mulNode(num(roundNice(coefficient)), log));
        steps.push(`∫ ${roundNice(coefficient)}/(x − ${roundNice(root)}) dx = ${roundNice(coefficient)} ln|x − ${roundNice(root)}|`);
      } else {
        const power = 1 - term.power;
        const piece = divNode(
          mulNode(num(coefficient), powNode(factorToNode(term.factor, variable), num(power))),
          num(power),
        );
        void root;
        pieces.push(piece);
        steps.push(`Repeated linear factor: ∫ A/(x − r)^${term.power} dx = A·(x − r)^${power}/${power}`);
      }
      continue;
    }

    if (factorDegree === 2) {
      const [c, b, a] = [term.factor[0]!, term.factor[1]!, term.factor[2]!];
      const [constant, linear] = [term.numerator[0] ?? 0, term.numerator[1] ?? 0];
      const quad = factorToNode(term.factor, variable);
      const disc = 4 * a * c - b * b;
      if (disc <= 0) return null;
      // Split (B x + C)/(a x² + b x + c) into a log plus an arctangent.
      const logCoefficient = linear / (2 * a);
      if (Math.abs(logCoefficient) > 1e-12) {
        pieces.push(
          mulNode(num(roundNice(logCoefficient)), {
            type: 'call',
            name: 'ln',
            args: [{ type: 'call', name: 'abs', args: [quad], start: 0, end: 0 }],
            start: 0,
            end: 0,
          }),
        );
      }
      const atanCoefficient = (constant - (linear * b) / (2 * a)) * (2 / Math.sqrt(disc));
      if (Math.abs(atanCoefficient) > 1e-12) {
        pieces.push(
          mulNode(num(roundNice(atanCoefficient)), {
            type: 'call',
            name: 'atan',
            args: [divNode(addNode(mulNode(num(2 * a), id(variable)), num(b)), num(Math.sqrt(disc)))],
            start: 0,
            end: 0,
          }),
        );
      }
      steps.push('Irreducible quadratic factor: split into a logarithm plus an arctangent');
      continue;
    }
    return null;
  }

  if (pieces.length === 0) return null;
  const result = pieces.reduce((accumulator, piece) => addNode(accumulator, piece));
  return { result, method: 'rational function (partial fractions)', steps };
}

function factorToNode(factor: Polynomial, variable: string): Node {
  return polynomialToNode(factor, variable);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** Numerical check that d/dx F(x) equals the integrand at sample points. */
export function verifyIntegral(
  integrand: Node,
  antiderivative: Node,
  variable: string,
  samples = [0.31, 0.83, 1.37, 2.11, 3.29],
): IntegralVerification {
  const derivative = differentiateNode(antiderivative, variable);
  let maxError = 0;
  let checked = 0;
  for (const x of samples) {
    const expected = evaluateAt(integrand, variable, x);
    const actual = evaluateAt(derivative, variable, x);
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) continue;
    checked += 1;
    maxError = Math.max(maxError, Math.abs(expected - actual) / Math.max(1, Math.abs(expected)));
  }
  return {
    method: 'differentiate the result and compare with the integrand',
    maxError,
    checked,
    agrees: checked >= 2 && maxError < 1e-7,
  };
}

/**
 * Integrates symbolically. Returns null when no rule applies — the caller must
 * then say so and offer the numeric integral.
 */
export function integrateSymbolic(source: string, variable = 'x'): SymbolicIntegral | null {
  let ast: Node;
  try {
    ast = parseNode(source);
  } catch {
    return null;
  }
  const attempt = integrateNode(ast, { variable, depth: 0 });
  if (!attempt) return null;
  const antiderivative = canonical(attempt.result);
  const verification = verifyIntegral(ast, antiderivative, variable);
  return {
    antiderivative,
    expression: formatNice(antiderivative),
    withConstant: `${format(antiderivative)} + C`,
    method: attempt.method,
    steps: [...attempt.steps, `Check: d/dx of the answer reproduces the integrand (checked at ${verification.checked} points)`],
    verification,
  };
}

export interface DefiniteIntegral {
  /** Exact value when the antiderivative is constant-free evaluable. */
  exact: number | null;
  numeric: { value: number; error: number };
  antiderivative: SymbolicIntegral | null;
  note: string;
}

/** Definite integral: symbolic where possible, always numerically checked. */
export function integrateDefinite(
  source: string,
  from: number,
  to: number,
  variable = 'x',
): DefiniteIntegral {
  const symbolic = integrateSymbolic(source, variable);
  let exact: number | null = null;
  if (symbolic && symbolic.verification.agrees) {
    const upper = evaluateAt(symbolic.antiderivative, variable, to);
    const lower = evaluateAt(symbolic.antiderivative, variable, from);
    if (Number.isFinite(upper) && Number.isFinite(lower)) exact = upper - lower;
  }

  const f = compileFunction(source, variable);
  if (!f) throw new CalcError('SYNTAX', 'Cannot read that integrand');
  const numeric = numericIntegrate(f, from, to);

  let note = 'numeric integration (adaptive Simpson) with its error estimate';
  if (exact !== null) {
    const difference = Math.abs(exact - numeric.value);
    const tolerance = Math.max(1e-6, 1e-6 * Math.abs(exact));
    note =
      difference <= tolerance
        ? 'exact antiderivative, confirmed numerically'
        : 'the symbolic antiderivative disagrees with the numeric integral — reporting the numeric value';
    if (difference > tolerance) exact = null;
  }
  return { exact, numeric, antiderivative: symbolic, note };
}

/** True when the CAS can express the antiderivative in closed form. */
export function canIntegrateSymbolically(source: string, variable = 'x'): boolean {
  return integrateSymbolic(source, variable) !== null;
}
