import { formatNumber } from '@/core/precision/format';
import {
  correlation,
  linearRegression,
  parseDataset,
  summarize,
} from '@/math/statistics';
import {
  binomialCdf,
  binomialPmf,
  normalCdf,
  normalPdf,
  poissonCdf,
  poissonPmf,
} from '@/math/probability';
import type { Capability, SolveOutcome, ResultBlock } from '../types';

const nf = (value: number, precision = 8) => formatNumber(value, { precision });

/** Accepts "1, 2, 3", "1 2 3", newlines, or a pasted column from a spreadsheet. */
function readDataset(raw: string): number[] | null {
  const cleaned = raw
    .replace(/^[^:]*:\s*/, '')
    .replace(/[a-z]+=/gi, ' ')
    .replace(/\b(?:data|dataset|values?|numbers?|list|for|of|the)\b/gi, ' ')
    .trim();
  if (!cleaned) return null;
  const parsed = parseDataset(cleaned);
  if (parsed && parsed.length > 0) return parsed;
  const fallback = cleaned
    .split(/[\s,;|]+/)
    .map((piece) => Number(piece))
    .filter((value) => Number.isFinite(value));
  return fallback.length > 0 ? fallback : null;
}

function datasetFromContext(raw: string, quoted: string | undefined): number[] | null {
  if (quoted) {
    const parsed = readDataset(quoted);
    if (parsed) return parsed;
  }
  // Everything after the first colon, or the numbers in the sentence itself.
  const afterColon = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw.replace(/^[^0-9-]*/, '');
  return readDataset(afterColon);
}

export const statisticsCapability: Capability = {
  id: 'statistics',
  title: 'Summarise a list of numbers',
  promise: '“Summarise 12, 15, 11, 19, 15”, “mean and standard deviation of …”.',
  group: 'Data & statistics',
  keywords: [
    'summarise', 'summarize', 'average', 'mean', 'median', 'mode', 'standard deviation', 'variance',
    'quartile', 'dataset', 'data', 'statistics', 'spread', 'distribution of',
  ],
  examples: [
    { text: 'average of 12, 15, 11, 19, 15', capabilityId: 'statistics', captures: [] },
    { text: 'summarise 4, 8, 15, 16, 23, 42', capabilityId: 'statistics', captures: [] },
    { text: 'standard deviation of 2 4 4 4 5 5 7 9', capabilityId: 'statistics', captures: [] },
  ],
  inputs: [
    {
      name: 'data',
      label: 'Numbers',
      hint: 'Separated by commas, spaces or new lines',
      kind: 'dataset',
      example: '12, 15, 11, 19, 15',
    },
  ],
  run(context): SolveOutcome {
    const raw = context.getText('data') ?? context.raw;
    const values = datasetFromContext(raw, context.getText('data'));
    if (!values || values.length === 0) {
      return {
        ok: false,
        message: 'Give me the numbers, for example “summarise 12, 15, 11, 19”.',
      };
    }
    if (values.length === 1) {
      return { ok: false, message: 'One value is not a dataset — add at least two numbers.' };
    }

    const summary = summarize(values);
    const blocks: ResultBlock[] = [
      {
        kind: 'stats',
        rows: [
          { label: 'Mean', value: nf(summary.mean), emphasize: true },
          { label: 'Median', value: nf(summary.median) },
          { label: 'Mode', value: summary.modes.length ? summary.modes.map((value) => nf(value)).join(', ') : 'none' },
          { label: 'Standard deviation (sample)', value: nf(summary.sdSample) },
          { label: 'Standard deviation (population)', value: nf(summary.sdPopulation) },
          { label: 'Variance (sample)', value: nf(summary.varianceSample) },
          { label: 'Minimum', value: nf(summary.min) },
          { label: 'Q1', value: nf(summary.q1) },
          { label: 'Q3', value: nf(summary.q3) },
          { label: 'Maximum', value: nf(summary.max) },
          { label: 'Range', value: nf(summary.range) },
          { label: 'Interquartile range', value: nf(summary.iqr) },
          { label: 'Sum', value: nf(summary.sum) },
        ],
      },
      {
        kind: 'list',
        title: 'Reading it',
        items: [
          `Count: ${summary.count} values`,
          `The middle half of the data lies between ${nf(summary.q1)} and ${nf(summary.q3)}.`,
          summary.modes.length === 0
            ? 'No value repeats, so there is no mode.'
            : `Most common value: ${summary.modes.map((value) => nf(value)).join(', ')}.`,
        ],
      },
    ];

    return {
      ok: true,
      headline: `Mean ${nf(summary.mean)}, median ${nf(summary.median)}`,
      understood: `summarise ${summary.count} values`,
      blocks,
      copyText: [
        `n = ${summary.count}`,
        `mean = ${summary.mean}`,
        `median = ${summary.median}`,
        `sd (sample) = ${summary.sdSample}`,
        `min = ${summary.min}, max = ${summary.max}`,
      ].join('\n'),
    };
  },
};

const REGRESSION_PATTERNS = [
  {
    template: 'linear regression for x {x} y {y}',
    slots: [
      { name: 'x', introducers: ['x'], type: 'list' as const },
      { name: 'y', introducers: ['y'], type: 'list' as const },
    ],
  },
  {
    template: 'line of best fit for x {x} y {y}',
    slots: [
      { name: 'x', introducers: ['x'], type: 'list' as const },
      { name: 'y', introducers: ['y'], type: 'list' as const },
    ],
  },
  {
    template: 'best fit for x {x} y {y}',
    slots: [
      { name: 'x', introducers: ['x'], type: 'list' as const },
      { name: 'y', introducers: ['y'], type: 'list' as const },
    ],
  },
  {
    template: 'linear regression of {y} against {x}',
    slots: [
      { name: 'y', introducers: ['of'], type: 'list' as const },
      { name: 'x', introducers: ['against'], type: 'list' as const },
    ],
  },
  {
    template: 'regression line for x {x} y {y}',
    slots: [
      { name: 'x', introducers: ['x'], type: 'list' as const },
      { name: 'y', introducers: ['y'], type: 'list' as const },
    ],
  },
];

export const regressionCapability: Capability = {
  id: 'regression',
  title: 'Fit a line to data',
  promise: '“Linear regression for x 1,2,3,4 y 2.1,3.9,6.2,7.8”.',
  group: 'Data & statistics',
  keywords: [
    'regression', 'linear regression', 'line of best fit', 'best fit', 'trend line', 'correlation',
    'correlate', 'fit', 'r squared', 'slope and intercept',
  ],
  examples: [
    { text: 'linear regression for x 1, 2, 3, 4 y 1.9, 4.1, 5.9, 8.2', capabilityId: 'regression', captures: [] },
    { text: 'line of best fit for x 1 2 3 4 y 2 4 6 9', capabilityId: 'regression', captures: [] },
  ],
  inputs: [
    { name: 'x', label: 'x values', kind: 'dataset', example: '1, 2, 3, 4' },
    { name: 'y', label: 'y values', kind: 'dataset', example: '1.9, 4.1, 5.9, 8.2' },
  ],
  patterns: REGRESSION_PATTERNS,
  run(context): SolveOutcome {
    const raw = context.raw;
    const xText = context.getText('x');
    const yText = context.getText('y');

    let xs = xText ? readDataset(xText) : null;
    let ys = yText ? readDataset(yText) : null;
    if (!xs || !ys) {
      const afterColon = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : '';
      const columns = afterColon
        .split(/\n|;/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (columns.length >= 2) {
        xs = readDataset(columns[0]!);
        ys = readDataset(columns[1]!);
      }
    }

    if (!xs || !ys) {
      return {
        ok: false,
        message: 'I need both columns, for example “linear regression for x 1,2,3 y 2,4,6”.',
      };
    }
    if (xs.length !== ys.length) {
      return { ok: false, message: `I have ${xs.length} x values but ${ys.length} y values — they must match.` };
    }
    if (xs.length < 2) {
      return { ok: false, message: 'A line needs at least two points.' };
    }

    try {
      const fit = linearRegression(xs, ys);
      const r = correlation(xs, ys);
      return {
        ok: true,
        headline: fit.equation,
        understood: `least-squares line through ${xs.length} points`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: 'Slope', value: nf(fit.slope), emphasize: true },
              { label: 'Intercept', value: nf(fit.intercept) },
              { label: 'r² (fit quality)', value: nf(fit.r2, 6) },
              { label: 'Correlation r', value: nf(r, 6) },
            ],
          },
          {
            kind: 'list',
            title: 'What it means',
            items: [
              `Each extra unit of x changes y by about ${nf(fit.slope)}.`,
              fit.r2 > 0.95
                ? 'The line explains almost all of the variation.'
                : fit.r2 > 0.7
                  ? 'The line explains a good part of the variation, but not all of it.'
                  : 'The line is a weak fit — the data may not be linear.',
              `Predict a value with the calculator: “${fit.slope} * x + ${fit.intercept}”.`,
            ],
          },
        ],
        copyText: `y = ${fit.slope}x + ${fit.intercept} (r² = ${fit.r2})`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That regression failed.' };
    }
  },
};

/** Probability questions: normal, binomial or Poisson, in plain words. */
export const probabilityCapability: Capability = {
  id: 'probability',
  title: 'Probability questions',
  promise: '“probability z < 1.96”, “chance of at most 8 successes in 10 trials with p 0.3”.',
  group: 'Data & statistics',
  keywords: [
    'probability', 'chance', 'odds', 'normal', 'z score', 'z-score', 'bell curve', 'standard normal',
    'binomial', 'poisson', 'at most', 'at least', 'no more than', 'fewer than', 'distribution',
  ],
  examples: [
    { text: 'probability that z < 1.96', capabilityId: 'probability', captures: [{ name: 'x', value: 1.96 }] },
    { text: 'probability between -1 and 1', capabilityId: 'probability', captures: [{ name: 'low', value: -1 }, { name: 'high', value: 1 }] },
    { text: 'chance of at most 8 successes in 10 trials with p 0.3', capabilityId: 'probability', captures: [{ name: 'k', value: 8 }, { name: 'n', value: 10 }, { name: 'p', value: 0.3 }] },
  ],
  inputs: [
    { name: 'x', label: 'Value / z-score', example: '1.96', optional: true },
    { name: 'low', label: 'Range start', example: '-1', optional: true },
    { name: 'high', label: 'Range end', example: '1', optional: true },
    { name: 'k', label: 'Successes', example: '8', optional: true },
    { name: 'n', label: 'Trials', example: '10', optional: true },
    { name: 'p', label: 'Probability of success', example: '0.3', optional: true },
    { name: 'lambda', label: 'Poisson mean', example: '2', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw;
    const number = (name: string, pattern: RegExp): number | undefined => {
      const captured = context.get(name);
      if (captured !== undefined) return captured;
      const match = pattern.exec(raw);
      return match ? Number(match[1]) : undefined;
    };

    const n = number('n', /(\d+)\s*trials?/i);
    const k = number('k', /(?:at most|at least|fewer than|exactly|no more than|more than)\s*(\d+)|(\d+)\s*success/i)
      ?? number('k', /(\d+)\s*success/i);
    const p = number('p', /(?:probability|p)\s*(?:of success\s*)?(?:=|is|of)?\s*(0?\.\d+|\d+%)/i);
    const lambda = number('lambda', /(?:mean|lambda)\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)/i);

    // Binomial
    if (n !== undefined && k !== undefined && p !== undefined) {
      const probability = p > 1 ? p / 100 : p;
      const atMost = /at most|no more than|fewer than|<=|≤/i.test(raw);
      const atLeast = /at least|no fewer than|>=|≥/i.test(raw);
      const value = atMost ? binomialCdf(k, n, probability) : atLeast ? 1 - binomialCdf(k - 1, n, probability) : binomialPmf(k, n, probability);
      const label = atMost ? `P(X ≤ ${k})` : atLeast ? `P(X ≥ ${k})` : `P(X = ${k})`;
      return {
        ok: true,
        headline: nf(value, 8),
        understood: `${label} for n = ${n}, p = ${probability}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label, value: nf(value, 8), emphasize: true },
              { label: 'Mean (np)', value: nf(n * probability) },
              { label: 'Standard deviation', value: nf(Math.sqrt(n * probability * (1 - probability))) },
              { label: 'P(X = k)', value: nf(binomialPmf(k, n, probability)) },
            ],
          },
        ],
        copyText: `${label} = ${value}`,
      };
    }

    // Poisson
    if (lambda !== undefined && k !== undefined) {
      const atMost = /at most|no more than|fewer than/i.test(raw);
      const value = atMost ? poissonCdf(k, lambda) : poissonPmf(k, lambda);
      const label = atMost ? `P(X ≤ ${k})` : `P(X = ${k})`;
      return {
        ok: true,
        headline: nf(value, 8),
        understood: `${label} with mean ${lambda}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label, value: nf(value, 8), emphasize: true },
              { label: 'Mean and variance', value: nf(lambda) },
            ],
          },
        ],
        copyText: `${label} = ${value} (Poisson, mean ${lambda})`,
      };
    }

    // Normal distribution
    const between = /between\s*(-?[\d.]+)\s*(?:and|to)\s*(-?[\d.]+)/i.exec(raw);
    const low = context.get('low') ?? (between ? Number(between[1]) : undefined);
    const high = context.get('high') ?? (between ? Number(between[2]) : undefined);
    const mean = number('mean', /mean\s*(?:=|is|of)?\s*(-?[\d.]+)/i) ?? 0;
    const sd = number('sd', /(?:standard deviation|sd|sigma)\s*(?:=|is|of)?\s*(-?[\d.]+)/i) ?? 1;

    if (low !== undefined && high !== undefined) {
      const value = normalCdf(high, mean, sd) - normalCdf(low, mean, sd);
      return normalResult(`P(${low} < X < ${high})`, value, mean, sd);
    }

    const x = context.get('x') ?? number('x', /(?:z\s*[<>=]\s*|below|above|less than|more than|greater than)\s*(-?[\d.]+)|(-?[\d.]+)/i);
    if (x !== undefined) {
      const below = /below|less than|<|under/i.test(raw);
      const above = /above|more than|greater than|>/i.test(raw);
      const value = above ? 1 - normalCdf(x, mean, sd) : normalCdf(x, mean, sd);
      const label = above ? `P(X > ${x})` : below ? `P(X < ${x})` : `P(X ≤ ${x})`;
      return normalResult(label, value, mean, sd);
    }

    return {
      ok: false,
      message:
        'Tell me the distribution and numbers, for example “probability z < 1.96”, “between -1 and 1”, or “at most 8 successes in 10 trials with p 0.3”.',
    };

    function normalResult(label: string, value: number, meanValue: number, sdValue: number): SolveOutcome {
      return {
        ok: true,
        headline: nf(value, 8),
        understood: `${label} for a normal distribution (mean ${meanValue}, sd ${sdValue})`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label, value: nf(value, 8), emphasize: true },
              { label: 'Complement (1 − P)', value: nf(1 - value, 8) },
              { label: 'Density at the value', value: nf(normalPdf(meanValue, meanValue, sdValue), 8) },
            ],
          },
          { kind: 'note', text: 'Values come from the error-function integral, accurate to about 1e-15.' },
        ],
        copyText: `${label} = ${value}`,
      };
    }
  },
};
