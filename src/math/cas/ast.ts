import { parse, printExpression, type BinaryOperator, type ExpressionNode } from '@/core/parser';
import { createContext, getDefaultRegistry } from '@/core/engine';
import { evaluateNode } from '@/core/evaluator/evaluate';

/**
 * Computer-algebra core: tiny AST builders and a canonicaliser on top of the
 * same `ExpressionNode` the parser produces, so anything the CAS returns can be
 * printed back as a normal expression, re-parsed and plotted.
 */
export type Node = ExpressionNode;

export const num = (value: number): Node => ({ type: 'number', value, start: 0, end: 0 });
export const id = (name: string): Node => ({ type: 'identifier', name, start: 0, end: 0 });
export const neg = (operand: Node): Node => ({ type: 'unary', operator: '-', operand, start: 0, end: 0 });
export const bin = (operator: BinaryOperator, left: Node, right: Node): Node => ({
  type: 'binary',
  operator,
  left,
  right,
  start: 0,
  end: 0,
});
export const add = (a: Node, b: Node): Node => bin('+', a, b);
export const sub = (a: Node, b: Node): Node => bin('-', a, b);
export const mul = (a: Node, b: Node): Node => bin('*', a, b);
export const div = (a: Node, b: Node): Node => bin('/', a, b);
export const pow = (base: Node, exponent: Node): Node => bin('^', base, exponent);
export const call = (name: string, ...args: Node[]): Node => ({ type: 'call', name, args, start: 0, end: 0 });

export const ZERO = num(0);
export const ONE = num(1);

export const isNumber = (node: Node): node is Extract<Node, { type: 'number' }> => node.type === 'number';
export const isIdentifier = (node: Node): node is Extract<Node, { type: 'identifier' }> =>
  node.type === 'identifier';

export const numberOf = (node: Node): number | null => (isNumber(node) ? node.value : null);

/** Canonical text for a node — also the equality test used by the simplifier. */
export const key = (node: Node): string => printExpression(node);
export const same = (a: Node, b: Node): boolean => key(a) === key(b);
export const isZero = (node: Node): boolean => numberOf(node) === 0;
export const isOne = (node: Node): boolean => numberOf(node) === 1;
export const isNegative = (node: Node): boolean =>
  node.type === 'unary' && node.operator === '-' ? true : (numberOf(node) ?? 0) < 0;

/** Function names the engine already knows, used when re-parsing CAS output. */
export function parseNode(source: string): Node {
  return parse(source, { functions: new Set(getDefaultRegistry().primaryNames()) });
}

export function containsVariable(node: Node, variable: string): boolean {
  switch (node.type) {
    case 'number':
      return false;
    case 'identifier':
      return node.name === variable;
    case 'unary':
      return containsVariable(node.operand, variable);
    case 'postfix':
      return containsVariable(node.operand, variable);
    case 'binary':
      return containsVariable(node.left, variable) || containsVariable(node.right, variable);
    case 'call':
      return node.args.some((arg) => containsVariable(arg, variable));
  }
}

export function walk(node: Node, visit: (candidate: Node) => void): void {
  visit(node);
  switch (node.type) {
    case 'unary':
    case 'postfix':
      walk(node.operand, visit);
      return;
    case 'binary':
      walk(node.left, visit);
      walk(node.right, visit);
      return;
    case 'call':
      for (const arg of node.args) walk(arg, visit);
      return;
    default:
  }
}

export function mapChildren(node: Node, mapper: (child: Node) => Node): Node {
  switch (node.type) {
    case 'unary':
      return { ...node, operand: mapper(node.operand) };
    case 'postfix':
      return { ...node, operand: mapper(node.operand) };
    case 'binary':
      return { ...node, left: mapper(node.left), right: mapper(node.right) };
    case 'call':
      return { ...node, args: node.args.map(mapper) };
    default:
      return node;
  }
}

const EXACT_CALLS: Record<string, (arg: number) => number | null> = {
  sin: (x) => (x === 0 ? 0 : null),
  tan: (x) => (x === 0 ? 0 : null),
  asin: (x) => (x === 0 ? 0 : null),
  atan: (x) => (x === 0 ? 0 : null),
  cos: (x) => (x === 0 ? 1 : null),
  exp: (x) => (x === 0 ? 1 : null),
  ln: (x) => (x === 1 ? 0 : x === 0 ? null : null),
  sqrt: (x) => (x === 0 ? 0 : x === 1 ? 1 : x === 4 ? 2 : x === 9 ? 3 : null),
};

/**
 * Canonicalise: fold numbers, drop identities (`+0`, `*1`, `^1`), collapse
 * `x/x`, `x - x`, and evaluate a few exact special values. Deliberately
 * conservative — anything it cannot prove is left exactly as written.
 */
export function canonical(node: Node): Node {
  switch (node.type) {
    case 'number':
      return node;
    case 'identifier':
      return node;
    case 'unary': {
      const operand = canonical(node.operand);
      if (isNumber(operand)) return num(node.operator === '-' ? -operand.value : operand.value);
      if (node.operator === '-') {
        if (operand.type === 'unary' && operand.operator === '-') return operand.operand;
        if (operand.type === 'binary' && operand.operator === '-') {
          // -(a - b) = b - a. Only the subtraction identity is safe here: turning
          // -(a + b) into a + b would silently drop the sign.
          return canonical(bin('-', operand.right, operand.left));
        }
      }
      return { ...node, operand };
    }
    case 'postfix': {
      const operand = canonical(node.operand);
      if (isNumber(operand)) {
        if (node.operator === '%') return num(operand.value / 100);
      }
      return { ...node, operand };
    }
    case 'binary': {
      const left = canonical(node.left);
      const right = canonical(node.right);
      const a = numberOf(left);
      const b = numberOf(right);

      switch (node.operator) {
        case '+':
          if (a === 0) return right;
          if (b === 0) return left;
          if (a !== null && b !== null) return num(a + b);
          if (same(left, right)) return canonical(mul(num(2), left));
          break;
        case '-':
          if (b === 0) return left;
          if (a === 0) return canonical(neg(right));
          if (a !== null && b !== null) return num(a - b);
          if (same(left, right)) return ZERO;
          break;
        case '*':
          if (a === 0 || b === 0) return ZERO;
          if (a === 1) return right;
          if (b === 1) return left;
          if (a !== null && b !== null) return num(a * b);
          if (isNegative(left)) return canonical(neg(mul(canonical(neg(left)), right)));
          if (isNegative(right)) return canonical(neg(mul(left, canonical(neg(right)))));
          if (same(left, right)) return canonical(pow(left, num(2)));
          // (a^(n)) * a → a^(n+1)
          if (left.type === 'binary' && left.operator === '^' && same(left.left, right) && isNumber(left.right)) {
            return canonical(pow(right, num(left.right.value + 1)));
          }
          if (right.type === 'binary' && right.operator === '^' && same(right.left, left) && isNumber(right.right)) {
            return canonical(pow(left, num(right.right.value + 1)));
          }
          break;
        case '/':
          if (b === 1) return left;
          if (a === 0 && b !== null) return ZERO;
          if (a !== null && b !== null) return b === 0 ? { ...node, left, right } : num(a / b);
          if (same(left, right)) return ONE;
          // (k · y) / m → (k / m) · y, so 2·x/2 comes back as x.
          if (b !== null && left.type === 'binary' && left.operator === '*') {
            const leftFactor = numberOf(left.left);
            const rightFactor = numberOf(left.right);
            if (leftFactor !== null) return canonical(mul(num(leftFactor / b), left.right));
            if (rightFactor !== null) return canonical(mul(num(rightFactor / b), left.left));
          }
          break;
        case '^':
          if (b === 0) return ONE;
          if (b === 1) return left;
          if (a === 1) return ONE;
          if (a === 0 && b !== null && b > 0) return ZERO;
          if (a !== null && b !== null) {
            const value = a ** b;
            if (Number.isFinite(value) && (Number.isInteger(value) || Number.isInteger(b))) return num(value);
          }
          // (a^m)^n → a^(m*n) for numeric exponents
          if (left.type === 'binary' && left.operator === '^' && isNumber(left.right) && b !== null) {
            return canonical(pow(left.left, num(left.right.value * b)));
          }
          break;
        default:
          break;
      }
      if (a !== null && b !== null) {
        const folded = foldBinary(node.operator, a, b);
        if (folded !== null) return num(folded);
      }
      return { ...node, left, right };
    }
    case 'call': {
      const args = node.args.map(canonical);
      if (args.length === 1 && isNumber(args[0])) {
        const exact = EXACT_CALLS[node.name.toLowerCase()]?.(args[0].value);
        if (exact !== null && exact !== undefined) return num(exact);
      }
      return { ...node, args };
    }
  }
}

function foldBinary(operator: BinaryOperator, a: number, b: number): number | null {
  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? null : a / b;
    case '^':
      return a ** b;
    case 'mod':
      return b === 0 ? null : a - b * Math.floor(a / b);
    default:
      return null;
  }
}

/** Evaluates a node at one value of the CAS variable (NaN when undefined there). */
export function evaluateAt(node: Node, variable: string, value: number): number {
  try {
    const ctx = createContext({ variables: { [variable]: value, x: value, t: value } });
    const result = evaluateNode(node, ctx);
    return typeof result === 'number' && Number.isFinite(result) ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

/**
 * Like `evaluateAt` but keeps ±Infinity instead of turning it into NaN, which is
 * what growth comparisons at infinity need.
 */
export function evaluateRaw(node: Node, variable: string, value: number): number {
  try {
    const ctx = createContext({ variables: { [variable]: value, x: value, t: value } });
    const result = evaluateNode(node, ctx);
    return typeof result === 'number' ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export const format = (node: Node): string => printExpression(canonical(node));

/**
 * Presentation pass for CAS output: writes rational coefficients as fractions
 * (`0.333… · x³` becomes `x^3 / 3`), cancels numeric factors in products and
 * keeps the printed answer close to how a textbook writes it. Purely cosmetic —
 * the underlying tree is unchanged.
 */
export function formatNice(node: Node): string {
  // Canonicalise first, then re-shape for reading. Doing it the other way round
  // would let the simplifier fold the presentation back into a decimal.
  return printExpression(normaliseFractions(canonical(node)));
}

/** Snaps a value to the nearest small fraction when it is within 1e-10 of one. */
export function asFraction(value: number): { numerator: number; denominator: number } | null {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return { numerator: value, denominator: 1 };
  for (let denominator = 2; denominator <= 12; denominator += 1) {
    const numerator = value * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < 1e-10) {
      return { numerator: Math.round(numerator), denominator };
    }
  }
  return null;
}

export function normaliseFractions(node: Node): Node {
  switch (node.type) {
    case 'binary': {
      const left = normaliseFractions(node.left);
      const right = normaliseFractions(node.right);
      if (node.operator === '/') {
        const numerator = numberOf(left);
        const denominator = numberOf(right);
        if (numerator !== null && denominator !== null && denominator !== 0) {
          const fraction = asFraction(numerator / denominator);
          if (fraction && fraction.denominator > 1) {
            return bin('/', num(fraction.numerator), num(fraction.denominator));
          }
        }
        return bin('/', left, right);
      }
      if (node.operator === '*') {
        // k · (y / m) → (k · y) / m, and (y / m) · k likewise.
        if (left.type === 'binary' && left.operator === '/' && numberOf(right) !== null) {
          return bin('/', mulNode(right, left.left), left.right);
        }
        if (right.type === 'binary' && right.operator === '/' && numberOf(left) !== null) {
          return bin('/', mulNode(left, right.left), right.right);
        }
        // Rational coefficient: 0.5 · x → x / 2, (2/3) · x → 2x / 3
        if (numberOf(right) !== null && numberOf(left) === null) return bin('*', right, left);
        if (numberOf(left) !== null) {
          const fraction = asFraction(numberOf(left)!);
          if (fraction && fraction.denominator > 1) {
            // 1/3 · x³ → x³ / 3, 4/3 · x → 4x / 3
            const numerator = fraction.numerator === 1 ? right : mulNode(num(fraction.numerator), right);
            return bin('/', numerator, num(fraction.denominator));
          }
        }
      }
      return bin(node.operator, left, right);
    }
    case 'unary':
      return { ...node, operand: normaliseFractions(node.operand) };
    case 'postfix':
      return { ...node, operand: normaliseFractions(node.operand) };
    case 'call':
      return { ...node, args: node.args.map(normaliseFractions) };
    default:
      return node;
  }
}

const mulNode = (a: Node, b: Node): Node => ({ type: 'binary', operator: '*', left: a, right: b, start: 0, end: 0 });
