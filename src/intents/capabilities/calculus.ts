import { formatNumber } from '@/core/precision/format';
import { compileFunction, derivative, differentiate, integrate, limit, taylorSeries, taylorString } from '@/math/calculus';
import { DEFAULT_VIEWPORT, visibleBounds } from '@/graphing/viewport';
import { findExtrema, findRoots } from '@/graphing/analysis';
import type { Capability, SolveOutcome, ResultBlock } from '../types';

const nf = (value: number) => formatNumber(value, { precision: 8 });

/** Pulls "f(x) = x^2 - 4" or "the slope of x^2 at 3" down to just the body. */
const LEAD_IN =
  /^(?:(?:the|a|an|what(?:'s| is)|find|calculate|compute|work out|please|me|value of|graph of)\s+)*(?:(?:plot|graph|draw|sketch|analyse|analyze|differentiate|derive|integrate|area under|area between|area of|integral of|slope of|gradient of|rate of change of|limit of|second derivative of|first derivative of|third derivative of|derivative of|antiderivative of|taylor series of|maclaurin series of|series of|where does|where is|at what point does)\s+)+/i;

function extractFunction(raw: string): string {
  return raw
    .trim()
    .replace(LEAD_IN, '')
    .replace(/^\s*(?:f|g|y|h)\s*\(\s*[a-z]\s*\)\s*=/i, '')
    .replace(/^\s*y\s*=/i, '')
    .replace(/\s+to order\s*\d+.*$/i, '')
    .replace(/\s+around\s+-?[\d.]+.*$/i, '')
    .replace(/\s+(?:from|between)\s+-?[\d.]+\s*(?:to|and)\s+-?[\d.]+.*$/i, '')
    .replace(/\s+as\s+x\s+.*$/i, '')
    .replace(/\s+at\s+-?[\d.]+.*$/i, '')
    .replace(/\s+(?:cross(?:es)?|equal|equals|touch(?:es)?)\s+(?:the\s+)?(?:x-?axis|zero|0).*$/i, '')
    .trim();
}

function extractRange(raw: string): { from: number; to: number } | null {
  const match = /(?:from|between)\s*(-?[\d.]+)\s*(?:to|and)\s*(-?[\d.]+)/i.exec(raw);
  if (!match) return null;
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null;
  return { from, to };
}

export const plotAnalysisCapability: Capability = {
  id: 'plotAnalysis',
  title: 'Plot and analyse a function',
  promise: '“Plot x^2 - 4”, “graph sin(x) from 0 to 6.28”, “where does x^3 - 3x cross zero?”.',
  group: 'Graphs & calculus',
  keywords: [
    'plot', 'graph', 'draw', 'sketch', 'curve', 'roots', 'zeroes', 'zeros', 'x-intercepts', 'cross zero',
    'crosses zero', 'cross the axis', 'where does', 'intersect', 'turning point', 'minimum', 'maximum', 'analyse', 'analyze',
  ],
  examples: [
    { text: 'plot x^2 - 4', capabilityId: 'plotAnalysis', captures: [] },
    { text: 'graph sin(x) from 0 to 6.28', capabilityId: 'plotAnalysis', captures: [] },
    { text: 'where does x^3 - 3x cross zero', capabilityId: 'plotAnalysis', captures: [] },
  ],
  inputs: [
    { name: 'function', label: 'Function', hint: 'In terms of x', expression: true, example: 'x^2 - 4' },
    { name: 'from', label: 'From x', example: '-5', optional: true },
    { name: 'to', label: 'To x', example: '5', optional: true },
  ],
  run(context): SolveOutcome {
    const source = context.getText('function') ?? extractFunction(context.raw);
    const f = compileFunction(source);
    if (!f) {
      return { ok: false, message: `I could not read “${source}” as a function of x.` };
    }

    const range = extractRange(context.raw);
    const bounds = visibleBounds(DEFAULT_VIEWPORT, { width: 800, height: 500 });
    const minX = context.get('from') ?? range?.from ?? bounds.minX;
    const maxX = context.get('to') ?? range?.to ?? bounds.maxX;

    const roots = findRoots(f, minX, maxX);
    const extrema = findExtrema(f, minX, maxX);

    const blocks: ResultBlock[] = [
      {
        kind: 'stats',
        rows: [
          { label: `f(${nf(minX)})`, value: nf(f(minX)) },
          { label: `f(${nf(maxX)})`, value: nf(f(maxX)) },
        ],
      },
    ];

    if (roots.length > 0) {
      blocks.push({
        kind: 'stats',
        title: 'Crosses zero at',
        rows: roots.map((root) => ({ label: 'x =', value: nf(root), emphasize: true })),
      });
    } else {
      blocks.push({ kind: 'note', text: `No zero crossings found between ${nf(minX)} and ${nf(maxX)}.` });
    }

    if (extrema.length > 0) {
      blocks.push({
        kind: 'stats',
        title: 'Turns at',
        rows: extrema.map((point) => ({ label: `x = ${nf(point.x)}`, value: `y = ${nf(point.y)}` })),
      });
    }

    return {
      ok: true,
      headline:
        roots.length > 0
          ? `Zeros at ${roots.map((root) => nf(root)).join(', ')}`
          : `Plotted on [${nf(minX)}, ${nf(maxX)}]`,
      understood: `analyse f(x) = ${source} on [${nf(minX)}, ${nf(maxX)}]`,
      blocks,
      copyText: [
        `f(x) = ${source}`,
        `range: ${minX} … ${maxX}`,
        roots.length ? `roots: ${roots.join(', ')}` : 'roots: none found',
        extrema.length ? `turning points: ${extrema.map((point) => `(${point.x}, ${point.y})`).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  },
};

export const derivativeCapability: Capability = {
  id: 'derivative',
  title: 'Differentiate a function',
  promise: '“Differentiate x^3 + 2x”, “second derivative of sin(x)”, “slope of x^2 at 3”.',
  group: 'Graphs & calculus',
  keywords: ['derivative', 'differentiate', 'slope', 'rate of change', 'gradient', 'ddx', 'second derivative'],
  examples: [
    { text: 'differentiate x^3 + 2x', capabilityId: 'derivative', captures: [] },
    { text: 'second derivative of sin(x)', capabilityId: 'derivative', captures: [] },
    { text: 'slope of x^2 at 3', capabilityId: 'derivative', captures: [{ name: 'at', value: 3 }] },
  ],
  inputs: [
    { name: 'function', label: 'Function', hint: 'In terms of x', expression: true, example: 'x^3 + 2x' },
    { name: 'at', label: 'Evaluate at x', example: '3', optional: true },
  ],
  run(context): SolveOutcome {
    const raw = context.raw;
    const order = /\bsecond\b|\b2nd\b|order 2/i.test(raw) ? 2 : /\bthird\b|\b3rd\b/i.test(raw) ? 3 : 1;
    const source = context.getText('function') ?? extractFunction(raw);
    const atMatch = /\bat\s*(-?[\d.]+)/i.exec(raw);
    const at = context.get('at') ?? (atMatch ? Number(atMatch[1]) : undefined);

    try {
      const symbolic = differentiate(source, 'x');
      const symbolicOrdered = order === 1 ? symbolic : differentiate(symbolic, 'x');

      const rows = [
        { label: 'f(x)', value: source },
        { label: order === 1 ? "f'(x)" : `f''(x)`, value: symbolicOrdered, emphasize: true },
      ];

      if (at !== undefined) {
        const f = compileFunction(source);
        const numeric = derivative(f!, at, 1);
        rows.push({ label: `Slope at x = ${nf(at)}`, value: nf(numeric.value) });
      }

      return {
        ok: true,
        headline: symbolicOrdered,
        understood: `${order === 1 ? 'first' : 'second'} derivative of ${source}`,
        blocks: [
          { kind: 'stats', rows },
          { kind: 'note', text: 'Symbolic result, simplified for the signs it can prove. Check it against a numeric slope if you need certainty.' },
        ],
        copyText: `${source} → ${symbolicOrdered}`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That function could not be differentiated.' };
    }
  },
};

export const integralCapability: Capability = {
  id: 'integral',
  title: 'Integrate a function (area under the curve)',
  promise: '“Integrate x^2 from 0 to 3”, “area under sin(x) between 0 and pi”.',
  group: 'Graphs & calculus',
  keywords: ['integrate', 'integral', 'area under', 'antiderivative', 'definite integral', 'accumulate'],
  examples: [
    { text: 'integrate x^2 from 0 to 3', capabilityId: 'integral', captures: [{ name: 'from', value: 0 }, { name: 'to', value: 3 }] },
    { text: 'area under sin(x) between 0 and 3.14159', capabilityId: 'integral', captures: [{ name: 'from', value: 0 }, { name: 'to', value: 3.14159 }] },
  ],
  inputs: [
    { name: 'function', label: 'Function', expression: true, example: 'x^2' },
    { name: 'from', label: 'From x', example: '0' },
    { name: 'to', label: 'To x', example: '3' },
  ],
  run(context): SolveOutcome {
    const source = context.getText('function') ?? extractFunction(context.raw);
    const range = extractRange(context.raw);
    const from = context.get('from') ?? range?.from;
    const to = context.get('to') ?? range?.to;

    if (from === undefined || to === undefined) {
      return { ok: false, message: 'Tell me the limits, for example “integrate x^2 from 0 to 3”.' };
    }
    const f = compileFunction(source);
    if (!f) return { ok: false, message: `I could not read “${source}” as a function of x.` };

    try {
      const result = integrate(f, from, to);
      return {
        ok: true,
        headline: nf(result.value),
        understood: `∫ ${source} dx from ${nf(from)} to ${nf(to)}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: `∫ from ${nf(from)} to ${nf(to)}`, value: nf(result.value), emphasize: true },
              { label: 'Estimated error', value: `± ${result.error.toExponential(2)}` },
              { label: 'Method', value: result.method },
            ],
          },
          {
            kind: 'note',
            text: result.converged
              ? 'Adaptive Simpson integration converged. If the function has a spike inside the interval, split it into pieces.'
              : 'The estimate did not fully converge — the function probably has a discontinuity or spike in this range. Split the interval and integrate around it.',
          },
        ],
        copyText: `∫(${source}) from ${from} to ${to} = ${result.value} (±${result.error})`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That integral could not be evaluated.' };
    }
  },
};

export const limitCapability: Capability = {
  id: 'limit',
  title: 'Find a limit',
  promise: '“Limit of sin(x)/x as x goes to 0”, “limit of 1/x as x approaches 0”.',
  group: 'Graphs & calculus',
  keywords: ['limit', 'approaches', 'tends to', 'as x goes to', 'as x approaches'],
  examples: [
    { text: 'limit of sin(x)/x as x approaches 0', capabilityId: 'limit', captures: [{ name: 'point', value: 0 }] },
    { text: 'limit of 1/x as x goes to 0', capabilityId: 'limit', captures: [{ name: 'point', value: 0 }] },
  ],
  inputs: [
    { name: 'function', label: 'Function', expression: true, example: 'sin(x)/x' },
    { name: 'point', label: 'As x approaches', example: '0' },
  ],
  run(context): SolveOutcome {
    const source = context.getText('function') ?? extractFunction(context.raw).replace(/\s+as\s+.*$/i, '');
    const pointMatch = /(?:as\s*x\s*(?:goes to|approaches|tends to|→)|at)\s*(-?[\d.]+|0)/i.exec(context.raw);
    const point = context.get('point') ?? (pointMatch ? Number(pointMatch[1]) : undefined);
    if (point === undefined) {
      return { ok: false, message: 'Say where it approaches, for example “as x approaches 0”.' };
    }
    const f = compileFunction(source);
    if (!f) return { ok: false, message: `I could not read “${source}” as a function of x.` };

    try {
      const result = limit(f, point);
      return {
        ok: true,
        headline: nf(result.value),
        understood: `lim (x → ${nf(point)}) of ${source}`,
        blocks: [
          {
            kind: 'stats',
            rows: [
              { label: 'Limit', value: nf(result.value), emphasize: true },
              { label: 'Approach', value: result.twoSided ? 'two-sided (both sides agree)' : 'one-sided only' },
              { label: 'Estimated error', value: `± ${result.error.toExponential(2)}` },
            ],
          },
        ],
        copyText: `lim x→${point} of ${source} = ${result.value}`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That limit could not be evaluated.' };
    }
  },
};

export const seriesCapability: Capability = {
  id: 'series',
  title: 'Taylor / Maclaurin series',
  promise: '“Taylor series of sin(x) to order 5”, “Maclaurin series of e^x”.',
  group: 'Graphs & calculus',
  keywords: ['taylor', 'maclaurin', 'series', 'expansion', 'approximation', 'polynomial approximation'],
  examples: [
    { text: 'taylor series of sin(x) to order 5', capabilityId: 'series', captures: [{ name: 'order', value: 5 }] },
    { text: 'maclaurin series of e^x', capabilityId: 'series', captures: [] },
  ],
  inputs: [
    { name: 'function', label: 'Function', expression: true, example: 'sin(x)' },
    { name: 'order', label: 'Order', example: '5', optional: true },
    { name: 'centre', label: 'Centre', hint: 'Leave blank for 0 (Maclaurin)', example: '0', optional: true },
  ],
  run(context): SolveOutcome {
    const source = context.getText('function') ?? extractFunction(context.raw).replace(/\s+(?:to order|order)\s*\d+.*$/i, '');
    const orderMatch = /order\s*(\d+)|(\d+)\s*terms?/i.exec(context.raw);
    const order = context.get('order') ?? (orderMatch ? Number(orderMatch[1] ?? orderMatch[2]) : 5);
    const centreMatch = /(?:around|about|at)\s*(-?[\d.]+)/i.exec(context.raw);
    const centre = context.get('centre') ?? (centreMatch ? Number(centreMatch[1]) : 0);

    try {
      const result = taylorSeries(source, centre, Math.min(8, Math.max(1, Math.round(order))));
      const polynomial = taylorString(result.coefficients, centre);
      return {
        ok: true,
        headline: polynomial,
        understood: `${centre === 0 ? 'Maclaurin' : `Taylor around ${nf(centre)}`} series of ${source}, order ${result.coefficients.length - 1}`,
        blocks: [
          { kind: 'math', text: `f(x) ≈ ${polynomial}` },
          {
            kind: 'stats',
            rows: result.coefficients.map((coefficient, index) => ({
              label: `x^${index} coefficient`,
              value: nf(coefficient),
            })),
          },
        ],
        copyText: `${source} ≈ ${polynomial}`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That series could not be built.' };
    }
  },
};
