import { CATEGORY_ORDER, type Capability, type SolveContext, type SolveOutcome } from './types';
import { matchAny, parseLooseNumber, stripFiller, type PatternSpec } from './patterns';
import { everyCapability, capabilityById } from './capabilities';
import { hasUnitWords } from './units';
import { correctReadings, damerauDistance, typoBudget, type Correction } from './fuzzy';
import { EVERYDAY_FILLER } from './wordlists';
import { intentVocabulary, preferredWords, protectedWords } from './vocabulary';

/**
 * Sentence → plan.
 *
 * 1. Clean up the phrasing ("hey, could you please…").
 * 2. Score every capability by how well the words match its keywords and its
 *    example sentences — not just a keyword list, so "how many ounces is 250 g"
 *    reaches the unit converter without a special case.
 * 3. Run the winning plan, filling any numbers straight from the sentence.
 *
 * `plan()` is pure and synchronous, so it is fully unit-testable; the UI only
 * renders what comes back.
 */

export interface Plan {
  capability: Capability;
  /** 0–1 confidence in the chosen capability. */
  confidence: number;
  /** Values pulled out of the sentence. */
  captures: Record<string, number>;
  /** Text pulled out of the sentence (units, function bodies…). */
  text: Record<string, string>;
  /** The cleaned-up, typo-corrected request that the capability actually sees. */
  cleaned: string;
  /**
   * Words that were not recognised and were read as the closest known word
   * ("convret" → "convert"). Empty when the request was typed cleanly, so the
   * UI can say exactly what it assumed instead of guessing silently.
   */
  corrections: Correction[];
}

export interface PlanFailure {
  capability: null;
  reason: 'empty' | 'unknown';
  cleaned: string;
  /** Typo corrections applied before matching (see `Plan.corrections`). */
  corrections: Correction[];
  /** Best alternatives, for "did you mean…". */
  suggestions: Capability[];
}

export type PlanResult = Plan | PlanFailure;

const FILLER = EVERYDAY_FILLER;

function tokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9%°µ^+*/()=.,;:!?\-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function contentTokens(input: string): string[] {
  return tokens(input).filter((token) => !FILLER.has(token) && token.length > 1);
}

/**
 * Keyword hit score.
 *
 * Word boundaries on both ends, so the keyword "% of" does not fire inside
 * "30% off"; longer and multi-word keys outrank glue words like "of".
 */
export function keywordScore(raw: string, keyword: string): number {
  const sentence = ` ${raw.toLowerCase()} `;
  const key = keyword.toLowerCase().trim();
  if (!key) return 0;
  if (key === '%') return sentence.includes('%') ? 30 : 0;

  const body = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  // A key that starts with a symbol ("% of") only needs its trailing boundary.
  const prefix = /^[a-z0-9]/i.test(key) ? '(?:^|[^a-z0-9])' : '';
  if (new RegExp(`${prefix}${body}(?:$|[^a-z0-9])`, 'i').test(sentence)) {
    return key.includes(' ') ? 40 + key.split(' ').length * 6 : 24 + Math.min(14, key.length * 1.6);
  }

  // Nothing matched exactly — try the same comparison with a typo budget, so
  // "sovle"/"intergrate" still find their capability. Fuzzy hits score lower.
  const keyWords = key.split(/\s+/);
  const sentenceWords = sentence.trim().split(/[^a-z0-9%°]+/).filter(Boolean);
  for (let start = 0; start + keyWords.length <= sentenceWords.length; start += 1) {
    let distance = 0;
    let matched = true;
    for (let offset = 0; offset < keyWords.length; offset += 1) {
      const wanted = keyWords[offset]!;
      if (!/[a-z]/.test(wanted)) {
        matched = sentenceWords[start + offset] === wanted;
      } else {
        const budget = typoBudget(wanted.length);
        if (budget === 0) {
          matched = wanted === sentenceWords[start + offset];
        } else {
          const near = damerauDistance(sentenceWords[start + offset]!, wanted, budget);
          if (near > budget) matched = false;
          else distance += near;
        }
      }
      if (!matched) break;
    }
    if (matched) {
      const base = key.includes(' ') ? 34 + keyWords.length * 6 : 20 + Math.min(14, key.length * 1.6);
      return Math.max(12, base - distance * 6);
    }
  }
  return 0;
}

/** How well a capability's own examples resemble what the user said. */
function exampleScore(raw: string, capability: Capability): number {
  const said = new Set(contentTokens(raw));
  if (said.size === 0) return 0;
  let best = 0;
  for (const example of capability.examples) {
    const wanted = contentTokens(example.text);
    if (wanted.length === 0) continue;
    let shared = 0;
    for (const token of wanted) if (said.has(token)) shared += 1;
    // Jaccard-ish: precision matters more than recall here.
    const score = (shared / Math.max(1, wanted.length)) * 30;
    if (score > best) best = score;
  }
  return best;
}

export interface PlanOptions {
  /** Force a specific capability (used by the UI's "I want to…" tiles). */
  capabilityId?: string;
}

/** A bare sum like "2^10" or "(3+4)*2" is arithmetic even without the word "calculate". */
export function looksLikeArithmetic(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return false;
  if (!/[\d)]/.test(trimmed) || !/[-+*/^%!]/.test(trimmed)) return false;
  // Strip digits, operators and punctuation: if letters remain it is prose,
  // a variable ("x^2 - 5x + 6") or a function call, not a bare sum.
  return trimmed.replace(/[\d.]+/g, '').replace(/[-+*/^%(),;:\s]/g, '').length === 0;
}

export function scoreCapabilities(raw: string): { capability: Capability; score: number }[] {
  return everyCapability()
    .filter((capability) => !capability.accepts || capability.accepts(raw))
    .map((capability) => {
      const keywords = Math.max(0, ...capability.keywords.map((keyword) => keywordScore(raw, keyword)));
      const examples = exampleScore(raw, capability);
      const titleHit = keywordScore(raw, capability.title) / 2;
      // A capability whose own sentence templates fit is almost certainly the
      // right one, so a pattern match counts for more than a keyword hit.
      const pattern = capability.patterns ? matchAny(raw, capability.patterns) : null;
      const patternBonus = pattern ? 40 * pattern.coverage : 0;
      const unitBonus = capability.id === 'convertUnits' && hasUnitWords(raw) ? 30 : 0;
      const arithmetic = capability.id === 'calculate' && looksLikeArithmetic(raw) ? 32 : 0;
      return { capability, score: keywords + examples + titleHit + patternBonus + unitBonus + arithmetic };
    })
    .sort((a, b) => b.score - a.score);
}

/** Pulls numbers out of a sentence using the capability's own templates. */
function extractFromPatterns(
  cleaned: string,
  patterns: readonly PatternSpec[] | undefined,
): { numbers: Record<string, number>; text: Record<string, string> } {
  const numbers: Record<string, number> = {};
  const text: Record<string, string> = {};
  if (!patterns || patterns.length === 0) return { numbers, text };

  const match = matchAny(cleaned, patterns);
  if (!match) return { numbers, text };

  for (const [name, value] of Object.entries(match.text)) {
    const numeric = parseLooseNumber(value);
    if (value.trim().length === 0) continue;
    // Keep both readings: capabilities that want a word use `text`, the rest use
    // `numbers`. A unit word will simply fail the numeric parse and be skipped.
    text[name] = value.trim();
    if (numeric !== null && /^[-+]?[\d.,\s]+(?:[eE][-+]?\d+)?$/.test(value.trim())) {
      numbers[name] = numeric;
    }
  }
  return { numbers, text };
}

export function plan(request: string, options: PlanOptions = {}): PlanResult {
  const trimmed = stripFiller(request);
  if (!trimmed) return { capability: null, reason: 'empty', cleaned: trimmed, corrections: [], suggestions: [] };

  // Fix likely typos before anything else looks at the words, so scoring,
  // template matching and the capabilities' own extraction all see clean text.
  // Ambiguous words ("precent" → percent or present) produce more than one
  // reading, and the one that makes most sense of the whole sentence wins.
  const readings = correctReadings(trimmed, intentVocabulary(), protectedWords(), preferredWords());
  const rankedReadings = readings.map((reading) => ({
    reading,
    ranked: scoreCapabilities(reading.text),
  }));
  const winner = rankedReadings.reduce((best, entry) =>
    (entry.ranked[0]?.score ?? 0) > (best.ranked[0]?.score ?? 0) ? entry : best,
  );
  const { text: cleaned, corrections } = winner.reading;

  if (options.capabilityId) {
    const forced = capabilityById(options.capabilityId);
    if (forced) {
      const extracted = extractFromPatterns(cleaned, forced.patterns);
      return {
        capability: forced,
        confidence: 1,
        captures: extracted.numbers,
        text: extracted.text,
        cleaned,
        corrections,
      };
    }
  }

  // Two or more "=" in one request is a system of equations, not a sum.
  const equations = (cleaned.match(/=/g) ?? []).length;
  if (equations >= 2) {
    const system = capabilityById('solveSystem');
    if (system) {
      const extracted = extractFromPatterns(cleaned, system.patterns);
      return {
        capability: system,
        confidence: 0.9,
        captures: extracted.numbers,
        text: extracted.text,
        cleaned,
        corrections,
      };
    }
  }

  const ranked = winner.ranked;
  const best = ranked[0];
  if (!best || best.score <= 0) {
    return {
      capability: null,
      reason: 'unknown',
      cleaned,
      corrections,
      suggestions: ranked.slice(0, 6).map((entry) => entry.capability),
    };
  }

  const chosen = best.capability;
  const extracted = extractFromPatterns(cleaned, chosen.patterns);
  return {
    capability: chosen,
    confidence: Math.min(1, best.score / 60),
    captures: extracted.numbers,
    text: extracted.text,
    cleaned,
    corrections,
  };
}

/** Builds the context a capability receives: sentence values win over fields. */
export function buildContext(
  planResult: Plan,
  fields: Record<string, number> = {},
  textFields: Record<string, string> = {},
): SolveContext {
  const numbers: Record<string, number> = { ...fields };
  const text: Record<string, string> = { ...textFields };

  for (const [name, value] of Object.entries(planResult.text)) {
    text[name] = value;
  }
  for (const [name, value] of Object.entries(planResult.captures)) {
    numbers[name] = value;
  }

  return {
    raw: planResult.cleaned,
    captures: Object.entries(planResult.captures).map(([name, value]) => ({ name, value })),
    text,
    get(name) {
      return numbers[name];
    },
    getText(name) {
      return text[name];
    },
  };
}

export function runPlan(planResult: Plan, fields: Record<string, number> = {}, textFields: Record<string, string> = {}): SolveOutcome {
  try {
    return planResult.capability.run(buildContext(planResult, fields, textFields));
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'That request could not be completed.',
    };
  }
}

/** Capabilities grouped for the picker, in a deliberate order. */
export function groupedCapabilities(): { group: Capability['group']; capabilities: Capability[] }[] {
  const all = everyCapability();
  return CATEGORY_ORDER.map((group) => ({
    group,
    capabilities: all.filter((capability) => capability.group === group),
  })).filter((entry) => entry.capabilities.length > 0);
}
