/**
 * Vector fields, gradients and streamlines in the plane.
 *
 * Fields are described by two expressions of (x, y) — the first gives the
 * horizontal component, the second the vertical one — exactly the notation used
 * in physics and engineering textbooks.
 */

import { CalcError } from '@/core/errors';

export interface FieldBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface VectorArrow {
  x: number;
  y: number;
  /** Arrow components after optional normalisation. */
  dx: number;
  dy: number;
  /** Length of the original vector at this point. */
  magnitude: number;
}

export interface VectorFieldResult {
  arrows: VectorArrow[];
  maxMagnitude: number;
  /** Points where the field is zero (stagnation points), within the grid. */
  zeros: { x: number; y: number }[];
}

export interface VectorFieldOptions extends FieldBounds {
  steps?: number;
  /**
   * 'raw' keeps the true magnitudes, 'length' keeps lengths proportional to
   * magnitude (scaled to fit) and 'direction' makes every arrow the same length.
   */
  scaling?: 'raw' | 'length' | 'direction';
}

/** Samples a planar vector field (fx, fy) on a regular grid of points. */
export function vectorField(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  options: VectorFieldOptions,
): VectorFieldResult {
  const steps = Math.max(2, Math.min(80, Math.floor(options.steps ?? 15)));
  if (!(options.xMax > options.xMin) || !(options.yMax > options.yMin)) {
    throw new CalcError('INPUT', 'A vector field needs a range with max > min on both axes');
  }
  const scaling = options.scaling ?? 'length';
  const cellX = (options.xMax - options.xMin) / steps;
  const cellY = (options.yMax - options.yMin) / steps;
  const raw: { x: number; y: number; u: number; v: number; magnitude: number }[] = [];
  let maxMagnitude = 0;
  for (let j = 0; j <= steps; j += 1) {
    const y = options.yMin + cellY * j;
    for (let i = 0; i <= steps; i += 1) {
      const x = options.xMin + cellX * i;
      const u = safe(fx, x, y);
      const v = safe(fy, x, y);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      const magnitude = Math.hypot(u, v);
      if (magnitude > maxMagnitude) maxMagnitude = magnitude;
      raw.push({ x, y, u, v, magnitude });
    }
  }
  const longest = 0.9;
  const arrows: VectorArrow[] = raw.map((arrow) => {
    let dx = arrow.u;
    let dy = arrow.v;
    if (scaling === 'direction') {
      const length = arrow.magnitude;
      dx = length < 1e-12 ? 0 : (arrow.u / length) * longest;
      dy = length < 1e-12 ? 0 : (arrow.v / length) * longest;
    } else if (scaling === 'length') {
      if (arrow.magnitude > 1e-12) {
        const scale = maxMagnitude > 1e-12 ? (longest * arrow.magnitude) / maxMagnitude : 0;
        dx = (arrow.u / arrow.magnitude) * scale;
        dy = (arrow.v / arrow.magnitude) * scale;
      } else {
        dx = 0;
        dy = 0;
      }
    }
    return { x: arrow.x, y: arrow.y, dx, dy, magnitude: arrow.magnitude };
  });
  return { arrows, maxMagnitude, zeros: findFieldZeros(fx, fy, options, steps, Math.min(cellX, cellY)) };
}

/**
 * Stagnation points: cells where both components change sign. Each cell is
 * refined by alternating bisection along x and y (Gauss–Seidel style), which
 * converges quickly for smooth fields.
 */
function findFieldZeros(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  bounds: FieldBounds,
  steps: number,
  tolerance: number,
): { x: number; y: number }[] {
  const zeros: { x: number; y: number }[] = [];
  const spanX = (bounds.xMax - bounds.xMin) / steps;
  const spanY = (bounds.yMax - bounds.yMin) / steps;
  for (let j = 0; j < steps; j += 1) {
    const y0 = bounds.yMin + spanY * j;
    const y1 = y0 + spanY;
    for (let i = 0; i < steps; i += 1) {
      const x0 = bounds.xMin + spanX * i;
      const x1 = x0 + spanX;
      const corners: [number, number][] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
      const samples = corners.map(([x, y]) => ({ u: safe(fx, x, y), v: safe(fy, x, y) }));
      if (samples.some((entry) => !Number.isFinite(entry.u) || !Number.isFinite(entry.v))) continue;
      const straddles = (key: 'u' | 'v') =>
        samples.some((entry) => entry[key] >= 0) && samples.some((entry) => entry[key] <= 0);
      if (!straddles('u') || !straddles('v')) continue;
      const refined = refineZero(fx, fy, x0, x1, y0, y1);
      if (!refined) continue;
      const { x, y } = refined;
      if (zeros.some((zero) => Math.hypot(zero.x - x, zero.y - y) < tolerance)) continue;
      zeros.push({ x, y });
    }
  }
  return zeros;
}

/** Central-difference gradient of a scalar function — the gradient vector field. */
export function gradientField(
  f: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-5,
): { fx: number; fy: number } {
  const step = h * Math.max(1, Math.abs(x), Math.abs(y));
  return {
    fx: (safe(f, x + step, y) - safe(f, x - step, y)) / (2 * step),
    fy: (safe(f, x, y + step) - safe(f, x, y - step)) / (2 * step),
  };
}

/** Numerical divergence ∂fx/∂x + ∂fy/∂y at a point. */
export function divergence(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-5,
): number {
  const step = h * Math.max(1, Math.abs(x), Math.abs(y));
  return (
    (safe(fx, x + step, y) - safe(fx, x - step, y)) / (2 * step) +
    (safe(fy, x, y + step) - safe(fy, x, y - step)) / (2 * step)
  );
}

/** Numerical curl (scalar z-component) ∂fy/∂x − ∂fx/∂y at a point. */
export function curl(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-5,
): number {
  const step = h * Math.max(1, Math.abs(x), Math.abs(y));
  return (
    (safe(fy, x + step, y) - safe(fy, x - step, y)) / (2 * step) -
    (safe(fx, x, y + step) - safe(fx, x, y - step)) / (2 * step)
  );
}

/**
 * Newton on the 2×2 system (fx, fy) = 0 from the cell centre. A singular
 * Jacobian (a degenerate zero) returns null instead of a wild guess.
 */
function refineZero(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): { x: number; y: number } | null {
  const width = x1 - x0;
  const height = y1 - y0;
  let x = (x0 + x1) / 2;
  let y = (y0 + y1) / 2;
  for (let i = 0; i < 60; i += 1) {
    const f = safe(fx, x, y);
    const g = safe(fy, x, y);
    if (!Number.isFinite(f) || !Number.isFinite(g)) return null;
    if (Math.hypot(f, g) < 1e-12) break;
    const h = 1e-7 * Math.max(1, Math.abs(x), Math.abs(y));
    const j11 = (safe(fx, x + h, y) - safe(fx, x - h, y)) / (2 * h);
    const j12 = (safe(fx, x, y + h) - safe(fx, x, y - h)) / (2 * h);
    const j21 = (safe(fy, x + h, y) - safe(fy, x - h, y)) / (2 * h);
    const j22 = (safe(fy, x, y + h) - safe(fy, x, y - h)) / (2 * h);
    const determinant = j11 * j22 - j12 * j21;
    if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-14) return null;
    x -= (f * j22 - g * j12) / determinant;
    y -= (-f * j21 + g * j11) / determinant;
    if (
      x < x0 - width ||
      x > x1 + width ||
      y < y0 - height ||
      y > y1 + height ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null;
    }
  }
  return { x, y };
}

export interface StreamlineOptions extends FieldBounds {
  seeds?: number;
  stepSize?: number;
  maxSteps?: number;
  /** Integrate forwards, backwards or both. */
  direction?: 'forward' | 'backward' | 'both';
}

export interface Streamline {
  points: { x: number; y: number }[];
  closed: boolean;
}

/**
 * Traces streamlines with classical RK4 on x′ = fx, y′ = fy, stopping at the
 * domain boundary, at a stagnation point, or after `maxSteps`.
 */
export function streamlines(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  options: StreamlineOptions,
): Streamline[] {
  if (!(options.xMax > options.xMin) || !(options.yMax > options.yMin)) {
    throw new CalcError('INPUT', 'Streamlines need a range with max > min on both axes');
  }
  const seeds = Math.max(1, Math.min(40, Math.floor(options.seeds ?? 12)));
  const stepSize = options.stepSize ?? (options.xMax - options.xMin) / 120;
  const maxSteps = Math.max(10, Math.min(4000, Math.floor(options.maxSteps ?? 600)));
  const direction = options.direction ?? 'both';
  const lines: Streamline[] = [];
  for (let s = 0; s < seeds; s += 1) {
    // R2 low-discrepancy seeding: evenly spread, and it never lands exactly on
    // a symmetric stagnation point the way a straight diagonal grid does.
    const x = options.xMin + (options.xMax - options.xMin) * fract((s + 0.5) * 0.7548776662466927);
    const y = options.yMin + (options.yMax - options.yMin) * fract((s + 0.5) * 0.5698402909980532);
    const forward = trace(fx, fy, x, y, stepSize, maxSteps, 1, options);
    const backward =
      direction === 'both'
        ? trace(fx, fy, x, y, stepSize, maxSteps, -1, options)
        : { points: [] as { x: number; y: number }[], closed: false };
    const points = [...backward.points.reverse(), ...forward.points];
    if (points.length >= 2) lines.push({ points, closed: forward.closed || backward.closed });
  }
  return lines;
}

function trace(
  fx: (x: number, y: number) => number,
  fy: (x: number, y: number) => number,
  x0: number,
  y0: number,
  h: number,
  maxSteps: number,
  sign: 1 | -1,
  bounds: FieldBounds,
): { points: { x: number; y: number }[]; closed: boolean } {
  const points = [{ x: x0, y: y0 }];
  let x = x0;
  let y = y0;
  let closed = false;
  const startSpeed = Math.hypot(safe(fx, x0, y0), safe(fy, x0, y0));
  const closingTolerance = Math.max(1e-12, 0.5 * h * (Number.isFinite(startSpeed) ? startSpeed : 0));
  for (let i = 0; i < maxSteps; i += 1) {
    const k1x = safe(fx, x, y) * sign;
    const k1y = safe(fy, x, y) * sign;
    if (!Number.isFinite(k1x) || !Number.isFinite(k1y)) break;
    if (Math.hypot(k1x, k1y) < 1e-12) break;
    const k2x = safe(fx, x + (h / 2) * k1x, y + (h / 2) * k1y) * sign;
    const k2y = safe(fy, x + (h / 2) * k1x, y + (h / 2) * k1y) * sign;
    const k3x = safe(fx, x + (h / 2) * k2x, y + (h / 2) * k2y) * sign;
    const k3y = safe(fy, x + (h / 2) * k2x, y + (h / 2) * k2y) * sign;
    const k4x = safe(fx, x + h * k3x, y + h * k3y) * sign;
    const k4y = safe(fy, x + h * k3x, y + h * k3y) * sign;
    const nextX = x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    const nextY = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) break;
    if (nextX < bounds.xMin || nextX > bounds.xMax || nextY < bounds.yMin || nextY > bounds.yMax) {
      points.push({ x: Math.min(bounds.xMax, Math.max(bounds.xMin, nextX)), y: Math.min(bounds.yMax, Math.max(bounds.yMin, nextY)) });
      break;
    }
    // A loop that returns to its seed is closed: stop instead of retracing it.
    if (i > 4 && Math.hypot(nextX - x0, nextY - y0) < closingTolerance) {
      points.push({ x: x0, y: y0 });
      closed = true;
      break;
    }
    points.push({ x: nextX, y: nextY });
    x = nextX;
    y = nextY;
  }
  return { points, closed };
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function safe(f: (x: number, y: number) => number, x: number, y: number): number {
  try {
    const value = f(x, y);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}
