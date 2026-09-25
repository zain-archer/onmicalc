/**
 * Natural-language capture.
 *
 * A pattern is a sentence with `{slots}`; each slot declares the words that may
 * introduce the value, the value's own shape (number, expression, unit word…)
 * and a fallback so that "15% of 200" and "what is 15 percent of 200" are the
 * same pattern.
 *
 * `matchSentence()` is deliberately greedy-but-honest: it only succeeds when
 * every non-optional slot is filled, so a half-understood sentence produces a
 * form instead of a wrong answer.
 */

export interface SlotSpec {
  name: string;
  /** Words that may precede the value, e.g. ['x', 'for x']. The empty string means "right here". */
  introducers: string[];
  /** How to read the value. */
  type: 'number' | 'expression' | 'unit' | 'list' | 'text' | 'angle' | 'function';
  /** Value to use when the slot is absent. */
  fallback?: string;
  optional?: boolean;
}

export interface PatternSpec {
  /** Sentence template, e.g. 'convert {value} {from} to {to}'. */
  template: string;
  slots: SlotSpec[];
}

export interface PatternMatch {
  /** Captured raw strings by slot name. */
  text: Record<string, string>;
  /** Sentence with values replaced, for the "what I understood" line. */
  summary: string;
  /** 0–1: how much of the sentence the pattern accounted for. */
  coverage: number;
}

const NUMBER = String.raw`[-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?`;
/** An expression: numbers, operators, parentheses, function names, variables. */
const EXPRESSION = String.raw`[A-Za-z0-9_^()+*/.,\-\s]+?`;
const UNIT = String.raw`[A-Za-z°µ"']+`;
const TEXT = String.raw`.+?`;

/** Escapes literal text and turns the pattern's own regex syntax back on. */
function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word list → alternation, longest first so "kilometres" wins over "kilometre". */
export function alternation(words: readonly string[]): string {
  const cleaned = words.filter(Boolean).map((word) => escapeLiteral(word));
  if (cleaned.length === 0) return '';
  return [...cleaned].sort((a, b) => b.length - a.length).join('|');
}

function fragment(slot: SlotSpec): string {
  const introducers = alternation(slot.introducers.filter((word) => word.length > 0));
  const prefix = introducers ? `(?:${introducers})\\s+` : '\\s*';
  const body =
    slot.type === 'number'
      ? `(${NUMBER})`
      : slot.type === 'unit'
        ? `(${UNIT})`
        : slot.type === 'list'
          ? `([0-9.,;\\s\\-]+)`
          : slot.type === 'angle'
            ? `(${NUMBER})\\s*(?:°|deg|degrees?)`
            : slot.type === 'expression' || slot.type === 'function'
              ? `(${EXPRESSION})`
              : `(${TEXT})`;
  return `(?:${prefix}${body})`;
}

/** Escapes a literal template fragment and makes runs of whitespace flexible. */
function literalSource(text: string): string {
  return text === '' ? '' : escapeLiteral(text).replace(/\s+/g, '\\s+');
}

/**
 * A slot may spell its own introducer in the template ("percent of {whole}") or
 * rely on the introducer list ("how many {to} is…"). When the template already
 * has the word, take it out of the literal so the slot — which still accepts the
 * whole introducer list — matches it exactly once.
 */
function consumeIntroducer(pending: string, slot: SlotSpec): string {
  const candidates = [...slot.introducers].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const introducer of candidates) {
    const trailing = new RegExp(`(?:^|\\s)${escapeLiteral(introducer)}\\s*$`, 'i');
    if (trailing.test(pending)) return pending.replace(trailing, ' ');
  }
  return pending;
}

function templateToRegex(template: string, slots: SlotSpec[]): RegExp | null {
  const byName = new Map(slots.map((slot) => [slot.name, slot]));
  const parts = template.split(/(\{[a-zA-Z]+\})/g);
  let pending = '';
  let source = '';
  for (const part of parts) {
    const match = /^\{([a-zA-Z]+)\}$/.exec(part);
    if (!match) {
      pending += part;
      continue;
    }
    const slot = byName.get(match[1]!);
    if (!slot) return null;
    source += literalSource(consumeIntroducer(pending, slot));
    pending = '';
    source += fragment(slot);
  }
  source += literalSource(pending);
  return new RegExp(`^\\s*${source}\\s*$`, 'i');
}

/** Removes filler words so "hey, could you please plot y = x^2 for me" still matches. */
export function stripFiller(input: string): string {
  return input
    .trim()
    .replace(/^(?:hey|hi|hello)[,\s]+/i, '')
    .replace(/^(?:please|could you|can you|i want to|i need to|help me|i'd like to|id like to)\s+/i, '')
    .replace(/\s+(?:please|for me|thanks|thank you)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[?!.]+$/, '')
    .trim();
}

function tidyValue(type: SlotSpec['type'], raw: string): string {
  const trimmed = raw.trim();
  if (type === 'number') return trimmed.replace(',', '.');
  if (type === 'expression' || type === 'function') {
    return trimmed
      .replace(/^y\s*=\s*/i, '')
      .replace(/\s*=\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return trimmed;
}

export function matchSentence(sentence: string, pattern: PatternSpec): PatternMatch | null {
  const regex = templateToRegex(pattern.template, pattern.slots);
  if (!regex) return null;
  const match = regex.exec(sentence);
  if (!match) return null;

  const text: Record<string, string> = {};
  const byName = new Map(pattern.slots.map((slot) => [slot.name, slot]));
  pattern.slots.forEach((slot, index) => {
    const captured = match[index + 1];
    if (captured !== undefined && captured.trim() !== '') {
      text[slot.name] = tidyValue(slot.type, captured);
    } else if (slot.fallback !== undefined) {
      text[slot.name] = slot.fallback;
    }
  });

  const missing = pattern.slots.filter((slot) => !slot.optional && text[slot.name] === undefined);
  if (missing.length > 0) return null;

  // Coverage: the match must account for the whole sentence.
  const consumed = match[0]!.length;
  return {
    text,
    summary: summarise(pattern.template, text, byName),
    coverage: Math.min(1, consumed / Math.max(1, sentence.length)),
  };
}

function summarise(
  template: string,
  text: Record<string, string>,
  slots: Map<string, SlotSpec>,
): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, name: string) => {
    const value = text[name];
    if (value === undefined) return slots.get(name)?.fallback ?? '';
    return value;
  });
}

/** Tries every pattern and returns the best (highest coverage) match. */
export function matchAny(sentence: string, patterns: readonly PatternSpec[]): PatternMatch | null {
  let best: PatternMatch | null = null;
  for (const pattern of patterns) {
    const match = matchSentence(sentence, pattern);
    if (!match) continue;
    if (!best || match.coverage > best.coverage) best = match;
  }
  return best;
}

/** Reads a decimal number out of free text ("about 12.5 kg" → 12.5). */
export function parseLooseNumber(input: string): number | null {
  const match = new RegExp(NUMBER).exec(input.replace(/,(\d{3})/g, '$1'));
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}
