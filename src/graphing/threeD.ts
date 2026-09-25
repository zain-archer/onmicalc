/**
 * Three-dimensional graphing primitives.
 *
 * Everything here is pure maths plus plain data — no canvas, no WebGL, no DOM.
 * The UI receives polylines/quads in screen space and paints them as SVG, so the
 * same code can also drive an export, a test or a future native renderer.
 */

import { CalcError } from '@/core/errors';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SurfaceGrid {
  xs: number[];
  ys: number[];
  /** z values, `null` where the function is undefined or not finite. */
  zs: (number | null)[][];
  minZ: number;
  maxZ: number;
  /** Number of intervals per axis (grid is steps + 1 by steps + 1). */
  steps: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SurfaceOptions {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Number of intervals per axis (grid is steps + 1 by steps + 1). */
  steps?: number;
}

/** Samples z = f(x, y) on a regular grid. Non-finite values become `null`. */
export function sampleSurface(
  f: (x: number, y: number) => number,
  options: SurfaceOptions,
): SurfaceGrid {
  const steps = Math.max(2, Math.min(200, Math.floor(options.steps ?? 40)));
  if (!(options.xMax > options.xMin) || !(options.yMax > options.yMin)) {
    throw new CalcError('INPUT', 'A surface needs a range with max > min on both axes');
  }
  const xs = gridAxis(options.xMin, options.xMax, steps);
  const ys = gridAxis(options.yMin, options.yMax, steps);
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  const zs: (number | null)[][] = ys.map((y) =>
    xs.map((x) => {
      let value: number;
      try {
        value = f(x, y);
      } catch {
        return null;
      }
      if (!Number.isFinite(value)) return null;
      if (value < minZ) minZ = value;
      if (value > maxZ) maxZ = value;
      return value;
    }),
  );
  if (!Number.isFinite(minZ)) {
    minZ = 0;
    maxZ = 0;
  }
  return { xs, ys, zs, minZ, maxZ, ...options, steps };
}

function gridAxis(min: number, max: number, steps: number): number[] {
  const values: number[] = [];
  for (let i = 0; i <= steps; i += 1) values.push(min + ((max - min) * i) / steps);
  return values;
}

/* ------------------------------- projection ------------------------------- */

export interface View3D {
  /** Horizontal angle in radians. */
  yaw: number;
  /** Vertical angle in radians; positive looks down from above. */
  pitch: number;
  /** Screen pixels per world unit. */
  scale: number;
  /** Screen position of the world origin. */
  originU: number;
  originV: number;
  /** Camera distance for perspective; 0 or undefined gives an orthographic view. */
  distance?: number;
}

export const DEFAULT_VIEW_3D: View3D = {
  yaw: -0.6,
  pitch: 0.5,
  scale: 40,
  originU: 380,
  originV: 250,
  distance: 0,
};

/** Yaw about the vertical axis, then pitch. Screen axes: x right, z up, y depth. */
export function rotate(point: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = cy * point.x - sy * point.y;
  const y1 = sy * point.x + cy * point.y;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  return { x: x1, y: cp * y1 - sp * point.z, z: sp * y1 + cp * point.z };
}

export function project(point: Vec3, view: View3D): { u: number; v: number; depth: number } {
  const r = rotate(point, view.yaw, view.pitch);
  let factor = view.scale;
  if (view.distance && view.distance > 0) {
    const denominator = view.distance - r.y;
    factor = view.scale * (view.distance / (Math.abs(denominator) < 1e-6 ? 1e-6 : denominator));
  }
  return { u: view.originU + r.x * factor, v: view.originV - r.z * factor, depth: r.y };
}

/* --------------------------------- meshes --------------------------------- */

/** Mean viewer depth of a polyline: larger means nearer the camera. */
export function meanDepth(points: Vec3[], view: View3D): number {
  if (points.length === 0) return 0;
  let total = 0;
  for (const point of points) total += project(point, view).depth;
  return total / points.length;
}

export interface Polyline3D {
  points: Vec3[];
}

export interface WireframeOptions {
  /** Draw every n-th row/column (1 = all). */
  stride?: number;
}

/** Row and column polylines of the surface grid, ready for painter's-algorithm drawing. */
export function surfaceWireframe(grid: SurfaceGrid, options: WireframeOptions = {}): Polyline3D[] {
  const stride = Math.max(1, Math.floor(options.stride ?? 1));
  const lines: Polyline3D[] = [];
  for (let j = 0; j < grid.ys.length; j += stride) {
    pushPolyline(lines, grid.xs.map((x, i) => cell(grid, i, j, x)));
  }
  for (let i = 0; i < grid.xs.length; i += stride) {
    pushPolyline(lines, grid.ys.map((y, j) => cell(grid, i, j, y)));
  }
  return lines;
}

function cell(grid: SurfaceGrid, i: number, j: number, coordinate: number): Vec3 | null {
  const z = grid.zs[j]?.[i];
  if (z === null || z === undefined) return null;
  return { x: grid.xs[i]!, y: coordinate, z };
}

/** Splits a run of points at undefined samples so gaps are not bridged. */
function pushPolyline(target: Polyline3D[], raw: (Vec3 | null)[]): void {
  let run: Vec3[] = [];
  const flush = () => {
    if (run.length >= 2) target.push({ points: run });
    run = [];
  };
  for (const point of raw) {
    if (point) run.push(point);
    else flush();
  }
  flush();
}

export interface Quad3D {
  corners: [Vec3, Vec3, Vec3, Vec3];
  /** Mean depth, larger = nearer the viewer. */
  depth: number;
  /** 0 (dark) to 1 (fully lit) — Lambert shading of a double-sided surface. */
  shade: number;
}

const DEFAULT_LIGHT: Vec3 = { x: -0.4, y: -0.7, z: 0.6 };

/**
 * Small quads with a Lambert shade factor, for a solid-looking shaded surface.
 * `view` is only used to work out the depth ordering.
 */
export function surfaceQuads(
  grid: SurfaceGrid,
  view: View3D,
  light: Vec3 = DEFAULT_LIGHT,
): Quad3D[] {
  const quads: Quad3D[] = [];
  const l = normalise(light);
  for (let j = 0; j + 1 < grid.ys.length; j += 1) {
    for (let i = 0; i + 1 < grid.xs.length; i += 1) {
      const a = cell(grid, i, j, grid.ys[j]!);
      const b = cell(grid, i + 1, j, grid.ys[j]!);
      const c = cell(grid, i + 1, j + 1, grid.ys[j + 1]!);
      const d = cell(grid, i, j + 1, grid.ys[j + 1]!);
      if (!a || !b || !c || !d) continue;
      const normal = normalise(cross(sub(b, a), sub(d, a)));
      const shade = 0.25 + 0.75 * Math.abs(normal.x * l.x + normal.y * l.y + normal.z * l.z);
      const depth =
        (project(a, view).depth +
          project(b, view).depth +
          project(c, view).depth +
          project(d, view).depth) /
        4;
      quads.push({ corners: [a, b, c, d], depth, shade: Math.max(0, Math.min(1, shade)) });
    }
  }
  return quads;
}

/** Space curve (x(t), y(t), z(t)) sampled uniformly in t. */
export function spaceCurve(
  f: (t: number) => Vec3,
  options: { tMin: number; tMax: number; steps?: number },
): Vec3[] {
  const steps = Math.max(2, Math.min(2000, Math.floor(options.steps ?? 200)));
  const points: Vec3[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = options.tMin + ((options.tMax - options.tMin) * i) / steps;
    let point: Vec3;
    try {
      point = f(t);
    } catch {
      continue;
    }
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) continue;
    points.push(point);
  }
  return points;
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (!Number.isFinite(length) || length < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Distance between two points — handy for tests and for axis-length readouts. */
export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
