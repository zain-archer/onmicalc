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

const digit = (label: string): KeyDef => ({ label, insert: label, variant: 'digit', title: label });

/** Symbol keys read badly aloud, so each one carries a spoken name. */
const SYMBOL_TITLES: Record<string, string> = {
  '(': 'Open bracket',
  ')': 'Close bracket',
  '.': 'Decimal point',
  '=': 'Equals, show the result',
  'π': 'Pi',
  'e': "Euler's number e",
  'τ': 'Tau, two pi',
  'x²': 'Square',
  'x³': 'Cube',
  'xʸ': 'Raise to a power',
  '√': 'Square root',
  '∛': 'Cube root',
  '1/x': 'Reciprocal, one over x',
  'n!': 'Factorial',
  '|x|': 'Absolute value',
  'eˣ': 'e to the power of x',
  '10ˣ': '10 to the power of x',
  'logₙ': 'Logarithm with a chosen base',
};

export const BASIC_KEYS: readonly KeyDef[] = [
  { label: 'AC', action: 'clear', variant: 'danger', title: 'Clear expression' },
  { label: '⌫', action: 'backspace', title: 'Backspace' },
  { label: '(', insert: '(', variant: 'operator', title: SYMBOL_TITLES['('] },
  { label: ')', insert: ')', variant: 'operator', title: SYMBOL_TITLES[')'] },
  { label: '÷', insert: '÷', variant: 'operator', title: 'Divide' },
  digit('7'),
  digit('8'),
  digit('9'),
  { label: '×', insert: '×', variant: 'operator', title: 'Multiply' },
  { label: '%', insert: '%', variant: 'operator', title: 'Percent — divides by 100, or increases by that percent in a sum' },
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
  { label: '.', insert: '.', variant: 'digit', title: SYMBOL_TITLES['.'] },
  { label: '=', action: 'equals', variant: 'accent', title: SYMBOL_TITLES['='] },
];

/** Keys offered in the scientific keypad; the row above the digits adds function keys. */
export const SCIENTIFIC_KEYS: readonly KeyDef[] = [
  { label: 'x²', insert: '²', variant: 'function', title: SYMBOL_TITLES['x²'] },
  { label: 'x³', insert: '³', variant: 'function', title: SYMBOL_TITLES['x³'] },
  { label: 'xʸ', insert: '^', caret: 0, variant: 'function', title: SYMBOL_TITLES['xʸ'] },
  { label: '√', insert: 'sqrt(', caret: -1, variant: 'function', title: SYMBOL_TITLES['√'] },
  { label: '∛', insert: 'cbrt(', caret: -1, variant: 'function', title: SYMBOL_TITLES['∛'] },
  { label: '1/x', insert: '1/(', caret: -1, variant: 'function', title: SYMBOL_TITLES['1/x'] },
  { label: 'n!', insert: '!', variant: 'function', title: SYMBOL_TITLES['n!'] },
  { label: '|x|', insert: 'abs(', caret: -1, variant: 'function', title: SYMBOL_TITLES['|x|'] },
  { label: 'π', insert: 'π', variant: 'function', title: SYMBOL_TITLES['π']},
  { label: 'e', insert: 'e', variant: 'function', title: SYMBOL_TITLES['e']},
  { label: 'τ', insert: 'τ', variant: 'function', title: SYMBOL_TITLES['τ']},
  { label: 'eˣ', insert: 'exp(', caret: -1, variant: 'function', title: SYMBOL_TITLES['eˣ'] },
  { label: '10ˣ', insert: '10^(', caret: -1, variant: 'function', title: SYMBOL_TITLES['10ˣ'] },
  { label: 'log', insert: 'log(', caret: -1, variant: 'function', title: 'Base 10 logarithm' },
  { label: 'ln', insert: 'ln(', caret: -1, variant: 'function', title: 'Natural logarithm' },
  { label: 'logₙ', insert: 'log(', caret: -1, variant: 'function', title: SYMBOL_TITLES['logₙ'] },
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
