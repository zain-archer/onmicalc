import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { compileFunction } from '@/math/calculus';
import { DEFAULT_VIEWPORT, formatTick, pan, ticksFor, visibleBounds, worldToScreenX, worldToScreenY, zoomAt, type Viewport } from '@/graphing/viewport';
import { sampleFunction, type Polyline } from '@/graphing/sampling';
import {
  areaBetween,
  areaUnder,
  findExtrema,
  findIntersections,
  findRoots,
  tangentAt,
} from '@/graphing/analysis';
import { errorMessage } from '@/core/errors';
import { formatNumber } from '@/core/precision/format';
import { useSettings } from '@/settings/useSettings';
import { Notice, OutputList } from '@/ui/components/primitives';

const COLORS = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#eab308'];

interface FunctionEntry {
  id: number;
  expression: string;
  visible: boolean;
  color: string;
}

const SIZE = { width: 760, height: 460 };
const DEFAULT_FUNCTIONS: FunctionEntry[] = [
  { id: 1, expression: 'x^2', visible: true, color: COLORS[0]! },
  { id: 2, expression: 'sin(x)*5', visible: true, color: COLORS[1]! },
];

function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Run high-frequency pointer work at most once per browser frame. */
function scheduleFrame(callback: () => void): number {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, 0);
}

function cancelFrame(id: number): void {
  if (typeof window === 'undefined') return;
  // clearTimeout is harmless for an animation-frame id and also handles the
  // jsdom/non-visual fallback used by tests.
  window.cancelAnimationFrame?.(id);
  window.clearTimeout(id);
}

export function GraphPanel() {
  const settings = useSettings();
  // Draft values stay local to the form. The graph only reads the committed
  // values after the user presses Calculate, so typing never starts a math
  // pass or locks the input fields.
  const [functions, setFunctions] = useState<FunctionEntry[]>(() => DEFAULT_FUNCTIONS.map((entry) => ({ ...entry })));
  const [calculatedFunctions, setCalculatedFunctions] = useState<FunctionEntry[]>(() =>
    DEFAULT_FUNCTIONS.map((entry) => ({ ...entry })),
  );
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedId, setSelectedId] = useState(1);
  const [traceX, setTraceX] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState<{ a: number; b: number }>({ a: -3, b: 3 });
  const [calculatedRange, setCalculatedRange] = useState<{ a: number; b: number }>({ a: -3, b: 3 });
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [calculationVersion, setCalculationVersion] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const pendingPan = useRef({ dx: 0, dy: 0 });
  const panFrame = useRef<number | null>(null);
  const pendingTraceX = useRef<number | null>(null);
  const traceFrame = useRef<number | null>(null);
  const pendingZoom = useRef<{ factor: number; px: number; py: number } | null>(null);
  const zoomFrame = useRef<number | null>(null);

  const schedulePan = useCallback((dx: number, dy: number) => {
    pendingPan.current.dx += dx;
    pendingPan.current.dy += dy;
    if (panFrame.current !== null) return;
    panFrame.current = scheduleFrame(() => {
      panFrame.current = null;
      const delta = pendingPan.current;
      pendingPan.current = { dx: 0, dy: 0 };
      if (delta.dx !== 0 || delta.dy !== 0) {
        startTransition(() => setViewport((current) => pan(current, delta.dx, delta.dy)));
      }
    });
  }, []);

  const scheduleZoom = useCallback((factor: number, px: number, py: number) => {
    const pending = pendingZoom.current;
    pendingZoom.current = pending
      ? { factor: pending.factor * factor, px, py }
      : { factor, px, py };
    if (zoomFrame.current !== null) return;
    zoomFrame.current = scheduleFrame(() => {
      zoomFrame.current = null;
      const next = pendingZoom.current;
      pendingZoom.current = null;
      if (next) startTransition(() => setViewport((current) => zoomAt(current, next.factor, next.px, next.py, SIZE)));
    });
  }, []);

  const scheduleTrace = useCallback((x: number) => {
    pendingTraceX.current = x;
    if (traceFrame.current !== null) return;
    traceFrame.current = scheduleFrame(() => {
      traceFrame.current = null;
      const next = pendingTraceX.current;
      setTraceX((current) => (current === next ? current : next));
    });
  }, []);

  const clearTrace = useCallback(() => {
    pendingTraceX.current = null;
    if (traceFrame.current !== null) {
      cancelFrame(traceFrame.current);
      traceFrame.current = null;
    }
    setTraceX(null);
  }, []);

  useEffect(
    () => () => {
      if (panFrame.current !== null) cancelFrame(panFrame.current);
      if (traceFrame.current !== null) cancelFrame(traceFrame.current);
      if (zoomFrame.current !== null) cancelFrame(zoomFrame.current);
      panFrame.current = null;
      traceFrame.current = null;
      zoomFrame.current = null;
      pendingZoom.current = null;
    },
    [],
  );

  const compiled = useMemo(
    () =>
      calculatedFunctions.map((entry) => ({
        entry,
        fn: entry.visible && entry.expression.trim() ? compileFunction(entry.expression) : null,
      })),
    [calculatedFunctions],
  );

  const bounds = useMemo(() => visibleBounds(viewport, SIZE), [viewport]);
  const xTicks = useMemo(() => ticksFor(bounds.minX, bounds.maxX, 12), [bounds]);
  const yTicks = useMemo(() => ticksFor(bounds.minY, bounds.maxY, 8), [bounds]);

  const curves: { entry: FunctionEntry; polylines: Polyline[] }[] = useMemo(
    () =>
      compiled
        .filter((item) => item.fn)
        .map((item) => ({
          entry: item.entry,
          polylines: sampleFunction(item.fn!, viewport, SIZE),
        })),
    [compiled, viewport],
  );

  // Build the SVG point-string for every polyline here, memoized on `curves`
  // and `viewport`. Doing this inline in JSX would re-run the expensive
  // map/join over every sampled point on every render (including every
  // keystroke), even when the curves themselves hadn't changed.
  const renderedCurves = useMemo(
    () =>
      curves.map(({ entry, polylines }) => ({
        entry,
        paths: polylines.map((line) =>
          line.points
            .map(
              (point) =>
                `${worldToScreenX(viewport, point.x, SIZE).toFixed(2)},${worldToScreenY(viewport, point.y, SIZE).toFixed(2)}`,
            )
            .join(' '),
        ),
      })),
    [curves, viewport],
  );

  const selected = curves.find((curve) => curve.entry.id === selectedId) ?? curves[0];
  const selectedFn = compiled.find((item) => item.entry.id === selected?.entry.id)?.fn ?? null;
  const otherFns = useMemo(
    () =>
      compiled
        .filter((item) => item.fn && item.entry.id !== selected?.entry.id)
        .map((item) => item.fn!),
    [compiled, selected],
  );

  // A pointer trace changes on almost every pointer event. Keep it separate
  // from the expensive roots/extrema pass so moving across the plot only
  // computes the small tangent calculation instead of rescanning the graph.
  const analysisViewport = useDebouncedValue(viewport, 180);
  const analysisBounds = useMemo(() => visibleBounds(analysisViewport, SIZE), [analysisViewport]);
  const analysisIsCurrent = analysisViewport === viewport;
  const [analysisEnabled, setAnalysisEnabled] = useState(false);

  // Let the plot paint before the initial root/extrema scan. On slower devices
  // this prevents opening the Graphing tool from looking like a frozen page.
  // Calculate also resets this flag so a new expression is analysed only after
  // the committed values have had a chance to render.
  useEffect(() => {
    setAnalysisEnabled(false);
    const timer = setTimeout(() => setAnalysisEnabled(true), 0);
    return () => clearTimeout(timer);
  }, [calculationVersion]);

  const calculate = useCallback(() => {
    setCalculatedFunctions(functions.map((entry) => ({ ...entry })));
    setCalculatedRange({ ...rangeInput });
    setHasPendingChanges(false);
    setAnalysisEnabled(false);
    setCalculationVersion((current) => current + 1);
    clearTrace();
  }, [functions, rangeInput, clearTrace]);

  type StaticAnalysis = { roots: number[]; extrema: { x: number; y: number }[]; intersections: { x: number; y: number }[] };
  const [staticAnalysis, setStaticAnalysis] = useState<StaticAnalysis | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false);

  // Root/extrema/intersection scans are deliberately scheduled outside render.
  // The expression evaluator is exact but relatively expensive, so doing these
  // thousands of calls inside useMemo made the whole graph appear frozen on
  // phones and low-power laptops. A short idle delay lets the SVG paint first,
  // and cancelling stale work keeps a pan/zoom responsive.
  useEffect(() => {
    setStaticAnalysis(null);
    if (!analysisEnabled || !selectedFn) {
      setAnalysisBusy(false);
      return;
    }
    let cancelled = false;
    setAnalysisBusy(true);
    const run = () => {
      if (cancelled) return;
      try {
        const roots = findRoots(selectedFn, analysisBounds.minX, analysisBounds.maxX, 260);
        const extrema = findExtrema(selectedFn, analysisBounds.minX, analysisBounds.maxX, 180);
        const intersections = otherFns.flatMap((other) =>
          findIntersections(selectedFn, other, analysisBounds.minX, analysisBounds.maxX, 260),
        );
        if (!cancelled) {
          setStaticAnalysis({ roots, extrema, intersections });
          setAnalysisBusy(false);
        }
      } catch {
        if (!cancelled) {
          setStaticAnalysis(null);
          setAnalysisBusy(false);
        }
      }
    };
    const timer = window.setTimeout(run, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [analysisEnabled, analysisBounds, otherFns, selectedFn]);

  const tangent = useMemo(() => {
    if (!selectedFn || traceX === null) return null;
    try {
      return tangentAt(selectedFn, traceX, (bounds.maxX - bounds.minX) / 20);
    } catch {
      return null;
    }
  }, [selectedFn, traceX, bounds]);

  // Do not draw markers calculated for the previous viewport while a pan or
  // zoom is still settling; showing them in the wrong place looks like a
  // broken graph. They will reappear once the debounced analysis catches up.
  const analysis = analysisEnabled && analysisIsCurrent && staticAnalysis ? { ...staticAnalysis, tangent } : null;

  const intersections = analysis?.intersections ?? [];

  type AreaState =
    | { state: 'ok'; kind: 'between' | 'under'; from: number; to: number; value: number; error: number; converged: boolean }
    | { state: 'failed'; message: string }
    | null;

  const area = useMemo<AreaState>(() => {
    if (!selectedFn) return null;
    try {
      const kind = otherFns[0] ? ('between' as const) : ('under' as const);
      const result = otherFns[0]
        ? areaBetween(selectedFn, otherFns[0], calculatedRange.a, calculatedRange.b)
        : areaUnder(selectedFn, calculatedRange.a, calculatedRange.b);
      return { state: 'ok', kind, from: calculatedRange.a, to: calculatedRange.b, ...result };
    } catch (err) {
      return { state: 'failed', message: errorMessage(err) };
    }
  }, [selectedFn, otherFns, calculatedRange]);

  const updateFunction = (id: number, patch: Partial<FunctionEntry>) => {
    setFunctions((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
    setHasPendingChanges(true);
  };

  const addFunction = () => {
    const id = Math.max(0, ...functions.map((entry) => entry.id)) + 1;
    setFunctions((current) => [
      ...current,
      { id, expression: '', visible: true, color: COLORS[current.length % COLORS.length]! },
    ]);
    setSelectedId(id);
    setHasPendingChanges(true);
  };

  const removeFunction = (id: number) => {
    setFunctions((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== id)));
    setHasPendingChanges(true);
  };

  const onWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = ((event.clientX - rect.left) / rect.width) * SIZE.width;
      const py = ((event.clientY - rect.top) / rect.height) * SIZE.height;
      scheduleZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, px, py);
    },
    [scheduleZoom],
  );

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = { x: event.clientX, y: event.clientY };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      const px = ((event.clientX - rect.left) / rect.width) * SIZE.width;
      scheduleTrace(bounds.minX + (px / SIZE.width) * (bounds.maxX - bounds.minX));
    }
    const start = dragging.current;
    if (!start) return;
    const dxPixels = ((event.clientX - start.x) / (rect?.width ?? SIZE.width)) * SIZE.width;
    const dyPixels = ((event.clientY - start.y) / (rect?.height ?? SIZE.height)) * SIZE.height;
    dragging.current = { x: event.clientX, y: event.clientY };
    schedulePan(dxPixels, dyPixels);
  };

  const endDrag = () => {
    dragging.current = null;
  };

  // Keep the analysis range inside the visible window when the view changes.
  useEffect(() => {
    setRangeInput((current) => {
      const span = bounds.maxX - bounds.minX;
      if (current.a >= bounds.minX && current.b <= bounds.maxX) return current;
      return { a: bounds.minX + span * 0.25, b: bounds.minX + span * 0.75 };
    });
  }, [bounds]);

  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  return (
    <div className="stack">
      <section className="card">
        <h2>Functions</h2>
        <ul className="functions">
          {functions.map((entry) => {
            const compiledEntry = compiled.find((item) => item.entry.id === entry.id);
            const hasError = !hasPendingChanges && !compiledEntry?.fn && entry.expression.trim() !== '';
            return (
              <li key={entry.id} className={`functions__row${entry.id === selected?.entry.id ? ' is-selected' : ''}`}>
                <span className="functions__color" style={{ background: entry.color }} aria-hidden="true" />
                <input
                  className="field__input functions__input"
                  value={entry.expression}
                  placeholder="y = x^2"
                  aria-label={`Function ${entry.id}`}
                  spellCheck={false}
                  onChange={(event) => updateFunction(entry.id, { expression: event.target.value })}
                  onFocus={() => setSelectedId(entry.id)}
                />
                {hasError ? (
                  <span className="functions__error" title="This expression cannot be plotted">
                    !
                  </span>
                ) : null}
                <button
                  type="button"
                  className={`btn btn--ghost btn--tiny${entry.visible ? ' is-on' : ''}`}
                  aria-pressed={entry.visible}
                  title={entry.visible ? 'Hide this function' : 'Show this function'}
                  onClick={() => updateFunction(entry.id, { visible: !entry.visible })}
                >
                  {entry.visible ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--tiny"
                  title="Remove this function"
                  disabled={functions.length <= 1}
                  onClick={() => removeFunction(entry.id)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
        <div className="row">
          <button type="button" className="btn btn--primary btn--small" onClick={calculate}>
            Calculate graph
          </button>
          {hasPendingChanges ? (
            <span className="field__hint" role="status">
              Changes waiting — press Calculate
            </span>
          ) : null}
          <button type="button" className="btn btn--small" onClick={addFunction}>
            Add function
          </button>
          <button type="button" className="btn btn--small" onClick={() => setViewport(DEFAULT_VIEWPORT)}>
            Reset view
          </button>
          <label className="field field--check">
            <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
            <span>Grid</span>
          </label>
          <span className="range">
            <span className="range__label">Zoom</span>
            <button type="button" className="btn btn--small" onClick={() => setViewport((v) => zoomAt(v, 2, SIZE.width / 2, SIZE.height / 2, SIZE))}>
              +
            </button>
            <button type="button" className="btn btn--small" onClick={() => setViewport((v) => zoomAt(v, 0.5, SIZE.width / 2, SIZE.height / 2, SIZE))}>
              −
            </button>
          </span>
        </div>
      </section>

      <section className="card">
        <h2>Plot</h2>
        <svg
          ref={svgRef}
          className="plot"
          viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
          role="img"
          aria-label="Graph of the entered functions"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={() => {
            endDrag();
            clearTrace();
          }}
        >
          <rect x="0" y="0" width={SIZE.width} height={SIZE.height} fill="var(--bg-inset)" />
          {showGrid ? (
            <g stroke="var(--border)" strokeWidth="0.5">
              {xTicks.values.map((value) => (
                <line
                  key={`gx-${value}`}
                  x1={worldToScreenX(viewport, value, SIZE)}
                  y1={0}
                  x2={worldToScreenX(viewport, value, SIZE)}
                  y2={SIZE.height}
                />
              ))}
              {yTicks.values.map((value) => (
                <line
                  key={`gy-${value}`}
                  x1={0}
                  y1={worldToScreenY(viewport, value, SIZE)}
                  x2={SIZE.width}
                  y2={worldToScreenY(viewport, value, SIZE)}
                />
              ))}
            </g>
          ) : null}

          <g stroke="var(--text-dim)" strokeWidth="1">
            <line x1={0} y1={worldToScreenY(viewport, 0, SIZE)} x2={SIZE.width} y2={worldToScreenY(viewport, 0, SIZE)} />
            <line x1={worldToScreenX(viewport, 0, SIZE)} y1={0} x2={worldToScreenX(viewport, 0, SIZE)} y2={SIZE.height} />
          </g>

          <g fill="var(--text-dim)" fontSize="10">
            {xTicks.values.map((value) => (
              <text key={`tx-${value}`} x={worldToScreenX(viewport, value, SIZE)} y={Math.min(SIZE.height - 3, Math.max(11, worldToScreenY(viewport, 0, SIZE) + 12))} textAnchor="middle">
                {formatTick(value, xTicks.step)}
              </text>
            ))}
            {yTicks.values.map((value) => (
              <text key={`ty-${value}`} x={Math.min(SIZE.width - 4, Math.max(20, worldToScreenX(viewport, 0, SIZE) - 6))} y={worldToScreenY(viewport, value, SIZE) + 3} textAnchor="end">
                {formatTick(value, yTicks.step)}
              </text>
            ))}
          </g>

          {renderedCurves.map(({ entry, paths }) => (
            <g key={entry.id} stroke={entry.color} fill="none" strokeWidth={entry.id === selected?.entry.id ? 2.2 : 1.5}>
              {paths.map((points, index) => (
                <polyline key={index} points={points} />
              ))}
            </g>
          ))}

          {analysis?.tangent ? (
            <line
              x1={worldToScreenX(viewport, analysis.tangent.line.x1, SIZE)}
              y1={worldToScreenY(viewport, analysis.tangent.line.y1, SIZE)}
              x2={worldToScreenX(viewport, analysis.tangent.line.x2, SIZE)}
              y2={worldToScreenY(viewport, analysis.tangent.line.y2, SIZE)}
              stroke="var(--warn)"
              strokeDasharray="5 4"
              strokeWidth="1.6"
            />
          ) : null}

          {analysis?.roots.map((root) => (
            <circle key={`root-${root}`} cx={worldToScreenX(viewport, root, SIZE)} cy={worldToScreenY(viewport, 0, SIZE)} r="3.5" fill="var(--ok)" />
          ))}
          {analysis?.extrema.map((point) => (
            <circle key={`ext-${point.x}`} cx={worldToScreenX(viewport, point.x, SIZE)} cy={worldToScreenY(viewport, point.y, SIZE)} r="3.5" fill="var(--warn)" />
          ))}
          {intersections.map((point) => (
            <circle key={`int-${point.x}`} cx={worldToScreenX(viewport, point.x, SIZE)} cy={worldToScreenY(viewport, point.y, SIZE)} r="3.5" fill="var(--danger)" />
          ))}
          {traceX !== null && selectedFn ? (
            <TraceMarker fn={selectedFn} x={traceX} viewport={viewport} />
          ) : null}
        </svg>
        <p className="chart-caption">
          Drag to pan, scroll to zoom, move the pointer to trace. Green dots are roots, amber dots are
          extrema, red dots are intersections between curves.
        </p>
      </section>

      <section className="card">
        <h2>Analysis of {selected ? selected.entry.expression : 'the selected function'}</h2>
        {!analysis ? (
          <Notice kind={analysisEnabled && analysisIsCurrent ? 'error' : 'info'}>
            {analysisBusy || !analysisEnabled || !analysisIsCurrent
              ? 'Updating the analysis for this view…'
              : 'No analysable function is selected.'}
          </Notice>
        ) : (
          <OutputList
            rows={[
              { label: 'Roots in view', value: analysis.roots.length ? analysis.roots.map((root) => nf(root)).join(', ') : 'None in this window', emphasize: true },
              {
                label: 'Local extrema in view',
                value: analysis.extrema.length
                  ? analysis.extrema.map((point) => `(${nf(point.x)}, ${nf(point.y)})`).join(', ')
                  : 'None in this window',
              },
              {
                label: 'Intersections with other curves',
                value: intersections.length
                  ? intersections.map((point) => `(${nf(point.x)}, ${nf(point.y)})`).join(', ')
                  : 'None in this window',
              },
              ...(analysis.tangent
                ? [
                    { label: `f(${nf(analysis.tangent.x)})`, value: nf(analysis.tangent.y) },
                    { label: `slope at the trace point`, value: nf(analysis.tangent.slope) },
                  ]
                : []),
            ]}
          />
        )}
        <div className="grid grid--form">
          <label className="field">
            <span className="field__label">Area from</span>
            <input
              className="field__input"
              type="number"
              step="0.1"
              value={rangeInput.a}
              onChange={(event) => {
                setRangeInput((current) => ({ ...current, a: Number(event.target.value) }));
                setHasPendingChanges(true);
              }}
            />
          </label>
          <label className="field">
            <span className="field__label">Area to</span>
            <input
              className="field__input"
              type="number"
              step="0.1"
              value={rangeInput.b}
              onChange={(event) => {
                setRangeInput((current) => ({ ...current, b: Number(event.target.value) }));
                setHasPendingChanges(true);
              }}
            />
          </label>
        </div>
        {area?.state === 'failed' ? (
          <Notice kind="error">{area.message}</Notice>
        ) : area && area.state === 'ok' ? (
          <OutputList
            title={area.kind === 'between' ? 'Area between the two curves' : 'Area under the curve'}
            rows={[
              { label: `∫ from ${nf(area.from)} to ${nf(area.to)}`, value: nf(area.value), emphasize: true },
              { label: 'Estimated error', value: area.error.toExponential(2) },
              { label: 'Converged', value: area.converged ? 'Yes' : 'No — treat this value as approximate' },
            ]}
          />
        ) : null}
      </section>
    </div>
  );
}

function TraceMarker({ fn, x, viewport }: { fn: (x: number) => number; x: number; viewport: Viewport }) {
  let y: number;
  try {
    y = fn(x);
  } catch {
    return null;
  }
  if (!Number.isFinite(y)) return null;
  const px = worldToScreenX(viewport, x, SIZE);
  const py = worldToScreenY(viewport, y, SIZE);
  return (
    <g>
      <circle cx={px} cy={py} r="4" fill="none" stroke="var(--text)" strokeWidth="1.6" />
      <text x={px + 8} y={py - 8} fontSize="11" fill="var(--text)">
        ({Number(x.toPrecision(4))}, {Number(y.toPrecision(4))})
      </text>
    </g>
  );
}