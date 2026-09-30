/**
 * Extended analysis: derivative graph, integral shading, tangent, normal, evaluate, table, asymptotes
 */
import type { ScalarFunction } from '@/math/calculus';
import { derivative, integrate } from '@/math/calculus';
import { findRoots, findExtrema, findIntersections, tangentAt, type Point } from './analysis';
import type { Polyline } from './sampling';
import { visibleBounds, type Viewport, type Size } from './viewport';

export interface TableRow {
  x: number;
  y: number;
  valid: boolean;
}

export function generateTable(fn: ScalarFunction, start: number, end: number, step: number): TableRow[] {
  const rows: TableRow[] = [];
  if (step === 0) return rows;
  const actualStep = step > 0 ? step : -step;
  const s = Math.min(start, end);
  const e = Math.max(start, end);
  const count = Math.min(10000, Math.floor((e - s) / actualStep) + 1);
  for (let i = 0; i < count; i++) {
    const x = s + i * actualStep;
    if (x > e + 1e-12) break;
    let y: number;
    try {
      y = fn(x);
    } catch {
      rows.push({ x, y: NaN, valid: false });
      continue;
    }
    rows.push({ x, y, valid: Number.isFinite(y) });
  }
  return rows;
}

export function evaluateAt(fn: ScalarFunction, x: number): { y: number; valid: boolean; error?: string } {
  try {
    const y = fn(x);
    if (!Number.isFinite(y)) return { y: NaN, valid: false, error: 'Function not defined at this point' };
    return { y, valid: true };
  } catch (e) {
    return { y: NaN, valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface DerivativeGraph {
  fn: ScalarFunction;
  polylines: Polyline[];
}

export function sampleDerivative(
  fn: ScalarFunction,
  viewport: Viewport,
  size: Size,
  domain?: { min: number; max: number } | null
): Polyline[] {
  const derivativeFn: ScalarFunction = (x: number) => {
    try {
      return derivative(fn, x).value;
    } catch {
      return NaN;
    }
  };
  // Reuse sampling logic
  const bounds = visibleBounds(viewport, size);
  const minX = domain?.min ?? bounds.minX;
  const maxX = domain?.max ?? bounds.maxX;
  const steps = Math.max(100, Math.min(2000, Math.round(size.width * 1.2)));
  const dx = (maxX - minX) / steps;
  const polylines: Polyline[] = [];
  let current: { x: number; y: number }[] = [];
  const push = () => {
    if (current.length > 1) polylines.push({ points: current, broken: false });
    current = [];
  };
  let prev: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const x = minX + i * dx;
    const y = derivativeFn(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
      push();
      prev = null;
      continue;
    }
    if (prev !== null && Math.abs(y - prev) > Math.abs(bounds.maxY - bounds.minY) * 2) {
      push();
    }
    current.push({ x, y });
    prev = y;
  }
  push();
  return polylines;
}

export interface IntegralResult {
  value: number;
  error: number;
  converged: boolean;
  points: { x: number; y: number }[];
}

export function computeIntegral(
  fn: ScalarFunction,
  a: number,
  b: number
): IntegralResult {
  const result = integrate(fn, a, b);
  // Sample points for shading
  const points: { x: number; y: number }[] = [];
  const steps = 100;
  const dx = (b - a) / steps;
  for (let i = 0; i <= steps; i++) {
    const x = a + i * dx;
    try {
      const y = fn(x);
      if (Number.isFinite(y)) points.push({ x, y });
    } catch {
      // skip
    }
  }
  return {
    value: result.value,
    error: result.error,
    converged: result.converged,
    points,
  };
}

export function areaBetweenCurves(
  f: ScalarFunction,
  g: ScalarFunction,
  a: number,
  b: number
) {
  const diff = (x: number) => {
    try {
      const fv = f(x);
      const gv = g(x);
      if (!Number.isFinite(fv) || !Number.isFinite(gv)) return NaN;
      return fv - gv;
    } catch {
      return NaN;
    }
  };
  return computeIntegral(diff, a, b);
}

export interface TangentResult {
  x: number;
  y: number;
  slope: number;
  line: { x1: number; y1: number; x2: number; y2: number };
  equation: string;
}

export function computeTangent(fn: ScalarFunction, x: number, halfWidth: number): TangentResult {
  const t = tangentAt(fn, x, halfWidth);
  const b = t.y - t.slope * t.x;
  const eq = t.slope === 0 ? `y = ${t.y.toFixed(4)}` : `y = ${t.slope.toFixed(4)}x ${b >= 0 ? '+' : ''} ${b.toFixed(4)}`;
  return { ...t, equation: eq };
}

export interface NormalResult {
  x: number;
  y: number;
  slope: number;
  normalSlope: number;
  line: { x1: number; y1: number; x2: number; y2: number };
  equation: string;
}

export function computeNormal(fn: ScalarFunction, x: number, halfWidth: number): NormalResult {
  const tan = tangentAt(fn, x, halfWidth);
  const normalSlope = tan.slope === 0 ? Infinity : -1 / tan.slope;
  let line: { x1: number; y1: number; x2: number; y2: number };
  let equation: string;
  if (!Number.isFinite(normalSlope)) {
    line = { x1: x, y1: tan.y - halfWidth, x2: x, y2: tan.y + halfWidth };
    equation = `x = ${x.toFixed(4)}`;
  } else {
    line = {
      x1: x - halfWidth,
      y1: tan.y - normalSlope * halfWidth,
      x2: x + halfWidth,
      y2: tan.y + normalSlope * halfWidth,
    };
    const b = tan.y - normalSlope * x;
    equation = `y = ${normalSlope.toFixed(4)}x ${b >= 0 ? '+' : ''} ${b.toFixed(4)}`;
  }
  return {
    x: tan.x,
    y: tan.y,
    slope: tan.slope,
    normalSlope,
    line,
    equation,
  };
}

export interface Asymptote {
  type: 'vertical' | 'horizontal' | 'oblique';
  x?: number;
  y?: number;
  slope?: number;
  intercept?: number;
  equation: string;
}

export function detectAsymptotes(fn: ScalarFunction, minX: number, maxX: number, samples = 500): Asymptote[] {
  const asymptotes: Asymptote[] = [];
  const dx = (maxX - minX) / samples;
  const threshold = 1e3;
  // Detect vertical asymptotes: where |f| jumps from large positive to large negative
  let prevX = minX;
  let prevY: number;
  try {
    prevY = fn(prevX);
  } catch {
    prevY = NaN;
  }

  for (let i = 1; i <= samples; i++) {
    const x = minX + i * dx;
    let y: number;
    try {
      y = fn(x);
    } catch {
      prevX = x;
      prevY = NaN;
      continue;
    }
    if (!Number.isFinite(prevY) || !Number.isFinite(y)) {
      if (Number.isFinite(prevY) && Math.abs(prevY) > threshold) {
        // Approaching asymptote from left
        asymptotes.push({ type: 'vertical', x: prevX, equation: `x = ${prevX.toFixed(4)}` });
      }
      if (Number.isFinite(y) && Math.abs(y) > threshold) {
        asymptotes.push({ type: 'vertical', x, equation: `x = ${x.toFixed(4)}` });
      }
      prevX = x;
      prevY = y;
      continue;
    }
    if (prevY * y < 0 && Math.abs(y - prevY) > threshold) {
      // Sign change with large jump -> vertical asymptote between
      const mid = (prevX + x) / 2;
      // Refine by finding where |f| is max
      let bestX = mid;
      let bestAbs = 0;
      for (let k = 0; k < 10; k++) {
        const testX = prevX + ((x - prevX) * k) / 10;
        try {
          const testY = fn(testX);
          if (Math.abs(testY) > bestAbs) {
            bestAbs = Math.abs(testY);
            bestX = testX;
          }
        } catch {
          // ignore
        }
      }
      if (!asymptotes.some(a => a.x !== undefined && Math.abs(a.x - bestX) < dx * 2)) {
        asymptotes.push({ type: 'vertical', x: bestX, equation: `x = ${bestX.toFixed(4)}` });
      }
    }
    prevX = x;
    prevY = y;
  }

  // Horizontal asymptotes: check behavior at large |x|
  const largeX = Math.max(Math.abs(minX), Math.abs(maxX)) * 2;
  if (largeX > 10) {
    try {
      const y1 = fn(largeX);
      const y2 = fn(largeX * 1.5);
      if (Number.isFinite(y1) && Number.isFinite(y2) && Math.abs(y1 - y2) < 0.01 * Math.max(1, Math.abs(y1))) {
        if (!asymptotes.some(a => a.type === 'horizontal')) {
          asymptotes.push({ type: 'horizontal', y: y1, equation: `y = ${y1.toFixed(4)}` });
        }
      }
      const yn1 = fn(-largeX);
      const yn2 = fn(-largeX * 1.5);
      if (Number.isFinite(yn1) && Number.isFinite(yn2) && Math.abs(yn1 - yn2) < 0.01 * Math.max(1, Math.abs(yn1))) {
        if (Math.abs(yn1 - (asymptotes.find(a => a.type === 'horizontal')?.y ?? Infinity)) > 0.1) {
          asymptotes.push({ type: 'horizontal', y: yn1, equation: `y = ${yn1.toFixed(4)}` });
        }
      }
    } catch {
      // ignore
    }
  }

  return asymptotes;
}

export function findAllAnalysis(
  fn: ScalarFunction,
  minX: number,
  maxX: number
) {
  return {
    roots: findRoots(fn, minX, maxX),
    extrema: findExtrema(fn, minX, maxX),
    asymptotes: detectAsymptotes(fn, minX, maxX),
  };
}

export function findIntersectionsWithOthers(
  fn: ScalarFunction,
  others: ScalarFunction[],
  minX: number,
  maxX: number
): Point[] {
  const all: Point[] = [];
  for (const other of others) {
    all.push(...findIntersections(fn, other, minX, maxX));
  }
  // Dedupe
  const deduped: Point[] = [];
  for (const p of all) {
    if (!deduped.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6)) {
      deduped.push(p);
    }
  }
  return deduped;
}
