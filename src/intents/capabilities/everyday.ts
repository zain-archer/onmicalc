import { evaluateExpression } from '@/core/engine';
import { formatNumber } from '@/core/precision/format';
import type { Capability, SolveContext, SolveOutcome } from '../types';

/** Evaluates an expression with the app's default settings, returning formatted text. */
function evaluate(source: string): { ok: true; value: number; display: string } | { ok: false; message: string } {
  const result = evaluateExpression(source);
  if (!result.ok) {
    return { ok: false, message: `${result.error.message} (in "${source}")` };
  }
  return { ok: true, value: result.value, display: result.display };
}

function numberFrom(context: SolveContext, name: string, fallback?: number): number | undefined {
  const value = context.get(name);
  if (value !== undefined) return value;
  return fallback;
}

function money(value: number): string {
  return formatNumber(value, { precision: 6, thousandsSeparator: true });
}

const PERCENT_PATTERNS = [
  {
    template: 'what is {percent}% of {whole}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'whole', introducers: ['of', 'off'], type: 'number' as const },
    ],
  },
  {
    template: '{percent}% of {whole}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'whole', introducers: ['of'], type: 'number' as const },
    ],
  },
  {
    template: 'what is {percent} percent of {whole}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'whole', introducers: ['of'], type: 'number' as const },
    ],
  },
  {
    template: '{percent} percent of {whole}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'whole', introducers: ['of'], type: 'number' as const },
    ],
  },
];

const CHANGE_PATTERNS = [
  {
    template: 'what is the percentage change from {from} to {to}',
    slots: [
      { name: 'from', introducers: ['from'], type: 'number' as const },
      { name: 'to', introducers: ['to'], type: 'number' as const },
    ],
  },
  {
    template: 'percentage change from {from} to {to}',
    slots: [
      { name: 'from', introducers: ['from'], type: 'number' as const },
      { name: 'to', introducers: ['to'], type: 'number' as const },
    ],
  },
  {
    template: 'increase {from} by {percent}%',
    slots: [
      { name: 'from', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['by'], type: 'number' as const },
    ],
  },
  {
    template: 'decrease {from} by {percent}%',
    slots: [
      { name: 'from', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['by'], type: 'number' as const },
    ],
  },
  {
    template: 'increase {from} by {percent} percent',
    slots: [
      { name: 'from', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['by'], type: 'number' as const },
    ],
  },
  {
    template: 'decrease {from} by {percent} percent',
    slots: [
      { name: 'from', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['by'], type: 'number' as const },
    ],
  },
  {
    template: 'increase {from} by {percent}%',
    slots: [
      { name: 'from', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['by'], type: 'number' as const },
    ],
  },
];

const RATIO_PATTERNS = [
  {
    template: 'what percent is {part} of {whole}',
    slots: [
      { name: 'part', introducers: ['is'], type: 'number' as const },
      { name: 'whole', introducers: ['of'], type: 'number' as const },
    ],
  },
  {
    template: 'what percentage is {part} of {whole}',
    slots: [
      { name: 'part', introducers: ['is'], type: 'number' as const },
      { name: 'whole', introducers: ['of'], type: 'number' as const },
    ],
  },
  {
    template: '{part} is what percent of {whole}',
    slots: [
      { name: 'part', introducers: [''], type: 'number' as const },
      { name: 'whole', introducers: ['of'], type: 'number' as const },
    ],
  },
];

const TIP_PATTERNS = [
  {
    template: 'tip {percent} percent on a bill of {bill}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'bill', introducers: ['on a bill of', 'on a bill', 'on', 'for'], type: 'number' as const },
      { name: 'people', introducers: ['between', 'for'], type: 'number' as const, optional: true },
    ],
  },
  {
    template: 'tip {percent} percent on {bill}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'bill', introducers: ['on', 'for'], type: 'number' as const },
    ],
  },
  {
    template: '{percent} percent tip on {bill}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'bill', introducers: ['on'], type: 'number' as const },
    ],
  },
  {
    template: 'tip on a bill of {bill}',
    slots: [{ name: 'bill', introducers: ['of'], type: 'number' as const }],
  },
  {
    template: 'tip {percent}% on a {bill} bill for {people} people',
    slots: [
      { name: 'percent', introducers: ['tip'], type: 'number' as const },
      { name: 'bill', introducers: ['on a', 'on', 'a'], type: 'number' as const },
      { name: 'people', introducers: ['for', 'between'], type: 'number' as const, fallback: '1' },
    ],
  },
  {
    template: 'tip {percent}% on {bill} for {people} people',
    slots: [
      { name: 'percent', introducers: ['tip'], type: 'number' as const },
      { name: 'bill', introducers: ['on a', 'on'], type: 'number' as const },
      { name: 'people', introducers: ['for', 'between'], type: 'number' as const, fallback: '1' },
    ],
  },
  {
    template: 'tip {percent}% on {bill}',
    slots: [
      { name: 'percent', introducers: ['tip'], type: 'number' as const },
      { name: 'bill', introducers: ['on a', 'on'], type: 'number' as const },
      { name: 'people', introducers: ['for', 'between'], type: 'number' as const, optional: true, fallback: '1' },
    ],
  },
  {
    template: 'split a {bill} bill between {people} people',
    slots: [
      { name: 'bill', introducers: ['a'], type: 'number' as const },
      { name: 'people', introducers: ['between', 'among'], type: 'number' as const },
    ],
  },
];

const DISCOUNT_PATTERNS = [
  {
    template: '{percent}% off {price}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'price', introducers: ['off'], type: 'number' as const },
      { name: 'tax', introducers: ['plus'], type: 'number' as const, optional: true },
    ],
  },
  {
    template: 'what is {percent}% off {price}',
    slots: [
      { name: 'percent', introducers: ['is'], type: 'number' as const },
      { name: 'price', introducers: ['off'], type: 'number' as const },
      { name: 'tax', introducers: ['plus'], type: 'number' as const, optional: true },
    ],
  },
  {
    template: 'discount of {percent}% on {price}',
    slots: [
      { name: 'percent', introducers: ['of'], type: 'number' as const },
      { name: 'price', introducers: ['on'], type: 'number' as const },
      { name: 'tax', introducers: ['plus'], type: 'number' as const, optional: true },
    ],
  },
  {
    template: 'price {price} with {percent} percent discount',
    slots: [
      { name: 'price', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['with'], type: 'number' as const },
      { name: 'tax', introducers: ['plus'], type: 'number' as const, optional: true },
    ],
  },
  {
    template: '{percent}% off {price} plus {tax}% tax',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'price', introducers: ['off'], type: 'number' as const },
      { name: 'tax', introducers: ['plus'], type: 'number' as const },
    ],
  },
  {
    template: 'what is {percent}% off {price} plus {tax}% tax',
    slots: [
      { name: 'percent', introducers: ['is'], type: 'number' as const },
      { name: 'price', introducers: ['off'], type: 'number' as const },
      { name: 'tax', introducers: ['plus'], type: 'number' as const },
    ],
  },
  {
    template: '{percent} percent discount on {price}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'price', introducers: ['on'], type: 'number' as const },
    ],
  },
  {
    template: '{percent} percent off {price}',
    slots: [
      { name: 'percent', introducers: [''], type: 'number' as const },
      { name: 'price', introducers: ['off'], type: 'number' as const },
    ],
  },
  {
    template: 'price {price} with {percent} percent off',
    slots: [
      { name: 'price', introducers: [''], type: 'number' as const },
      { name: 'percent', introducers: ['with'], type: 'number' as const },
    ],
  },
];

/** Shared by the "calculate" capability and the generic fallback. */
export function evaluateExpressionOutcome(source: string): SolveOutcome {
  const cleaned = source.replace(/^\s*(?:what is|calculate|evaluate|compute|work out)\s+/i, '').trim();
  if (!cleaned) {
    return { ok: false, message: 'Type an expression, for example 2 + 2 * 3.' };
  }
  const result = evaluate(cleaned);
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: true,
    headline: result.display,
    understood: `evaluate ${cleaned}`,
    blocks: [
      { kind: 'math', text: `${cleaned} = ${result.display}` },
      { kind: 'stats', rows: [{ label: 'Exact value', value: String(result.value) }] },
    ],
    copyText: `${cleaned} = ${result.display}`,
  };
}

export const calculateCapability: Capability = {
  id: 'calculate',
  title: 'Calculate anything',
  promise: 'Type any expression the way you would say it: “18% of 240”, “(3+4)^2 / 7”.',
  group: 'Everyday maths',
  keywords: [
    'calculate', 'evaluate', 'compute', 'what is', 'how much is', 'work out', 'expression', 'sum',
    'arithmetic', 'maths', 'math', 'equals',
  ],
  examples: [
    { text: '2+2', capabilityId: 'calculate', captures: [] },
    { text: '(3+4)^2 / 7', capabilityId: 'calculate', captures: [] },
    { text: 'sin(30) + cos(60)', capabilityId: 'calculate', captures: [] },
    { text: 'sqrt(144) * 100', capabilityId: 'calculate', captures: [] },
    { text: 'calculate 12 * 12', capabilityId: 'calculate', captures: [] },
  ],
  inputs: [
    { name: 'expression', label: 'Expression', hint: 'Anything you would type into a calculator', expression: true, example: '2 + 2 * 3' },
  ],
  run(context) {
    return evaluateExpressionOutcome(context.raw);
  },
};

export const percentOfCapability: Capability = {
  id: 'percentOf',
  title: 'Find a percentage of something',
  promise: '“18% of 240”, “what is 7.5 percent of 1000”.',
  group: 'Everyday maths',
  keywords: ['percent of', 'percentage of', '% of', 'percent', 'of'],
  examples: [
    { text: '18% of 240', capabilityId: 'percentOf', captures: [{ name: 'percent', value: 18 }, { name: 'whole', value: 240 }] },
    { text: 'what is 15 percent of 200', capabilityId: 'percentOf', captures: [{ name: 'percent', value: 15 }, { name: 'whole', value: 200 }] },
  ],
  inputs: [
    { name: 'percent', label: 'Percent', unit: '%', example: '15' },
    { name: 'whole', label: 'Of what', example: '200' },
  ],
  patterns: PERCENT_PATTERNS,
  run(context) {
    const percent = numberFrom(context, 'percent');
    const whole = numberFrom(context, 'whole');
    if (percent === undefined || whole === undefined) {
      return { ok: false, message: 'I need both a percentage and a value, for example “15% of 200”.' };
    }
    const value = (percent / 100) * whole;
    return {
      ok: true,
      headline: money(value),
      understood: `${percent}% of ${money(whole)}`,
      money: true,
      blocks: [
        { kind: 'stats', rows: [{ label: `${percent}% of ${money(whole)}`, value: money(value), emphasize: true }] },
        {
          kind: 'list',
          title: 'Related',
          items: [
            `${money(whole)} plus ${percent}% = ${money(whole + value)}`,
            `${money(whole)} minus ${percent}% = ${money(whole - value)}`,
            `${percent}% as a decimal = ${percent / 100}`,
          ],
        },
      ],
      copyText: `${percent}% of ${whole} = ${value}`,
    };
  },
};

export const percentRatioCapability: Capability = {
  id: 'percentRatio',
  title: 'What percent is one number of another',
  promise: '“25 is what percent of 200?”',
  group: 'Everyday maths',
  keywords: ['what percent is', 'what percentage is', 'is what percent of', 'is what percentage of', 'proportion', 'as a percent of'],
  examples: [
    { text: 'what percent is 25 of 200', capabilityId: 'percentRatio', captures: [{ name: 'part', value: 25 }, { name: 'whole', value: 200 }] },
    { text: '25 is what percent of 200', capabilityId: 'percentRatio', captures: [{ name: 'part', value: 25 }, { name: 'whole', value: 200 }] },
  ],
  inputs: [
    { name: 'part', label: 'Part', example: '25' },
    { name: 'whole', label: 'Whole', example: '200' },
  ],
  patterns: RATIO_PATTERNS,
  run(context) {
    const part = numberFrom(context, 'part');
    const whole = numberFrom(context, 'whole');
    if (part === undefined || whole === undefined) {
      return { ok: false, message: 'I need both numbers, for example “25 is what percent of 200?”.' };
    }
    if (whole === 0) return { ok: false, message: 'The whole cannot be zero.' };
    const percent = (part / whole) * 100;
    return {
      ok: true,
      headline: `${formatNumber(percent, { precision: 6 })}%`,
      understood: `${part} as a percentage of ${money(whole)}`,
      blocks: [
        {
          kind: 'stats',
          rows: [
            { label: 'Percentage', value: `${formatNumber(percent, { precision: 6 })}%`, emphasize: true },
            { label: 'As a fraction', value: `${part}/${whole}` },
            { label: 'As a decimal', value: String(part / whole) },
          ],
        },
      ],
      copyText: `${part} is ${percent}% of ${whole}`,
    };
  },
};

export const percentChangeCapability: Capability = {
  id: 'percentChange',
  title: 'Percentage change or increase',
  promise: '“Percentage change from 200 to 250”, “increase 80 by 15%”.',
  group: 'Everyday maths',
  keywords: ['percentage change', 'percent change', 'increase by', 'decrease by', 'increase', 'decrease', 'change', 'rises', 'drops', 'goes up', 'goes down', 'grew', 'grows', 'shrink'],
  examples: [
    { text: 'percentage change from 200 to 250', capabilityId: 'percentChange', captures: [{ name: 'from', value: 200 }, { name: 'to', value: 250 }] },
    { text: 'increase 80 by 15%', capabilityId: 'percentChange', captures: [{ name: 'from', value: 80 }, { name: 'percent', value: 15 }] },
    { text: 'decrease 500 by 12.5%', capabilityId: 'percentChange', captures: [{ name: 'from', value: 500 }, { name: 'percent', value: 12.5 }] },
  ],
  inputs: [
    { name: 'from', label: 'Starting value', example: '200' },
    { name: 'to', label: 'Ending value', example: '250', optional: true },
    { name: 'percent', label: 'Or a percentage', unit: '%', example: '15', optional: true },
  ],
  patterns: CHANGE_PATTERNS,
  run(context) {
    const from = numberFrom(context, 'from');
    const to = numberFrom(context, 'to');
    const percent = numberFrom(context, 'percent');
    const decreasing = /\bdecreas|\breduc|\blower\b|\bdiscount\b/i.test(context.raw);

    if (from === undefined) {
      return { ok: false, message: 'I need a starting value, for example “increase 80 by 15%”.' };
    }
    if (to === undefined && percent === undefined) {
      return { ok: false, message: 'Add the ending value or the percentage, for example “from 200 to 250”.' };
    }
    if (from === 0 && to !== undefined) {
      return { ok: false, message: 'There is no percentage change from zero — the increase is infinite.' };
    }

    const target = to ?? from * (1 + (decreasing ? -1 : 1) * ((percent ?? 0) / 100));
    const change = from === 0 ? Number.NaN : ((target - from) / Math.abs(from)) * 100;

    /*
     * The headline answers the question that was asked. "From 200 to 250" asks
     * for the change, so that is the answer; "increase 80 by 15%" asks for the
     * new value, and answering "+15%" merely restated the question — the number
     * the user wants (92) was buried in the detail rows.
     */
    const askedForPercentageChange = to !== undefined;
    const changeText = `${change >= 0 ? '+' : ''}${formatNumber(change, { precision: 6 })}%`;

    return {
      ok: true,
      headline: askedForPercentageChange ? changeText : money(target),
      understood:
        to !== undefined
          ? `change from ${money(from)} to ${money(target)}`
          : `${decreasing ? 'decrease' : 'increase'} ${money(from)} by ${percent}%`,
      money: true,
      blocks: [
        {
          kind: 'stats',
          rows: [
            {
              label: askedForPercentageChange ? 'Change' : 'New value',
              value: askedForPercentageChange ? changeText : money(target),
              emphasize: true,
            },
            // When the headline is already the change, do not repeat the row.
            ...(askedForPercentageChange ? [] : [{ label: 'Change', value: changeText }]),
            { label: 'Difference', value: money(target - from) },
            { label: 'Starting value', value: money(from) },
            { label: 'New value', value: money(target) },
            { label: 'Multiplier', value: formatNumber(from === 0 ? 0 : target / from, { precision: 8 }) },
          ],
        },
      ],
      copyText: `${from} → ${target} is a ${change}% change`,
    };
  },
};

export const tipCapability: Capability = {
  id: 'tip',
  title: 'Tip and split a bill',
  promise: '“tip 15% on 80 for 4 people”.',
  group: 'Money',
  keywords: ['tip', 'percent tip', 'tip on', 'gratuity', 'split the bill', 'split a bill', 'bill', 'restaurant', 'waiter', 'service charge'],
  examples: [
    { text: 'tip 15% on 80 for 4 people', capabilityId: 'tip', captures: [{ name: 'percent', value: 15 }, { name: 'bill', value: 80 }, { name: 'people', value: 4 }] },
    { text: 'tip 10% on 45', capabilityId: 'tip', captures: [{ name: 'percent', value: 10 }, { name: 'bill', value: 45 }] },
    { text: 'split a 120 bill between 5 people', capabilityId: 'tip', captures: [{ name: 'bill', value: 120 }, { name: 'people', value: 5 }] },
  ],
  inputs: [
    { name: 'bill', label: 'Bill total', example: '80' },
    { name: 'percent', label: 'Tip', unit: '%', example: '15', optional: true },
    { name: 'people', label: 'Split between', hint: 'Number of people', example: '4', optional: true },
  ],
  patterns: TIP_PATTERNS,
  run(context) {
    const bill = numberFrom(context, 'bill');
    if (bill === undefined) return { ok: false, message: 'I need the bill total, for example “tip 15% on 80”.' };
    const percent = numberFrom(context, 'percent', 0) ?? 0;
    const people = numberFrom(context, 'people', 1) ?? 1;
    if (people <= 0) return { ok: false, message: 'The number of people must be at least 1.' };

    const tipAmount = (bill * percent) / 100;
    const total = bill + tipAmount;
    return {
      ok: true,
      headline: money(total / people),
      understood: `tip ${percent}% on ${money(bill)}${people > 1 ? ` split ${people} ways` : ''}`,
      money: true,
      blocks: [
        {
          kind: 'stats',
          rows: [
            { label: 'Each person pays', value: money(total / people), emphasize: true },
            { label: 'Tip', value: money(tipAmount) },
            { label: 'Total with tip', value: money(total) },
          ],
        },
      ],
      copyText: `Bill ${bill}, tip ${percent}% → total ${total}, ${money(total / people)} each`,
    };
  },
};

export const discountCapability: Capability = {
  id: 'discount',
  title: 'Work out a discount or sale price',
  promise: '“20% off 150”, “30% off 89.99 plus 10% tax”.',
  group: 'Money',
  keywords: ['discount', 'percent discount', 'percent off', 'sale price', 'sale', 'reduced price', 'price', 'bargain', 'deal', 'marked down'],
  examples: [
    { text: '20% off 150', capabilityId: 'discount', captures: [{ name: 'percent', value: 20 }, { name: 'price', value: 150 }] },
    { text: '30% off 89.99 plus 10% tax', capabilityId: 'discount', captures: [{ name: 'percent', value: 30 }, { name: 'price', value: 89.99 }, { name: 'tax', value: 10 }] },
  ],
  inputs: [
    { name: 'price', label: 'Original price', example: '150' },
    { name: 'percent', label: 'Discount', unit: '%', example: '20' },
    { name: 'tax', label: 'Added tax', unit: '%', example: '0', optional: true },
  ],
  patterns: DISCOUNT_PATTERNS,
  run(context) {
    const price = numberFrom(context, 'price');
    const percent = numberFrom(context, 'percent');
    const tax = numberFrom(context, 'tax', 0) ?? 0;
    if (price === undefined || percent === undefined) {
      return { ok: false, message: 'Tell me the price and the discount, for example “20% off 150”.' };
    }
    const saved = (price * percent) / 100;
    const afterDiscount = price - saved;
    const taxAmount = (afterDiscount * tax) / 100;
    const final = afterDiscount + taxAmount;
    return {
      ok: true,
      headline: money(final),
      understood: `${percent}% off ${money(price)}${tax ? ` plus ${tax}% tax` : ''}`,
      money: true,
      blocks: [
        {
          kind: 'stats',
          rows: [
            { label: 'You pay', value: money(final), emphasize: true },
            { label: 'You save', value: money(saved) },
            { label: 'After discount', value: money(afterDiscount) },
            ...(tax ? [{ label: `Tax at ${tax}%`, value: money(taxAmount) }] : []),
            { label: 'Effective discount', value: `${formatNumber(((price - final) / price) * 100, { precision: 5 })}%` },
          ],
        },
      ],
      copyText: `${price} with ${percent}% off = ${final}`,
    };
  },
};

export { evaluate as evaluateForIntent, money as formatMoney };
