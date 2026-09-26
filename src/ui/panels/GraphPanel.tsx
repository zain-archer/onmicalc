// import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import { compileFunction } from '@/math/calculus';
// import { DEFAULT_VIEWPORT, formatTick, pan, ticksFor, visibleBounds, worldToScreenX, worldToScreenY, zoomAt, type Viewport } from '@/graphing/viewport';
// import { sampleFunction, type Polyline } from '@/graphing/sampling';
// import {
//   areaBetween,
//   areaUnder,
//   findExtrema,
//   findIntersections,
//   findRoots,
//   tangentAt,
// } from '@/graphing/analysis';
// import { errorMessage } from '@/core/errors';
// import { formatNumber } from '@/core/precision/format';
// import { useSettings } from '@/settings/useSettings';
// import { Notice, OutputList } from '@/ui/components/primitives';

// const COLORS = ['#6366f1', '#f97316', '#10b981', '#ec4899', '#0ea5e9', '#eab308'];

// interface FunctionEntry {
//   id: number;
//   expression: string;
//   visible: boolean;
//   color: string;
// }

// const SIZE = { width: 760, height: 460 };

// export function GraphPanel() {
//   const settings = useSettings();
//   const [functions, setFunctions] = useState<FunctionEntry[]>([
//     { id: 1, expression: 'x^2', visible: true, color: COLORS[0]! },
//     { id: 2, expression: 'sin(x)*5', visible: true, color: COLORS[1]! },
//   ]);
//   const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
//   const [showGrid, setShowGrid] = useState(true);
//   const [selectedId, setSelectedId] = useState(1);
//   const [traceX, setTraceX] = useState<number | null>(null);
//   const [rangeInput, setRangeInput] = useState<{ a: number; b: number }>({ a: -3, b: 3 });
//   const svgRef = useRef<SVGSVGElement | null>(null);
//   const dragging = useRef<{ x: number; y: number } | null>(null);

//   const compiled = useMemo(
//     () =>
//       functions.map((entry) => ({
//         entry,
//         fn: entry.visible && entry.expression.trim() ? compileFunction(entry.expression) : null,
//       })),
//     [functions],
//   );

//   const bounds = useMemo(() => visibleBounds(viewport, SIZE), [viewport]);
//   const xTicks = useMemo(() => ticksFor(bounds.minX, bounds.maxX, 12), [bounds]);
//   const yTicks = useMemo(() => ticksFor(bounds.minY, bounds.maxY, 8), [bounds]);

//   const curves: { entry: FunctionEntry; polylines: Polyline[] }[] = useMemo(
//     () =>
//       compiled
//         .filter((item) => item.fn)
//         .map((item) => ({
//           entry: item.entry,
//           polylines: sampleFunction(item.fn!, viewport, SIZE),
//         })),
//     [compiled, viewport],
//   );

//   const selected = curves.find((curve) => curve.entry.id === selectedId) ?? curves[0];
//   const selectedFn = compiled.find((item) => item.entry.id === selected?.entry.id)?.fn ?? null;

//   const analysis = useMemo(() => {
//     if (!selectedFn) return null;
//     try {
//       const roots = findRoots(selectedFn, bounds.minX, bounds.maxX);
//       const extrema = findExtrema(selectedFn, bounds.minX, bounds.maxX);
//       const tangent = traceX === null ? null : tangentAt(selectedFn, traceX, (bounds.maxX - bounds.minX) / 20);
//       return { roots, extrema, tangent };
//     } catch {
//       return null;
//     }
//   }, [selectedFn, bounds, traceX]);

//   const otherFns = compiled.filter((item) => item.fn && item.entry.id !== selected?.entry.id).map((item) => item.fn!);
//   const intersections = useMemo(() => {
//     if (!selectedFn) return [];
//     return otherFns.flatMap((other) => findIntersections(selectedFn, other, bounds.minX, bounds.maxX));
//   }, [selectedFn, otherFns, bounds]);

//   type AreaState =
//     | { state: 'ok'; kind: 'between' | 'under'; from: number; to: number; value: number; error: number; converged: boolean }
//     | { state: 'failed'; message: string }
//     | null;

//   const area = useMemo<AreaState>(() => {
//     if (!selectedFn) return null;
//     try {
//       const kind = otherFns[0] ? ('between' as const) : ('under' as const);
//       const result = otherFns[0]
//         ? areaBetween(selectedFn, otherFns[0], rangeInput.a, rangeInput.b)
//         : areaUnder(selectedFn, rangeInput.a, rangeInput.b);
//       return { state: 'ok', kind, from: rangeInput.a, to: rangeInput.b, ...result };
//     } catch (err) {
//       return { state: 'failed', message: errorMessage(err) };
//     }
//   }, [selectedFn, otherFns, rangeInput]);

//   const updateFunction = (id: number, patch: Partial<FunctionEntry>) => {
//     setFunctions((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
//   };

//   const addFunction = () => {
//     const id = Math.max(0, ...functions.map((entry) => entry.id)) + 1;
//     setFunctions((current) => [
//       ...current,
//       { id, expression: '', visible: true, color: COLORS[current.length % COLORS.length]! },
//     ]);
//     setSelectedId(id);
//   };

//   const removeFunction = (id: number) => {
//     setFunctions((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== id)));
//   };

//   const onWheel = useCallback(
//     (event: React.WheelEvent<SVGSVGElement>) => {
//       event.preventDefault();
//       const rect = svgRef.current?.getBoundingClientRect();
//       if (!rect) return;
//       const px = ((event.clientX - rect.left) / rect.width) * SIZE.width;
//       const py = ((event.clientY - rect.top) / rect.height) * SIZE.height;
//       setViewport((current) => zoomAt(current, event.deltaY < 0 ? 1.15 : 1 / 1.15, px, py, SIZE));
//     },
//     [],
//   );

//   const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
//     dragging.current = { x: event.clientX, y: event.clientY };
//     (event.target as Element).setPointerCapture?.(event.pointerId);
//   };

//   const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
//     const rect = svgRef.current?.getBoundingClientRect();
//     if (rect) {
//       const px = ((event.clientX - rect.left) / rect.width) * SIZE.width;
//       const py = ((event.clientY - rect.top) / rect.height) * SIZE.height;
//       setTraceX(bounds.minX + (px / SIZE.width) * (bounds.maxX - bounds.minX));
//       void py;
//     }
//     const start = dragging.current;
//     if (!start) return;
//     const dxPixels = ((event.clientX - start.x) / (rect?.width ?? SIZE.width)) * SIZE.width;
//     const dyPixels = ((event.clientY - start.y) / (rect?.height ?? SIZE.height)) * SIZE.height;
//     dragging.current = { x: event.clientX, y: event.clientY };
//     setViewport((current) => pan(current, dxPixels, dyPixels));
//   };

//   const endDrag = () => {
//     dragging.current = null;
//   };

//   // Keep the analysis range inside the visible window when the view changes.
//   useEffect(() => {
//     setRangeInput((current) => {
//       const span = bounds.maxX - bounds.minX;
//       if (current.a >= bounds.minX && current.b <= bounds.maxX) return current;
//       return { a: bounds.minX + span * 0.25, b: bounds.minX + span * 0.75 };
//     });
//   }, [bounds]);

//   const precision = settings.precision;
//   const nf = (value: number) => formatNumber(value, { precision });

//   return (
//     <div className="stack">
//       <section className="card">
//         <h2>Functions</h2>
//         <ul className="functions">
//           {functions.map((entry) => (
//             <li key={entry.id} className={`functions__row${entry.id === selected?.entry.id ? ' is-selected' : ''}`}>
//               <span className="functions__color" style={{ background: entry.color }} aria-hidden="true" />
//                 <input
//                   className="field__input functions__input"
//                   value={entry.expression}
//                   placeholder="y = x^2"
//                   aria-label={`Function ${entry.id}`}
//                   spellCheck={false}
//                   onChange={(event) => updateFunction(entry.id, { expression: event.target.value })}
//                   onFocus={() => setSelectedId(entry.id)}
//                 />
//               {compileFunction(entry.expression) || entry.expression.trim() === '' ? null : (
//                 <span className="functions__error" title="This expression cannot be plotted">
//                   !
//                 </span>
//               )}
//               <button
//                 type="button"
//                 className={`btn btn--ghost btn--tiny${entry.visible ? ' is-on' : ''}`}
//                 aria-pressed={entry.visible}
//                 title={entry.visible ? 'Hide this function' : 'Show this function'}
//                 onClick={() => updateFunction(entry.id, { visible: !entry.visible })}
//               >
//                 {entry.visible ? 'Hide' : 'Show'}
//               </button>
//               <button
//                 type="button"
//                 className="btn btn--ghost btn--tiny"
//                 title="Remove this function"
//                 disabled={functions.length <= 1}
//                 onClick={() => removeFunction(entry.id)}
//               >
//                 ✕
//               </button>
//             </li>
//           ))}
//         </ul>
//         <div className="row">
//           <button type="button" className="btn btn--small" onClick={addFunction}>
//             Add function
//           </button>
//           <button type="button" className="btn btn--small" onClick={() => setViewport(DEFAULT_VIEWPORT)}>
//             Reset view
//           </button>
//           <label className="field field--check">
//             <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
//             <span>Grid</span>
//           </label>
//           <span className="range">
//             <span className="range__label">Zoom</span>
//             <button type="button" className="btn btn--small" onClick={() => setViewport((v) => zoomAt(v, 2, SIZE.width / 2, SIZE.height / 2, SIZE))}>
//               +
//             </button>
//             <button type="button" className="btn btn--small" onClick={() => setViewport((v) => zoomAt(v, 0.5, SIZE.width / 2, SIZE.height / 2, SIZE))}>
//               −
//             </button>
//           </span>
//         </div>
//       </section>

//       <section className="card">
//         <h2>Plot</h2>
//         <svg
//           ref={svgRef}
//           className="plot"
//           viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
//           role="img"
//           aria-label="Graph of the entered functions"
//           onWheel={onWheel}
//           onPointerDown={onPointerDown}
//           onPointerMove={onPointerMove}
//           onPointerUp={endDrag}
//           onPointerLeave={() => {
//             endDrag();
//             setTraceX(null);
//           }}
//         >
//           <rect x="0" y="0" width={SIZE.width} height={SIZE.height} fill="var(--bg-inset)" />
//           {showGrid ? (
//             <g stroke="var(--border)" strokeWidth="0.5">
//               {xTicks.values.map((value) => (
//                 <line
//                   key={`gx-${value}`}
//                   x1={worldToScreenX(viewport, value, SIZE)}
//                   y1={0}
//                   x2={worldToScreenX(viewport, value, SIZE)}
//                   y2={SIZE.height}
//                 />
//               ))}
//               {yTicks.values.map((value) => (
//                 <line
//                   key={`gy-${value}`}
//                   x1={0}
//                   y1={worldToScreenY(viewport, value, SIZE)}
//                   x2={SIZE.width}
//                   y2={worldToScreenY(viewport, value, SIZE)}
//                 />
//               ))}
//             </g>
//           ) : null}

//           <g stroke="var(--text-dim)" strokeWidth="1">
//             <line x1={0} y1={worldToScreenY(viewport, 0, SIZE)} x2={SIZE.width} y2={worldToScreenY(viewport, 0, SIZE)} />
//             <line x1={worldToScreenX(viewport, 0, SIZE)} y1={0} x2={worldToScreenX(viewport, 0, SIZE)} y2={SIZE.height} />
//           </g>

//           <g fill="var(--text-dim)" fontSize="10">
//             {xTicks.values.map((value) => (
//               <text key={`tx-${value}`} x={worldToScreenX(viewport, value, SIZE)} y={Math.min(SIZE.height - 3, Math.max(11, worldToScreenY(viewport, 0, SIZE) + 12))} textAnchor="middle">
//                 {formatTick(value, xTicks.step)}
//               </text>
//             ))}
//             {yTicks.values.map((value) => (
//               <text key={`ty-${value}`} x={Math.min(SIZE.width - 4, Math.max(20, worldToScreenX(viewport, 0, SIZE) - 6))} y={worldToScreenY(viewport, value, SIZE) + 3} textAnchor="end">
//                 {formatTick(value, yTicks.step)}
//               </text>
//             ))}
//           </g>

//           {curves.map(({ entry, polylines }) => (
//             <g key={entry.id} stroke={entry.color} fill="none" strokeWidth={entry.id === selected?.entry.id ? 2.2 : 1.5}>
//               {polylines.map((line, index) => (
//                 <polyline
//                   key={index}
//                   points={line.points
//                     .map((point) => `${worldToScreenX(viewport, point.x, SIZE).toFixed(2)},${worldToScreenY(viewport, point.y, SIZE).toFixed(2)}`)
//                     .join(' ')}
//                 />
//               ))}
//             </g>
//           ))}

//           {analysis?.tangent ? (
//             <line
//               x1={worldToScreenX(viewport, analysis.tangent.line.x1, SIZE)}
//               y1={worldToScreenY(viewport, analysis.tangent.line.y1, SIZE)}
//               x2={worldToScreenX(viewport, analysis.tangent.line.x2, SIZE)}
//               y2={worldToScreenY(viewport, analysis.tangent.line.y2, SIZE)}
//               stroke="var(--warn)"
//               strokeDasharray="5 4"
//               strokeWidth="1.6"
//             />
//           ) : null}

//           {analysis?.roots.map((root) => (
//             <circle key={`root-${root}`} cx={worldToScreenX(viewport, root, SIZE)} cy={worldToScreenY(viewport, 0, SIZE)} r="3.5" fill="var(--ok)" />
//           ))}
//           {analysis?.extrema.map((point) => (
//             <circle key={`ext-${point.x}`} cx={worldToScreenX(viewport, point.x, SIZE)} cy={worldToScreenY(viewport, point.y, SIZE)} r="3.5" fill="var(--warn)" />
//           ))}
//           {intersections.map((point) => (
//             <circle key={`int-${point.x}`} cx={worldToScreenX(viewport, point.x, SIZE)} cy={worldToScreenY(viewport, point.y, SIZE)} r="3.5" fill="var(--danger)" />
//           ))}
//           {traceX !== null && selectedFn ? (
//             <TraceMarker fn={selectedFn} x={traceX} viewport={viewport} />
//           ) : null}
//         </svg>
//         <p className="chart-caption">
//           Drag to pan, scroll to zoom, move the pointer to trace. Green dots are roots, amber dots are
//           extrema, red dots are intersections between curves.
//         </p>
//       </section>

//       <section className="card">
//         <h2>Analysis of {selected ? selected.entry.expression : 'the selected function'}</h2>
//         {!analysis ? (
//           <Notice kind="error">No analysable function is selected.</Notice>
//         ) : (
//           <OutputList
//             rows={[
//               { label: 'Roots in view', value: analysis.roots.length ? analysis.roots.map((root) => nf(root)).join(', ') : 'None in this window', emphasize: true },
//               {
//                 label: 'Local extrema in view',
//                 value: analysis.extrema.length
//                   ? analysis.extrema.map((point) => `(${nf(point.x)}, ${nf(point.y)})`).join(', ')
//                   : 'None in this window',
//               },
//               {
//                 label: 'Intersections with other curves',
//                 value: intersections.length
//                   ? intersections.map((point) => `(${nf(point.x)}, ${nf(point.y)})`).join(', ')
//                   : 'None in this window',
//               },
//               ...(analysis.tangent
//                 ? [
//                     { label: `f(${nf(analysis.tangent.x)})`, value: nf(analysis.tangent.y) },
//                     { label: `slope at the trace point`, value: nf(analysis.tangent.slope) },
//                   ]
//                 : []),
//             ]}
//           />
//         )}
//         <div className="grid grid--form">
//           <label className="field">
//             <span className="field__label">Area from</span>
//             <input
//               className="field__input"
//               type="number"
//               step="0.1"
//               value={rangeInput.a}
//               onChange={(event) => setRangeInput((current) => ({ ...current, a: Number(event.target.value) }))}
//             />
//           </label>
//           <label className="field">
//             <span className="field__label">Area to</span>
//             <input
//               className="field__input"
//               type="number"
//               step="0.1"
//               value={rangeInput.b}
//               onChange={(event) => setRangeInput((current) => ({ ...current, b: Number(event.target.value) }))}
//             />
//           </label>
//         </div>
//         {area?.state === 'failed' ? (
//           <Notice kind="error">{area.message}</Notice>
//         ) : area && area.state === 'ok' ? (
//           <OutputList
//             title={area.kind === 'between' ? 'Area between the two curves' : 'Area under the curve'}
//             rows={[
//               { label: `∫ from ${nf(area.from)} to ${nf(area.to)}`, value: nf(area.value), emphasize: true },
//               { label: 'Estimated error', value: area.error.toExponential(2) },
//               { label: 'Converged', value: area.converged ? 'Yes' : 'No — treat this value as approximate' },
//             ]}
//           />
//         ) : null}
//       </section>
//     </div>
//   );
// }

// function TraceMarker({ fn, x, viewport }: { fn: (x: number) => number; x: number; viewport: Viewport }) {
//   let y: number;
//   try {
//     y = fn(x);
//   } catch {
//     return null;
//   }
//   if (!Number.isFinite(y)) return null;
//   const px = worldToScreenX(viewport, x, SIZE);
//   const py = worldToScreenY(viewport, y, SIZE);
//   return (
//     <g>
//       <circle cx={px} cy={py} r="4" fill="none" stroke="var(--text)" strokeWidth="1.6" />
//       <text x={px + 8} y={py - 8} fontSize="11" fill="var(--text)">
//         ({Number(x.toPrecision(4))}, {Number(y.toPrecision(4))})
//       </text>
//     </g>
//   );
// }


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function GraphPanel() {
  const settings = useSettings();
  const [functions, setFunctions] = useState<FunctionEntry[]>([
    { id: 1, expression: 'x^2', visible: true, color: COLORS[0]! },
    { id: 2, expression: 'sin(x)*5', visible: true, color: COLORS[1]! },
  ]);
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedId, setSelectedId] = useState(1);
  const [traceX, setTraceX] = useState<number | null>(null);
  const [rangeInput, setRangeInput] = useState<{ a: number; b: number }>({ a: -3, b: 3 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Typing updates `functions` instantly (so the input never lags).
  // The expensive pipeline below reads from the debounced copy instead,
  // so parsing/sampling/analysis only re-run ~150ms after you stop typing.
  const debouncedFunctions = useDebouncedValue(functions, 150);

  const compiled = useMemo(
    () =>
      debouncedFunctions.map((entry) => ({
        entry,
        fn: entry.visible && entry.expression.trim() ? compileFunction(entry.expression) : null,
      })),
    [debouncedFunctions],
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

  const analysis = useMemo(() => {
    if (!selectedFn) return null;
    try {
      const roots = findRoots(selectedFn, bounds.minX, bounds.maxX);
      const extrema = findExtrema(selectedFn, bounds.minX, bounds.maxX);
      const tangent = traceX === null ? null : tangentAt(selectedFn, traceX, (bounds.maxX - bounds.minX) / 20);
      return { roots, extrema, tangent };
    } catch {
      return null;
    }
  }, [selectedFn, bounds, traceX]);

  const otherFns = useMemo(
    () =>
      compiled
        .filter((item) => item.fn && item.entry.id !== selected?.entry.id)
        .map((item) => item.fn!),
    [compiled, selected],
  );

  const intersections = useMemo(() => {
    if (!selectedFn) return [];
    return otherFns.flatMap((other) => findIntersections(selectedFn, other, bounds.minX, bounds.maxX));
  }, [selectedFn, otherFns, bounds]);

  type AreaState =
    | { state: 'ok'; kind: 'between' | 'under'; from: number; to: number; value: number; error: number; converged: boolean }
    | { state: 'failed'; message: string }
    | null;

  const area = useMemo<AreaState>(() => {
    if (!selectedFn) return null;
    try {
      const kind = otherFns[0] ? ('between' as const) : ('under' as const);
      const result = otherFns[0]
        ? areaBetween(selectedFn, otherFns[0], rangeInput.a, rangeInput.b)
        : areaUnder(selectedFn, rangeInput.a, rangeInput.b);
      return { state: 'ok', kind, from: rangeInput.a, to: rangeInput.b, ...result };
    } catch (err) {
      return { state: 'failed', message: errorMessage(err) };
    }
  }, [selectedFn, otherFns, rangeInput]);

  const updateFunction = (id: number, patch: Partial<FunctionEntry>) => {
    setFunctions((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const addFunction = () => {
    const id = Math.max(0, ...functions.map((entry) => entry.id)) + 1;
    setFunctions((current) => [
      ...current,
      { id, expression: '', visible: true, color: COLORS[current.length % COLORS.length]! },
    ]);
    setSelectedId(id);
  };

  const removeFunction = (id: number) => {
    setFunctions((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== id)));
  };

  const onWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = ((event.clientX - rect.left) / rect.width) * SIZE.width;
      const py = ((event.clientY - rect.top) / rect.height) * SIZE.height;
      setViewport((current) => zoomAt(current, event.deltaY < 0 ? 1.15 : 1 / 1.15, px, py, SIZE));
    },
    [],
  );

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragging.current = { x: event.clientX, y: event.clientY };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const px = ((event.clientX - rect.left) / rect.width) * SIZE.width;
      const py = ((event.clientY - rect.top) / rect.height) * SIZE.height;
      setTraceX(bounds.minX + (px / SIZE.width) * (bounds.maxX - bounds.minX));
      void py;
    }
    const start = dragging.current;
    if (!start) return;
    const dxPixels = ((event.clientX - start.x) / (rect?.width ?? SIZE.width)) * SIZE.width;
    const dyPixels = ((event.clientY - start.y) / (rect?.height ?? SIZE.height)) * SIZE.height;
    dragging.current = { x: event.clientX, y: event.clientY };
    setViewport((current) => pan(current, dxPixels, dyPixels));
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
            const hasError = !compiledEntry?.fn && entry.expression.trim() !== '';
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
            setTraceX(null);
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
          <Notice kind="error">No analysable function is selected.</Notice>
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
              onChange={(event) => setRangeInput((current) => ({ ...current, a: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Area to</span>
            <input
              className="field__input"
              type="number"
              step="0.1"
              value={rangeInput.b}
              onChange={(event) => setRangeInput((current) => ({ ...current, b: Number(event.target.value) }))}
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