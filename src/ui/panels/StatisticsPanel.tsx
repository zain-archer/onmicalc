import { useMemo, useState } from 'react';
import {
  correlation,
  interquartileRange,
  linearRegression,
  parseDataset,
  percentile,
  summarize,
  zScore,
} from '@/math/statistics';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { Notice, OutputList, TextField } from '@/ui/components/primitives';
import { FitTool, InferenceTool, ShapeTool } from './StatisticsTools';

export function StatisticsPanel() {
  return (
    <div className="stack">
      <SummaryTool />
      <ShapeTool />
      <RegressionTool />
      <FitTool />
      <InferenceTool />
    </div>
  );
}

function SummaryTool() {
  const settings = useSettings();
  const [text, setText] = useState('2, 4, 4, 4, 5, 5, 7, 9');
  const [zValue, setZValue] = useState('7');
  const [percentileValue, setPercentileValue] = useState('90');

  const data = useMemo(() => parseDataset(text), [text]);
  const summary = useMemo(() => {
    if (!data) return { ok: false as const, message: 'Enter numbers separated by commas, spaces or new lines.' };
    try {
      return { ok: true as const, value: summarize(data) };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [data]);

  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const zResult = useMemo(() => {
    if (!data || !summary.ok) return null;
    const value = Number(zValue);
    if (!Number.isFinite(value)) return null;
    try {
      return zScore(value, data, 'sample');
    } catch {
      return null;
    }
  }, [data, summary.ok, zValue]);

  const percentileResult = useMemo(() => {
    if (!data || !summary.ok) return null;
    const value = Number(percentileValue);
    if (!(value >= 0 && value <= 100)) return null;
    try {
      return percentile(data, value);
    } catch {
      return null;
    }
  }, [data, summary.ok, percentileValue]);

  return (
    <section className="card">
      <h2>Descriptive statistics</h2>
      <div className="grid grid--form">
        <TextField
          label="Data set"
          value={text}
          onChange={setText}
          multiline
          rows={3}
          placeholder="1, 2, 3, 4"
          hint="Any separators. Line breaks are fine."
        />
        <TextField label="Z-score of value" value={zValue} onChange={setZValue} placeholder="7" />
        <TextField
          label="Percentile"
          value={percentileValue}
          onChange={setPercentileValue}
          placeholder="90"
          hint="0–100, linear interpolation."
        />
      </div>

      {!summary.ok ? (
        <Notice kind="error">{summary.message}</Notice>
      ) : (
        <>
          <OutputList
            title={`Summary of ${summary.value.count} values`}
            rows={[
              { label: 'Mean', value: nf(summary.value.mean), emphasize: true },
              { label: 'Median', value: nf(summary.value.median) },
              { label: 'Mode', value: summary.value.modes.length ? summary.value.modes.map(nf).join(', ') : 'No repeated value' },
              { label: 'Sum', value: nf(summary.value.sum) },
              { label: 'Minimum', value: nf(summary.value.min) },
              { label: 'Maximum', value: nf(summary.value.max) },
              { label: 'Range', value: nf(summary.value.range) },
              { label: 'Sample variance (n−1)', value: nf(summary.value.varianceSample) },
              { label: 'Population variance (n)', value: nf(summary.value.variancePopulation) },
              { label: 'Sample standard deviation', value: nf(summary.value.sdSample), emphasize: true },
              { label: 'Population standard deviation', value: nf(summary.value.sdPopulation) },
              { label: 'Standard error of the mean', value: nf(summary.value.standardError) },
              { label: 'Q1', value: nf(summary.value.q1) },
              { label: 'Q3', value: nf(summary.value.q3) },
              { label: 'Interquartile range', value: nf(interquartileRange(data!)) },
              ...(zResult !== null ? [{ label: `Z-score of ${zValue}`, value: nf(zResult) }] : []),
              ...(percentileResult !== null
                ? [{ label: `Percentile ${percentileValue}`, value: nf(percentileResult) }]
                : []),
            ]}
          />
          <BoxPlot data={data!} />
        </>
      )}
    </section>
  );
}

/** Simple SVG box plot: min, Q1, median, Q3, max. */
function BoxPlot({ data }: { data: readonly number[] }) {
  const stats = useMemo(() => {
    const summary = summarize(data);
    return summary;
  }, [data]);

  const width = 520;
  const height = 90;
  const pad = 24;
  const spread = Math.max(1e-9, stats.max - stats.min);
  const x = (value: number) => pad + ((value - stats.min) / spread) * (width - pad * 2);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Box plot of the data set" width="100%" height="110">
        <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="var(--border)" strokeWidth="1" />
        <line x1={x(stats.min)} y1={height / 2 - 16} x2={x(stats.min)} y2={height / 2 + 16} stroke="var(--text-dim)" />
        <line x1={x(stats.max)} y1={height / 2 - 16} x2={x(stats.max)} y2={height / 2 + 16} stroke="var(--text-dim)" />
        <rect
          x={x(stats.q1)}
          y={height / 2 - 18}
          width={Math.max(1, x(stats.q3) - x(stats.q1))}
          height={36}
          fill="color-mix(in srgb, var(--accent) 25%, transparent)"
          stroke="var(--accent)"
        />
        <line x1={x(stats.median)} y1={height / 2 - 18} x2={x(stats.median)} y2={height / 2 + 18} stroke="var(--accent)" strokeWidth="2" />
        <text x={x(stats.min)} y={height / 2 + 32} fontSize="10" textAnchor="middle" fill="var(--text-dim)">
          {formatNumber(stats.min, { precision: 4 })}
        </text>
        <text x={x(stats.median)} y={height / 2 + 32} fontSize="10" textAnchor="middle" fill="var(--text-dim)">
          {formatNumber(stats.median, { precision: 4 })}
        </text>
        <text x={x(stats.max)} y={height / 2 + 32} fontSize="10" textAnchor="middle" fill="var(--text-dim)">
          {formatNumber(stats.max, { precision: 4 })}
        </text>
      </svg>
      <figcaption>Box plot: whiskers at the minimum and maximum, box at Q1–Q3, line at the median.</figcaption>
    </figure>
  );
}

function RegressionTool() {
  const settings = useSettings();
  const [xText, setXText] = useState('1, 2, 3, 4, 5');
  const [yText, setYText] = useState('2, 4, 5, 4, 5');

  const x = useMemo(() => parseDataset(xText), [xText]);
  const y = useMemo(() => parseDataset(yText), [yText]);

  const outcome = useMemo(() => {
    if (!x || !y) return { ok: false as const, message: 'Enter two numeric data sets.' };
    try {
      return {
        ok: true as const,
        regression: linearRegression(x, y),
        correlation: correlation(x, y),
      };
    } catch (err) {
      return { ok: false as const, message: errorMessage(err) };
    }
  }, [x, y]);

  const precision = settings.precision;

  return (
    <section className="card">
      <h2>Linear regression</h2>
      <div className="grid grid--form">
        <TextField label="x values" value={xText} onChange={setXText} multiline rows={2} />
        <TextField label="y values" value={yText} onChange={setYText} multiline rows={2} />
      </div>
      {!outcome.ok ? (
        <Notice kind="error">{outcome.message}</Notice>
      ) : (
        <>
          <OutputList
            rows={[
              { label: 'Equation', value: outcome.regression.equation, emphasize: true },
              { label: 'Slope', value: formatNumber(outcome.regression.slope, { precision }) },
              { label: 'Intercept', value: formatNumber(outcome.regression.intercept, { precision }) },
              { label: 'R² (coefficient of determination)', value: formatNumber(outcome.regression.r2, { precision }) },
              { label: 'r (Pearson correlation)', value: formatNumber(outcome.correlation, { precision }) },
              {
                label: 'Prediction at the mean x',
                value: formatNumber(
                  outcome.regression.predict(x!.reduce((a, b) => a + b, 0) / x!.length),
                  { precision },
                ),
              },
            ]}
          />
          <ScatterPlot x={x!} y={y!} slope={outcome.regression.slope} intercept={outcome.regression.intercept} />
        </>
      )}
    </section>
  );
}

function ScatterPlot({
  x,
  y,
  slope,
  intercept,
}: {
  x: readonly number[];
  y: readonly number[];
  slope: number;
  intercept: number;
}) {
  const width = 520;
  const height = 280;
  const padding = 34;
  const minX = Math.min(...x);
  const maxX = Math.max(...x);
  const minY = Math.min(...y, intercept + slope * minX);
  const maxY = Math.max(...y, intercept + slope * maxX);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const px = (value: number) => padding + ((value - minX) / spanX) * (width - padding * 2);
  const py = (value: number) => height - padding - ((value - minY) / spanY) * (height - padding * 2);

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Scatter plot with fitted regression line" width="100%" height="300">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="var(--border)" />
        <line
          x1={px(minX)}
          y1={py(intercept + slope * minX)}
          x2={px(maxX)}
          y2={py(intercept + slope * maxX)}
          stroke="var(--accent)"
          strokeWidth="2"
        />
        {x.map((value, index) => (
          <circle key={index} cx={px(value)} cy={py(y[index]!)} r="4" fill="var(--warn)" />
        ))}
        <text x={width - padding} y={height - padding + 18} fontSize="10" textAnchor="end" fill="var(--text-dim)">
          x
        </text>
        <text x={padding - 6} y={padding} fontSize="10" textAnchor="end" fill="var(--text-dim)">
          y
        </text>
      </svg>
      <figcaption>Scatter plot of the data with the least-squares fitted line.</figcaption>
    </figure>
  );
}
