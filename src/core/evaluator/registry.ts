import { CalcError } from '@/core/errors';
import type { AngleMode } from '@/core/numbers/angle';

export interface EvalContext {
  angleMode: AngleMode;
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
