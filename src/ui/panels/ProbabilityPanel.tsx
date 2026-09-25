import { useMemo, useState } from 'react';
import * as p from '@/math/probability';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { Notice, NumberField, OutputList, Tabs } from '@/ui/components/primitives';

const DISTRIBUTIONS = [
  { id: 'normal', label: 'Normal' },
  { id: 'binomial', label: 'Binomial' },
  { id: 'poisson', label: 'Poisson' },
  { id: 'uniform', label: 'Uniform' },
  { id: 'exponential', label: 'Exponential' },
  { id: 'studentt', label: 'Student t' },
] as const;

type DistributionId = (typeof DISTRIBUTIONS)[number]['id'];

export function ProbabilityPanel() {
  const settings = useSettings();
  const [id, setId] = useState<DistributionId>('normal');
  const [x, setX] = useState<number | ''>(0);
  const [a, setA] = useState<number | ''>(0);
  const [b, setB] = useState<number | ''>(1);

  const precision = settings.precision;

  const outcome = useMemo(() => {
    if (x === '' || a === '' || b === '') {
      return { ok: false as const, message: 'Fill in every parameter.' };
    }
    try {
      const rows: { label: string; value: string; emphasize?: boolean }[] = [];
      const nf = (value: number) => formatNumber(value, { precision });

      if (id === 'normal') {
        const mean = Number(a);
        const sd = Number(b);
        rows.push(
          { label: 'Mean μ', value: nf(mean) },
          { label: 'Standard deviation σ', value: nf(sd) },
          { label: 'Probability density f(x)', value: nf(p.normalPdf(Number(x), mean, sd)) },
          { label: 'P(X ≤ x)', value: nf(p.normalCdf(Number(x), mean, sd)), emphasize: true },
          { label: 'P(X ≥ x)', value: nf(1 - p.normalCdf(Number(x), mean, sd)) },
        );
        const moments = p.normalMoments(mean, sd);
        rows.push({ label: 'Variance', value: nf(moments.variance) });
      } else if (id === 'binomial') {
        const n = Math.round(Number(a));
        const probability = Number(b);
        rows.push(
          { label: 'Trials n', value: String(n) },
          { label: 'Success probability p', value: nf(probability) },
          { label: 'P(X = k)', value: nf(p.binomialPmf(Number(x), n, probability)) },
          { label: 'P(X ≤ k)', value: nf(p.binomialCdf(Number(x), n, probability)), emphasize: true },
          { label: 'P(X > k)', value: nf(1 - p.binomialCdf(Number(x), n, probability)) },
        );
        const moments = p.binomialMoments(n, probability);
        rows.push(
          { label: 'Mean', value: nf(moments.mean) },
          { label: 'Variance', value: nf(moments.variance) },
          { label: 'Standard deviation', value: nf(moments.sd) },
        );
      } else if (id === 'poisson') {
        const lambda = Number(a);
        rows.push(
          { label: 'Rate λ', value: nf(lambda) },
          { label: 'P(X = k)', value: nf(p.poissonPmf(Number(x), lambda)) },
          { label: 'P(X ≤ k)', value: nf(p.poissonCdf(Number(x), lambda)), emphasize: true },
          { label: 'P(X > k)', value: nf(1 - p.poissonCdf(Number(x), lambda)) },
        );
        const moments = p.poissonMoments(lambda);
        rows.push({ label: 'Mean = variance', value: nf(moments.mean) });
      } else if (id === 'uniform') {
        const low = Number(a);
        const high = Number(b);
        rows.push(
          { label: `Lower bound`, value: nf(low) },
          { label: `Upper bound`, value: nf(high) },
          { label: 'Density f(x)', value: nf(p.uniformPdf(Number(x), low, high)) },
          { label: 'P(X ≤ x)', value: nf(p.uniformCdf(Number(x), low, high)), emphasize: true },
        );
        const moments = p.uniformMoments(low, high);
        rows.push({ label: 'Mean', value: nf(moments.mean) }, { label: 'Variance', value: nf(moments.variance) });
      } else if (id === 'exponential') {
        const rate = Number(a);
        rows.push(
          { label: 'Rate λ', value: nf(rate) },
          { label: 'Density f(x)', value: nf(p.exponentialPdf(Number(x), rate)) },
          { label: 'P(X ≤ x)', value: nf(p.exponentialCdf(Number(x), rate)), emphasize: true },
          { label: 'P(X > x)', value: nf(1 - p.exponentialCdf(Number(x), rate)) },
        );
        const moments = p.exponentialMoments(rate);
        rows.push({ label: 'Mean = standard deviation', value: nf(moments.mean) });
      } else {
        const df = Number(a);
        rows.push(
          { label: 'Degrees of freedom', value: nf(df) },
          { label: 'Density f(t)', value: nf(p.tPdf(Number(x), df)) },
          { label: 'P(T ≤ t)', value: nf(p.tCdf(Number(x), df)), emphasize: true },
          { label: 'Two-sided p-value', value: nf(2 * (1 - p.tCdf(Math.abs(Number(x)), df))) },
        );
      }

      return { ok: true as const, rows };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [id, x, a, b, precision]);

  const labels = parameterLabels(id);

  return (
    <div className="stack">
      <section className="card">
        <Tabs
          tabs={DISTRIBUTIONS.map((entry) => ({ id: entry.id, label: entry.label }))}
          value={id}
          onChange={(next) => setId(next as DistributionId)}
          label="Distribution"
        />
        <div className="grid grid--form">
          <NumberField label={labels.aLabel} value={a} onChange={setA} step={0.1} hint={labels.aHint} />
          <NumberField label={labels.bLabel} value={b} onChange={setB} step={0.1} hint={labels.bHint} />
          <NumberField label={labels.xLabel} value={x} onChange={setX} step={0.1} hint={labels.xHint} />
        </div>
        <Notice>
          Cumulative probabilities use the regularised incomplete beta and gamma functions and match
          published statistical tables to at least 8 decimal places.
        </Notice>
      </section>

      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {outcome.ok ? <OutputList rows={outcome.rows} /> : <Notice kind="error">{outcome.message}</Notice>}
      </section>
    </div>
  );
}

function parameterLabels(id: DistributionId): {
  aLabel: string;
  aHint?: string;
  bLabel: string;
  bHint?: string;
  xLabel: string;
  xHint?: string;
} {
  switch (id) {
    case 'normal':
      return { aLabel: 'Mean μ', bLabel: 'Standard deviation σ', bHint: 'Must be positive', xLabel: 'Value x' };
    case 'binomial':
      return { aLabel: 'Trials n', aHint: 'Whole number', bLabel: 'Probability p', bHint: '0 – 1', xLabel: 'Successes k' };
    case 'poisson':
      return { aLabel: 'Rate λ', bLabel: 'Not used', xLabel: 'Events k' };
    case 'uniform':
      return { aLabel: 'Lower bound a', bLabel: 'Upper bound b', xLabel: 'Value x' };
    case 'exponential':
      return { aLabel: 'Rate λ', bLabel: 'Not used', xLabel: 'Value x' };
    default:
      return { aLabel: 'Degrees of freedom', bLabel: 'Not used', xLabel: 't value' };
  }
}
