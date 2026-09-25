import { formatNumber } from '@/core/precision/format';
import {
  determinant,
  eigenvalues,
  formatMatrix,
  inverse,
  parseMatrix,
  rank,
  rref,
  transpose,
  type Matrix,
} from '@/math/matrices';
import { angleBetween, cross, dot, magnitude, normalize, projection, parseVector } from '@/math/vectors';
import type { Capability, SolveOutcome, ResultBlock } from '../types';

const nf = (value: number, precision = 6) => formatNumber(value, { precision });

function matrixBlocks(matrix: Matrix, title: string): ResultBlock {
  return {
    kind: 'table',
    title,
    table: {
      columns: Array.from({ length: matrix[0]?.length ?? 0 }, (_, index) => `col ${index + 1}`),
      rows: matrix.map((row) => row.map((value) => nf(value))),
    },
  };
}

function readMatrix(context: { getText(name: string): string | undefined; raw: string }, name: string): Matrix | null {
  const text = context.getText(name);
  if (text) {
    const parsed = parseMatrix(text);
    if (parsed) return parsed;
  }
  // Everything after a colon, or from the first digit — how people paste matrices.
  const colon = context.raw.indexOf(':');
  const tail = colon >= 0 ? context.raw.slice(colon + 1) : context.raw.replace(/^[^\d-]+/, '');
  return parseMatrix(tail.trim());
}

export const matrixCapability: Capability = {
  id: 'matrix',
  title: 'Matrix calculations',
  promise: '“Determinant of 1 2; 3 4”, “inverse of 4 7; 2 6”, “eigenvalues of …”.',
  group: 'Matrices & vectors',
  keywords: [
    'matrix', 'determinant', 'det', 'inverse', 'rank', 'rref', 'row reduce', 'eigenvalue',
    'eigenvalues', 'transpose', 'characteristic polynomial',
  ],
  examples: [
    { text: 'determinant of 1 2; 3 4', capabilityId: 'matrix', captures: [] },
    { text: 'inverse of 4 7; 2 6', capabilityId: 'matrix', captures: [] },
    { text: 'eigenvalues of 2 0; 0 3', capabilityId: 'matrix', captures: [] },
  ],
  inputs: [
    {
      name: 'matrix',
      label: 'Matrix',
      hint: 'Rows separated by “;” or new lines, entries by spaces or commas',
      kind: 'text',
      example: '1 2; 3 4',
    },
  ],
  run(context): SolveOutcome {
    const matrix = readMatrix(context, 'matrix');
    if (!matrix) {
      return {
        ok: false,
        message: 'Give me the matrix, for example “determinant of 1 2; 3 4”. Use “;” between rows.',
      };
    }
    const op = /determinant|\bdet\b/i.test(context.raw)
      ? 'determinant'
      : /inverse|invert/i.test(context.raw)
        ? 'inverse'
        : /eigen/i.test(context.raw)
          ? 'eigenvalues'
          : /rank/i.test(context.raw)
            ? 'rank'
            : /rref|row reduce|reduced row/i.test(context.raw)
              ? 'rref'
              : /transpose/i.test(context.raw)
                ? 'transpose'
                : 'all';

    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;

    try {
      if (op === 'determinant') {
        if (rows !== cols) return { ok: false, message: 'A determinant needs a square matrix.' };
        const value = determinant(matrix);
        return single(`${nf(value)}`, `determinant of the ${rows}×${rows} matrix`, 'Determinant', value, matrix, [
          { kind: 'note', text: value === 0 ? 'The determinant is zero, so this matrix has no inverse.' : 'The matrix is invertible.' },
        ]);
      }
      if (op === 'inverse') {
        if (rows !== cols) return { ok: false, message: 'An inverse needs a square matrix.' };
        const result = inverse(matrix);
        return {
          ok: true,
          headline: 'Inverse found',
          understood: `inverse of the ${rows}×${rows} matrix`,
          blocks: [matrixBlocks(result, 'Inverse')],
          copyText: formatMatrix(result, 6),
        };
      }
      if (op === 'eigenvalues') {
        if (rows !== cols) return { ok: false, message: 'Eigenvalues need a square matrix.' };
        const result = eigenvalues(matrix);
        return {
          ok: true,
          headline: result.values.map((value) => nf(value)).join(', '),
          understood: `eigenvalues of the ${rows}×${rows} matrix`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                ...result.values.map((value, index) => ({ label: `λ${index + 1}`, value: nf(value), emphasize: true })),
                { label: 'Trace (sum of λ)', value: nf(result.values.reduce((total, value) => total + value, 0)) },
              ],
            },
            { kind: 'note', text: 'Real eigenvalues only. Complex pairs are reported by the Matrices tool.' },
          ],
          copyText: result.values.join(', '),
        };
      }
      if (op === 'rank') {
        const value = rank(matrix);
        return single(`${value}`, `rank of the ${rows}×${cols} matrix`, 'Rank', value, null, [
          { kind: 'note', text: value === Math.min(rows, cols) ? 'Full rank.' : 'Rank deficient: the rows are dependent.' },
        ]);
      }
      if (op === 'rref') {
        const result = rref(matrix);
        return {
          ok: true,
          headline: 'Reduced row echelon form',
          understood: `rref of the ${rows}×${cols} matrix`,
          blocks: [matrixBlocks(result, 'RREF')],
          copyText: formatMatrix(result, 6),
        };
      }
      if (op === 'transpose') {
        const result = transpose(matrix);
        return {
          ok: true,
          headline: `${cols}×${rows}`,
          understood: `transpose of the ${rows}×${cols} matrix`,
          blocks: [matrixBlocks(result, 'Transpose')],
          copyText: formatMatrix(result, 6),
        };
      }
      return {
        ok: false,
        message: 'Which matrix calculation? Try “determinant of …”, “inverse of …”, “rank of …”, “rref of …” or “eigenvalues of …”.',
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That matrix calculation failed.' };
    }

    function single(
      headline: string,
      understood: string,
      label: string,
      value: number,
      echo: Matrix | null,
      extra: ResultBlock[],
    ): SolveOutcome {
      return {
        ok: true,
        headline,
        understood,
        blocks: [
          { kind: 'stats', rows: [{ label, value: nf(value), emphasize: true }] },
          ...(echo ? [matrixBlocks(echo, 'Input')] : []),
          ...extra,
        ],
        copyText: `${label} = ${value}`,
      };
    }
  },
};

const VECTOR_PATTERNS = [
  {
    template: 'dot product of {a} and {b}',
    slots: [
      { name: 'a', introducers: ['of'], type: 'text' as const },
      { name: 'b', introducers: ['and'], type: 'text' as const },
    ],
  },
  {
    template: 'cross product of {a} and {b}',
    slots: [
      { name: 'a', introducers: ['of'], type: 'text' as const },
      { name: 'b', introducers: ['and'], type: 'text' as const },
    ],
  },
  {
    template: 'angle between {a} and {b}',
    slots: [
      { name: 'a', introducers: ['between'], type: 'text' as const },
      { name: 'b', introducers: ['and'], type: 'text' as const },
    ],
  },
  {
    template: 'magnitude of {a}',
    slots: [{ name: 'a', introducers: ['of'], type: 'text' as const }],
  },
  {
    template: 'length of {a}',
    slots: [{ name: 'a', introducers: ['of'], type: 'text' as const }],
  },
];

export const vectorCapability: Capability = {
  id: 'vector',
  title: 'Vectors',
  promise: '“Dot product of 1 2 3 and 4 5 6”, “angle between 1 0 and 0 1”.',
  group: 'Matrices & vectors',
  keywords: ['vector', 'dot product', 'cross product', 'angle between', 'magnitude', 'norm', 'projection', 'unit vector'],
  examples: [
    { text: 'dot product of 1 2 3 and 4 5 6', capabilityId: 'vector', captures: [] },
    { text: 'cross product of 1 0 0 and 0 1 0', capabilityId: 'vector', captures: [] },
    { text: 'angle between 1 0 and 0 1', capabilityId: 'vector', captures: [] },
  ],
  inputs: [
    { name: 'a', label: 'Vector A', hint: 'Numbers separated by spaces or commas', kind: 'text', example: '1 2 3' },
    { name: 'b', label: 'Vector B', hint: 'Needed for products and angles', kind: 'text', example: '4 5 6', optional: true },
  ],
  patterns: VECTOR_PATTERNS,
  run(context): SolveOutcome {
    const aText = context.getText('a');
    const bText = context.getText('b');
    const pair = /(?:of|between)\s+([\d.,\s-]+?)\s+and\s+([\d.,\s-]+)/i.exec(context.raw);
    const single = /(?:of|for)\s+([\d.,\s-]+)$/i.exec(context.raw);

    const a = parseVector(aText ?? pair?.[1] ?? single?.[1] ?? '');
    const b = parseVector(bText ?? pair?.[2] ?? '');

    if (!a) return { ok: false, message: 'Give me a vector, for example “dot product of 1 2 3 and 4 5 6”.' };

    const wantsDot = /dot|scalar product/i.test(context.raw);
    const wantsCross = /cross|vector product/i.test(context.raw);
    const wantsAngle = /angle/i.test(context.raw);
    const wantsProjection = /project/i.test(context.raw);
    const wantsUnit = /unit vector|normalise|normalize/i.test(context.raw);
    const wantsMagnitude = /magnitude|\blength\b|\bnorm\b|\|v\|/i.test(context.raw);

    try {
      if (wantsMagnitude && !wantsDot && !wantsCross && !wantsAngle && !wantsProjection) {
        const value = magnitude(a);
        return {
          ok: true,
          headline: nf(value),
          understood: `magnitude of (${a.join(', ')})`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Magnitude (length)', value: nf(value), emphasize: true },
                { label: 'Components', value: a.map((item) => nf(item, 6)).join(', ') },
              ],
            },
          ],
          copyText: `|(${a.join(', ')})| = ${value}`,
        };
      }

      if (wantsUnit) {
        const unit = normalize(a);
        return {
          ok: true,
          headline: `(${unit.map((value) => nf(value, 6)).join(', ')})`,
          understood: `unit vector in the direction of (${a.join(', ')})`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Unit vector', value: `(${unit.map((value) => nf(value, 6)).join(', ')})`, emphasize: true },
                { label: 'Magnitude of the original', value: nf(magnitude(a)) },
              ],
            },
          ],
          copyText: `unit(${a.join(', ')}) = (${unit.join(', ')})`,
        };
      }

      if (!b) return { ok: false, message: 'That needs two vectors, for example “dot product of 1 2 3 and 4 5 6”.' };

      if (wantsDot) {
        const value = dot(a, b);
        return {
          ok: true,
          headline: nf(value),
          understood: `dot product of (${a.join(', ')}) and (${b.join(', ')})`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Dot product', value: nf(value), emphasize: true },
                { label: '|a|, |b|', value: `${nf(magnitude(a))}, ${nf(magnitude(b))}` },
                { label: 'Perpendicular?', value: Math.abs(value) < 1e-12 ? 'yes' : 'no' },
              ],
            },
          ],
          copyText: `a · b = ${value}`,
        };
      }
      if (wantsCross) {
        const value = cross(a, b);
        return {
          ok: true,
          headline: `(${value.map((item) => nf(item, 6)).join(', ')})`,
          understood: `cross product of (${a.join(', ')}) and (${b.join(', ')})`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Cross product', value: `(${value.map((item) => nf(item, 6)).join(', ')})`, emphasize: true },
                { label: 'Magnitude (area of the parallelogram)', value: nf(magnitude(value)) },
              ],
            },
          ],
          copyText: `a × b = (${value.join(', ')})`,
        };
      }
      if (wantsAngle) {
        const radians = angleBetween(a, b) as number;
        const degrees = (radians * 180) / Math.PI;
        return {
          ok: true,
          headline: `${nf(degrees, 6)}°`,
          understood: `angle between (${a.join(', ')}) and (${b.join(', ')})`,
          blocks: [
            {
              kind: 'stats',
              rows: [
                { label: 'Degrees', value: `${nf(degrees, 6)}°`, emphasize: true },
                { label: 'Radians', value: nf(radians, 8) },
              ],
            },
          ],
          copyText: `angle = ${degrees}°`,
        };
      }
      if (wantsProjection) {
        const value = projection(a, b);
        return {
          ok: true,
          headline: `(${value.map((item) => nf(item, 6)).join(', ')})`,
          understood: `projection of (${a.join(', ')}) onto (${b.join(', ')})`,
          blocks: [
            { kind: 'stats', rows: [{ label: 'Projection', value: `(${value.map((item) => nf(item, 6)).join(', ')})`, emphasize: true }] },
          ],
          copyText: `proj = (${value.join(', ')})`,
        };
      }
      return { ok: false, message: 'Say which operation: dot product, cross product, angle, projection or unit vector.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'That vector calculation failed.' };
    }
  },
};
