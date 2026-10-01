import { CalcError } from '@/core/errors';
import { isNearlyInteger } from '@/core/numbers';
import { factorial } from '@/core/numbers/factorial';
import type { BinaryNode, ExpressionNode, PostfixNode } from '@/core/parser/ast';
import type { EvalContext } from './registry';

function guard(value: number, node: ExpressionNode, what: string): number {
  if (Number.isNaN(value)) {
    throw new CalcError('DOMAIN', `${what} has no real result`, {
      position: node.start,
      length: Math.max(1, node.end - node.start),
    });
  }
  if (!Number.isFinite(value)) {
    throw new CalcError('OVERFLOW', `${what} is too large to represent`, {
      position: node.start,
      length: Math.max(1, node.end - node.start),
    });
  }
  return value;
}

/** Floored modulo: the result takes the sign of the divisor (-7 mod 3 = 2). */
export function modulo(a: number, b: number): number {
  if (b === 0) throw new CalcError('DIV_ZERO', 'Division by zero in mod');
  return ((a % b) + b) % b;
}

export function power(base: number, exponent: number): number {
  if (base === 0 && exponent < 0) {
    throw new CalcError('DIV_ZERO', '0 raised to a negative power is undefined');
  }
  if (base < 0 && !isNearlyInteger(exponent)) {
    throw new CalcError('DOMAIN', 'A negative base with a fractional exponent has no real result', {
      details: 'Use cbrt() for real cube roots of negative numbers.',
    });
  }
  // By convention among calculators, 0^0 = 1 for the integer exponent case.
  return Math.pow(base, exponent);
}

/** A `%` postfix, e.g. the `10%` in `200 + 10%`. */
function isPercentNode(node: ExpressionNode): boolean {
  return node.type === 'postfix' && node.operator === '%';
}

function evaluateBinary(node: BinaryNode, ctx: EvalContext): number {
  const left = evaluateNode(node.left, ctx);
  const right = evaluateNode(node.right, ctx);

  switch (node.operator) {
    case '+':
      // `200 + 10%` reads as "200 increased by 10%" in consumer calculators.
      // A percentage on both sides keeps the strict reading, so `50% + 50%`
      // stays 1 rather than becoming 0.75.
      if ((ctx.percentMode ?? 'contextual') === 'contextual' && isPercentNode(node.right) && !isPercentNode(node.left)) {
        return guard(left * (1 + right), node, 'This sum');
      }
      return guard(left + right, node, 'This sum');
    case '-':
      if ((ctx.percentMode ?? 'contextual') === 'contextual' && isPercentNode(node.right) && !isPercentNode(node.left)) {
        return guard(left * (1 - right), node, 'This difference');
      }
      return guard(left - right, node, 'This difference');
    case '*':
      return guard(left * right, node, 'This product');
    case '/':
      if (right === 0) {
        throw new CalcError('DIV_ZERO', 'Division by zero', {
          position: node.right.start,
          length: Math.max(1, node.right.end - node.right.start),
        });
      }
      return guard(left / right, node, 'This quotient');
    case 'mod':
      try {
        return guard(modulo(left, right), node, 'This remainder');
      } catch (err) {
        if (err instanceof CalcError && err.code === 'DIV_ZERO') {
          throw new CalcError('DIV_ZERO', 'Division by zero in mod', {
            position: node.right.start,
            length: Math.max(1, node.right.end - node.right.start),
          });
        }
        throw err;
      }
    case '^':
      try {
        return guard(power(left, right), node, 'This power');
      } catch (err) {
        if (err instanceof CalcError) {
          throw new CalcError(err.code, err.message, {
            position: node.start,
            length: Math.max(1, node.end - node.start),
            details: err.details,
          });
        }
        throw err;
      }
    case 'and':
    case 'or':
    case 'xor':
      throw new CalcError('NOT_SUPPORTED', `The "${node.operator}" operator works on integers only`, {
        position: node.start,
        length: Math.max(1, node.end - node.start),
        details: 'Bitwise operations live in the Number Systems / Programmer tools.',
      });
  }
}

function evaluatePostfix(node: PostfixNode, ctx: EvalContext): number {
  const value = evaluateNode(node.operand, ctx);
  if (node.operator === '!') {
    try {
      return factorial(value);
    } catch (err) {
      if (err instanceof CalcError) {
        throw new CalcError(err.code, err.message, {
          position: node.start,
          length: Math.max(1, node.end - node.start),
          details: err.details,
        });
      }
      throw err;
    }
  }
  return value / 100;
}

export function evaluateNode(node: ExpressionNode, ctx: EvalContext): number {
  switch (node.type) {
    case 'number':
      return node.value;

    case 'identifier': {
      const variable = ctx.variables[node.name];
      if (variable !== undefined) return variable;
      const constant = ctx.constants[node.name];
      if (constant !== undefined) return constant;
      throw new CalcError('UNKNOWN_IDENTIFIER', `Unknown name "${node.name}"`, {
        position: node.start,
        length: Math.max(1, node.end - node.start),
        details: 'Define a variable or use a known constant/function name.',
      });
    }

    case 'unary': {
      const operand = evaluateNode(node.operand, ctx);
      return node.operator === '-' ? -operand : operand;
    }

    case 'binary':
      return evaluateBinary(node, ctx);

    case 'postfix':
      return evaluatePostfix(node, ctx);

    case 'call': {
      const def = ctx.functions.get(node.name);
      if (!def) {
        throw new CalcError('UNKNOWN_IDENTIFIER', `Unknown function "${node.name}"`, {
          position: node.start,
          length: Math.max(1, node.end - node.start),
        });
      }
      if (node.args.length < def.minArgs || node.args.length > def.maxArgs) {
        const expected =
          def.minArgs === def.maxArgs ? String(def.minArgs) : `${def.minArgs}–${def.maxArgs}`;
        throw new CalcError(
          'BAD_ARITY',
          `${def.name}() takes ${expected} argument${def.maxArgs === 1 ? '' : 's'}`,
          {
            position: node.start,
            length: Math.max(1, node.end - node.start),
            details: `Received ${node.args.length}. Signature: ${def.signature ?? def.name}`,
          },
        );
      }
      const args = node.args.map((arg) => evaluateNode(arg, ctx));
      let result: number;
      try {
        result = def.fn(args, ctx);
      } catch (err) {
        if (err instanceof CalcError) {
          throw new CalcError(err.code, err.message, {
            position: node.start,
            length: Math.max(1, node.end - node.start),
            details: err.details,
          });
        }
        throw err;
      }
      return guard(result, node, `${def.name}()`);
    }
  }
}
