import { CalcError } from '@/core/errors';
import { getElement } from './elements';

/**
 * Chemical formula parsing and the quantities that follow from it.
 *
 * The parser is a hand-written recursive descent over the formula grammar —
 * no regular-expression guesswork, so nesting is handled properly and errors
 * point at the character that went wrong:
 *
 *   formula  := part+
 *   part     := group (H2O, NaCl) | '(' formula ')' count? | '[' formula ']' count?
 *   group    := symbol count?        (2 to 3 letters, first upper case)
 *   count    := digits
 *
 * Hydrates are written with a dot or a middle dot (`CuSO4·5H2O`), which the
 * grammar treats as multiplication of the whole hydrate unit — exactly what a
 * chemist means by it.
 */

export interface FormulaPart {
  symbol: string;
  count: number;
}

export interface ParsedFormula {
  /** Canonical display form, e.g. "CuSO4·5H2O". */
  display: string;
  parts: FormulaPart[];
  /** Total number of atoms in one formula unit. */
  atoms: number;
}

interface GroupNode {
  parts: FormulaPart[];
  /** Hydrate multiplier from a leading number. */
  multiplier: number;
}

function parseGroup(source: string, start: number, closing?: string): { node: GroupNode; next: number } {
  const parts: FormulaPart[] = [];
  let index = start;
  let multiplier = 1;

  // A leading number before a hydrate unit: "5H2O" in CuSO4·5H2O.
  const digitStart = index;
  while (index < source.length && /\d/.test(source[index]!)) index += 1;
  if (index > digitStart) {
    multiplier = Number(source.slice(digitStart, index));
    if (!Number.isFinite(multiplier) || multiplier < 1) {
      throw new CalcError('INPUT', `“${source.slice(digitStart, index)}” is not a valid multiplier`, {
        position: digitStart,
        details: 'A hydrate multiplier such as the 5 in CuSO4·5H2O must be a whole number of at least 1.',
      });
    }
  }

  while (index < source.length) {
    const character = source[index]!;
    if (closing && character === closing) {
      return { node: { parts, multiplier }, next: index + 1 };
    }
    if (character === '(' || character === '[') {
      const expected = character === '(' ? ')' : ']';
      const inner = parseGroup(source, index + 1, expected);
      if (source[inner.next - 1] !== expected) {
        throw new CalcError('INPUT', `This ${character === '(' ? 'bracket' : 'square bracket'} is never closed`, {
          position: index,
          details: 'Every bracket in a formula needs its partner, for example Ca(OH)2.',
        });
      }
      let after = inner.next;
      const countStart = after;
      while (after < source.length && /\d/.test(source[after]!)) after += 1;
      const count = after > countStart ? Number(source.slice(countStart, after)) : 1;
      for (const part of inner.node.parts) {
        parts.push({ symbol: part.symbol, count: part.count * inner.node.multiplier * count });
      }
      index = after;
      continue;
    }
    if (character === ')' || character === ']') {
      throw new CalcError('INPUT', `Unexpected “${character}”`, {
        position: index,
        details: 'There is no matching opening bracket before it.',
      });
    }
    if (character === '·' || character === '.' || character === '*') {
      // Hydrate separator: the rest of the formula is a separate unit that adds.
      const remainder = parseGroup(source, index + 1);
      for (const part of remainder.node.parts) {
        parts.push({ symbol: part.symbol, count: part.count * remainder.node.multiplier });
      }
      index = source.length;
      break;
    }
    if (!/[A-Za-z]/.test(character)) {
      throw new CalcError('INPUT', `“${character}” cannot appear in a chemical formula`, {
        position: index,
        details: 'Use element symbols, digits, brackets, and a dot for hydrates (CuSO4·5H2O).',
      });
    }
    if (character !== character.toUpperCase()) {
      throw new CalcError('INPUT', `Element symbols start with a capital letter — did you mean “${character.toUpperCase()}”?`, {
        position: index,
      });
    }
    let after = index + 1;
    while (after < source.length && /[a-z]/.test(source[after]!) && after - index < 3) after += 1;
    const symbol = source.slice(index, after);
    const element = getElement(symbol);
    if (!element) {
      // Try the one-letter symbol (Hf vs H).
      const single = getElement(source.slice(index, index + 1));
      if (!single) {
        throw new CalcError('INPUT', `“${symbol}” is not an element symbol`, {
          position: index,
          details: 'Check the spelling — element symbols are one or two letters, and the second is lower case.',
        });
      }
      const countDigits = countAfter(source, index + 1);
      parts.push({ symbol: single.symbol, count: countDigits.count });
      index = countDigits.next;
      continue;
    }
    const countDigits = countAfter(source, after);
    parts.push({ symbol: element.symbol, count: countDigits.count });
    index = countDigits.next;
  }

  if (closing) {
    throw new CalcError('INPUT', `This formula is missing a closing “${closing}”`, { position: start });
  }
  return { node: { parts, multiplier }, next: index };
}

function countAfter(source: string, start: number): { count: number; next: number } {
  let index = start;
  while (index < source.length && /\d/.test(source[index]!)) index += 1;
  if (index === start) return { count: 1, next: start };
  const count = Number(source.slice(start, index));
  if (!Number.isFinite(count) || count <= 0) {
    throw new CalcError('INPUT', `“${source.slice(start, index)}” is not a valid atom count`, { position: start });
  }
  return { count, next: index };
}

/** Parses a formula into its element counts, merging repeated elements. */
export function parseFormula(formula: string): ParsedFormula {
  const source = formula.replace(/\s+/g, '');
  if (!source) {
    throw new CalcError('INPUT', 'Type a chemical formula, for example H2O or C6H12O6.');
  }
  const { node } = parseGroup(source, 0);
  const merged = new Map<string, number>();
  for (const part of node.parts) {
    merged.set(part.symbol, (merged.get(part.symbol) ?? 0) + part.count * node.multiplier);
  }
  if (merged.size === 0) {
    throw new CalcError('INPUT', `“${formula}” does not contain any elements`);
  }
  const parts = [...merged.entries()].map(([symbol, count]) => ({ symbol, count }));
  return {
    display: renderFormula(parts),
    parts,
    atoms: parts.reduce((total, part) => total + part.count, 0),
  };
}

function renderFormula(parts: FormulaPart[]): string {
  return parts.map((part) => `${part.symbol}${part.count === 1 ? '' : part.count}`).join('');
}

export interface MolarMassResult extends ParsedFormula {
  /** Molar mass in g/mol. */
  molarMass: number;
  /** True when any element's mass is a mass number (unstable element). */
  approximate: boolean;
}

/** Molar mass in g/mol from a formula. */
export function molarMass(formula: string): MolarMassResult {
  const parsed = parseFormula(formula);
  let total = 0;
  let approximate = false;
  for (const part of parsed.parts) {
    const element = getElement(part.symbol)!;
    if (element.synthetic) approximate = true;
    total += element.mass * part.count;
  }
  return { ...parsed, molarMass: total, approximate };
}

export interface CompositionRow {
  symbol: string;
  name: string;
  count: number;
  /** Mass contributed by this element in g/mol. */
  mass: number;
  /** Percentage of the molar mass, 0–100. */
  percent: number;
}

/** Mass percentage of every element in a formula. */
export function percentComposition(formula: string): { molarMass: number; rows: CompositionRow[] } {
  const result = molarMass(formula);
  const rows = result.parts.map((part) => {
    const element = getElement(part.symbol)!;
    const mass = element.mass * part.count;
    return {
      symbol: element.symbol,
      name: element.name,
      count: part.count,
      mass,
      percent: (mass / result.molarMass) * 100,
    };
  });
  rows.sort((a, b) => b.percent - a.percent);
  return { molarMass: result.molarMass, rows };
}

export interface EmpiricalResult {
  /** Smallest whole-number formula, e.g. "CH2O". */
  formula: string;
  /** Mole ratio before scaling to whole numbers. */
  ratios: { symbol: string; percent: number; moles: number; ratio: number }[];
  /** Total of the percentages that were supplied. */
  totalPercent: number;
  note: string;
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.round(Math.abs(a));
  let y = Math.round(Math.abs(b));
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

/** Smallest whole-number ratio, with a search for the multipliers that clear fractions. */
function smallWholeNumbers(values: number[]): number[] {
  if (values.every((value) => Math.abs(value - Math.round(value)) < 1e-3)) {
    return values.map((value) => Math.round(value));
  }
  for (let multiplier = 1; multiplier <= 12; multiplier += 1) {
    const scaled = values.map((value) => value * multiplier);
    if (scaled.every((value) => Math.abs(value - Math.round(value)) < 1e-3)) {
      return scaled.map((value) => Math.round(value));
    }
  }
  // Nothing small fits: fall back to the values themselves, disclosed in the note.
  return values.map((value) => Number(value.toFixed(3)));
}

/**
 * Empirical formula from mass percentages (they should add up to 100 %).
 * The result is the smallest whole-number ratio, which is what an empirical
 * formula is; the note says when a molecular formula would need the molar mass.
 */
export function empiricalFormula(percentages: Record<string, number>): EmpiricalResult {
  const entries = Object.entries(percentages).filter(([, percent]) => Number.isFinite(percent) && percent > 0);
  if (entries.length === 0) {
    throw new CalcError('INPUT', 'Give the mass percentage of at least one element, for example C = 40, H = 6.7, O = 53.3');
  }
  const totalPercent = entries.reduce((total, [, percent]) => total + percent, 0);
  const moles = entries.map(([symbol, percent]) => {
    const element = getElement(symbol);
    if (!element) {
      throw new CalcError('INPUT', `“${symbol}” is not an element symbol`, {
        details: 'Use symbols such as C, H, O, Na, Cl.',
      });
    }
    return { symbol: element.symbol, percent, moles: percent / element.mass };
  });
  const smallest = Math.min(...moles.map((entry) => entry.moles));
  const ratios = moles.map((entry) => entry.moles / smallest);
  const whole = smallWholeNumbers(ratios);
  const divisor = whole.reduce((current, value) => greatestCommonDivisor(current, value), whole[0]!);
  const finalCounts = whole.map((value) => Math.max(1, Math.round(value / divisor)));

  const pairs: { symbol: string; percent: number; moles: number; ratio: number }[] = moles.map((entry, index) => ({
    ...entry,
    ratio: finalCounts[index]!,
  }));
  // Hill order: carbon, then hydrogen, then the rest alphabetically — the
  // convention chemists read (CH2O, not H2CO).
  const hill = (symbol: string): [number, string] =>
    symbol === 'C' ? [0, ''] : symbol === 'H' ? [1, ''] : [2, symbol];
  pairs.sort((a, b) => {
    const [groupA, nameA] = hill(a.symbol);
    const [groupB, nameB] = hill(b.symbol);
    return groupA - groupB || nameA.localeCompare(nameB);
  });
  const formula = pairs.map((pair) => `${pair.symbol}${pair.ratio === 1 ? '' : pair.ratio}`).join('');

  const notes: string[] = [];
  if (Math.abs(totalPercent - 100) > 5) {
    notes.push(`The percentages add up to ${Number(totalPercent.toFixed(2))} %, not 100 % — the ratio is still scaled to whole numbers, but check the data.`);
  }
  notes.push('This is the empirical formula: the smallest whole-number ratio. A molecular formula needs the molar mass as well.');
  return { formula, ratios: pairs, totalPercent, note: notes.join(' ') };
}
