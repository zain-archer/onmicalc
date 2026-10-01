import { CalcError } from '@/core/errors';
import type { AngleMode } from '@/core/numbers/angle';

/**
 * How `%` behaves when it is added to or subtracted from a value.
 *
 * - `contextual` (default): `200 + 10%` is 220 — the increase/decrease reading
 *   that every consumer calculator (Google, iOS, Windows) and most users mean.
 * - `strict`: `%` always divides by 100, so `200 + 10%` is 200.1.
 *
 * Multiplication, division and the bare postfix are `÷ 100` in both modes;
 * this only changes the additive reading, where the two conventions disagree.
 */
export type PercentMode = 'contextual' | 'strict';

export interface EvalContext {
  angleMode: AngleMode;
  /** Defaults to `contextual` when omitted. */
  percentMode?: PercentMode;
  constants: Readonly<Record<string, number>>;
  variables: Readonly<Record<string, number>>;
  functions: FunctionRegistry;
}

export interface FunctionDef {
  /** Primary name used in expressions. */
  name: string;
  /** Extra accepted spellings. */
  aliases?: readonly string[];
  /** Human readable signature, e.g. 'sqrt(x)'. */
  signature?: string;
  minArgs: number;
  maxArgs: number;
  description: string;
  category: 'basic' | 'trigonometry' | 'logarithm' | 'combinatorics' | 'statistics' | 'complex' | 'utility';
  /** Pure function: no side effects, no I/O. */
  fn: (args: number[], ctx: EvalContext) => number;
}

/** Immutable-ish registry keyed by every name and alias. */
export class FunctionRegistry {
  private readonly map = new Map<string, FunctionDef>();

  constructor(definitions: readonly FunctionDef[] = []) {
    this.registerAll(definitions);
  }

  registerAll(definitions: readonly FunctionDef[]): this {
    for (const def of definitions) {
      for (const name of [def.name, ...(def.aliases ?? [])]) {
        const key = name.toLowerCase();
        if (this.map.has(key)) {
          throw new CalcError('INTERNAL', `Duplicate function name "${key}"`);
        }
        this.map.set(key, def);
      }
    }
    return this;
  }

  get(name: string): FunctionDef | undefined {
    return this.map.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.map.has(name.toLowerCase());
  }

  /** Names usable without parentheses, excluding aliases. */
  primaryNames(): string[] {
    const names = new Set<string>();
    for (const def of this.map.values()) names.add(def.name);
    return [...names].sort();
  }

  definitions(): FunctionDef[] {
    return [...new Set(this.map.values())];
  }

  clone(): FunctionRegistry {
    return new FunctionRegistry(this.definitions());
  }
}
