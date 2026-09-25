/**
 * What OmniCalc knows.
 *
 * A data-driven knowledge base so "what is pi", "define acceleration" or "unit
 * of power" can be answered with a real definition, the value, the unit and a
 * source — never a fabricated one. Entries are plain data (`entries/*.json`) so
 * adding knowledge is a data change, and `resolveTerm()` also understands terms
 * that are *not* in the base (anything the engine or the unit converter knows).
 *
 * Rules:
 * - A term is only described here if it is stable, checkable and sourced.
 * - Lookups are exact-then-fuzzy, so typos work without inventing an answer.
 * - Anything unknown is reported as unknown; the app never guesses a definition.
 */

import maths from './entries/maths.json';
import physics from './entries/physics.json';
import chemistry from './entries/chemistry.json';
import computing from './entries/computing.json';
import finance from './entries/finance.json';
import { ALL_CONSTANT_VALUES, constantRecords } from '@/constants';
import { tokenize } from '@/core/parser/tokenizer';
import { ALL_CONSTANT_ALIASES } from '@/constants';
import { UNIT_CATEGORIES_FOR_LOOKUP, findAnyUnit } from './units-bridge';
import { closestWord, damerauDistance } from '@/intents/fuzzy';

export interface KnowledgeEntry {
  id: string;
  /** Canonical term, e.g. "acceleration". */
  term: string;
  /** Other spellings people use, e.g. "rate of change of velocity". */
  aliases?: string[];
  /** Short, one-sentence meaning. */
  summary: string;
  /** Optional longer explanation or historical note. */
  detail?: string;
  /** Symbol, if there is one. */
  symbol?: string;
  /** Numeric value where the term *is* a number (pi, e, c). */
  value?: number;
  /** Exact display string when the value is irrational or a definition. */
  display?: string;
  /** SI or common unit. */
  unit?: string;
  /** Formula(s) in engine syntax — these can be evaluated or graphed. */
  formula?: string;
  /** Where the value/definition comes from. */
  source?: string;
  /** Related terms, for exploration. */
  seeAlso?: string[];
  /** Grouping for the reference list. */
  area: string;
}

const AREAS = [
  { id: 'maths', label: 'Mathematics', entries: maths },
  { id: 'physics', label: 'Physics', entries: physics },
  { id: 'chemistry', label: 'Chemistry', entries: chemistry },
  { id: 'computing', label: 'Computing', entries: computing },
  { id: 'finance', label: 'Money', entries: finance },
] as const;

let cache: KnowledgeEntry[] | null = null;

export function allEntries(): KnowledgeEntry[] {
  cache ??= AREAS.flatMap((area) =>
    (area.entries as Omit<KnowledgeEntry, 'area'>[]).map((entry) => ({ ...entry, area: area.label })),
  );
  return cache;
}

export function areas(): { label: string; count: number }[] {
  const everything = allEntries();
  return AREAS.map((area) => ({
    label: area.label,
    count: everything.filter((entry) => entry.area === area.label).length,
  })).filter((area) => area.count > 0);
}

function normalise(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Exact match on term or alias. */
function exactMatch(needle: string): KnowledgeEntry | undefined {
  const clean = normalise(needle);
  if (!clean) return undefined;
  const withArticle = clean.replace(/^(the|a|an) /, '');
  return (
    allEntries().find((entry) => normalise(entry.term) === withArticle) ??
    allEntries().find((entry) => (entry.aliases ?? []).some((alias) => normalise(alias) === withArticle))
  );
}

/**
 * Find an exact entry, else the closest term (typos welcome), else a term the
 * engine or unit converter knows but the base does not describe.
 */
export function resolveTerm(term: string): { entry?: KnowledgeEntry; suggestion?: string; known?: boolean } {
  const direct = exactMatch(term);
  if (direct) return { entry: direct };

  const clean = normalise(term.replace(/^(the|a|an) /, ''));
  if (!clean) return {};

  // An exact unit, constant or function name is never "corrected" into a
  // different word: "mile" must stay a mile, not become "mole".
  if (findAnyUnit(clean)) return { known: true };
  if (clean in ALL_CONSTANT_VALUES) return { known: true };
  if (ALL_CONSTANT_ALIASES.some((alias) => normalise(alias) === clean)) return { known: true };
  if (FUNCTION_NAMES.has(clean)) return { known: true };
  if (UNIT_CATEGORIES_FOR_LOOKUP.some((category) => category.id === clean || normalise(category.label) === clean)) {
    return { known: true };
  }

  const vocabulary = allEntries().flatMap((entry) => [normalise(entry.term), ...(entry.aliases ?? []).map(normalise)]);
  if (clean.length >= 4) {
    const near = closestWord(clean.replace(/ /g, ''), vocabulary.map((word) => word.replace(/ /g, '')));
    if (near) {
      const hit = allEntries().find((entry) =>
        [normalise(entry.term), ...(entry.aliases ?? []).map(normalise)].some(
          (value) => value.replace(/ /g, '') === near,
        ),
      );
      if (hit) return { entry: hit, suggestion: hit.term, known: true };
    }
  }

  // Nothing matched at all: report it instead of guessing.
  return {};
}

export function searchKnowledge(query: string, limit = 20): KnowledgeEntry[] {
  const needle = normalise(query);
  if (!needle) return allEntries().slice(0, limit);
  const scored = allEntries()
    .map((entry) => {
      const haystack = normalise(
        [entry.term, ...(entry.aliases ?? []), entry.summary, entry.area, entry.symbol ?? ''].join(' '),
      );
      let score = 0;
      if (normalise(entry.term).startsWith(needle)) score += 60;
      else if (haystack.includes(needle)) score += 30;
      else {
        const budget = Math.min(2, Math.max(0, Math.floor(needle.length / 4)));
        if (budget > 0 && damerauDistance(needle, normalise(entry.term).slice(0, needle.length + 2), budget) <= budget) {
          score += 12;
        }
      }
      return { entry, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((hit) => hit.entry);
}

/** Constants (CODATA/maths) described as knowledge entries, for "what is c?" … */
export function constantEntries(): KnowledgeEntry[] {
  return constantRecords().map((record) => ({
    id: `constant:${record.name}`,
    term: record.name,
    aliases: record.aliases ? [...record.aliases] : undefined,
    summary: record.description,
    symbol: record.symbol,
    value: record.value,
    display: record.display,
    unit: record.unit || undefined,
    source: record.source,
    area: record.category === 'physical' ? 'Physics' : 'Mathematics',
  }));
}

/**
 * Identifiers inside a formula that are not the answer itself — useful for
 * telling the user what a formula needs before they try to graph it.
 */
export function formulaVariables(entry: KnowledgeEntry): string[] {
  if (!entry.formula) return [];
  let tokens;
  try {
    tokens = tokenize(entry.formula);
  } catch {
    return [];
  }
  const known = new Set(['x', 'e', 'pi', 'tau', 'ans']);
  const names = new Set<string>();
  for (const token of tokens) {
    if (token.type !== 'ident') continue;
    const name = token.value;
    if (known.has(name) || name in ALL_CONSTANT_VALUES || FUNCTION_NAMES.has(name)) continue;
    names.add(name);
  }
  return [...names].sort();
}

/** Function names the engine can evaluate — they count as "known" terms. */
const FUNCTION_NAMES = new Set(
  [
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'log2', 'log10',
    'exp', 'sqrt', 'cbrt', 'root', 'pow', 'abs', 'round', 'floor', 'ceil', 'min', 'max', 'mod', 'fact',
    'gcd', 'lcm', 'gamma', 'erf', 'hypot', 'sign', 'trunc',
  ],
);
