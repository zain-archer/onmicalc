import { formatNumber } from '@/core/precision/format';
import { convertByWords, lookupUnit, allUnitsOf } from '../units';
import { convert } from '@/conversions/engine';
import { categoryById } from '@/conversions/definitions';
import type { Capability, SolveOutcome } from '../types';

const nf = (value: number) => formatNumber(value, { precision: 10 });

/**
 * Patterns for conversions. The `{from}` and `{to}` slots accept any unit word
 * because the vocabulary comes from the conversion engine itself.
 */
const CONVERT_PATTERNS = [
  {
    template: 'convert {value} {from} to {to}',
    slots: [
      { name: 'value', introducers: [''], type: 'number' as const },
      { name: 'from', introducers: [''], type: 'unit' as const },
      { name: 'to', introducers: ['to', 'into', 'in'], type: 'unit' as const },
    ],
  },
  {
    template: '{value} {from} to {to}',
    slots: [
      { name: 'value', introducers: [''], type: 'number' as const },
      { name: 'from', introducers: [''], type: 'unit' as const },
      { name: 'to', introducers: ['to', 'into', 'in'], type: 'unit' as const },
    ],
  },
  {
    template: '{value} {from} in {to}',
    slots: [
      { name: 'value', introducers: [''], type: 'number' as const },
      { name: 'from', introducers: [''], type: 'unit' as const },
      { name: 'to', introducers: ['in'], type: 'unit' as const },
    ],
  },
  {
    template: 'how many {to} is {value} {from}',
    slots: [
      { name: 'to', introducers: ['many'], type: 'unit' as const },
      { name: 'value', introducers: ['is'], type: 'number' as const },
      { name: 'from', introducers: [''], type: 'unit' as const },
    ],
  },
  {
    template: 'how many {to} in {value} {from}',
    slots: [
      { name: 'to', introducers: ['many'], type: 'unit' as const },
      { name: 'value', introducers: ['in'], type: 'number' as const },
      { name: 'from', introducers: [''], type: 'unit' as const },
    ],
  },
  {
    template: 'how many {to} are in {value} {from}',
    slots: [
      { name: 'to', introducers: ['many'], type: 'unit' as const },
      { name: 'value', introducers: ['in', 'are in'], type: 'number' as const },
      { name: 'from', introducers: [''], type: 'unit' as const },
    ],
  },
];

export const convertUnitsCapability: Capability = {
  id: 'convertUnits',
  title: 'Convert units',
  promise: '“Convert 5 km to miles”, “how many ounces is 250 g”.',
  group: 'Numbers & units',
  keywords: [
    'convert', 'conversion', 'how many', 'in miles', 'in km', 'in kg', 'in pounds', 'to celsius',
    'to fahrenheit', 'unit', 'units', 'inches', 'metres', 'meters',
  ],
  examples: [
    { text: 'convert 5 km to miles', capabilityId: 'convertUnits', captures: [{ name: 'value', value: 5 }] },
    { text: 'how many ounces is 250 g', capabilityId: 'convertUnits', captures: [{ name: 'value', value: 250 }] },
    { text: '100 f to c', capabilityId: 'convertUnits', captures: [{ name: 'value', value: 100 }] },
  ],
  inputs: [
    { name: 'value', label: 'Value', example: '5' },
    { name: 'from', label: 'From unit', hint: 'Any unit word, e.g. km, kilograms, °C', kind: 'text', example: 'km' },
    { name: 'to', label: 'To unit', hint: 'Any unit word, e.g. miles, lb, °F', kind: 'text', example: 'miles' },
  ],
  patterns: CONVERT_PATTERNS,
  run(context): SolveOutcome {
    const value = context.get('value');
    // Slot text from the sentence first ("5 km to miles" → km, miles), then the
    // form fields, then a last-resort scan of the words themselves.
    const fromGuess =
      context.getText('from') ?? context.raw.match(/\b([^\s]+)\s+(?:to|into)\b/i)?.[1];
    const toGuess = context.getText('to') ?? context.raw.match(/\b(?:to|into|in)\s+([^\s]+)/i)?.[1];

    if (value === undefined || !fromGuess || !toGuess) {
      return {
        ok: false,
        message: 'Tell me the value and both units, for example “convert 5 km to miles”.',
      };
    }
    if (!lookupUnit(fromGuess)) return { ok: false, message: `I do not know the unit “${fromGuess}”.` };
    if (!lookupUnit(toGuess)) return { ok: false, message: `I do not know the unit “${toGuess}”.` };

    try {
      const outcome = convertByWords(value, fromGuess, toGuess);
      const rows = [
        { label: `${nf(value)} ${outcome.from.symbol}`, value: `${nf(outcome.result)} ${outcome.to.symbol}`, emphasize: true },
      ];
      // Show the same value in the rest of the category, because that is usually
      // what someone actually needs next.
      const category = categoryById(outcome.from.categoryId);
      const others = category
        ? category.units
            .filter((unit) => unit.id !== outcome.from.unitId && unit.id !== outcome.to.unitId)
            .slice(0, 6)
            .map((unit) => `${nf(convert(category, value, outcome.from.unitId, unit.id))} ${unit.symbol}`)
        : [];

      return {
        ok: true,
        headline: `${nf(outcome.result)} ${outcome.to.symbol}`,
        understood: `${nf(value)} ${outcome.from.symbol} → ${outcome.to.symbol} (${outcome.categoryLabel})`,
        blocks: [
          { kind: 'stats', rows },
          ...(others.length > 0 ? [{ kind: 'list' as const, title: `Also in ${outcome.categoryLabel}`, items: others }] : []),
        ],
        copyText: `${value} ${outcome.from.symbol} = ${outcome.result} ${outcome.to.symbol}`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That conversion failed.' };
    }
  },
};

/** Answers "what units does OmniCalc know?" so the feature is discoverable. */
export const listUnitsCapability: Capability = {
  id: 'listUnits',
  title: 'See available units',
  promise: '“What units can you convert?”',
  group: 'Numbers & units',
  keywords: ['what units', 'which units', 'list units', 'available units', 'supported units'],
  examples: [{ text: 'what units can you convert', capabilityId: 'listUnits', captures: [] }],
  inputs: [],
  run(context): SolveOutcome {
    const word = context.raw.replace(/[^a-z°µ]/gi, ' ').trim();
    const hit = word ? lookupUnit(word.split(/\s+/).pop() ?? '') : undefined;
    if (hit) {
      const units = allUnitsOf(hit.categoryId);
      return {
        ok: true,
        headline: `${units.length} ${hit.categoryId} units`,
        understood: `units available for ${hit.categoryId}`,
        blocks: [{ kind: 'list', title: `${hit.categoryId} units`, items: units.map((unit) => `${unit.label} (${unit.symbol})`) }],
        copyText: units.map((unit) => `${unit.label} (${unit.symbol})`).join('\n'),
      };
    }
    return {
      ok: false,
      message: 'Ask it as a conversion instead, for example “convert 5 km to miles”.',
    };
  },
};
