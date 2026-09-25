import { useMemo, useState } from 'react';
import {
  createRandom,
  describeDistribution,
  DISTRIBUTIONS,
  requireDistribution,
  sampleDistribution,
  sampleStats,
} from '@/math/probability';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { NumberField, Notice, OutputList, SelectField, type OutputRow } from '@/ui/components/primitives';

/**
 * One panel for every distribution in the registry: the parameter fields are
 * built from the distribution's own description, so adding a distribution in
 * the maths layer makes it available here with no extra UI code.
 */
export function ProbabilityPanel() {
  const settings = useSettings();
  const [id, setId] = useState('normal');
  const [values, setValues] = useState<Record<string, number>>(() => defaultsFor('normal'));
  const [x, setX] = useState(0);
  const [simulationSize, setSimulationSize] = useState(1000);
  const [seed, setSeed] = useState(12345);

  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const distribution = requireDistribution(id);
  const parameters = distribution.parameters.map((parameter) => values[parameter.name] ?? parameter.default);

  const choose = (nextId: string) => {
    setId(nextId);
    setValues(defaultsFor(nextId));
  };

  const outcome = useMemo(() => {
    try {
      const profile = describeDistribution(id, parameters);
      const density = distribution.pdf(x, parameters);
      const lower = distribution.cdf(x, parameters);
      const rows: OutputRow[] = [
        {
          label: distribution.discrete ? 'P(X = x)' : 'Probability density f(x)',
          value: nf(density),
        },
        { label: 'P(X ≤ x)', value: nf(lower), emphasize: true },
        { label: 'P(X ≥ x)', value: nf(Math.max(0, 1 - lower + (distribution.discrete ? density : 0))) },
        { label: 'P(X = x)', value: nf(distribution.discrete ? density : 0) },
        {
          label: 'Support',
          value: `${formatBound(profile.support.min, nf)} … ${formatBound(profile.support.max, nf)}`,
        },
        { label: 'Mean', value: Number.isFinite(profile.mean) ? nf(profile.mean) : 'Does not exist' },
        {
          label: 'Variance',
          value: Number.isFinite(profile.variance) ? nf(profile.variance) : 'Does not exist',
        },
        { label: 'Standard deviation', value: Number.isFinite(profile.sd) ? nf(profile.sd) : 'Does not exist' },
        { label: 'Median', value: Number.isFinite(profile.median) ? nf(profile.median) : '—' },
        { label: 'Quartiles Q1 / Q3', value: `${nf(profile.quartiles.q1)} / ${nf(profile.quartiles.q3)}` },
        { label: 'When to use it', value: profile.use },
      ];
      if (profile.note) rows.push({ label: 'Note', value: profile.note });
      return { ok: true as const, rows };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [distribution, id, parameters, x, nf]);

  const simulation = useMemo(() => {
    try {
      const draws = sampleDistribution(id, parameters, simulationSize, seed);
      const stats = sampleStats(draws);
      return {
        ok: true as const,
        rows: [
          { label: 'Draws', value: String(stats.count) },
          { label: 'Sample mean', value: nf(stats.mean) },
          { label: 'Sample standard deviation', value: nf(stats.sd) },
          { label: 'Standard error of the mean', value: nf(stats.standardError) },
          { label: 'Smallest draw', value: nf(Math.min(...draws)) },
          { label: 'Largest draw', value: nf(Math.max(...draws)) },
        ],
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [id, parameters, simulationSize, seed, nf]);

  return (
    <div className="stack">
      <section className="card">
        <div className="grid grid--form">
          <SelectField
            label="Distribution"
            value={id}
            onChange={choose}
            options={DISTRIBUTIONS.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
          {distribution.parameters.map((parameter) => (
            <NumberField
              key={parameter.name}
              label={`${parameter.name} — ${parameter.description}`}
              value={values[parameter.name] ?? parameter.default}
              onChange={(next) =>
                setValues((current) => ({ ...current, [parameter.name]: next === '' ? parameter.default : next }))
              }
              step={parameter.integer ? 1 : 0.1}
              min={parameter.min}
              max={parameter.max}
              hint={
                parameter.min !== undefined || parameter.max !== undefined
                  ? `Allowed range: ${parameter.min ?? '−∞'} … ${parameter.max ?? '∞'}${parameter.integer ? ', whole numbers' : ''}`
                  : undefined
              }
            />
          ))}
          <NumberField
            label="Value x"
            value={x}
            onChange={(next) => setX(next === '' ? 0 : next)}
            step={0.1}
            hint="Density, cumulative probability and quantile all use this value."
          />
        </div>
        <Notice>
          Densities and cumulative probabilities come from the same Lanczos gamma, incomplete beta and
          incomplete gamma routines used everywhere else in the app, and are checked against published
          tables in the test suite.
        </Notice>
      </section>

      <section className="card" aria-live="polite">
        <h2>Result</h2>
        {outcome.ok ? <OutputList rows={outcome.rows} /> : <Notice kind="error">{outcome.message}</Notice>}
      </section>

      <section className="card">
        <h2>Simulation</h2>
        <div className="grid grid--form">
          <NumberField
            label="Draws"
            value={simulationSize}
            onChange={(next) => setSimulationSize(next === '' ? 100 : Math.max(1, Math.min(20000, Math.round(next))))}
            min={1}
            max={20000}
            hint="A larger sample follows the theoretical mean and variance more closely."
          />
          <NumberField
            label="Random seed"
            value={seed}
            onChange={(next) => setSeed(next === '' ? 0 : Math.round(next))}
            hint="The same seed always produces exactly the same sample, so results are reproducible."
          />
        </div>
        {simulation.ok ? (
          <OutputList rows={simulation.rows} title="Sample statistics" />
        ) : (
          <Notice kind="error">{simulation.message}</Notice>
        )}
        <button
          type="button"
          className="btn btn--small"
          onClick={() => setSeed(createRandom(seed)() * 2 ** 31)}
        >
          New sample
        </button>
      </section>
    </div>
  );
}

function defaultsFor(id: string): Record<string, number> {
  const distribution = DISTRIBUTIONS.find((entry) => entry.id === id) ?? DISTRIBUTIONS[0]!;
  return Object.fromEntries(distribution.parameters.map((parameter) => [parameter.name, parameter.default]));
}

function formatBound(value: number, nf: (value: number) => string): string {
  if (value === Number.NEGATIVE_INFINITY) return '−∞';
  if (value === Number.POSITIVE_INFINITY) return '∞';
  return nf(value);
}
