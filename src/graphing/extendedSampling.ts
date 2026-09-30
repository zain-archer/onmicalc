/**
 * Extended sampling: parametric, polar, implicit, inequality, adaptive Cartesian
 */
import type { Viewport, Size } from './viewport';
import { visibleBounds } from './viewport';
import type { Polyline } from './sampling';
import { compileFunction, compileFunctionOf } from '@/math/calculus';
import { sampleGrid, marchingSquares, type Segment2D } from './implicit';

export interface ExtendedSampleOptions {
  density?: number;
  clipY?: number;
  domain?: { min: number; max: number } | null;
  paramDomain?: { min: number; max: number } | null;
}

/** Enhanced Cartesian sampling with domain and better discontinuity detection */
export function sampleCartesian(
  fn: (x: number) => number,
  viewport: Viewport,
  size: Size,
  options: ExtendedSampleOptions = {}
): Polyline[] {
  const density = Math.max(0.5, Math.min(4, options.density ?? 1.2));
  const bounds = visibleBounds(viewport, size);
  const minX = options.domain?.min ?? bounds.minX;
  const maxX = options.domain?.max ?? bounds.maxX;
  if (maxX <= minX) return [];
  const steps = Math.max(16, Math.min(5000, Math.round(size.width * density * 1.2)));
  const dx = (maxX - minX) / steps;
  const clipY = options.clipY ?? Math.max(1e6, Math.abs(bounds.maxY - bounds.minY) * 100);

  const polylines: Polyline[] = [];
  let current: { x: number; y: number }[] = [];

  const push = () => {
    if (current.length > 1) polylines.push({ points: current, broken: false });
    else if (current.length === 1) polylines.push({ points: [...current, ...current], broken: false });
    current = [];
  };

  let prevY: number | null = null;
  let prevX: number | null = null;

  for (let i = 0; i <= steps; i++) {
    const x = minX + i * dx;
    let y: number;
    try {
      y = fn(x);
    } catch {
      push();
      prevY = null;
      prevX = null;
      continue;
    }
    if (!Number.isFinite(y) || Math.abs(y) > clipY) {
      push();
      prevY = null;
      prevX = null;
      continue;
    }

    if (prevY !== null && prevX !== null) {
      const jump = Math.abs(y - prevY);
      const spanY = Math.max(1, Math.abs(y), Math.abs(prevY));
      const dxWorld = Math.abs(x - prevX);
      // Detect vertical asymptotes: large jump relative to expected slope
      // Also detect sign change with large jump (classic 1/x)
      const expectedMaxSlope = clipY / 10;
      const actualSlope = jump / Math.max(dxWorld, 1e-12);
      
      if (
        (jump > spanY * 2 && actualSlope > expectedMaxSlope) ||
        (prevY * y < 0 && jump > Math.max(Math.abs(bounds.maxY - bounds.minY) * 0.5, 5)) ||
        jump > (bounds.maxY - bounds.minY) * 2
      ) {
        // Check if this is a genuine discontinuity by sampling midpoint
        try {
          const midX = (x + prevX) / 2;
          const midY = fn(midX);
          if (!Number.isFinite(midY) || Math.abs(midY) > clipY || Math.abs(midY - prevY) > jump * 0.8) {
            push();
          }
        } catch {
          push();
        }
      }
    }

    current.push({ x, y });
    prevY = y;
    prevX = x;
  }
  push();
  return polylines;
}

export interface ParametricPoint {
  x: number;
  y: number;
  t: number;
}

export interface ParametricPolyline {
  points: ParametricPoint[];
  broken: boolean;
}

export function sampleParametric(
  fx: (t: number) => number,
  fy: (t: number) => number,
  viewport: Viewport,
  size: Size,
  options: ExtendedSampleOptions = {}
): ParametricPolyline[] {
  const tMin = options.paramDomain?.min ?? -10;
  const tMax = options.paramDomain?.max ?? 10;
  if (tMax <= tMin) return [];
  const bounds = visibleBounds(viewport, size);
  const density = options.density ?? 1.5;
  const steps = Math.max(50, Math.min(5000, Math.round(size.width * density * 1.5)));
  const dt = (tMax - tMin) / steps;
  const clip = Math.max(1e6, Math.max(Math.abs(bounds.maxX - bounds.minX), Math.abs(bounds.maxY - bounds.minY)) * 100);

  const polylines: ParametricPolyline[] = [];
  let current: ParametricPoint[] = [];

  const push = () => {
    if (current.length > 1) polylines.push({ points: current, broken: false });
    else if (current.length === 1) polylines.push({ points: [...current, ...current], broken: false });
    current = [];
  };

  for (let i = 0; i <= steps; i++) {
    const t = tMin + i * dt;
    let x: number, y: number;
    try {
      x = fx(t);
      y = fy(t);
    } catch {
      push();
      continue;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > clip || Math.abs(y) > clip) {
      push();
      continue;
    }
    // Break on huge jumps
    const prev = current[current.length - 1];
    if (prev) {
      const jump = Math.hypot(x - prev.x, y - prev.y);
      if (jump > Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.8) {
        push();
      }
    }
    current.push({ x, y, t });
  }
  push();
  return polylines;
}

export function samplePolar(
  rFn: (theta: number) => number,
  viewport: Viewport,
  size: Size,
  options: ExtendedSampleOptions = {}
): ParametricPolyline[] {
  const thMin = options.paramDomain?.min ?? 0;
  const thMax = options.paramDomain?.max ?? Math.PI * 2;
  if (thMax <= thMin) return [];
  const bounds = visibleBounds(viewport, size);
  const density = options.density ?? 1.8;
  const steps = Math.max(80, Math.min(6000, Math.round(size.width * density * 2)));
  const dth = (thMax - thMin) / steps;
  const clip = Math.max(1e6, Math.max(Math.abs(bounds.maxX - bounds.minX), Math.abs(bounds.maxY - bounds.minY)) * 100);

  const polylines: ParametricPolyline[] = [];
  let current: ParametricPoint[] = [];

  const push = () => {
    if (current.length > 1) polylines.push({ points: current, broken: false });
    else if (current.length === 1) polylines.push({ points: [...current, ...current], broken: false });
    current = [];
  };

  for (let i = 0; i <= steps; i++) {
    const th = thMin + i * dth;
    let r: number;
    try {
      r = rFn(th);
    } catch {
      push();
      continue;
    }
    if (!Number.isFinite(r) || Math.abs(r) > clip) {
      push();
      continue;
    }
    const x = r * Math.cos(th);
    const y = r * Math.sin(th);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      push();
      continue;
    }
    const prev = current[current.length - 1];
    if (prev) {
      const jump = Math.hypot(x - prev.x, y - prev.y);
      if (jump > Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.5) {
        // For polar, a jump might be due to r crossing zero – allow if r is near zero
        if (Math.abs(r) > 0.1) {
          push();
        }
      }
    }
    current.push({ x, y, t: th });
  }
  push();
  return polylines;
}

export function sampleImplicit(
  f: (x: number, y: number) => number,
  viewport: Viewport,
  size: Size,
  options: ExtendedSampleOptions = {}
): Segment2D[] {
  const bounds = visibleBounds(viewport, size);
  const minX = options.domain?.min ?? bounds.minX;
  const maxX = options.domain?.max ?? bounds.maxX;
  const steps = Math.max(30, Math.min(300, Math.round(Math.sqrt(size.width * size.height) / 8)));
  try {
    const grid = sampleGrid(f, { xMin: minX, xMax: maxX, yMin: bounds.minY, yMax: bounds.maxY, steps });
    return marchingSquares(grid, 0);
  } catch {
    return [];
  }
}

export interface InequalitySample {
  x: number;
  yTop: number;
  yBottom: number;
  valid: boolean;
}

export function sampleInequality(
  fn: (x: number) => number,
  op: '>' | '<' | '>=' | '<=' | '=' | '!=',
  viewport: Viewport,
  size: Size,
  options: ExtendedSampleOptions = {}
): { polylines: Polyline[]; regions: { x: number; y1: number; y2: number }[] } {
  const cartesian = sampleCartesian(fn, viewport, size, options);
  const bounds = visibleBounds(viewport, size);
  const regions: { x: number; y1: number; y2: number }[] = [];

  // For shading, we need to generate regions above/below the curve
  // Sample at higher resolution for shading
  const minX = options.domain?.min ?? bounds.minX;
  const maxX = options.domain?.max ?? bounds.maxX;
  const steps = Math.round(size.width * 1.2);
  const dx = (maxX - minX) / steps;

  for (let i = 0; i <= steps; i++) {
    const x = minX + i * dx;
    let y: number;
    try {
      y = fn(x);
    } catch {
      continue;
    }
    if (!Number.isFinite(y)) continue;

    if (op === '>' || op === '>=') {
      regions.push({ x, y1: y, y2: bounds.maxY });
    } else if (op === '<' || op === '<=') {
      regions.push({ x, y1: bounds.minY, y2: y });
    }
  }

  return { polylines: cartesian, regions };
}

/** Compile helpers that return null-safe functions */
export function tryCompileCartesian(expr: string): ((x: number) => number) | null {
  if (!expr.trim()) return null;
  // Support y = prefix stripping
  const clean = expr.replace(/^\s*y\s*=\s*/i, '').trim();
  if (!clean) return null;
  const fn = compileFunction(clean);
  return fn;
}

export function tryCompileParametric(xExpr: string, yExpr: string): { fx: (t: number) => number; fy: (t: number) => number } | null {
  const fx = compileFunctionOf(xExpr, ['t']);
  const fy = compileFunctionOf(yExpr, ['t']);
  if (!fx || !fy) return null;
  return {
    fx: (t: number) => fx({ t, x: t }),
    fy: (t: number) => fy({ t, y: t }),
  };
}

export function tryCompilePolar(rExpr: string): ((theta: number) => number) | null {
  const clean = rExpr.replace(/^\s*r\s*=\s*/i, '').trim();
  const fn = compileFunctionOf(clean, ['theta', 't', 'x']);
  if (!fn) return null;
  return (theta: number) => fn({ theta, t: theta, x: theta });
}

export function tryCompileImplicit(expr: string): ((x: number, y: number) => number) | null {
  // Support forms like "x^2 + y^2 = 25" -> "x^2 + y^2 - 25"
  let clean = expr.trim();
  if (clean.includes('=')) {
    const parts = clean.split('=');
    if (parts.length === 2) {
      clean = `(${parts[0]}) - (${parts[1]})`;
    }
  }
  const fn = compileFunctionOf(clean, ['x', 'y']);
  if (!fn) return null;
  return (x: number, y: number) => fn({ x, y });
}

export function tryCompileInequality(expr: string): { fn: (x: number) => number; op: '>' | '<' | '>=' | '<=' } | null {
  const match = expr.match(/(.+?)\s*(>=|<=|>|<)\s*(.+)/);
  let fnExpr: string;
  let op: '>' | '<' | '>=' | '<=';
  if (match) {
    const left = match[1]!.trim();
    op = match[2] as any;
    const right = match[3]!.trim();
    // Determine if it's y > f(x) or f(x) > y etc.
    // We support y op expr and expr op y
    const leftIsY = /^\s*y\s*$/i.test(left);
    const rightIsY = /^\s*y\s*$/i.test(right);
    if (leftIsY) {
      fnExpr = right;
    } else if (rightIsY) {
      fnExpr = left;
      // Flip operator
      if (op === '>') op = '<';
      else if (op === '<') op = '>';
      else if (op === '>=') op = '<=';
      else if (op === '<=') op = '>=';
    } else {
      // Assume y op expr where expr contains x
      fnExpr = right;
    }
  } else {
    // No inequality, treat as equality for shading fallback
    return null;
  }
  const fn = compileFunction(fnExpr);
  if (!fn) return null;
  return { fn, op };
}
