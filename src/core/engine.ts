import type { CalcErrorCode } from '@/core/errors';
import { CalcError } from '@/core/errors';
import { ALL_CONSTANT_VALUES } from '@/constants';
import type { AngleMode } from '@/core/numbers/angle';
import type { ExpressionNode } from '@/core/parser';
import { parse } from '@/core/parser';
import { formatNumber } from '@/core/precision/format';
import type { FormatOptions } from '@/core/precision/format';
import { evaluateNode } from '@/core/evaluator/evaluate';
import { createDefaultRegistry } from '@/core/evaluator/functions';
import type { EvalContext, FunctionRegistry } from '@/core/evaluator/registry';

export { modulo, power } from '@/core/evaluator/evaluate';

export interface EngineOptions extends Partial<FormatOptions> {
  angleMode?: AngleMode;
  variables?: Readonly<Record<string, number>>;
  constants?: Readonly<Record<string, number>>;
  functions?: FunctionRegistry;
  /** Registry cache key: pass the same instance across calls to avoid rebuilds. */
  registry?: FunctionRegistry;
}

export interface EvaluationSuccess {
  ok: true;
  /** Echo of the parsed source (whitespace-trimmed). */
  source: string;
  value: number;
  /** Formatted for display, honouring the precision settings. */
  display: string;
  ast: ExpressionNode;
}

export interface EvaluationFailure {
  ok: false;
  source: string;
  error: {
    code: CalcErrorCode;
    message: string;
    position?: number;
    length?: number;
    details?: string;
  };
}

export type EvaluationResult = EvaluationSuccess | EvaluationFailure;

let defaultRegistry: FunctionRegistry | null = null;

export function getDefaultRegistry(): FunctionRegistry {
  defaultRegistry ??= createDefaultRegistry();
  return defaultRegistry;
}

export function createContext(options: EngineOptions = {}): EvalContext {
  return {
    angleMode: options.angleMode ?? 'RAD',
    constants: { ...ALL_CONSTANT_VALUES, ...(options.constants ?? {}) },
    variables: options.variables ?? {},
    functions: options.functions ?? options.registry ?? getDefaultRegistry(),
  };
}

/** Parses an expression with the engine's function names so `sqrt 16` works. */
export function parseExpression(source: string, functions?: FunctionRegistry): ExpressionNode {
  const registry = functions ?? getDefaultRegistry();
  return parse(source, { functions: new Set(registry.primaryNames()) });
}

/** Evaluate an expression and never throw: errors come back as data. */
export function evaluateExpression(source: string, options: EngineOptions = {}): EvaluationResult {
  const trimmed = source.trim();
  try {
    const ast = parseExpression(trimmed, options.functions ?? options.registry);
    const ctx = createContext(options);
    const value = evaluateNode(ast, ctx);
    if (Number.isNaN(value)) {
      throw new CalcError('DOMAIN', 'The result is not a real number');
    }
    if (!Number.isFinite(value)) {
      throw new CalcError('OVERFLOW', 'The result is too large to represent');
    }
    return {
      ok: true,
      source: trimmed,
      value,
      display: formatNumber(value, options),
      ast,
    };
  } catch (err) {
    const calc = err instanceof CalcError ? err : new CalcError('INTERNAL', 'Unexpected engine failure', {
      details: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      source: trimmed,
      error: {
        code: calc.code,
        message: calc.message,
        position: calc.position,
        length: calc.length,
        details: calc.details,
      },
    };
  }
}
