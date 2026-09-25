import { evaluateExpression } from '@/core/engine';
import { formatNumber } from '@/core/precision/format';
import {
  allEntries,
  areas,
  constantEntries,
  formulaVariables,
  resolveTerm,
  searchKnowledge,
  type KnowledgeEntry,
} from '@/knowledge';
import { categoryOfUnit, findAnyUnit, unitWordsWithCategories } from '@/knowledge/units-bridge';
import { closestWord } from '../fuzzy';
import { looksLikeArithmetic } from '../solve';
import type { Capability, ResultBlock, SolveOutcome } from '../types';

const nf = (value: number) => formatNumber(value, { precision: 12 });

/** "what unit is kilomter" — a mistyped unit name still resolves. */
function nearestUnit(term: string) {
  const clean = term.replace(/^(?:the|a|an)\s+/i, '').trim().toLowerCase();
  if (clean.length < 4) return undefined;
  const vocabulary = unitWordsWithCategories();
  const guess = closestWord(clean, vocabulary.map((entry) => entry.word));
  if (!guess) return undefined;
  const hit = vocabulary.find((entry) => entry.word === guess);
  return hit ? findAnyUnit(hit.symbol) : undefined;
}

/** Trims the politeness and the scaffolding from a captured term. */
function cleanTerm(input: string): string {
  return input
    .replace(/^(?:please\s+)?(?:tell me\s+)?/i, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/^(?:value|meaning|definition|symbol)\s+of\s+/i, '')
    .replace(/^(?:the\s+)?(?:symbol|unit|constant|term)\s+(?:for\s+|of\s+)?/i, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "what is pi", "define acceleration", "meaning of torque" → the term. */
function extractTerm(raw: string): string {
  return raw
    .replace(/^\s*(?:what|who|which)\s+(?:is|are|does|do)\s+/i, '')
    .replace(/^\s*(?:please\s+)?(?:tell me|explain|describe)\s+(?:about\s+|what\s+)?/i, '')
    .replace(/^\s*(?:define|definition of|meaning of|what does|whats|what's)\s+/i, '')
    .replace(/^\s*(?:the\s+)?(?:term|word|symbol|constant|unit)\s+/i, '')
    .replace(/\s+(?:mean|means|stand for|refer to)\??$/i, '')
    .replace(/\s+in\s+(?:maths|math|physics|chemistry|statistics)\??$/i, '')
    .replace(/[?.!]+$/, '')
    .replace(/^[“"']|[”"']$/g, '')
    .trim();
}

function entryBlocks(entry: KnowledgeEntry): ResultBlock[] {
  const rows: { label: string; value: string; emphasize?: boolean }[] = [];
  if (entry.symbol) rows.push({ label: 'Symbol', value: entry.symbol });
  if (entry.display) rows.push({ label: 'Value', value: entry.display, emphasize: true });
  else if (entry.value !== undefined) rows.push({ label: 'Value', value: nf(entry.value), emphasize: true });
  if (entry.unit) rows.push({ label: 'Unit', value: entry.unit });
  if (entry.formula) rows.push({ label: 'Formula', value: entry.formula });
  if (entry.source) rows.push({ label: 'Source', value: entry.source });

  const blocks: ResultBlock[] = [{ kind: 'text', text: entry.summary }];
  if (entry.detail) blocks.push({ kind: 'text', text: entry.detail });
  if (rows.length > 0) blocks.push({ kind: 'stats', rows });

  if (entry.formula) {
    // Prove the formula works by evaluating it where that is possible.
    const variables = formulaVariables(entry);
    const probe = evaluateExpression(entry.formula, { variables: Object.fromEntries(variables.map((name) => [name, 2])) });
    blocks.push(
      probe.ok
        ? { kind: 'math', text: `${entry.formula} = ${probe.display} when each variable is 2` }
        : { kind: 'note', text: `Ready to try: send “${entry.formula}” to the calculator, or plot it.` },
    );
  }
  if (entry.seeAlso?.length) blocks.push({ kind: 'list', title: 'See also', items: entry.seeAlso });
  return blocks;
}

export const defineCapability: Capability = {
  id: 'define',
  title: 'Explain a term, constant or unit',
  promise: '“What is pi?”, “define acceleration”, “what does N mean?”, “meaning of eigenvalue”.',
  group: 'Everyday maths',
  keywords: [
    'what is', 'what are', 'who is', 'what does', 'whats', "what's", 'define', 'definition of',
    'meaning of', 'explain', 'tell me about', 'stand for', 'stands for', 'what is the value of',
    'what unit is', 'what unit', 'what quantity is', 'symbol', 'constant', 'meaning',
  ],
  examples: [
    { text: 'what is pi', capabilityId: 'define', captures: [] },
    { text: 'define acceleration', capabilityId: 'define', captures: [] },
    { text: 'what does the symbol N mean', capabilityId: 'define', captures: [] },
    { text: 'meaning of eigenvalue', capabilityId: 'define', captures: [] },
  ],
  inputs: [{ name: 'term', label: 'Term', hint: 'A constant, quantity, unit or concept', example: 'pi' }],
  patterns: [
    // Most specific templates first: the first pattern that matches whole-sentence wins.
    { template: 'what does the symbol {term} mean', slots: [{ name: 'term', introducers: ['symbol'], type: 'text' as const }] },
    { template: 'what does the unit {term} mean', slots: [{ name: 'term', introducers: ['unit'], type: 'text' as const }] },
    { template: 'what is the value of {term}', slots: [{ name: 'term', introducers: ['of'], type: 'text' as const }] },
    { template: 'what is the meaning of {term}', slots: [{ name: 'term', introducers: ['of'], type: 'text' as const }] },
    { template: 'what unit is {term}', slots: [{ name: 'term', introducers: ['is'], type: 'text' as const }] },
    { template: 'what unit is a {term}', slots: [{ name: 'term', introducers: ['a'], type: 'text' as const }] },
    { template: 'what quantity is {term}', slots: [{ name: 'term', introducers: ['is'], type: 'text' as const }] },
    { template: 'what does {term} mean', slots: [{ name: 'term', introducers: ['does'], type: 'text' as const }] },
    { template: 'what is {term}', slots: [{ name: 'term', introducers: ['is'], type: 'text' as const }] },
    { template: 'what are {term}', slots: [{ name: 'term', introducers: ['are'], type: 'text' as const }] },
    { template: '{term} meaning', slots: [{ name: 'term', introducers: [''], type: 'text' as const }] },
    { template: 'meaning of {term}', slots: [{ name: 'term', introducers: ['of'], type: 'text' as const }] },
    { template: 'definition of {term}', slots: [{ name: 'term', introducers: ['of'], type: 'text' as const }] },
    { template: 'define {term}', slots: [{ name: 'term', introducers: [''], type: 'text' as const }] },
    { template: 'explain {term}', slots: [{ name: 'term', introducers: [''], type: 'text' as const }] },
    { template: 'tell me about {term}', slots: [{ name: 'term', introducers: ['about'], type: 'text' as const }] },
  ],
  // “what is 12 + 34 * 2” is arithmetic: leave it to the calculator.
  accepts: (raw) => !looksLikeArithmetic(extractTerm(raw)),
  run(context): SolveOutcome {
    const term = cleanTerm(context.getText('term') ?? extractTerm(context.raw));
    if (!term) {
      return { ok: false, message: 'Which term should I explain? Try “what is pi” or “define acceleration”.' };
    }

    const resolved = resolveTerm(term);

    // 1. A described entry: the richest answer, with source and formula.
    if (resolved.entry) {
      const entry = resolved.entry;
      const typed = resolved.suggestion && resolved.suggestion.toLowerCase() !== term.toLowerCase();
      return {
        ok: true,
        headline: entry.term,
        understood: typed ? `“${term}” read as ${entry.term}` : `explaining ${entry.term}`,
        blocks: entryBlocks(entry),
        copyText: `${entry.term}: ${entry.summary}${entry.formula ? ` (${entry.formula})` : ''}`,
      };
    }

    // 2. A constant known to the engine, explained from the CODATA table.
    const constant = constantEntries().find(
      (entry) =>
        entry.term.toLowerCase() === term.toLowerCase() ||
        (entry.aliases ?? []).some((alias) => alias.toLowerCase() === term.toLowerCase()),
    );
    if (constant) {
      return {
        ok: true,
        headline: `${constant.symbol ?? constant.term} = ${constant.display ?? nf(constant.value ?? 0)}${constant.unit ? ` ${constant.unit}` : ''}`,
        understood: `explaining the constant ${constant.term}`,
        blocks: entryBlocks(constant),
        copyText: `${constant.term} = ${constant.display ?? constant.value}${constant.unit ? ` ${constant.unit}` : ''} — ${constant.summary}`,
      };
    }

    // 3. A unit, answered from the converter's own table (never hand-written).
    const unit = findAnyUnit(term) ?? nearestUnit(term);
    if (unit) {
      const category = categoryOfUnit(unit);
      return {
        ok: true,
        headline: `${unit.label} (${unit.symbol})`,
        understood: `explaining the unit ${term}`,
        blocks: [
          {
            kind: 'text',
            text: `${unit.label} — symbol ${unit.symbol} — is a unit of ${category?.toLowerCase() ?? 'measurement'}.`,
          },
          {
            kind: 'stats',
            rows: [
              { label: 'Symbol', value: unit.symbol },
              { label: 'Unit', value: unit.label },
              ...(category ? [{ label: 'Measures', value: category }] : []),
              ...(unit.aliases?.length ? [{ label: 'Also written', value: unit.aliases.join(', ') }] : []),
            ],
          },
          { kind: 'note', text: `Convert with it by typing “convert 5 ${unit.symbol.toLowerCase()} to …”.` },
        ],
        copyText: `${unit.symbol} = ${unit.label} (${category ?? 'unit'})`,
      };
    }

    if (resolved.known) {
      // Something the app can use but does not describe: say that honestly.
      const value = evaluateExpression(term);
      return {
        ok: true,
        headline: value.ok ? `${term} = ${value.display}` : `“${term}” is recognised by the calculator`,
        understood: `“${term}” is something OmniCalc can calculate with`,
        blocks: [
          {
            kind: 'text',
            text: value.ok
              ? `“${term}” evaluates to ${value.display}, but OmniCalc has no stored definition for it, so it will not invent one.`
              : `“${term}” is understood by the calculator, but OmniCalc has no stored definition for it.`,
          },
          { kind: 'note', text: 'Definitions are only shown when they come from a named source.' },
        ],
        copyText: `${term} = ${value.ok ? value.display : 'recognised'}`,
      };
    }

    const near = searchKnowledge(term, 4);
    return {
      ok: false,
      message:
        near.length > 0
          ? `I do not have a definition for “${term}”. Did you mean ${near.map((entry) => entry.term).join(', ')}?`
          : `I do not have a stored definition for “${term}”. Try “what is pi”, “define acceleration” or “what unit is N”.`,
    };
  },
};

export const knowledgeSearchCapability: Capability = {
  id: 'knowledgeSearch',
  title: 'Search what OmniCalc knows',
  promise: '“What formulas do you know?”, “list physics constants”, “search for energy”.',
  group: 'Everyday maths',
  keywords: [
    'search', 'list', 'browse', 'what do you know', 'knowledge', 'reference', 'glossary', 'all formulas',
    'constants', 'encyclopedia', 'library', 'lookup', 'what formulas', 'which formulas',
    'how many formulas', 'what equations',
  ],
  examples: [
    { text: 'list physics constants', capabilityId: 'knowledgeSearch', captures: [] },
    { text: 'what formulas do you know', capabilityId: 'knowledgeSearch', captures: [] },
    { text: 'search for energy', capabilityId: 'knowledgeSearch', captures: [] },
    { text: 'what formulas do you know', capabilityId: 'knowledgeSearch', captures: [] },
  ],
  inputs: [
    { name: 'query', label: 'Search for', hint: 'Leave blank to list areas', kind: 'text', example: 'energy', optional: true },
  ],
  patterns: [
    { template: 'search for {query}', slots: [{ name: 'query', introducers: ['for'], type: 'text' as const }] },
    { template: 'search {query}', slots: [{ name: 'query', introducers: [''], type: 'text' as const }] },
    { template: 'list {query}', slots: [{ name: 'query', introducers: [''], type: 'text' as const }] },
    { template: 'browse {query}', slots: [{ name: 'query', introducers: [''], type: 'text' as const }] },
  ],
  run(context): SolveOutcome {
    const query = (context.getText('query') ?? '')
      .replace(/^(?:the|all)\s+/i, '')
      .replace(/\b(do you know|can you|you know|are there|is there|have you got|you have)\b/gi, '')
      .trim();

    if (!query && /formulas?|equations?/i.test(context.raw)) {
      const withFormula = allEntries().filter((entry) => entry.formula);
      return {
        ok: true,
        headline: `${withFormula.length} formulas ready to use`,
        understood: 'listing every stored formula',
        blocks: [
          {
            kind: 'table',
            title: 'Formulas',
            table: {
              columns: ['Quantity', 'Formula'],
              rows: withFormula.map((entry) => [entry.term, entry.formula!]),
            },
          },
          {
            kind: 'note',
            text: 'Send any of these to the calculator or the graph, or ask “formula for kinetic energy” for the explanation.',
          },
        ],
        copyText: withFormula.map((entry) => `${entry.term}: ${entry.formula}`).join('\n'),
      };
    }

    if (!query) {
      return {
        ok: true,
        headline: `${allEntries().length} explanations ready to look up`,
        understood: 'listing what OmniCalc knows',
        blocks: [
          {
            kind: 'list',
            title: 'Knowledge areas',
            items: areas().map((area) => `${area.label}: ${area.count} entries`),
          },
          {
            kind: 'note',
            text: 'Ask for any term by name — “what is pi”, “define acceleration”, “what unit is N” — or search, e.g. “search for energy”.',
          },
        ],
        copyText: `OmniCalc knows ${allEntries().length} terms across ${areas().length} areas.`,
      };
    }

    // "list physics constants" / "what formulas do you know" are browsing, not searching.
    const wantsConstants = /constants?/i.test(query);
    const wantsFormulas = /formulas?|equations?/i.test(query);
    const remainder = query
      .replace(/constants?/i, '')
      .replace(/formulas?/i, '')
      .replace(/equations?/i, '')
      .replace(/\b(physics|maths|math|chemistry|all|the|you|know|do|is|are|of)\b/gi, '')
      .trim();
    const physical = /physics/i.test(query);
    let filtered = wantsConstants
      ? constantEntries().filter((entry) => (physical ? entry.area === 'Physics' : true))
      : wantsFormulas
        ? allEntries().filter((entry) => entry.formula)
        : searchKnowledge(query, 24);
    if (remainder.length >= 3) {
      const narrowed = searchKnowledge(remainder, 24);
      if (narrowed.length > 0) filtered = narrowed;
    }

    if (filtered.length === 0) {
      return { ok: false, message: `Nothing in the knowledge base matches “${query}”.` };
    }

    return {
      ok: true,
      headline: `${filtered.length} match${filtered.length === 1 ? '' : 'es'} for “${query}”`,
      understood: `searching the knowledge base for ${query}`,
      blocks: [
        {
          kind: 'table',
          title: 'Matches',
          table: {
            columns: ['Term', 'Symbol', 'Value / unit', 'Summary'],
            rows: filtered.map((entry) => [
              entry.term,
              entry.symbol ?? '',
              entry.display ?? (entry.value !== undefined ? nf(entry.value) : entry.unit ?? ''),
              entry.summary.length > 90 ? `${entry.summary.slice(0, 87)}…` : entry.summary,
            ]),
          },
        },
        {
          kind: 'note',
          text: 'Ask “what is <term>” for the full explanation, source and formula.',
        },
      ],
      copyText: filtered.map((entry) => `${entry.term}: ${entry.summary}`).join('\n'),
    };
  },
};

export const formulaCapability: Capability = {
  id: 'formula',
  title: 'Find a formula',
  promise: '“Formula for kinetic energy”, “what is the equation for density?”.',
  group: 'Everyday maths',
  keywords: ['formula for', 'formulas for', 'formula of', 'formulae', 'equation for', 'expression for', 'how do i calculate', 'how to calculate'],
  examples: [
    { text: 'formula for kinetic energy', capabilityId: 'formula', captures: [] },
    { text: 'what is the equation for density', capabilityId: 'formula', captures: [] },
    { text: 'how do i calculate power', capabilityId: 'formula', captures: [] },
  ],
  inputs: [{ name: 'topic', label: 'Topic', kind: 'text', example: 'kinetic energy' }],
  patterns: [
    { template: 'formula for {topic}', slots: [{ name: 'topic', introducers: ['for'], type: 'text' as const }] },
    { template: 'formulas for {topic}', slots: [{ name: 'topic', introducers: ['for'], type: 'text' as const }] },
    { template: 'equation for {topic}', slots: [{ name: 'topic', introducers: ['for'], type: 'text' as const }] },
    { template: 'what is the equation for {topic}', slots: [{ name: 'topic', introducers: ['for'], type: 'text' as const }] },
    { template: 'what is the formula for {topic}', slots: [{ name: 'topic', introducers: ['for'], type: 'text' as const }] },
    { template: 'how do i calculate {topic}', slots: [{ name: 'topic', introducers: ['calculate'], type: 'text' as const }] },
    { template: 'formula of {topic}', slots: [{ name: 'topic', introducers: ['of'], type: 'text' as const }] },
  ],
  run(context): SolveOutcome {
    const topic = (context.getText('topic') ?? '').trim();
    if (!topic) return { ok: false, message: 'A formula for what? Try “formula for kinetic energy”.' };

    const withFormula = searchKnowledge(topic, 8).filter((entry) => entry.formula);
    if (withFormula.length === 0) {
      const matches = searchKnowledge(topic, 3);
      return {
        ok: false,
        message:
          matches.length > 0
            ? `I know about ${matches.map((entry) => entry.term).join(', ')} but have no stored formula for “${topic}”.`
            : `I have no stored formula for “${topic}”, and I will not invent one.`,
      };
    }

    const best = withFormula[0]!;
    return {
      ok: true,
      headline: best.formula!,
      understood: `formula for ${best.term}`,
      blocks: [
        { kind: 'math', text: best.formula! },
        { kind: 'text', text: best.summary },
        ...(best.detail ? [{ kind: 'text' as const, text: best.detail }] : []),
        {
          kind: 'stats',
          rows: [
            ...(formulaVariables(best).length
              ? [{ label: 'Variables', value: formulaVariables(best).join(', ') }]
              : []),
            ...(best.unit ? [{ label: 'Result unit', value: best.unit }] : []),
            ...(best.source ? [{ label: 'Source', value: best.source }] : []),
          ],
        },
        ...(withFormula.length > 1
          ? [
              {
                kind: 'list' as const,
                title: 'Also available',
                items: withFormula.slice(1, 6).map((entry) => `${entry.term}: ${entry.formula}`),
              },
            ]
          : []),
        { kind: 'note', text: 'Send it to the calculator or the graph to use it with your own numbers.' },
      ],
      copyText: `${best.term}: ${best.formula}`,
    };
  },
};
