export type KeyAction =
  | 'equals'
  | 'clear'
  | 'backspace'
  | 'ans'
  | 'memory-add'
  | 'memory-subtract'
  | 'memory-recall'
  | 'memory-clear';

export interface KeyDef {
  label: string;
  /** Text inserted at the caret. Omit for pure action keys. */
  insert?: string;
  /** Caret offset relative to the inserted text (see insert.ts). */
  caret?: number;
  action?: KeyAction;
  /** Screen-reader label when the visual label is a symbol. */
  title?: string;
  variant?: 'digit' | 'operator' | 'function' | 'accent' | 'danger';
}

const digit = (label: string): KeyDef => ({ label, insert: label, variant: 'digit' });

export const BASIC_KEYS: readonly KeyDef[] = [
  { label: 'AC', action: 'clear', variant: 'danger', title: 'Clear expression' },
  { label: '⌫', action: 'backspace', title: 'Backspace' },
  { label: '(', insert: '(', variant: 'operator' },
  { label: ')', insert: ')', variant: 'operator' },
  { label: '÷', insert: '÷', variant: 'operator', title: 'Divide' },
  digit('7'),
  digit('8'),
  digit('9'),
  { label: '×', insert: '×', variant: 'operator', title: 'Multiply' },
  { label: '%', insert: '%', variant: 'operator', title: 'Percent (divides by 100)' },
  digit('4'),
  digit('5'),
  digit('6'),
  { label: '−', insert: '-', variant: 'operator', title: 'Subtract' },
  { label: 'mod', insert: ' mod ', variant: 'operator', title: 'Remainder' },
  digit('1'),
  digit('2'),
  digit('3'),
  { label: '+', insert: '+', variant: 'operator', title: 'Add' },
  { label: '±', insert: '-', variant: 'operator', title: 'Negate' },
  digit('0'),
  { label: '.', insert: '.', variant: 'digit' },
  { label: '=' , action: 'equals', variant: 'accent' },
];

/** Keys offered in the scientific keypad; the row above the digits adds function keys. */
export const SCIENTIFIC_KEYS: readonly KeyDef[] = [
  { label: 'x²', insert: '²', variant: 'function', title: 'Square' },
  { label: 'x³', insert: '³', variant: 'function', title: 'Cube' },
  { label: 'xʸ', insert: '^', caret: 0, variant: 'function', title: 'Power' },
  { label: '√', insert: 'sqrt(', caret: -1, variant: 'function', title: 'Square root' },
  { label: '∛', insert: 'cbrt(', caret: -1, variant: 'function', title: 'Cube root' },
  { label: '1/x', insert: '1/(', caret: -1, variant: 'function', title: 'Reciprocal' },
  { label: 'n!', insert: '!', variant: 'function', title: 'Factorial' },
  { label: '|x|', insert: 'abs(', caret: -1, variant: 'function', title: 'Absolute value' },
  { label: 'π', insert: 'π', variant: 'function' },
  { label: 'e', insert: 'e', variant: 'function' },
  { label: 'τ', insert: 'τ', variant: 'function' },
  { label: 'eˣ', insert: 'exp(', caret: -1, variant: 'function', title: 'e to the power x' },
  { label: '10ˣ', insert: '10^(', caret: -1, variant: 'function', title: '10 to the power x' },
  { label: 'log', insert: 'log(', caret: -1, variant: 'function', title: 'Base 10 logarithm' },
  { label: 'ln', insert: 'ln(', caret: -1, variant: 'function', title: 'Natural logarithm' },
  { label: 'logₙ', insert: 'log(', caret: -1, variant: 'function', title: 'Logarithm with base: log(x, base)' },
  { label: 'exp', insert: 'exp(', caret: -1, variant: 'function', title: 'Exponential' },
  { label: 'round', insert: 'round(', caret: -1, variant: 'function' },
  { label: 'floor', insert: 'floor(', caret: -1, variant: 'function' },
  { label: 'ceil', insert: 'ceil(', caret: -1, variant: 'function' },
  { label: 'min', insert: 'min(', caret: -1, variant: 'function' },
  { label: 'max', insert: 'max(', caret: -1, variant: 'function' },
  { label: 'atan2', insert: 'atan2(', caret: -1, variant: 'function' },
  { label: 'Ans', action: 'ans', variant: 'function', title: 'Last answer' },
  { label: 'M+', action: 'memory-add', variant: 'function', title: 'Add result to memory' },
  { label: 'MR', action: 'memory-recall', variant: 'function', title: 'Recall memory' },
];

/** Trig row is generated so inverse/hyperbolic toggles stay honest. */
export function trigKeys(mode: { inverse: boolean; hyperbolic: boolean }): readonly KeyDef[] {
  const base = ['sin', 'cos', 'tan'] as const;
  const names = base.map((name) => {
    if (mode.hyperbolic) return mode.inverse ? `a${name}h` : `${name}h`;
    return mode.inverse ? `a${name}` : name;
  });
  return names.map((name) => ({
    label: name.replace('a', '').replace('h', mode.hyperbolic ? 'ʰ' : '') + (mode.inverse ? '⁻¹' : ''),
    insert: `${name}(`,
    caret: -1,
    title: `${name}()`,
    variant: 'function' as const,
  }));
}
