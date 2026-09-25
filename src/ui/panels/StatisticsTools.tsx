import { useMemo, useState } from 'react';
import {
  describeShape,
  exponentialRegression,
  fiveNumberSummary,
  frequencyTable,
  geometricMean,
  harmonicMean,
  histogram,
  coefficientOfVariation,
  chiSquareGoodnessOfFit,
  chiSquareIndependence,
  confidenceIntervalMean,
  confidenceIntervalProportion,
  meanAbsoluteDeviation,
  movingAverage,
  multipleRegression,
  logarithmicRegression,
  oneSampleTTest,
  pairedTTest,
  parseDataset,
  polynomialRegression,
  powerRegression,
  proportionZTest,
  requiredSampleSizeForMean,
  requiredSampleSizeForProportion,
  spearmanCorrelation,
  twoSampleTTest,
  correlation,
  type FitResult,
} from '@/math/statistics';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { Notice, NumberField, OutputList, SelectField, TextField, type OutputRow } from '@/ui/components/primitives';

/** Shared way of turning a failed computation into a readable notice. */
type Outcome<T> = { ok: true; value: T } | { ok: false; message: string };

function attempt<T>(work: () => T): Outcome<T> {
  try {
    return { ok: true, value: work() };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

function useNumbers(text: string): { data: number[] | null; message?: string } {
  return useMemo(() => {
    const data = parseDataset(text);
    return data ? { data } : { data: null, message: 'Enter numbers separated by commas, spaces or new lines.' };
  }, [text]);
}

function usePrecisionRows(): { nf: (value: number) => string; show: (outcome: Outcome<OutputRow[]>) => OutputRow[] } {
  const settings = useSettings();
  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });
  const show = (outcome: Outcome<OutputRow[]>) => (outcome.ok ? outcome.value : []);
  return { nf, show };
}

/* --------------------------- shape of a dataset --------------------------- */

export function ShapeTool() {
  const { nf, show } = usePrecisionRows();
  const [text, setText] = useState('2, 4, 4, 4, 5, 5, 7, 9');
  const [second, setSecond] = useState('3, 1, 5, 4, 6, 8, 7, 9');
  const { data, message: datasetMessage } = useNumbers(text);
  const { data: partner, message: partnerMessage } = useNumbers(second);

  const outcome = useMemo<Outcome<OutputRow[]>>(() => {
    if (!data) return { ok: false, message: datasetMessage ?? 'No data.' };
    return attempt(() => {
      const shape = describeShape(data, 'sample');
      const five = fiveNumberSummary(data);
      const rows: OutputRow[] = [
        { label: 'Skewness (sample)', value: nf(shape.skewness), emphasize: true },
        { label: 'Excess kurtosis', value: nf(shape.excessKurtosis) },
        { label: 'Kurtosis', value: nf(shape.kurtosis) },
        { label: 'Shape', value: shape.description },
        { label: 'Five-number summary', value: `${nf(five.minimum)} · ${nf(five.q1)} · ${nf(five.median)} · ${nf(five.q3)} · ${nf(five.maximum)}` },
        { label: 'Interquartile range', value: nf(five.interquartileRange) },
        {
          label: 'Outliers (1.5 × IQR rule)',
          value: five.outliers.length ? five.outliers.map(nf).join(', ') : 'None',
        },
        { label: 'Geometric mean', value: data.some((value) => value <= 0) ? 'Needs positive values' : nf(geometricMean(data)) },
        { label: 'Harmonic mean', value: data.some((value) => value <= 0) ? 'Needs positive values' : nf(harmonicMean(data)) },
        { label: 'Mean absolute deviation', value: nf(meanAbsoluteDeviation(data)) },
        { label: 'Coefficient of variation', value: Math.abs(data.reduce((sum, value) => sum + value, 0)) < 1e-12 ? 'Undefined (mean is zero)' : nf(coefficientOfVariation(data)) },
        { label: 'Moving average (window 3, last value)', value: data.length >= 3 ? nf(movingAverage(data, 3).at(-1)!) : 'Needs three values' },
      ];
      if (partner && partner.length === data.length) {
        rows.push({ label: 'Spearman rank correlation with the second set', value: nf(spearmanCorrelation(data, partner)) });
        rows.push({ label: 'Pearson correlation with the second set', value: nf(correlation(data, partner)) });
      }
      return rows;
    });
  }, [data, partner, datasetMessage, nf]);

  const table = useMemo(() => {
    if (!data) return { bins: [], frequencies: [] };
    return attempt(() => ({ bins: histogram(data, 6), frequencies: frequencyTable(data) })).ok
      ? { bins: histogram(data, 6), frequencies: frequencyTable(data) }
      : { bins: [], frequencies: [] };
  }, [data]);

  return (
    <section className="card">
      <h2>Shape &amp; spread</h2>
      <div className="grid grid--form">
        <TextField
          label="Data"
          value={text}
          onChange={setText}
          placeholder="2, 4, 4, 4, 5"
          hint="Skewness and kurtosis describe the shape; the five-number summary and outliers describe the spread."
        />
        <TextField
          label="Second set (optional)"
          value={second}
          onChange={setSecond}
          placeholder="3, 1, 5, 4, 6"
          hint="Same length as the first set, to compare how the two move together."
        />
      </div>
      {!outcome.ok ? <Notice kind="error">{outcome.message}</Notice> : null}
      {outcome.ok ? (
        <>
          <OutputList rows={show(outcome)} title="Shape summary" />
          {table.bins.length > 0 ? (
            <OutputList
              rows={table.bins.map((bin) => ({ label: `${nf(bin.from)} – ${nf(bin.to)}`, value: `${bin.count} (${(bin.relative * 100).toFixed(1)} %)` }))}
              title="Histogram"
            />
          ) : null}
          {table.frequencies.length > 0 && table.frequencies.length <= 12 ? (
            <OutputList
              rows={table.frequencies.map((row) => ({ label: nf(row.value), value: `${row.count} (${(row.relative * 100).toFixed(1)} %)` }))}
              title="Frequency table"
            />
          ) : null}
        </>
      ) : null}
      {partnerMessage && data && !partner ? <Notice kind="info">{partnerMessage}</Notice> : null}
    </section>
  );
}

/* ------------------------------- curve fits ------------------------------- */

const FIT_MODELS = [
  { value: 'polynomial', label: 'Polynomial' },
  { value: 'exponential', label: 'Exponential y = a·e^(bx)' },
  { value: 'power', label: 'Power y = a·x^b' },
  { value: 'logarithmic', label: 'Logarithmic y = a + b·ln x' },
  { value: 'multiple', label: 'Several x variables' },
] as const;

export function FitTool() {
  const { nf } = usePrecisionRows();
  const [model, setModel] = useState<(typeof FIT_MODELS)[number]['value']>('polynomial');
  const [degree, setDegree] = useState(2);
  const [xText, setXText] = useState('0, 1, 2, 3, 4, 5');
  const [yText, setYText] = useState('2, 4.5, 6, 6.5, 6, 4.5');
  const [secondXText, setSecondXText] = useState('1, 0, 1, 2, 3, 0');
  const [predictAt, setPredictAt] = useState(2.5);

  const x = useNumbers(xText);
  const y = useNumbers(yText);
  const secondX = useNumbers(secondXText);

  const outcome = useMemo<Outcome<FitResult>>(() => {
    const xs = x.data;
    const ys = y.data;
    if (!xs) return { ok: false, message: x.message ?? 'No x values.' };
    if (!ys) return { ok: false, message: y.message ?? 'No y values.' };
    return attempt(() => {
      switch (model) {
        case 'exponential':
          return exponentialRegression(xs, ys);
        case 'power':
          return powerRegression(xs, ys);
        case 'logarithmic':
          return logarithmicRegression(xs, ys);
        case 'multiple':
          if (!secondX.data) throw new Error('The second x column is needed for a multiple fit');
          return multipleRegression([xs, secondX.data], ys);
        default:
          return polynomialRegression(xs, ys, degree);
      }
    });
  }, [model, x.data, y.data, secondX.data, degree, x.message, y.message]);

  return (
    <section className="card">
      <h2>Curve fitting</h2>
      <div className="grid grid--form">
        <SelectField
          label="Model"
          value={model}
          onChange={(value) => setModel(value as (typeof FIT_MODELS)[number]['value'])}
          options={FIT_MODELS.map((entry) => ({ value: entry.value, label: entry.label }))}
        />
        {model === 'polynomial' ? (
          <NumberField
            label="Degree"
            value={degree}
            onChange={(value) => setDegree(value === '' ? 1 : Math.max(1, Math.min(10, Math.round(value))))}
            min={1}
            max={10}
            hint="1 is a straight line; higher degrees bend to follow the data more closely."
          />
        ) : null}
        <TextField label="x values" value={xText} onChange={setXText} placeholder="0, 1, 2, 3" />
        <TextField label="y values" value={yText} onChange={setYText} placeholder="1, 2, 3, 4" />
        {model === 'multiple' ? (
          <TextField
            label="Second x column"
            value={secondXText}
            onChange={setSecondXText}
            hint="One extra column per additional explanatory variable."
          />
        ) : null}
        <NumberField label="Predict y at x =" value={predictAt} onChange={(value) => setPredictAt(value === '' ? 0 : value)} />
      </div>
      {!outcome.ok ? <Notice kind="error">{outcome.message}</Notice> : null}
      {outcome.ok ? (
        <OutputList
          title="Fit"
          rows={[
            { label: 'Equation', value: outcome.value.equation, emphasize: true },
            { label: 'Coefficients', value: outcome.value.coefficients.map((value) => nf(value)).join(', ') },
            { label: 'R²', value: nf(outcome.value.r2) },
            {
              label: 'Adjusted R²',
              value: Number.isNaN(outcome.value.adjustedR2) ? '—' : nf(outcome.value.adjustedR2),
            },
            { label: 'Standard error of the estimate', value: nf(outcome.value.standardError) },
            { label: 'Points used', value: String(outcome.value.points) },
            { label: `Prediction at x = ${nf(predictAt)}`, value: nf(outcome.value.predict(predictAt)), emphasize: true },
            ...(outcome.value.note ? [{ label: 'Note', value: outcome.value.note }] : []),
          ]}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------ tests on data ----------------------------- */

export function InferenceTool() {
  const { nf, show } = usePrecisionRows();
  const [first, setFirst] = useState('2, 4, 4, 4, 5, 5, 7, 9');
  const [second, setSecond] = useState('1, 2, 3, 4, 5');
  const [hypothesised, setHypothesised] = useState(5);
  const [observed, setObserved] = useState('10, 20, 30');
  const [expected, setExpected] = useState('');
  const [tableText, setTableText] = useState('10 20\n30 15');
  const [successes, setSuccesses] = useState(60);
  const [trials, setTrials] = useState(100);
  const [aimedProportion, setAimedProportion] = useState(0.5);
  const [margin, setMargin] = useState(0.03);

  const a = useNumbers(first);
  const b = useNumbers(second);
  const counts = useNumbers(observed);
  const expectedCounts = useNumbers(expected);

  const tests = useMemo<Outcome<OutputRow[]>>(() => {
    const first = a.data;
    if (!first) return { ok: false, message: a.message ?? 'No data.' };
    return attempt(() => {
      const rows: OutputRow[] = [];
      const one = oneSampleTTest(first, hypothesised);
      rows.push({ label: one.test, value: `t = ${nf(one.statistic)}, df = ${one.df[0]}, p = ${nf(one.pValue)}`, emphasize: true });
      rows.push({ label: 'Conclusion', value: one.conclusion });
      rows.push({
        label: `Confidence interval for the mean`,
        value: `${nf(one.interval!.low)} … ${nf(one.interval!.high)} (${(one.interval!.level * 100).toFixed(0)} %)`,
      });
      const interval = confidenceIntervalMean(first, 0.95);
      rows.push({ label: '95 % t interval (check)', value: `${nf(interval.low)} … ${nf(interval.high)}` });

      if (b.data && b.data.length >= 2) {
        const two = twoSampleTTest(first, b.data);
        rows.push({
          label: `${two.test} (first vs second)`,
          value: `t = ${nf(two.statistic)}, df = ${nf(two.df[0]!)}, p = ${nf(two.pValue)}`,
        });
        rows.push({ label: 'Two-sample conclusion', value: two.conclusion });
        if (first.length === b.data.length) {
          const paired = pairedTTest(b.data, first);
          rows.push({
            label: 'Paired t test (second − first)',
            value: `t = ${nf(paired.statistic)}, p = ${nf(paired.pValue)}`,
          });
        }
      }

      if (counts.data) {
        const fit = chiSquareGoodnessOfFit(counts.data, expectedCounts.data ?? undefined);
        rows.push({
          label: fit.test,
          value: `χ² = ${nf(fit.statistic)}, df = ${fit.degreesOfFreedom}, p = ${nf(fit.pValue)}`,
          emphasize: true,
        });
        rows.push({ label: 'Goodness-of-fit conclusion', value: fit.conclusion });
      }
      return rows;
    });
  }, [a.data, b.data, counts.data, expectedCounts.data, hypothesised, a.message, nf]);

  const contingency = useMemo<Outcome<OutputRow[]>>(() => {
    const parsed = tableText
      .trim()
      .split(/\n+/)
      .map((line) => line.split(/[\s,]+/).filter(Boolean))
      .filter((line) => line.length > 0);
    if (parsed.length === 0) return { ok: false, message: 'Enter a table with one row per line.' };
    const table = parsed.map((row) => row.map(Number));
    if (table.some((row) => row.some((value) => !Number.isFinite(value)))) {
      return { ok: false, message: 'Every cell of the table must be a number.' };
    }
    return attempt(() => {
      const result = chiSquareIndependence(table);
      return [
        { label: result.test, value: `χ² = ${nf(result.statistic)}, df = ${result.degreesOfFreedom}, p = ${nf(result.pValue)}`, emphasize: true },
        { label: 'Conclusion', value: result.conclusion },
        { label: 'Expected counts (first row)', value: result.table!.expected[0]!.map((value) => nf(value)).join(', ') },
        { label: 'Assumptions', value: result.assumptions },
      ];
    });
  }, [tableText, nf]);

  const proportion = useMemo<Outcome<OutputRow[]>>(() => {
    return attempt(() => {
      const test = proportionZTest(successes, trials, aimedProportion);
      const interval = confidenceIntervalProportion(successes, trials, 0.95);
      return [
        { label: test.test, value: `z = ${nf(test.statistic)}, p = ${nf(test.pValue)}`, emphasize: true },
        { label: 'Conclusion', value: test.conclusion },
        { label: 'Observed proportion', value: nf(test.estimate!.value) },
        { label: `${interval.method} (95 %)`, value: `${nf(interval.low)} … ${nf(interval.high)}` },
        { label: 'Sample size for ± this margin (mean)', value: `${requiredSampleSizeForMean(margin, Math.max(1e-9, Math.sqrt(test.estimate!.value * (1 - test.estimate!.value))))}` },
        {
          label: 'Sample size for this margin (proportion)',
          value: `${requiredSampleSizeForProportion(margin, Math.max(0.01, Math.min(0.99, test.estimate!.value)))}`,
        },
      ];
    });
  }, [successes, trials, aimedProportion, margin, nf]);

  return (
    <section className="card">
      <h2>Hypothesis tests</h2>
      <div className="grid grid--form">
        <TextField label="First sample" value={first} onChange={setFirst} placeholder="2, 4, 4, 5" />
        <TextField label="Second sample (optional)" value={second} onChange={setSecond} placeholder="1, 2, 3" />
        <NumberField
          label="Hypothesised mean"
          value={hypothesised}
          onChange={(value) => setHypothesised(value === '' ? 0 : value)}
        />
        <TextField label="Observed counts" value={observed} onChange={setObserved} placeholder="10, 20, 30" />
        <TextField
          label="Expected counts (blank = equal)"
          value={expected}
          onChange={setExpected}
          placeholder="20, 20, 20"
        />
        <TextField
          label="Contingency table"
          value={tableText}
          onChange={setTableText}
          multiline
          rows={3}
          hint="One row per line, cells separated by spaces, for the independence test."
        />
        <NumberField label="Successes" value={successes} onChange={(value) => setSuccesses(value === '' ? 0 : Math.round(value))} />
        <NumberField label="Trials" value={trials} onChange={(value) => setTrials(value === '' ? 1 : Math.round(value))} />
        <NumberField
          label="Hypothesised proportion"
          value={aimedProportion}
          onChange={(value) => setAimedProportion(value === '' ? 0.5 : value)}
          step={0.05}
          hint="Also used for the sample-size calculation."
        />
        <NumberField
          label="Target margin of error"
          value={margin}
          onChange={(value) => setMargin(value === '' ? 0.05 : value)}
          step={0.01}
        />
      </div>
      {!tests.ok ? <Notice kind="error">{tests.message}</Notice> : null}
      {tests.ok ? <OutputList rows={show(tests)} title="Tests on the first sample" /> : null}
      {!contingency.ok ? <Notice kind="error">{contingency.message}</Notice> : null}
      {contingency.ok ? <OutputList rows={show(contingency)} title="Contingency table" /> : null}
      {!proportion.ok ? <Notice kind="error">{proportion.message}</Notice> : null}
      {proportion.ok ? <OutputList rows={show(proportion)} title="Proportions" /> : null}
    </section>
  );
}
