import { useMemo, useState } from 'react';
import {
  detectPolynomialDegree,
  parseEquation,
  solveLinear,
  solveLinearSystem,
  solvePolynomial,
} from '@/math/algebra';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, Notice, OutputList, SelectField, Tabs, TextField } from '@/ui/components/primitives';

const KINDS = [
  { id: 'auto', label: 'Automatic (linear, then polynomial)' },
  { id: 'linear', label: 'Linear equation' },
  { id: 'quadratic', label: 'Quadratic equation' },
  { id: 'cubic', label: 'Cubic equation' },
  { id: 'polynomial', label: 'Polynomial (degree 4–6)' },
] as const;

export function EquationPanel() {
  const [tab, setTab] = useState<'single' | 'system'>('single');
  return (
    <div className="stack">
      <Tabs
        tabs={[
          { id: 'single', label: 'Single equation' },
          { id: 'system', label: 'Linear system' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as 'single' | 'system')}
        label="Equation solver mode"
      />
      {tab === 'single' ? <SingleEquation /> : <SystemSolver />}
    </div>
  );
}

function SingleEquation() {
  const settings = useSettings();
  const [input, setInput] = useState('x^2 + 5x + 6 = 0');
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('auto');

  const outcome = useMemo(() => {
    try {
      const equation = parseEquation(input);
      const variables = equation.variables;
      if (variables.length === 0) {
        return { ok: false as const, message: 'No unknown found. Use a letter such as x.' };
      }
      if (variables.length > 1) {
        return {
          ok: false as const,
          message: `More than one unknown (${variables.join(', ')}). Use the linear system solver.`,
        };
      }
      const variable = variables[0]!;

      if (kind === 'linear') {
        const solution = solveLinear(equation, variable);
        return {
          ok: true as const,
          variable,
          steps: solution.steps,
          rows: [
            { label: `${variable}`, value: formatNumber(solution.value, { precision: settings.precision }), emphasize: true },
            { label: 'Exact?', value: solution.exact ? 'Yes (terminating decimal)' : 'Approximate' },
          ],
        };
      }

      const degree = kind === 'auto' ? (detectPolynomialDegree(equation, variable) ?? 2) : degreeForKind(kind);
      const solution = solvePolynomial(equation, variable, degree);
      return {
        ok: true as const,
        variable,
        steps: solution.steps,
        rows: [
          ...solution.roots.map((root, index) => ({
            label: `${variable}${solution.roots.length > 1 ? ` (root ${index + 1})` : ''}`,
            value: formatNumber(root, { precision: settings.precision }),
            emphasize: index === 0,
          })),
          ...(solution.roots.length === 0
            ? [{ label: 'Real roots', value: 'None', emphasize: true }]
            : []),
          { label: 'Polynomial degree', value: String(degree) },
          {
            label: 'Non-real roots',
            value:
              solution.complexPairs === 0
                ? 'None'
                : `${solution.complexPairs} root(s) are not real`,
          },
        ],
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [input, kind, settings.precision]);

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField
            label="Equation"
            value={input}
            onChange={setInput}
            placeholder="2x + 5 = 15"
            hint="Examples: 2x + 5 = 15 · x^2 + 5x + 6 = 0 · x^3 - 6x^2 + 11x - 6 = 0"
          />
          <SelectField
            label="Equation type"
            value={kind}
            onChange={(value) => setKind(value as typeof kind)}
            options={KINDS.map((entry) => ({ value: entry.id, label: entry.label }))}
          />
        </div>
        <Notice>
          Roots are only reported when the solver can verify them: non-polynomial equations are refused
          rather than approximated silently, and complex roots are disclosed instead of hidden.
        </Notice>
      </section>

      <section className="card" aria-live="polite">
        <h2>Solution</h2>
        {outcome.ok ? (
          <>
            <OutputList rows={outcome.rows} />
            <details className="details">
              <summary>Show solution steps</summary>
              <ol className="steps">
                {outcome.steps.map((step, index) => (
                  <li key={index}>
                    <span className="steps__text">{step}</span>
                  </li>
                ))}
              </ol>
            </details>
            <div className="row">
              <CopyButton
                text={outcome.rows.map((row) => `${row.label} = ${row.value}`).join('\n')}
                label="Copy solution"
              />
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => appendToDraft(outcome.variable)}
                title="Insert the unknown into the calculator"
              >
                Use {outcome.variable} in calculator
              </button>
            </div>
          </>
        ) : (
          <Notice kind="error">{outcome.message}</Notice>
        )}
      </section>
    </>
  );
}

function degreeForKind(kind: string): number {
  switch (kind) {
    case 'linear':
      return 1;
    case 'cubic':
      return 3;
    case 'polynomial':
      return 4;
    default:
      return 2;
  }
}

function SystemSolver() {
  const settings = useSettings();
  const [equations, setEquations] = useState('2x + y = 10\nx - y = 2');
  const [variableText, setVariableText] = useState('x, y');

  const outcome = useMemo(() => {
    try {
      const lines = equations
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const variables = variableText
        .split(/[\s,;]+/)
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => name.toLowerCase());
      if (variables.length === 0) return { ok: false as const, message: 'List the unknowns, e.g. x, y' };
      if (lines.length !== variables.length) {
        return {
          ok: false as const,
          message: `Provide ${variables.length} equation(s) for ${variables.length} unknown(s).`,
        };
      }
      const solution = solveLinearSystem(lines, variables);
      if (solution.status !== 'unique') {
        return { ok: true as const, status: solution.status, rows: [], steps: solution.steps, variables };
      }
      return {
        ok: true as const,
        status: 'unique' as const,
        variables,
        steps: solution.steps,
        rows: [
          ...solution.values.map((value, index) => ({
            label: variables[index]!,
            value: formatNumber(value, { precision: settings.precision }),
            emphasize: index === 0,
          })),
          { label: 'Determinant', value: formatNumber(solution.determinant, { precision: settings.precision }) },
        ],
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [equations, variableText, settings.precision]);

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField
            label="Equations (one per line)"
            value={equations}
            onChange={setEquations}
            multiline
            rows={4}
            placeholder={'2x + y = 10\nx - y = 2'}
          />
          <TextField
            label="Unknowns"
            value={variableText}
            onChange={setVariableText}
            placeholder="x, y"
            hint="Comma separated; one equation per unknown."
          />
        </div>
      </section>
      <section className="card" aria-live="polite">
        <h2>Solution</h2>
        {!outcome.ok ? (
          <Notice kind="error">{outcome.message}</Notice>
        ) : outcome.status !== 'unique' ? (
          <>
            <Notice kind={outcome.status === 'none' ? 'error' : 'warn'}>
              {outcome.status === 'none'
                ? 'No solution exists: the equations contradict each other.'
                : 'Infinitely many solutions: the equations are dependent.'}
            </Notice>
            <OutputList rows={outcome.steps.map((step, index) => ({ label: `Check ${index + 1}`, value: step }))} />
          </>
        ) : (
          <>
            <OutputList rows={outcome.rows} />
            <details className="details">
              <summary>Show solution steps</summary>
              <ol className="steps">
                {outcome.steps.map((step, index) => (
                  <li key={index}>
                    <span className="steps__text">{step}</span>
                  </li>
                ))}
              </ol>
            </details>
            <CopyButton
              text={outcome.rows.map((row) => `${row.label} = ${row.value}`).join('\n')}
              label="Copy solution"
            />
          </>
        )}
      </section>
    </>
  );
}

