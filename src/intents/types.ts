/**
 * The "just say what you want" layer.
 *
 * Everything a tool can do is described once, as data: the words that select it,
 * the inputs it needs (each with its own natural-language patterns and examples)
 * and a `run()` that calls the existing engine functions. The UI is then only a
 * renderer, and new capabilities are a data change rather than new screens.
 */

import type { PatternSpec } from './patterns';

export type { PatternSpec };

export interface CapturedValue {
  /** What the author called this input. */
  name: string;
  value: number;
}

export interface SolveContext {
  /** The user's own words, exactly as typed. */
  raw: string;
  /** Inputs captured both from the sentence and from explicit fields. */
  captures: CapturedValue[];
  /** Convenience lookup by input name. */
  get(name: string): number | undefined;
  /**
   * Raw text captured by the sentence (unit words, function bodies, datasets…),
   * by slot name. Capabilities that need wording rather than numbers read this.
   */
  text: Record<string, string>;
  /** Convenience lookup for text inputs, falling back to the sentence. */
  getText(name: string): string | undefined;
}

export interface StatRow {
  label: string;
  value: string;
  emphasize?: boolean;
  unit?: string;
}

export interface ResultTable {
  columns: string[];
  rows: (string | number)[][];
}

export interface ResultBlock {
  kind: 'stats' | 'text' | 'math' | 'table' | 'list' | 'note';
  title?: string;
  /** For `stats`: label/value pairs. */
  rows?: StatRow[];
  /** For `text` / `math` / `note`. */
  text?: string;
  /** For `list`. */
  items?: string[];
  /** For `table`. */
  table?: ResultTable;
  /** Reusable action attributes for UI renderers (keyboard labels, copy text). */
  emphasize?: boolean;
}

export interface SolveResult {
  ok: true;
  /** Headline shown at the top of the answer. */
  headline: string;
  /** One-line restatement of what was understood, e.g. "convert 5 km → miles". */
  understood: string;
  blocks: ResultBlock[];
  /** Text suitable for the results explorer / history. */
  copyText: string;
  /**
   * Whether the numbers should be treated as money (adds a currency-style
   * prefix in the UI, never a fake currency symbol).
   */
  money?: boolean;
}

export interface SolveFailure {
  ok: false;
  /** Human explanation of why this example could not run. */
  message: string;
}

export type SolveOutcome = SolveResult | SolveFailure;

export interface InputSpec {
  name: string;
  label: string;
  /** Prompt shown in the form, e.g. "the function to plot". */
  hint?: string;
  example?: string;
  optional?: boolean;
  kind?: 'number' | 'text' | 'dataset';
  /** Use the engine (`x^2 + 3x`) rather than a plain number. */
  expression?: boolean;
  unit?: string;
}

export interface ExampleSpec {
  /** What the user would type. */
  text: string;
  /** The plan this example belongs to. */
  capabilityId: string;
  /** Values extracted by pattern rather than by explicit fields. */
  captures: CapturedValue[];
}

export interface Capability {
  id: string;
  /** Short human name, e.g. "Solve an equation". */
  title: string;
  /** The plain-language promise, e.g. "Find what x must be." */
  promise: string;
  /** Grouping for the picker. */
  group:
    | 'Everyday maths'
    | 'Algebra & equations'
    | 'Graphs & calculus'
    | 'Data & statistics'
    | 'Matrices & vectors'
    | 'Geometry'
    | 'Physics & engineering'
    | 'Money'
    | 'Dates & time'
    | 'Numbers & units';
  /** Words that select this capability. Longer phrases score higher. */
  keywords: string[];
  /** Example sentences that also act as the pattern corpus. */
  examples: ExampleSpec[];
  /** Fallback field definitions for people who prefer filling a form. */
  inputs: InputSpec[];
  /**
   * Optional sentence templates that pull numbers straight out of the user's
   * words (see `intents/patterns.ts`). Capabilities without patterns simply use
   * the field values.
   */
  patterns?: PatternSpec[];
  run(context: SolveContext): SolveOutcome;
}

export const CATEGORY_ORDER: Capability['group'][] = [
  'Everyday maths',
  'Numbers & units',
  'Algebra & equations',
  'Graphs & calculus',
  'Data & statistics',
  'Matrices & vectors',
  'Geometry',
  'Physics & engineering',
  'Money',
  'Dates & time',
];
