import { closestWord } from './fuzzy';
import { CATEGORIES, categoryById } from '@/conversions/definitions';
import { convert, findUnit } from '@/conversions/engine';

/**
 * Unit words → a conversion target.
 *
 * The conversion engine is data-driven, so unit vocabulary is generated from it
 * rather than hand-written. That keeps "5 km to miles", "5 kilometres in mi" and
 * "how many miles is 5 km" working for every unit the app supports.
 */

export interface UnitHit {
  categoryId: string;
  unitId: string;
  /** Canonical singular word for the "understood" line. */
  label: string;
  symbol: string;
}

/** Words that never identify a unit on their own (too ambiguous across categories). */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'c', 'd', 'in the', 'is', 'it', 'm', 'of', 'per', 's',
]);

function normalise(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/[°]/g, '')
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ');
}

/**
 * Singular forms of a word: "kilometres" → "kilometre", "miles" → "mile",
 * "inches" → "inch", "feet" stays "feet" (matched by alias anyway).
 */
function singulars(word: string): string[] {
  const forms = new Set<string>([word]);
  if (word.endsWith('ies')) forms.add(`${word.slice(0, -3)}y`);
  if (word.endsWith('es')) forms.add(word.slice(0, -2));
  if (word.endsWith('s')) forms.add(word.slice(0, -1));
  if (word.endsWith('feet')) forms.add('foot');
  if (word.endsWith('centimetres')) forms.add('centimetre');
  return [...forms];
}

interface Vocabulary {
  lookup: Map<string, UnitHit[]>;
  /** Every unit word, longest first, for building regexes. */
  words: string[];
}

let cache: Vocabulary | null = null;

function buildVocabulary(): Vocabulary {
  const lookup = new Map<string, UnitHit[]>();
  const words = new Set<string>();

  for (const category of CATEGORIES) {
    for (const unit of category.units) {
      const hit: UnitHit = {
        categoryId: category.id,
        unitId: unit.id,
        label: unit.label,
        symbol: unit.symbol,
      };
      const spellings = new Set(
        [unit.id, unit.symbol, unit.label, ...(unit.aliases ?? [])]
          .flatMap((form) => [normalise(form), ...singulars(normalise(form))])
          .filter((form) => form.length > 0 && !STOP_WORDS.has(form) && !/^\d+$/.test(form)),
      );
      for (const spelling of spellings) {
        const existing = lookup.get(spelling) ?? [];
        if (!existing.some((entry) => entry.categoryId === hit.categoryId && entry.unitId === hit.unitId)) {
          existing.push(hit);
        }
        lookup.set(spelling, existing);
        words.add(spelling);
      }
    }
  }

  return { lookup, words: [...words].sort((a, b) => b.length - a.length) };
}

function vocabulary(): Vocabulary {
  cache ??= buildVocabulary();
  return cache;
}

/** All unit words, longest first — used to extract units from free text. */
export function unitWords(): string[] {
  return vocabulary().words;
}

/**
 * Looks a word up as a unit. When several categories use the same word (for
 * example "t" for tonne and tesla), pass a hint category to disambiguate.
 */
export function lookupUnit(word: string, hint?: string): UnitHit | undefined {
  const direct = lookupExactly(word, hint);
  if (direct) return direct;
  // A mistyped unit ("kilomter", "fahrenhite") is still worth understanding.
  const guess = closestWord(normalise(word), unitWords());
  if (guess && guess !== normalise(word)) return lookupExactly(guess, hint);
  return undefined;
}

function lookupExactly(word: string, hint?: string): UnitHit | undefined {
  const forms = singulars(normalise(word));
  const candidates: UnitHit[] = [];
  for (const form of forms) {
    candidates.push(...(vocabulary().lookup.get(form) ?? []));
  }
  if (candidates.length === 0) return undefined;
  if (hint) {
    const hinted = candidates.find((entry) => entry.categoryId === hint);
    if (hinted) return hinted;
  }
  return candidates[0];
}

/** True when the word is a unit in the given category. */
/** True when the sentence mentions a real unit name (two letters or more, so "m" alone is ignored). */
export function hasUnitWords(text: string): boolean {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9°µ ]+/g, ' ')} `;
  return unitWords().some((word) => word.length >= 2 && haystack.includes(` ${word.toLowerCase()} `));
}

export function isUnit(word: string, categoryId?: string): boolean {
  const hit = lookupUnit(word, categoryId);
  return Boolean(hit && (!categoryId || hit.categoryId === categoryId));
}

/** Every category id a word belongs to (for ambiguity warnings). */
export function categoriesFor(word: string): string[] {
  const forms = singulars(normalise(word));
  const ids = new Set<string>();
  for (const form of forms) {
    for (const hit of vocabulary().lookup.get(form) ?? []) ids.add(hit.categoryId);
  }
  return [...ids];
}

export interface ConversionOutcome {
  categoryLabel: string;
  from: UnitHit;
  to: UnitHit;
  value: number;
  result: number;
  /** Whether the two units came from the same category (required). */
  compatible: boolean;
}

/** Converts between two unit words, inferring the category from the units. */
export function convertByWords(value: number, fromWord: string, toWord: string): ConversionOutcome {
  const fromHit = lookupUnit(fromWord);
  if (!fromHit) throw new Error(`"${fromWord}" is not a unit OmniCalc knows.`);
  const toHit = lookupUnit(toWord, fromHit.categoryId);
  if (!toHit) throw new Error(`"${toWord}" is not a unit OmniCalc knows.`);

  const category = categoryById(fromHit.categoryId);
  if (!category) throw new Error(`Unknown unit category for "${fromWord}".`);
  if (fromHit.categoryId !== toHit.categoryId) {
    const other = categoryById(toHit.categoryId);
    throw new Error(
      `"${fromHit.label}" is a ${category.label.toLowerCase()} unit and "${toHit.label}" is a ${other?.label.toLowerCase() ?? 'different'} unit, so they cannot be converted.`,
    );
  }
  if (!findUnit(category, fromHit.unitId) || !findUnit(category, toHit.unitId)) {
    throw new Error('That conversion is not supported.');
  }

  return {
    categoryLabel: category.label,
    from: fromHit,
    to: toHit,
    value,
    result: convert(category, value, fromHit.unitId, toHit.unitId),
    compatible: true,
  };
}

/** Every unit in a category, for "convert 5 km to everything" style answers. */
export function allUnitsOf(categoryId: string): UnitHit[] {
  const category = categoryById(categoryId);
  if (!category) return [];
  return category.units.map((unit) => ({
    categoryId: category.id,
    unitId: unit.id,
    label: unit.label,
    symbol: unit.symbol,
  }));
}

/** Short helper for the "understood" line: "5 km → mi (Length)". */
export function describeConversion(outcome: ConversionOutcome): string {
  return `${outcome.value} ${outcome.from.symbol} → ${outcome.to.symbol} (${outcome.categoryLabel})`;
}
