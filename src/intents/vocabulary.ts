/**
 * The words OmniCalc understands, and the words it must never "correct".
 *
 * The vocabulary is assembled from the app's own data — capability keywords,
 * titles and example sentences, sentence-template wording, unit names, engine
 * function names and physical-constant aliases — so anything the app can act on
 * is also something it can recognise through a typo. Nothing is hand-listed
 * except ordinary English, which is protected instead of corrected.
 */

import { BASIC_FUNCTIONS, SCIENTIFIC_FUNCTIONS } from '@/core/evaluator/functions';
import { ALL_CONSTANT_ALIASES } from '@/constants';
import { everyCapability } from './capabilities';
import { unitWords } from './units';
import { EVERYDAY_FILLER, commonEnglishWords } from './wordlists';

const word = (value: string): string => value.toLowerCase().replace(/[^a-z]/g, '');

/** Words that carry meaning for the app: gathered from data, never hand-written. */
const SOURCES: string[] = [];

export function addVocabularySource(words: readonly string[]): void {
  SOURCES.push(...words);
}

let vocabularyCache: Set<string> | null = null;
let preferredCache: Set<string> | null = null;

/** Rebuilds from the collected sources (called once, lazily). */
export function intentVocabulary(): Set<string> {
  if (vocabularyCache) return vocabularyCache;
  build();
  return vocabularyCache!;
}

/**
 * Words that carry an instruction — capability keywords, sentence-template
 * wording, unit names, function names, constants — as opposed to words that
 * merely appear in an example sentence. Used only to break ties, so a typo like
 * "precent" is read as "percent" (a keyword) rather than "present" (prose).
 */
export function preferredWords(): Set<string> {
  if (preferredCache) return preferredCache;
  build();
  return preferredCache!;
}

function build(): void {
  if (vocabularyCache && preferredCache) return;
  const words = new Set<string>();
  const preferred = new Set<string>();
  const { strong, weak } = wordsTheAppReactsTo();
  const collect = (sources: readonly string[], into: Set<string>): void => {
    for (const source of sources) {
      for (const part of source.split(/[^A-Za-z]+/)) {
        const cleaned = word(part);
        if (cleaned.length >= 3) into.add(cleaned);
      }
    }
  };
  collect([...strong, ...SOURCES], preferred);
  collect(weak, words);
  for (const extra of ['hundred', 'thousand', 'million', 'billion', 'half', 'double', 'triple', 'dozen']) {
    words.add(extra);
  }
  for (const value of preferred) words.add(value);
  vocabularyCache = words;
  preferredCache = preferred;
}

/**
 * Every word the app reacts to, read straight out of its own data: capability
 * keywords, titles, promises, example sentences and sentence templates (their
 * literals, introducers and slot names), plus unit names, engine function names
 * and constant aliases. A new capability therefore extends typo tolerance with
 * no extra work.
 */
function wordsTheAppReactsTo(): { strong: string[]; weak: string[] } {
  const strong: string[] = [];
  const weak: string[] = [];
  for (const capability of everyCapability()) {
    strong.push(capability.title, capability.id, ...capability.keywords);
    weak.push(capability.promise);
    for (const example of capability.examples) weak.push(example.text);
    for (const input of capability.inputs) {
      strong.push(input.name);
      weak.push(input.label, input.hint ?? '');
    }
    for (const pattern of capability.patterns ?? []) {
      for (const slot of pattern.slots) strong.push(slot.name, ...slot.introducers);
      weak.push(pattern.template);
    }
  }
  strong.push(...unitWords(), ...ALL_CONSTANT_ALIASES);
  for (const definition of [...BASIC_FUNCTIONS, ...SCIENTIFIC_FUNCTIONS]) {
    strong.push(definition.name, ...(definition.aliases ?? []));
  }
  // Template literals ("how many", "of a", "between") are instructions too, but
  // they live inside the templates, so add the wording by hand.
  strong.push(
    'function', 'equation', 'formula', 'result', 'answer', 'value', 'values', 'solve', 'convert',
    'plot', 'graph', 'draw', 'sketch', 'integrate', 'differentiate', 'derivative', 'limit',
    'series', 'probability', 'chance', 'average', 'mean', 'median', 'deviation', 'matrix',
    'vector', 'area', 'volume', 'perimeter', 'circumference', 'interest', 'loan', 'mortgage',
    'tip', 'discount', 'split', 'per', 'person', 'people', 'days', 'hours', 'minutes', 'age',
    'speed', 'velocity', 'distance', 'time', 'mass', 'force', 'acceleration', 'density',
    'pressure', 'momentum', 'energy', 'weight', 'power', 'voltage', 'current', 'resistance',
    'capacitance', 'resist', 'radius', 'height', 'width', 'side', 'sum', 'total', 'increase',
    'decrease', 'percent', 'percentage', 'fraction', 'round', 'nearest', 'root', 'roots',
    'simultaneous', 'system', 'simplify', 'factor', 'expand', 'evaluate', 'calculate',
  );
  return { strong, weak };
}

/** Ordinary English (and the app's own filler words) — never rewritten. */
export function protectedWords(): Set<string> {
  return commonEnglishWords();
}

export { EVERYDAY_FILLER };
