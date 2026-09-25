import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT,
  formatTick,
  niceStep,
  pan,
  screenToWorldX,
  screenToWorldY,
  ticksFor,
  visibleBounds,
  worldToScreenX,
  worldToScreenY,
  zoom,
  zoomAt,
} from './viewport';
import { sampleFunction } from './sampling';
import {
  areaBetween,
  areaUnder,
  findExtrema,
  findIntersections,
  findRoots,
  tangentAt,
} from './analysis';
import { compileFunction } from '@/math/calculus';
import { CalcError } from '@/core/errors';

const f = (source: string) => {
  const fn = compileFunction(source);
  if (!fn) throw new Error('compile failed');
  return fn;
};

const SIZE = { width: 800, height: 400 };

describe('viewport transforms', () => {
  it('maps world to screen and back', () => {
    expect(worldToScreenX(DEFAULT_VIEWPORT, 0, SIZE)).toBe(400);
    expect(worldToScreenY(DEFAULT_VIEWPORT, 0, SIZE)).toBe(200);
    expect(screenToWorldX(DEFAULT_VIEWPORT, 400, SIZE)).toBe(0);
    expect(screenToWorldY(DEFAULT_VIEWPORT, 200, SIZE)).toBe(0);
    for (const value of [-37.5, 0, 12.25]) {
      const px = worldToScreenX(DEFAULT_VIEWPORT, value, SIZE);
      expect(screenToWorldX(DEFAULT_VIEWPORT, px, SIZE)).toBeCloseTo(value, 12);
    }
  });

  it('zooms and pans predictably', () => {
    const bounds = visibleBounds(DEFAULT_VIEWPORT, SIZE);
    // 20 world units per pixel across 800 px = 16000 units, so ±8000.
    expect(bounds.minX).toBeCloseTo(-8000, 9);
    expect(bounds.maxX).toBeCloseTo(8000, 9);

    const zoomed = zoom(DEFAULT_VIEWPORT, 2);
    expect(visibleBounds(zoomed, SIZE).maxX).toBeCloseTo(4000, 9);

    const panned = pan(DEFAULT_VIEWPORT, 100, 0);
    // Dragging right by 100 px moves the view left by 100 × 20 world units.
    expect(panned.centerX).toBeCloseTo(-2000, 9);
    expect(panned.centerY).toBe(0);
  });

  it('keeps the anchored world point fixed while zooming', () => {
    const anchorWorldX = screenToWorldX(DEFAULT_VIEWPORT, 100, SIZE);
    const anchorWorldY = screenToWorldY(DEFAULT_VIEWPORT, 50, SIZE);
    const zoomed = zoomAt(DEFAULT_VIEWPORT, 3, 100, 50, SIZE);
    expect(screenToWorldX(zoomed, 100, SIZE)).toBeCloseTo(anchorWorldX, 6);
    expect(screenToWorldY(zoomed, 50, SIZE)).toBeCloseTo(anchorWorldY, 6);
  });

  it('clamps absurd zoom levels instead of producing zero scale', () => {
    let viewport = DEFAULT_VIEWPORT;
    for (let i = 0; i < 200; i += 1) viewport = zoom(viewport, 10);
    expect(viewport.scaleX).toBeGreaterThan(0);
    expect(Number.isFinite(viewport.scaleX)).toBe(true);
  });

  it('produces nice ticks', () => {
    expect(niceStep(10, 10)).toBe(1);
    expect(niceStep(100, 10)).toBe(10);
    expect(niceStep(1, 10)).toBeCloseTo(0.1, 12);
    expect(ticksFor(-10, 10, 10).step).toBe(2);
    expect(ticksFor(-10, 10, 10).values).toContain(0);
    expect(ticksFor(-10, 10, 10).values.length).toBeGreaterThan(5);
    expect(formatTick(0.5, 0.5)).toBe('0.5');
    expect(formatTick(0, 0.5)).toBe('0');
    expect(formatTick(-2, 1)).toBe('-2');
    expect(formatTick(200000, 10000)).toMatch(/e\+5/);
  });
});

describe('sampling', () => {
  it('samples a continuous function into a single polyline', () => {
    const polylines = sampleFunction(f('x^2'), DEFAULT_VIEWPORT, SIZE);
    expect(polylines).toHaveLength(1);
    expect(polylines[0]!.points.length).toBeGreaterThan(100);
  });

  it('breaks at domain gaps instead of connecting across them', () => {
    const sqrtLines = sampleFunction(f('sqrt(x)'), DEFAULT_VIEWPORT, SIZE);
    const negativeSide = sqrtLines.flatMap((line) => line.points).filter((point) => point.x < 0);
    expect(negativeSide).toHaveLength(0);

    const logLines = sampleFunction(f('ln(x)'), DEFAULT_VIEWPORT, SIZE);
    expect(logLines.every((line) => line.points.every((point) => point.x > 0))).toBe(true);
  });

  it('breaks at vertical asymptotes', () => {
    const lines = sampleFunction(f('1/x'), DEFAULT_VIEWPORT, SIZE);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      const xs = line.points.map((point) => point.x);
      expect(Math.min(...xs.map(Math.abs))).toBeGreaterThan(0);
    }
  });

  it('never emits non-finite points', () => {
    for (const source of ['tan(x)', 'x^3', 'sin(1/x)', '1/(x^2-1)']) {
      for (const line of sampleFunction(f(source), DEFAULT_VIEWPORT, SIZE)) {
        for (const point of line.points) {
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
        }
      }
    }
  });
});

describe('analysis', () => {
  it('finds roots of a polynomial', () => {
    const roots = findRoots(f('x^2 - 4'), -10, 10);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toBeCloseTo(-2, 8);
    expect(roots[1]).toBeCloseTo(2, 8);
  });

  it('finds roots of a transcendental function', () => {
    const roots = findRoots(f('sin(x)'), 0, 10);
    expect(roots.map((root) => Number(root.toFixed(6)))).toEqual([0, 3.141593, 6.283185, 9.424778]);
  });

  it('finds intersections of two curves', () => {
    const intersections = findIntersections(f('x^2'), f('x + 2'), -5, 5);
    expect(intersections).toHaveLength(2);
    expect(intersections[0]!.x).toBeCloseTo(-1, 8);
    expect(intersections[0]!.y).toBeCloseTo(1, 8);
    expect(intersections[1]!.x).toBeCloseTo(2, 8);
    expect(intersections[1]!.y).toBeCloseTo(4, 8);
  });

  it('finds local extrema', () => {
    const extrema = findExtrema(f('x^3 - 3x'), -3, 3);
    expect(extrema).toHaveLength(2);
    expect(extrema[0]!.x).toBeCloseTo(-1, 5);
    expect(extrema[0]!.y).toBeCloseTo(2, 5);
    expect(extrema[1]!.x).toBeCloseTo(1, 5);
    expect(extrema[1]!.y).toBeCloseTo(-2, 5);
  });

  it('computes tangents', () => {
    const tangent = tangentAt(f('x^2'), 1, 1);
    expect(tangent.y).toBeCloseTo(1, 10);
    expect(tangent.slope).toBeCloseTo(2, 8);
    expect(tangent.line.y1).toBeCloseTo(-1, 8);
    expect(tangent.line.y2).toBeCloseTo(3, 8);
    expect(() => tangentAt(f('sqrt(x)'), -1, 1)).toThrowError(CalcError);
  });

  it('computes areas under and between curves', () => {
    expect(areaUnder(f('x^2'), 0, 3).value).toBeCloseTo(9, 9);
    const between = areaBetween(f('x'), f('x^2'), 0, 1);
    expect(between.value).toBeCloseTo(1 / 6, 9);
    expect(between.converged).toBe(true);
  });
});
