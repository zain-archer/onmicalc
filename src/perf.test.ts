import { describe, expect, it } from 'vitest';
import { sampleFunction } from '@/graphing/sampling';
import { DEFAULT_VIEWPORT, zoom } from '@/graphing/viewport';
import { integrate } from '@/math/calculus';
import { evaluateExpression } from '@/core/engine';
import { compileFunction } from '@/math/calculus';

/**
 * Performance guardrails. These assert *bounded work* rather than wall-clock
 * timings, so they stay meaningful on any machine and never flake in CI.
 */
describe('bounded computation', () => {
  it('caps graph sampling points per curve', () => {
    const f = compileFunction('sin(x) * 1000 + x')!;
    let view = DEFAULT_VIEWPORT;
    for (let index = 0; index < 8; index += 1) view = zoom(view, 0.5);
    const polylines = sampleFunction(f, view, { width: 4000, height: 3000 });
    const points = polylines.reduce((total, line) => total + line.points.length, 0);
    // 4000 steps plus the closing sample.
    expect(points).toBeLessThanOrEqual(4001);
    expect(points).toBeGreaterThan(10);
  });

  it('keeps adaptive integration within its subdivision budget', () => {
    const f = compileFunction('exp(-x^2) * sin(20*x)')!;
    const result = integrate(f, -10, 10, { maxDepth: 14 });
    expect(result.subdivisions).toBeLessThanOrEqual(2 ** 14 + 1);
    expect(Number.isFinite(result.value)).toBe(true);
  });

  it('evaluates long expressions quickly enough for live typing', () => {
    const source = Array.from({ length: 200 }, (_, index) => `sin(${index}) + ${index}`).join(' + ');
    const started = performance.now();
    const result = evaluateExpression(source);
    const elapsed = performance.now() - started;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(250);
  });

  it('does not leak unbounded sample arrays for a discontinuous function', () => {
    const f = compileFunction('1/x')!;
    const polylines = sampleFunction(f, DEFAULT_VIEWPORT, { width: 800, height: 600 });
    expect(polylines.length).toBeGreaterThan(1);
    expect(polylines.every((line) => line.points.length <= 900)).toBe(true);
  });
});
