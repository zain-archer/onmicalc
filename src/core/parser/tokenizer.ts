import { CalcError } from '@/core/errors';
import type { Token } from './tokens';

/** Unicode look-alikes normalised to ASCII operators. */
const OPERATOR_MAP: Readonly<Record<string, string>> = {
  '×': '*',
  '∙': '*',
  '·': '*',
  '⋅': '*',
  '÷': '/',
  '∕': '/',
  '−': '-',
  '–': '-',
  '—': '-',
  '⁒': '/',
};

/** Single-character constants rewritten to their identifier form. */
const IDENT_MAP: Readonly<Record<string, string>> = {
  'π': 'pi',
  'τ': 'tau',
  'φ': 'phi',
  'ϕ': 'phi',
  '√': 'sqrt',
  '∛': 'cbrt',
};

/**
 * Symbols that are recognised but cannot be a *value*. They used to be rewritten
 * to an identifier the engine does not know (`∞` became the name "inf"), so the
 * user was told "Unknown name \"inf\"" for a character they never typed.
 */
const REJECTED_SYMBOLS: Readonly<Record<string, string>> = {
  '∞': 'Infinity is not a value you can calculate with — it describes what a result approaches. Use the Calculus tool for limits, or type a very large number.',
  '⧜': 'This symbol is not supported. Type a number, a name, or an operator instead.',
};

const POSTFIX_MAP: Readonly<Record<string, string>> = {
  '²': '^2',
  '³': '^3',
};

/** Words that behave as binary operators. */
const WORD_OPERATORS = new Set(['mod', 'and', 'or', 'xor']);

const IDENT_START = /[A-Za-z_]/;
const IDENT_BODY = /[A-Za-z0-9_]/;
const DIGIT = /[0-9]/;

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && DIGIT.test(ch);
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const pushOperator = (op: string, start: number, end: number) => {
    tokens.push({ type: 'op', value: op, start, end });
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1;
      continue;
    }

    // Numbers, including 1.5, .5, 1.2e-5, 3E8
    if (isDigit(ch) || (ch === '.' && isDigit(source[i + 1]))) {
      const start = i;
      while (isDigit(source[i])) i += 1;
      if (source[i] === '.') {
        i += 1;
        while (isDigit(source[i])) i += 1;
      }
      // Exponent marker only counts when followed by digits (optional sign),
      // so `2e` still means 2 * e and `2e3` means 2000.
      if (source[i] === 'e' || source[i] === 'E') {
        let j = i + 1;
        if (source[j] === '+' || source[j] === '-') j += 1;
        if (isDigit(source[j])) {
          i = j;
          while (isDigit(source[i])) i += 1;
        }
      }
      const text = source.slice(start, i);
      const num = Number(text);
      if (!Number.isFinite(num)) {
        throw new CalcError('SYNTAX', `Invalid number "${text}"`, {
          position: start,
          length: text.length,
        });
      }
      tokens.push({ type: 'number', value: text, num, start, end: i });
      continue;
    }

    if (IDENT_START.test(ch)) {
      const start = i;
      while (i < source.length && IDENT_BODY.test(source[i]!)) i += 1;
      const word = source.slice(start, i).toLowerCase();
      if (WORD_OPERATORS.has(word)) {
        pushOperator(word, start, i);
      } else {
        tokens.push({ type: 'ident', value: word, start, end: i });
      }
      continue;
    }

    const mapped = OPERATOR_MAP[ch];
    if (mapped) {
      pushOperator(mapped, i, i + 1);
      i += 1;
      continue;
    }

    const rejection = REJECTED_SYMBOLS[ch];
    if (rejection) {
      throw new CalcError('SYNTAX', `Unsupported symbol "${ch}"`, {
        position: i,
        length: 1,
        details: rejection,
      });
    }

    const ident = IDENT_MAP[ch];
    if (ident) {
      tokens.push({ type: 'ident', value: ident, start: i, end: i + 1 });
      i += 1;
      continue;
    }

    const postfix = POSTFIX_MAP[ch];
    if (postfix) {
      pushOperator('^', i, i + 1);
      const digit = postfix.slice(1);
      tokens.push({ type: 'number', value: digit, num: Number(digit), start: i + 1, end: i + 1 });
      i += 1;
      continue;
    }

    if (ch === '*' && source[i + 1] === '*') {
      pushOperator('^', i, i + 2);
      i += 2;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '!' || ch === '%') {
      pushOperator(ch, i, i + 1);
      i += 1;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      tokens.push({ type: 'lparen', value: '(', start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (ch === ')' || ch === ']' || ch === '}') {
      tokens.push({ type: 'rparen', value: ')', start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'comma', value: ',', start: i, end: i + 1 });
      i += 1;
      continue;
    }

    throw new CalcError('SYNTAX', `Unexpected character "${ch}"`, { position: i, length: 1 });
  }

  tokens.push({ type: 'eof', value: '', start: source.length, end: source.length });
  return tokens;
}
