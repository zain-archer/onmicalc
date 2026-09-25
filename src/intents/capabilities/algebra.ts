import { formatNumber } from '@/core/precision/format';
import {
  detectPolynomialDegree,
  findVariables,
  parseEquation,
  solveLinear,
  solveLinearSystem,
  solvePolynomial,
} from '@/math/algebra';
import type { Capability, SolveOutcome, ResultBlock } from '../types';

const nf = (value: number) => formatNumber(value, { precision: 10 });

function rootBlocks(variable: string, roots: number[], steps: string[]): ResultBlock[] {
  return [
    {
      kind: 'stats',
      rows: roots.length
        ? roots.map((root) => ({ label: `${variable} =`, value: nf(root), emphasize: roots.length === 1 }))
        : [{ label: 'Solutions', value: 'none in the real numbers' }],
    },
    ...(steps.length ? [{ kind: 'list' as const, title: 'How it was solved', items: steps }] : []),
  ];
}

export const solveEquationCapability: Capability = {
  id: 'solveEquation',
  title: 'Solve an equation',
  promise: '“Solve 3x + 5 = 20”, “x^2 - 5x + 6 = 0”, “solve for x”.',
  group: 'Algebra & equations',
  keywords: ['solve', 'equation', 'equals', 'root', 'roots', 'find x', 'value of x', 'zero'],
  examples: [
    { text: 'solve 3x + 5 = 20', capabilityId: 'solveEquation', captures: [] },
    { text: 'x^2 - 5x + 6 = 0', capabilityId: 'solveEquation', captures: [] },
    { text: 'solve for x: 2x + 5 = 15', capabilityId: 'solveEquation', captures: [] },
  ],
  inputs: [
    { name: 'equation', label: 'Equation', hint: 'Use = between the two sides', expression: true, example: '3x + 5 = 20' },
    { name: 'variable', label: 'Unknown', hint: 'Leave blank to detect it', kind: 'text', example: 'x', optional: true },
  ],
  run(context): SolveOutcome {
    const source = (context.getText('equation') ?? context.raw)
      .replace(/^\s*(?:solve|find|work out)\s+(?:for\s+[a-z]\s*:?\s*)?/i, '')
      .replace(/^\s*solve\s*:?\s*/i, '')
      .trim();

    if (!source.includes('=')) {
      return {
        ok: false,
        message: 'Write the equation with an equals sign, for example “3x + 5 = 20”.',
      };
    }

    let equation;
    try {
      equation = parseEquation(source);
    } catch {
      return { ok: false, message: `I could not read “${source}” as an equation.` };
    }

    const declared = (context.getText('variable') ?? '').trim();
    const variables = declared ? [declared] : findVariables(source);
    if (variables.length === 0) {
      return {
        ok: false,
        message: 'I could not find an unknown in that equation. Include a letter, for example “x”.',
      };
    }
    if (variables.length > 1) {
      return {
        ok: false,
        message: `That equation has ${variables.length} unknowns (${variables.join(', ')}). Use the system solver, or name one unknown explicitly.`,
      };
    }

    const variable = variables[0]!;
    try {
      const degree = detectPolynomialDegree(equation, variable, 6);
      if (degree === null) {
        return {
          ok: false,
          message: `“${source}” is not a polynomial in ${variable}, so OmniCalc will not guess an answer. Try the Graphing tool to find where both sides meet.`,
        };
      }
      if (degree === 1) {
        const linear = solveLinear(equation, variable);
        return {
          ok: true,
          headline: `${variable} = ${nf(linear.value)}`,
          understood: `solve ${source} for ${variable}`,
          blocks: rootBlocks(variable, [linear.value], linear.steps),
          copyText: `${source} → ${variable} = ${linear.value}`,
        };
      }
      const polynomial = solvePolynomial(equation, variable, degree);
      return {
        ok: true,
        headline:
          polynomial.roots.length === 0
            ? 'No real solutions'
            : polynomial.roots.map((root) => `${variable} = ${nf(root)}`).join(',  '),
        understood: `solve the degree-${degree} equation ${source} for ${variable}`,
        blocks: [
          ...rootBlocks(variable, polynomial.roots, polynomial.steps),
          ...(polynomial.complexPairs > 0
            ? [
                {
                  kind: 'note' as const,
                  text: `${polynomial.complexPairs} pair(s) of complex roots also exist. Open the Equation Solver to see the full factorisation.`,
                },
              ]
            : []),
        ],
        copyText: `${source} → ${polynomial.roots.map((root) => `${variable} = ${root}`).join(', ')}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'That equation could not be solved.',
      };
    }
  },
};

/**
 * Deliberately no catch-all template here: a pattern that matches any sentence
 * would win the scoring for every request. Multi-equation routing is handled in
 * `solve.ts` (two or more "=" means a system).
 */
const SYSTEM_PATTERNS = [
  {
    template: 'solve the system {equations}',
    slots: [{ name: 'equations', introducers: ['system'], type: 'text' as const }],
  },
  {
    template: 'solve the simultaneous equations {equations}',
    slots: [{ name: 'equations', introducers: ['equations'], type: 'text' as const }],
  },
  {
    template: 'solve for x and y: {equations}',
    slots: [{ name: 'equations', introducers: [''], type: 'text' as const }],
  },
];

export const solveSystemCapability: Capability = {
  id: 'solveSystem',
  title: 'Solve simultaneous equations',
  promise: '“2x + y = 10, x - y = 2”.',
  group: 'Algebra & equations',
  keywords: [
    'system', 'simultaneous', 'linear system', 'equations', 'two unknowns', 'solve for x and y',
    'at the same time',
  ],
  examples: [
    { text: 'solve 2x + y = 10, x - y = 2', capabilityId: 'solveSystem', captures: [] },
    { text: 'x + y = 5 and x - y = 1', capabilityId: 'solveSystem', captures: [] },
  ],
  inputs: [
    {
      name: 'equations',
      label: 'Equations',
      hint: 'One per line, or separated by semicolons/“and”',
      expression: true,
      example: '2x + y = 10\nx - y = 2',
    },
  ],
  patterns: SYSTEM_PATTERNS,
  run(context): SolveOutcome {
    const raw = (context.getText('equations') ?? context.raw).replace(
      /^\s*(?:solve|compute|find|work out)\s+(?:the\s+)?(?:system|simultaneous equations|equations)?\s*(?:for\s+[a-z](?:\s*(?:,|and)\s*[a-z])*\s*)?:?\s*/i,
      '',
    );
    const lines = raw
      .split(/\n|;|\band\b|,(?=\s*[^,]*=)/i)
      .map((line) => line.trim())
      .filter((line) => line.includes('='));

    if (lines.length < 2) {
      return {
        ok: false,
        message: 'Give me two or more equations, for example “2x + y = 10, x - y = 2”.',
      };
    }

    const variables = [...new Set(lines.flatMap((line) => findVariables(line)))].sort();
    if (variables.length !== lines.length) {
      return {
        ok: false,
        message: `${lines.length} equation(s) for ${variables.length} unknown(s) (${variables.join(', ') || 'none'}). Provide one equation per unknown.`,
      };
    }

    try {
      const solution = solveLinearSystem(lines, variables);
      if (solution.status !== 'unique') {
        return {
          ok: false,
          message:
            solution.status === 'none'
              ? 'Those equations have no common solution (they are inconsistent).'
              : 'Those equations are dependent: infinitely many solutions satisfy all of them.',
        };
      }
      return {
        ok: true,
        headline: variables.map((name, index) => `${name} = ${nf(solution.values[index] ?? Number.NaN)}`).join(',  '),
        understood: `solve the ${variables.length}×${variables.length} system`,
        blocks: [
          {
            kind: 'stats',
            rows: variables.map((name, index) => ({
              label: name,
              value: nf(solution.values[index] ?? Number.NaN),
            })),
          },
          { kind: 'note', text: `Determinant of the coefficient matrix: ${nf(solution.determinant)}` },
          ...(solution.steps.length ? [{ kind: 'list' as const, title: 'Gaussian elimination', items: solution.steps }] : []),
        ],
        copyText: variables.map((name, index) => `${name} = ${solution.values[index]}`).join(', '),
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'That system could not be solved.',
      };
    }
  },
};
