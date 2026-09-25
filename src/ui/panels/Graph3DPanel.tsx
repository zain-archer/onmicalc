import { useMemo, useState } from 'react';
import { compileFunctionOf } from '@/math/calculus';
import {
  DEFAULT_VIEW_3D,
  meanDepth,
  project,
  sampleSurface,
  surfaceQuads,
  surfaceWireframe,
  type SurfaceGrid,
  type Vec3,
  type View3D,
} from '@/graphing/threeD';
import { curl, divergence, streamlines, vectorField } from '@/graphing/fields';
import {
  colorRamp,
  contourLines,
  heatmapCells,
  PALETTE_NAMES,
  type PaletteName,
} from '@/graphing/implicit';
import { formatNumber } from '@/core/precision/format';
import { errorMessage } from '@/core/errors';
import { useSettings } from '@/settings/useSettings';
import { Notice, NumberField, OutputList, SelectField, Tabs, TextField } from '@/ui/components/primitives';

const SIZE = { width: 760, height: 460 };

type Mode = 'surface' | 'field' | 'contour';

const MODES = [
  { id: 'surface', label: '3D surface' },
  { id: 'field', label: 'Vector field' },
  { id: 'contour', label: 'Contour & heat map' },
] as const;

export function Graph3DPanel() {
  const settings = useSettings();
  const [mode, setMode] = useState<Mode>('surface');
  const [surfaceExpression, setSurfaceExpression] = useState('sin(sqrt(x^2+y^2))');
  const [fieldXExpression, setFieldXExpression] = useState('-y');
  const [fieldYExpression, setFieldYExpression] = useState('x');
  const [contourExpression, setContourExpression] = useState('sin(x)*cos(y)');
  const [steps, setSteps] = useState(28);
  const [contourSteps, setContourSteps] = useState(60);
  const [levelCount, setLevelCount] = useState(9);
  const [palette, setPalette] = useState<PaletteName>('spectral');
  const [xMin, setXMin] = useState(-4);
  const [xMax, setXMax] = useState(4);
  const [yMin, setYMin] = useState(-4);
  const [yMax, setYMax] = useState(4);
  const [solid, setSolid] = useState(false);
  const [showStreamlines, setShowStreamlines] = useState(true);
  const [showHeat, setShowHeat] = useState(true);
  const [yawDegrees, setYawDegrees] = useState(Math.round((DEFAULT_VIEW_3D.yaw * 180) / Math.PI));
  const [pitchDegrees, setPitchDegrees] = useState(Math.round((DEFAULT_VIEW_3D.pitch * 180) / Math.PI));
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const bounds = { xMin, xMax, yMin, yMax };
  const spanX = Math.max(1e-9, xMax - xMin);
  const spanY = Math.max(1e-9, yMax - yMin);
  const precision = settings.precision;
  const nf = (value: number) => formatNumber(value, { precision });

  const view: View3D = useMemo(() => {
    const scale = Math.min(SIZE.width / (spanX * 1.5), SIZE.height / (spanY * 1.6));
    return {
      yaw: (yawDegrees * Math.PI) / 180,
      pitch: (pitchDegrees * Math.PI) / 180,
      scale,
      originU: SIZE.width / 2,
      originV: SIZE.height / 2,
      distance: 0,
    };
  }, [yawDegrees, pitchDegrees, spanX, spanY]);

  /* ------------------------------- surface ------------------------------- */
  const surface = useMemo(() => {
    if (mode !== 'surface') return null;
    const f = compileFunctionOf(surfaceExpression, ['x', 'y']);
    if (!f) return { error: `“${surfaceExpression}” could not be read as an expression of x and y.` };
    try {
      const grid = sampleSurface((x, y) => f({ x, y }), { ...bounds, steps });
      // Keep the drawing inside the box: scale z so the tallest point fits.
      const zSpan = Math.max(1e-9, grid.maxZ - grid.minZ);
      const zScale = (Math.min(spanX, spanY) / zSpan) * 0.55;
      return { grid, zScale, f };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }, [mode, surfaceExpression, steps, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax, spanX, spanY]);

  const surfaceScene = useMemo(() => {
    if (!surface || !('grid' in surface) || !surface.grid) return null;
    const { grid, zScale } = surface;
    const scaled: SurfaceGrid = {
      ...grid,
      zs: grid.zs.map((row) => row.map((z) => (z === null ? null : z * zScale))),
      minZ: grid.minZ * zScale,
      maxZ: grid.maxZ * zScale,
    };
    const zSpan = Math.max(1e-12, scaled.maxZ - scaled.minZ);
    const lines = surfaceWireframe(scaled).map((line) => ({
      points: line.points,
      depth: meanDepth(line.points, view),
    }));
    lines.sort((a, b) => a.depth - b.depth);
    const minDepth = lines.length ? lines[0]!.depth : 0;
    const maxDepth = lines.length ? lines[lines.length - 1]!.depth : 1;
    const quads = solid
      ? surfaceQuads(scaled, view)
          .sort((a, b) => a.depth - b.depth)
          .map((quad) => {
            const zs = quad.corners.map((corner) => corner.z);
            const average = zs.reduce((sum, value) => sum + value, 0) / zs.length;
            const fill = colorRamp((average - scaled.minZ) / zSpan, palette);
            const closest = Math.max(...zs.map(() => quad.depth));
            return { ...quad, fill, opacity: 0.35 + 0.55 * quad.shade, depth: closest };
          })
      : [];
    const axes: { from: Vec3; to: Vec3; label: string }[] = [
      { from: { x: xMin, y: 0, z: 0 }, to: { x: xMax, y: 0, z: 0 }, label: 'x' },
      { from: { x: 0, y: yMin, z: 0 }, to: { x: 0, y: yMax, z: 0 }, label: 'y' },
      { from: { x: 0, y: 0, z: scaled.minZ }, to: { x: 0, y: 0, z: scaled.maxZ }, label: 'z' },
    ];
    return { scaled, lines, quads, axes, zSpan, minDepth, maxDepth };
  }, [surface, view, solid, palette, xMin, xMax, yMin, yMax]);

  /* --------------------------------- field -------------------------------- */
  const field = useMemo(() => {
    if (mode !== 'field') return null;
    const fx = compileFunctionOf(fieldXExpression, ['x', 'y']);
    const fy = compileFunctionOf(fieldYExpression, ['x', 'y']);
    if (!fx || !fy) {
      return { error: 'Both field components must be expressions of x and y.' };
    }
    try {
      const sample = (x: number, y: number) => fx({ x, y });
      const sampleY = (x: number, y: number) => fy({ x, y });
      const result = vectorField(sample, sampleY, { ...bounds, steps: 14 });
      const lines = showStreamlines
        ? streamlines(sample, sampleY, { ...bounds, seeds: 12, maxSteps: 900 })
        : [];
      const centreX = (xMin + xMax) / 2;
      const centreY = (yMin + yMax) / 2;
      const measures = {
        divergence: divergence(sample, sampleY, centreX, centreY),
        curl: curl(sample, sampleY, centreX, centreY),
        maxMagnitude: result.maxMagnitude,
        zeros: result.zeros,
      };
      return { result, lines, measures, centreX, centreY };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }, [mode, fieldXExpression, fieldYExpression, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax, showStreamlines, xMin, xMax, yMin, yMax]);

  /* -------------------------------- contour ------------------------------- */
  const contour = useMemo(() => {
    if (mode !== 'contour') return null;
    const f = compileFunctionOf(contourExpression, ['x', 'y']);
    if (!f) return { error: `“${contourExpression}” could not be read as an expression of x and y.` };
    try {
      const { grid, sets } = contourLines((x, y) => f({ x, y }), {
        ...bounds,
        steps: contourSteps,
        count: levelCount,
      });
      const cells = showHeat ? heatmapCells(grid, { palette }) : [];
      return { grid, sets, cells };
    } catch (err) {
      return { error: errorMessage(err) };
    }
  }, [mode, contourExpression, contourSteps, levelCount, palette, showHeat, bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax]);

  /** Straight-down view: world x to the right, world y up. */
  const plan: View3D = useMemo(
    () => ({
      yaw: 0,
      pitch: Math.PI / 2,
      scale: Math.min(SIZE.width / (spanX * 1.08), SIZE.height / (spanY * 1.08)),
      originU: SIZE.width / 2,
      originV: SIZE.height / 2,
      distance: 0,
    }),
    [spanX, spanY],
  );

  const toScreen = (point: Vec3, target: View3D) => {
    const { u, v } = project(point, target);
    return { x: u, y: v };
  };

  const path = (points: Vec3[], target: View3D) =>
    points.map((point) => { const p = toScreen(point, target); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; }).join(' ');

  const error = (surface && 'error' in surface ? surface.error : null) ??
    (field && 'error' in field ? field.error : null) ??
    (contour && 'error' in contour ? contour.error : null);

  const rows = useMemo(() => {
    if (surfaceScene && surface && 'grid' in surface && surface.grid) {
      const grid = surface.grid;
      return [
        { label: 'Grid', value: `${grid.steps + 1} × ${grid.steps + 1} samples` },
        { label: 'Minimum z', value: nf(grid.minZ) },
        { label: 'Maximum z', value: nf(grid.maxZ) },
        { label: 'View angle', value: `${yawDegrees}° / ${pitchDegrees}°` },
      ];
    }
    if (field && 'measures' in field && field.measures) {
      const { measures } = field;
      return [
        { label: 'Largest field strength', value: nf(measures.maxMagnitude) },
        { label: 'Stagnation points found', value: String(measures.zeros.length) },
        {
          label: `Divergence at (${nf(field.centreX)}, ${nf(field.centreY)})`,
          value: nf(measures.divergence),
        },
        {
          label: `Curl at (${nf(field.centreX)}, ${nf(field.centreY)})`,
          value: nf(measures.curl),
        },
      ];
    }
    if (contour && 'grid' in contour && contour.grid) {
      return [
        { label: 'Contour levels', value: String(contour.sets.length) },
        { label: 'Lowest value', value: nf(contour.grid.min) },
        { label: 'Highest value', value: nf(contour.grid.max) },
        {
          label: 'Level spacing',
          value: contour.sets.length > 1 ? nf(contour.sets[1]!.level - contour.sets[0]!.level) : '—',
        },
      ];
    }
    return [];
  }, [surfaceScene, surface, field, contour, nf, yawDegrees, pitchDegrees]);

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== 'surface' || !drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setDrag({ x: event.clientX, y: event.clientY });
    setYawDegrees((current) => round1(current + dx * 0.5));
    setPitchDegrees((current) => clampPitch(round1(current - dy * 0.4)));
  };

  return (
    <div className="stack">
      <section className="card">
        <Tabs tabs={MODES} value={mode} onChange={(id) => setMode(id as Mode)} label="Graph type" />
        <div className="grid grid--form">
          {mode === 'surface' ? (
            <TextField
              label="Surface z = f(x, y)"
              value={surfaceExpression}
              onChange={setSurfaceExpression}
              placeholder="x^2 - y^2"
              hint="Any expression in x and y: sin, sqrt, abs, exp, log, ^ …"
            />
          ) : null}
          {mode === 'field' ? (
            <>
              <TextField
                label="Field x-component F₁(x, y)"
                value={fieldXExpression}
                onChange={setFieldXExpression}
                placeholder="-y"
              />
              <TextField
                label="Field y-component F₂(x, y)"
                value={fieldYExpression}
                onChange={setFieldYExpression}
                placeholder="x"
              />
            </>
          ) : null}
          {mode === 'contour' ? (
            <TextField
              label="Height field z = f(x, y)"
              value={contourExpression}
              onChange={setContourExpression}
              placeholder="x^2 + y^2"
              hint="Contour lines join points of equal height; colours show the same values."
            />
          ) : null}
          <NumberField label="x from" value={xMin} onChange={(value) => setXMin(value === '' ? 0 : value)} />
          <NumberField label="x to" value={xMax} onChange={(value) => setXMax(value === '' ? 1 : value)} />
          <NumberField label="y from" value={yMin} onChange={(value) => setYMin(value === '' ? 0 : value)} />
          <NumberField label="y to" value={yMax} onChange={(value) => setYMax(value === '' ? 1 : value)} />
          <NumberField
            label={mode === 'contour' ? 'Contour resolution' : 'Grid resolution'}
            value={mode === 'contour' ? contourSteps : steps}
            onChange={(value) => {
              const next = value === '' ? 20 : Math.max(4, Math.min(120, Math.round(value)));
              if (mode === 'contour') setContourSteps(next);
              else setSteps(next);
            }}
            min={4}
            max={120}
            hint="More samples means a finer picture and more work."
          />
          {mode === 'contour' ? (
            <NumberField
              label="Number of contour lines"
              value={levelCount}
              onChange={(value) => setLevelCount(value === '' ? 8 : Math.max(2, Math.min(30, Math.round(value))))}
              min={2}
              max={30}
            />
          ) : null}
          <SelectField
            label="Colour palette"
            value={palette}
            onChange={(value) => setPalette(value as PaletteName)}
            options={PALETTE_NAMES.map((name) => ({ value: name, label: name }))}
          />
          {mode === 'surface' ? (
            <>
              <NumberField label="Rotation (yaw)" unit="°" value={yawDegrees} onChange={(value) => setYawDegrees(value === '' ? -34 : value)} />
              <NumberField label="Tilt (pitch)" unit="°" value={pitchDegrees} onChange={(value) => setPitchDegrees(value === '' ? 29 : clampPitch(value))} />
            </>
          ) : null}
        </div>
        <div className="row">
          {mode === 'surface' ? (
            <label className="field field--check">
              <input type="checkbox" checked={solid} onChange={(event) => setSolid(event.target.checked)} />
              <span>Shaded surface (slower)</span>
            </label>
          ) : null}
          {mode === 'field' ? (
            <label className="field field--check">
              <input
                type="checkbox"
                checked={showStreamlines}
                onChange={(event) => setShowStreamlines(event.target.checked)}
              />
              <span>Show streamlines</span>
            </label>
          ) : null}
          {mode === 'contour' ? (
            <label className="field field--check">
              <input type="checkbox" checked={showHeat} onChange={(event) => setShowHeat(event.target.checked)} />
              <span>Show heat map</span>
            </label>
          ) : null}
          {mode === 'surface' ? (
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                setYawDegrees(Math.round((DEFAULT_VIEW_3D.yaw * 180) / Math.PI));
                setPitchDegrees(Math.round((DEFAULT_VIEW_3D.pitch * 180) / Math.PI));
              }}
            >
              Reset view
            </button>
          ) : null}
        </div>
        {mode === 'surface' ? (
          <p className="field__hint">Drag inside the plot to rotate, or type the angles above.</p>
        ) : null}
      </section>

      <section className="card">
        <h2>Plot</h2>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <svg
          className="plot"
          viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
          role="img"
          aria-label={
            mode === 'surface'
              ? 'Surface plot of z against x and y'
              : mode === 'field'
                ? 'Vector field with streamlines'
                : 'Contour plot with heat map'
          }
          onPointerDown={mode === 'surface' ? (event) => setDrag({ x: event.clientX, y: event.clientY }) : undefined}
          onPointerMove={onPointerMove}
          onPointerUp={mode === 'surface' ? () => setDrag(null) : undefined}
          onPointerLeave={mode === 'surface' ? () => setDrag(null) : undefined}
        >
          {mode === 'surface' && surfaceScene
            ? surfaceScene.quads.map((quad, index) => (
                <polygon
                  key={`q${index}`}
                  points={path(quad.corners, view)}
                  fill={quad.fill}
                  fillOpacity={quad.opacity}
                  stroke="none"
                />
              ))
            : null}
          {mode === 'surface' && surfaceScene
            ? surfaceScene.lines.map((line, index) => (
                <polyline
                  key={`l${index}`}
                  points={path(line.points, view)}
                  fill="none"
                  stroke={colorRamp(
                    (line.depth - surfaceScene.minDepth) /
                      Math.max(1e-9, surfaceScene.maxDepth - surfaceScene.minDepth),
                    palette,
                  )}
                  strokeWidth={1}
                  strokeOpacity={0.9}
                />
              ))
            : null}
          {mode === 'surface' && surfaceScene
            ? surfaceScene.axes.map((axis) => (
                <line
                  key={axis.label}
                  x1={toScreen(axis.from, view).x}
                  y1={toScreen(axis.from, view).y}
                  x2={toScreen(axis.to, view).x}
                  y2={toScreen(axis.to, view).y}
                  stroke="var(--text-dim)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              ))
            : null}
          {mode === 'surface' && surfaceScene
            ? surfaceScene.axes.map((axis) => {
                const end = toScreen(axis.to, view);
                return (
                  <text key={`t${axis.label}`} x={end.x + 6} y={end.y - 4} fill="var(--text-dim)" fontSize={12}>
                    {axis.label}
                  </text>
                );
              })
            : null}

          {mode === 'field' && field && 'result' in field && field.result
            ? field.lines.map((line, index) => (
                <polyline
                  key={`s${index}`}
                  points={path(
                    line.points.map((point) => ({ x: point.x, y: point.y, z: 0 })),
                    plan,
                  )}
                  fill="none"
                  stroke="var(--accent)"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              ))
            : null}
          {mode === 'field' && field && 'result' in field && field.result
            ? field.result.arrows.map((arrow, index) => {
                const start = toScreen({ x: arrow.x, y: arrow.y, z: 0 }, plan);
                const end = toScreen({ x: arrow.x + arrow.dx, y: arrow.y + arrow.dy, z: 0 }, plan);
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const length = Math.hypot(dx, dy);
                if (length < 0.5) return null;
                const ux = dx / length;
                const uy = dy / length;
                const head = 0.3 * length;
                const strong = arrow.magnitude / Math.max(1e-9, field.result!.maxMagnitude);
                return (
                  <g key={`a${index}`} stroke={colorRamp(strong, palette)} fill={colorRamp(strong, palette)}>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} strokeWidth={1.3} />
                    <polygon
                      points={`${end.x},${end.y} ${end.x - ux * head - uy * head * 0.4},${end.y - uy * head + ux * head * 0.4} ${end.x - ux * head + uy * head * 0.4},${end.y - uy * head - ux * head * 0.4}`}
                      stroke="none"
                    />
                  </g>
                );
              })
            : null}
          {mode === 'field' && field && 'result' in field && field.result
            ? field.result.zeros.map((zero, index) => {
                const point = toScreen({ x: zero.x, y: zero.y, z: 0 }, plan);
                return (
                  <circle key={`z${index}`} cx={point.x} cy={point.y} r={4} fill="none" stroke="var(--warn)" strokeWidth={1.5} />
                );
              })
            : null}

          {mode === 'contour' && contour && 'grid' in contour && contour.grid
            ? contour.cells.map((cell, index) => {
                const corner = toScreen({ x: cell.x, y: cell.y, z: 0 }, plan);
                const opposite = toScreen({ x: cell.x + cell.width, y: cell.y + cell.height, z: 0 }, plan);
                return (
                  <rect
                    key={`h${index}`}
                    x={Math.min(corner.x, opposite.x)}
                    y={Math.min(corner.y, opposite.y)}
                    width={Math.abs(opposite.x - corner.x) + 0.5}
                    height={Math.abs(opposite.y - corner.y) + 0.5}
                    fill={cell.fill}
                  />
                );
              })
            : null}
          {mode === 'contour' && contour && 'grid' in contour && contour.grid
            ? contour.sets.map((set, index) => (
                <polyline
                  key={`c${index}`}
                  points={set.segments
                    .map((segment) => {
                      const a = toScreen({ x: segment.a.x, y: segment.a.y, z: 0 }, plan);
                      const b = toScreen({ x: segment.b.x, y: segment.b.y, z: 0 }, plan);
                      return `${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="rgba(15,20,35,0.75)"
                  strokeWidth={1.1}
                />
              ))
            : null}
        </svg>
        {mode === 'contour' && contour && 'sets' in contour && contour.sets ? (
          <p className="mono-line">
            Levels: {contour.sets.map((set) => nf(set.level)).join(', ')}
          </p>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section className="card">
          <OutputList rows={rows} title="Readout" />
        </section>
      ) : null}
    </div>
  );
}

function clampPitch(value: number): number {
  return Math.max(-89, Math.min(89, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
