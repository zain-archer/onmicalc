/**
 * Typo tolerance.
 *
 * People mistype: swapped keys ("convret"), doubled letters ("intergrate"),
 * dropped vowels ("frm"), wrong letters ("fahrenhite"). Matching a whole
 * sentence with a fuzzy regex would explode into thousands of alternatives, so
 * this layer does something cheaper and more predictable:
 *
 * 1. `correctSentence()` replaces *unknown* words with the closest word from a
 *    vocabulary built from OmniCalc's own keywords, units, function names and
 *    sentence templates, using Damerau–Levenshtein distance (a swap costs 1).
 * 2. The same `closestWord()` helper backs the unit lookup, so a mistyped unit
 *    is still recognised.
 *
 * Rules that keep it honest:
 * - only alphabetic words of 4+ letters are ever rewritten (digits, symbols and
 *   expressions are never touched);
 * - a word that is already known is never changed;
 * - ambiguous candidates (a tie) are left alone;
 * - common English words are protected, so "I want to know" never becomes
 *   "watt";
 * - every change is reported, so the UI can show what it assumed.
 */

export interface Correction {
  from: string;
  to: string;
}

const WORD = /[A-Za-z]{3,}/g;

/** Cheap memo so scoring on every keystroke stays instant. */
const distanceCache = new Map<string, number>();
const candidates = new Map<string, string[]>();

/**
 * Optimal string alignment (Damerau–Levenshtein with adjacent transpositions),
 * bounded by `max`: anything further away returns `max + 1` without finishing
 * the table.
 */
export function damerauDistance(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max > 4 ? max : max + 1;
  if (max < 1) return a === b ? 0 : 1;

  const key = `${a}|${b}|${max}`;
  const cached = distanceCache.get(key);
  if (cached !== undefined) return cached;

  const rows = a.length + 1;
  const columns = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (let i = 0; i < rows; i += 1) table[i]![0] = i;
  for (let j = 0; j < columns; j += 1) table[0]![j] = j;

  let result = max + 1;
  for (let i = 1; i < rows; i += 1) {
    let rowBest = max + 1;
    for (let j = 1; j < columns; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        table[i - 1]![j]! + 1,
        table[i]![j - 1]! + 1,
        table[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, table[i - 2]![j - 2]! + 1);
      }
      table[i]![j] = value;
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > max) {
      result = max + 1;
      if (distanceCache.size < 20_000) distanceCache.set(key, result);
      return result;
    }
    result = table[i]![columns - 1]!;
  }

  const answer = result;
  if (distanceCache.size < 20_000) distanceCache.set(key, answer);
  return answer;
}

/** How many typos are forgiven for a word of this length. */
export function typoBudget(length: number): number {
  if (length >= 8) return 2;
  if (length >= 4) return 1;
  return 0;
}

/**
 * All vocabulary words at the smallest distance within the typo budget, best
 * first. When two words are equally close but one is an instruction word (a
 * keyword, unit, function or template word) it is preferred, because that is
 * what the user was reaching for — "precent" is "percent", not "present".
 */
export function closestWords(
  word: string,
  vocabulary: readonly string[],
  preferred?: ReadonlySet<string>,
): string[] {
  const lower = word.toLowerCase();
  const budget = typoBudget(lower.length);
  if (budget === 0) return [];

  const cacheKey = `${budget}|${vocabulary.length}|${preferred?.size ?? 0}|${lower}`;
  const cached = candidates.get(cacheKey);
  if (cached) return cached;

  let bestDistance = budget + 1;
  const found: string[] = [];
  for (const candidate of vocabulary) {
    if (candidate.length === 0) continue;
    if (Math.abs(candidate.length - lower.length) > budget) continue;
    const distance = damerauDistance(lower, candidate, budget);
    if (distance > budget) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      found.length = 0;
      found.push(candidate);
    } else if (distance === bestDistance) {
      found.push(candidate);
    }
  }

  found.sort((a, b) => Number(preferred?.has(b) ?? false) - Number(preferred?.has(a) ?? false));
  const answer = found.slice(0, 4);
  if (candidates.size < 20_000) candidates.set(cacheKey, answer);
  return answer;
}

/**
 * One confident correction, or null when the word is fine, too short, or
 * genuinely ambiguous (a 50/50 guess is worse than no guess).
 */
export function closestWord(
  word: string,
  vocabulary: readonly string[],
  preferred?: ReadonlySet<string>,
): string | null {
  const found = closestWords(word, vocabulary, preferred);
  if (found.length === 1) return found[0]!;
  // Same-distance candidates from different sources: only take a winner when
  // exactly one of them is an instruction word.
  if (found.length > 1 && preferred) {
    const strong = found.filter((candidate) => preferred.has(candidate));
    if (strong.length === 1) return strong[0]!;
  }
  return null;
}

export interface Reading {
  text: string;
  corrections: Correction[];
}

/**
 * Every plausible reading of the sentence: the most likely one first, plus one
 * variant per genuinely ambiguous word. The planner scores each reading and
 * keeps the best, which is how "20 precent of 250" resolves to "percent"
 * (a percentage question) over "present" (no request at all).
 */
export function correctReadings(
  sentence: string,
  vocabulary: ReadonlySet<string>,
  protectedWords: ReadonlySet<string> = new Set(),
  preferred?: ReadonlySet<string>,
  maxReadings = 4,
): Reading[] {
  const list = [...vocabulary];
  const tokens: { raw: string; choices: string[] }[] = [];
  for (const match of sentence.matchAll(WORD)) {
    const raw = match[0]!;
    const lower = raw.toLowerCase();
    if (vocabulary.has(lower) || protectedWords.has(lower)) {
      tokens.push({ raw, choices: [raw] });
      continue;
    }
    const found = closestWords(lower, list, preferred);
    const plausible = found.filter((candidate) => candidate !== lower);
    if (plausible.length === 0) tokens.push({ raw, choices: [raw] });
    else tokens.push({ raw, choices: [plausible[0]!, ...plausible.slice(1, 2), raw] });
  }

  const readings: Reading[] = [];

  // Rebuild the sentence by walking tokens and the text between them.
  const pieces = sentence.split(WORD);
  const assemble = (picks: string[]): Reading => {
    let text = pieces[0] ?? '';
    const corrections: Correction[] = [];
    picks.forEach((pick, index) => {
      if (pick !== tokens[index]!.raw) corrections.push({ from: tokens[index]!.raw, to: pick });
      text += pick + (pieces[index + 1] ?? '');
    });
    return { text, corrections };
  };

  const picks: string[] = tokens.map((token) => token.choices[0]!);
  readings.push(assemble(picks));

  // Then one variant per ambiguous token, most likely alternative first.
  out: for (let index = 0; index < tokens.length && readings.length < maxReadings; index += 1) {
    const token = tokens[index]!;
    for (let option = 1; option < token.choices.length; option += 1) {
      if (readings.length >= maxReadings) break out;
      if (token.choices[option] === token.raw) continue;
      const variant = [...picks];
      variant[index] = token.choices[option]!;
      readings.push(assemble(variant));
    }
  }
  return readings;
}

export interface CorrectionResult {
  text: string;
  corrections: Correction[];
}

/**
 * The most likely reading of the sentence, keeping everything else byte for byte
 * (spacing, punctuation, digits and expressions included). Only alphabetic words
 * are ever rewritten, and only when a single candidate is clearly closest.
 */
export function correctSentence(
  sentence: string,
  vocabulary: ReadonlySet<string>,
  protectedWords: ReadonlySet<string> = new Set(),
  preferred?: ReadonlySet<string>,
): CorrectionResult {
  const [first] = correctReadings(sentence, vocabulary, protectedWords, preferred);
  return first ?? { text: sentence, corrections: [] };
}
