import { useMemo, useState } from 'react';
import {
  compileFunction,
  derivative,
  differentiate,
  differentiateOrder,
  explainFunctionSource,
  integrate,
  limit,
  partialDerivative,
  taylorSeries,
} from '@/math/calculus';
import { symbolicLimit } from '@/math/cas/limits';
import { errorCode, errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { appendToDraft } from '@/ui/bus';
import { CopyButton, Notice, NumberField, OutputList, SelectField, Tabs, TextField } from '@/ui/components/primitives';

export function CalculusPanel() {
  const [tab, setTab] = useState<'derivative' | 'integral' | 'limit' | 'series'>('derivative');
  return (
    <div className="stack">
      <Tabs
        tabs={[
          { id: 'derivative', label: 'Derivatives' },
          { id: 'integral', label: 'Integrals' },
          { id: 'limit', label: 'Limits' },
          { id: 'series', label: 'Series' },
        ]}
        value={tab}
        onChange={(id) => setTab(id as typeof tab)}
        label="Calculus tool"
      />
      {tab === 'derivative' ? <DerivativeTool /> : null}
      {tab === 'integral' ? <IntegralTool /> : null}
      {tab === 'limit' ? <LimitTool /> : null}
      {tab === 'series' ? <SeriesTool /> : null}
    </div>
  );
}

function DerivativeTool() {
  const settings = useSettings();
  const [source, setSource] = useState('x^3 - 3x^2 + 2x');
  const [point, setPoint] = useState<number | ''>(1);
  const [order, setOrder] = useState('1');
  const [variable, setVariable] = useState('x');
  const [others, setOthers] = useState('y = 2');

  const symbolic = useMemo(() => {
    try {
      const orderValue = Number(order);
      const expression = orderValue > 1 ? differentiateOrder(source, orderValue, variable) : differentiate(source, variable);
      return { ok: true as const, expression, orderValue };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [source, order, variable]);

  const numericResult = useMemo(() => {
    const x = Number(point);
    if (point === '' || !Number.isFinite(x)) return null;
    const extras = parseAssignments(others);
    if (Object.keys(extras).length > 0) {
      try {
        return { ok: true as const, value: partialDerivative(source, variable, { ...extras, [variable]: x }, Number(order) === 2 ? 2 : 1) };
      } catch (err) {
        return { ok: false as const, message: errorMessage(err) };
      }
    }
    const fn = compileFunction(source, variable);
    if (!fn) return { ok: false as const, message: explainFunctionSource(source) ?? 'The expression could not be parsed.' };
    try {
      return { ok: true as const, value: derivative(fn, x, Number(order) === 2 ? 2 : 1) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [source, point, order, variable, others]);

  const precision = settings.precision;

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField
            label="Function"
            value={source}
            onChange={setSource}
            placeholder="x^3 - 3x^2 + 2x"
            hint="Any expression in the chosen variable; sin, exp, ln and friends are supported."
          />
          <TextField label="Variable" value={variable} onChange={setVariable} placeholder="x" />
          <SelectField
            label="Order"
            value={order}
            onChange={setOrder}
            options={[
              { value: '1', label: 'First derivative f′' },
              { value: '2', label: 'Second derivative f″' },
              { value: '3', label: 'Third derivative' },
              { value: '4', label: 'Fourth derivative' },
            ]}
          />
          <NumberField label="Evaluate at" value={point} onChange={setPoint} step={0.1} />
          <TextField
            label="Other variables (for partial derivatives)"
            value={others}
            onChange={setOthers}
            placeholder="y = 2"
            hint="e.g. y = 3, z = 0.5 — used when the function has several variables."
          />
        </div>
      </section>

      <section className="card" aria-live="polite">
        <h2>Result</h2>
        <OutputList
          rows={[
            ...(symbolic.ok
              ? [{ label: 'Symbolic derivative', value: symbolic.expression, emphasize: true }]
              : []),
            ...(numericResult && numericResult.ok
              ? [
                  {
                    label: 'Numeric value at the point',
                    value: formatNumber(numericResult.value.value, { precision }),
                    emphasize: !symbolic.ok,
                  },
                  { label: 'Estimated error', value: numericResult.value.error.toExponential(2) },
                  { label: 'Method', value: numericResult.value.method },
                ]
              : []),
          ]}
        />
        {!symbolic.ok ? (
          <Notice kind="warn">
            Symbolic differentiation is unavailable here — {symbolic.message} The numeric derivative above is
            still valid.
          </Notice>
        ) : null}
        {numericResult && !numericResult.ok ? <Notice kind="error">{numericResult.message}</Notice> : null}
        {symbolic.ok ? (
          <div className="row">
            <CopyButton text={symbolic.expression} label="Copy derivative" />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => appendToDraft(symbolic.expression.replace(/·/g, '*'))}
            >
              Use in calculator
            </button>
          </div>
        ) : null}
      </section>
    </>
  );
}

function IntegralTool() {
  const settings = useSettings();
  const [source, setSource] = useState('sin(x)');
  const [a, setA] = useState<number | ''>(0);
  const [b, setB] = useState<number | ''>(Math.PI);
  const [method, setMethod] = useState('adaptive');

  const result = useMemo(() => {
    if (a === '' || b === '') return { ok: false as const, message: 'Enter both limits.' };
    const fn = compileFunction(source);
    if (!fn) return { ok: false as const, message: explainFunctionSource(source) ?? 'The expression could not be parsed.' };
    try {
      const outcome = integrate(fn, Number(a), Number(b), { tolerance: method === 'accurate' ? 1e-12 : 1e-8 });
      return { ok: true as const, outcome };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [source, a, b, method]);

  const precision = settings.precision;

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField label="Integrand f(x)" value={source} onChange={setSource} placeholder="sin(x)" />
          <NumberField label="Lower limit a" value={a} onChange={setA} step={0.1} />
          <NumberField label="Upper limit b" value={b} onChange={setB} step={0.1} hint="π is accepted: type pi" />
          <SelectField
            label="Accuracy target"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'adaptive', label: 'Standard (1e-8)' },
              { value: 'accurate', label: 'High (1e-12)' },
            ]}
          />
        </div>
      </section>
      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {!result.ok ? (
          <Notice kind="error">{result.message}</Notice>
        ) : (
          <>
            <OutputList
              rows={[
                {
                  label: `∫ from ${a} to ${b} of ${source}`,
                  value: formatNumber(result.outcome.value, { precision }),
                  emphasize: true,
                },
                { label: 'Estimated error', value: result.outcome.error.toExponential(3) },
                {
                  label: 'Converged',
                  value: result.outcome.converged
                    ? 'Yes'
                    : 'No — the integrand is not smooth enough; treat this as an approximation',
                },
                { label: 'Method', value: result.outcome.method },
                { label: 'Subdivisions', value: String(result.outcome.subdivisions) },
              ]}
            />
            <div className="row">
              <CopyButton text={formatNumber(result.outcome.value, { precision })} label="Copy result" />
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => appendToDraft(formatNumber(result.outcome.value, { precision }).replace(/,/g, ''))}
              >
                Use in calculator
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

type LimitOutcome =
  | { ok: true; value: number; approach: string; twoSided: boolean; how: string; diverges: boolean }
  | { ok: false; message: string; suggestion?: string };

/** Reads a limit point, accepting the ways people write infinity. */
function parseLimitPoint(input: string): number | null {
  const text = input.trim().toLowerCase().replace('∞', 'inf').replace(/−/g, '-');
  if (text === '') return null;
  if (text === 'inf' || text === '+inf' || text === 'infinity' || text === '+infinity') return Number.POSITIVE_INFINITY;
  if (text === '-inf' || text === '-infinity') return Number.NEGATIVE_INFINITY;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const isInfinite = (value: number) => !Number.isFinite(value);

function LimitTool() {
  const settings = useSettings();
  const [source, setSource] = useState('sin(x)/x');
  const [point, setPoint] = useState('0');
  const [side, setSide] = useState<'both' | 'left' | 'right'>('both');

  const result = useMemo<LimitOutcome>(() => {
    const target = parseLimitPoint(point);
    if (target === null) {
      return { ok: false, message: 'Enter the point to approach, or the word infinity.' };
    }
    const fn = compileFunction(source);
    if (!fn) return { ok: false, message: explainFunctionSource(source) ?? 'The expression could not be parsed.' };

    /*
     * x → ±∞ cannot use the estimator directly — there is no h to shrink — so it
     * substitutes u = 1/x and takes u → 0±, which the same Richardson estimator
     * handles. That path existed in the maths layer but nothing in the UI could
     * reach it, so "lim x → ∞" was impossible to ask for.
     *
     * The symbolic growth comparison is preferred when it is exact (it is the
     * better answer for rational functions); otherwise the substitution estimate
     * is used, because its tail is far more accurate — for (1+1/x)^x it lands
     * within 4e-9 of e where the growth comparison was off by 1.4e-6, and for
     * ln(x)/x it returns 0 where the growth comparison returned 1.4e-5.
     */
    if (isInfinite(target)) {
      const approach = target > 0 ? 'x → +∞' : 'x → −∞';
      const symbolic = symbolicLimit(source, target, 'x', side);
      if (symbolic?.exact) {
        return {
          ok: true,
          value: symbolic.value,
          approach,
          twoSided: false,
          how: `${symbolic.method} (exact)`,
          diverges: !symbolic.exists,
        };
      }

      const substituted = (u: number) => fn(1 / u);
      try {
        const outcome = limit(substituted, 0, { side: target > 0 ? 'right' : 'left' });
        return {
          ok: true,
          value: outcome.value,
          approach,
          twoSided: false,
          how: 'numeric estimate (x = 1/u, Richardson extrapolation)',
          diverges: false,
        };
      } catch (err) {
        const code = errorCode(err);
        // A divergence is an answer, not a failure: report what it diverges to.
        if (code === 'DOMAIN' && /diverges/i.test(errorMessage(err))) {
          return { ok: false, message: errorMessage(err), suggestion: 'The limit is infinite rather than a finite value.' };
        }
        /*
         * The estimator refused because the tail never settles (an oscillating
         * function, for example). Reporting the unaudited growth-comparison
         * number here would be exactly the "silently wrong answer" this app
         * promises not to give — sin(x)/x came out as -3.5e-7 that way.
         */
        return {
          ok: false,
          message: `The limit as ${approach} could not be determined.`,
          suggestion:
            'The tail does not settle, so any single number would be a guess. Oscillating functions such as sin(x)/x need the symbolic tools, or a range instead of a single point.',
        };
      }
    }

    try {
      const outcome = limit(fn, target, { side });
      return {
        ok: true,
        value: outcome.value,
        approach: `x → ${point.trim()}${outcome.twoSided ? '' : ` (from the ${outcome.approach})`}`,
        twoSided: outcome.twoSided,
        how: 'numeric estimate',
        diverges: false,
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [source, point, side]);

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField label="Function" value={source} onChange={setSource} placeholder="sin(x)/x" />
          <TextField
            label="Approach x →"
            value={point}
            onChange={setPoint}
            placeholder="0, or infinity"
            hint="A number, or the word infinity for x → ±∞."
          />
          <SelectField
            label="Direction"
            value={side}
            onChange={(value) => setSide(value as typeof side)}
            options={[
              { value: 'both', label: 'Two-sided' },
              { value: 'left', label: 'From the left' },
              { value: 'right', label: 'From the right' },
            ]}
          />
        </div>
      </section>
      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {!result.ok ? (
          <>
            <Notice kind="error">{result.message}</Notice>
            {result.suggestion ? <p className="muted">{result.suggestion}</p> : null}
          </>
        ) : (
          <OutputList
            rows={[
              {
                label: `lim f(x) as ${result.approach}`,
                value: formatNumber(result.value, { precision: settings.precision }),
                emphasize: true,
              },
              { label: 'Method', value: result.how },
              ...(result.twoSided ? [{ label: 'Both sides agree', value: 'Yes' }] : []),
              ...(result.diverges ? [{ label: 'Note', value: 'The limit diverges (±∞)' }] : []),
            ]}
          />
        )}
      </section>
    </>
  );
}

function SeriesTool() {
  const settings = useSettings();
  const [source, setSource] = useState('sin(x)');
  const [centre, setCentre] = useState<number | ''>(0);
  const [order, setOrder] = useState('5');

  const outcome = useMemo(() => {
    try {
      return { ok: true as const, series: taylorSeries(source, Number(centre === '' ? 0 : centre), Number(order)) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [source, centre, order]);

  return (
    <>
      <section className="card">
        <div className="grid grid--form">
          <TextField label="Function" value={source} onChange={setSource} placeholder="sin(x)" />
          <NumberField label="Centre a" value={centre} onChange={setCentre} step={0.5} hint="Use 0 for a Maclaurin series." />
          <SelectField
            label="Order"
            value={order}
            onChange={setOrder}
            options={['1', '2', '3', '4', '5', '6', '7', '8'].map((value) => ({ value, label: `Order ${value}` }))}
          />
        </div>
      </section>
      <section className="card" aria-live="polite">
        <h2>Expansion</h2>
        {!outcome.ok ? (
          <Notice kind="error">{outcome.message}</Notice>
        ) : (
          <>
            <OutputList
              rows={[
                { label: 'Taylor polynomial', value: outcome.series.polynomial, emphasize: true },
                ...outcome.series.coefficients.map((coefficient, index) => ({
                  label: `c${index}`,
                  value: formatNumber(coefficient, { precision: settings.precision }),
                })),
              ]}
            />
            <Notice>{outcome.series.radiusNote}</Notice>
            <CopyButton text={outcome.series.polynomial.replace(/·/g, '*')} label="Copy polynomial" />
          </>
        )}
      </section>
    </>
  );
}

function parseAssignments(input: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const part of input.split(/[,;]+/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d*\.?\d+(?:e[+-]?\d+)?)\s*$/i.exec(part);
    if (match) result[match[1]!.toLowerCase()] = Number(match[2]);
  }
  return result;
}
