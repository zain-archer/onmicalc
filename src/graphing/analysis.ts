import type { ScalarFunction } from '@/math/calculus';
import { derivative, integrate } from '@/math/calculus';
import { CalcError } from '@/core/errors';

/** Numeric analysis of graphed functions: roots, extrema, intersections, area. */

export interface Point {
  x: number;
  y: number;
}

function safe(f: ScalarFunction, x: number): number {
  try {
    const value = f(x);
    return Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

/** Bisection with a sign-change bracket; returns null when there is no bracket. */
function bisect(f: ScalarFunction, a: number, b: number, tolerance = 1e-12): number | null {
  let left = a;
  let right = b;
  let fLeft = safe(f, left);
  let fRight = safe(f, right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight) || fLeft * fRight > 0) return null;
  for (let i = 0; i < 300; i += 1) {
    const mid = (left + right) / 2;
    const fMid = safe(f, mid);
    if (!Number.isFinite(fMid)) return null;
    if (Math.abs(fMid) < tolerance || right - left < tolerance) return mid;
    if (fLeft * fMid < 0) {
      right = mid;
      fRight = fMid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }
  void fRight;
  return (left + right) / 2;
}

/** All sign-change roots in [minX, maxX], verified by evaluating the function. */
export function findRoots(f: ScalarFunction, minX: number, maxX: number, samples = 2000): number[] {
  const roots: number[] = [];
  // A root exactly on the left endpoint is not a sign change, so check it first.
  const startValue = safe(f, minX);
  if (Number.isFinite(startValue) && Math.abs(startValue) < 1e-12) roots.push(minX);
  const dx = (maxX - minX) / samples;
  let previousX = minX;
  let previousY = safe(f, previousX);
  for (let i = 1; i <= samples; i += 1) {
    const x = minX + i * dx;
    const y = safe(f, x);
    if (Number.isFinite(previousY) && Number.isFinite(y)) {
      if (y === 0) roots.push(x);
      else if (previousY * y < 0) {
        const root = bisect(f, previousX, x);
        if (root !== null && Math.abs(safe(f, root)) < 1e-6) roots.push(root);
      }
    }
    previousX = x;
    previousY = y;
  }
  return dedupe(roots);
}

export function findIntersections(
  f: ScalarFunction,
  g: ScalarFunction,
  minX: number,
  maxX: number,
  samples = 2000,
): Point[] {
  const difference: ScalarFunction = (x) => safe(f, x) - safe(g, x);
  return findRoots(difference, minX, maxX, samples).map((x) => ({ x, y: safe(f, x) }));
}

/** Local extrema from sign changes of the numerical derivative. */
export function findExtrema(f: ScalarFunction, minX: number, maxX: number, samples = 1000): Point[] {
  const points: Point[] = [];
  const dx = (maxX - minX) / samples;
  const slope = (x: number) => {
    try {
      return derivative(f, x).value;
    } catch {
      return Number.NaN;
    }
  };
  let previousX = minX;
  let previousSlope = slope(previousX);
  for (let i = 1; i <= samples; i += 1) {
    const x = minX + i * dx;
    const currentSlope = slope(x);
    if (Number.isFinite(previousSlope) && Number.isFinite(currentSlope) && previousSlope * currentSlope < 0) {
      const root = bisect(slope, previousX, x, 1e-10);
      if (root !== null) {
        const y = safe(f, root);
        if (Number.isFinite(y)) points.push({ x: root, y });
      }
    }
    previousX = x;
    previousSlope = currentSlope;
  }
  return points;
}

/** Tangent line data at a point: value, slope and the line's two endpoints. */
export interface Tangent {
  x: number;
  y: number;
  slope: number;
  line: { x1: number; y1: number; x2: number; y2: number };
}

export function tangentAt(f: ScalarFunction, x: number, halfWidth: number): Tangent {
  const y = safe(f, x);
  if (!Number.isFinite(y)) {
    throw new CalcError('DOMAIN', `The function is not defined at x = ${x}`);
  }
  const slope = derivative(f, x).value;
  return {
    x,
    y,
    slope,
    line: {
      x1: x - halfWidth,
      y1: y - slope * halfWidth,
      x2: x + halfWidth,
      y2: y + slope * halfWidth,
    },
  };
}

export interface AreaResult {
  value: number;
  error: number;
  converged: boolean;
}

export function areaUnder(f: ScalarFunction, a: number, b: number): AreaResult {
  const result = integrate(f, a, b);
  return { value: result.value, error: result.error, converged: result.converged };
}

/** Area between two curves over [a, b]. */
export function areaBetween(f: ScalarFunction, g: ScalarFunction, a: number, b: number): AreaResult {
  const difference: ScalarFunction = (x) => safe(f, x) - safe(g, x);
  const result = integrate(difference, a, b);
  return { value: result.value, error: result.error, converged: result.converged };
}

function dedupe(values: number[]): number[] {
  const out: number[] = [];
  for (const value of values.sort((a, b) => a - b)) {
    if (out.length === 0 || Math.abs(out[out.length - 1]! - value) > 1e-9) out.push(value);
  }
  return out;
}
