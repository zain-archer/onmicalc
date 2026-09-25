import { describe, expect, it } from 'vitest';
import {
  cross,
  distance,
  meanDepth,
  normalise,
  project,
  rotate,
  sampleSurface,
  spaceCurve,
  surfaceQuads,
  surfaceWireframe,
  DEFAULT_VIEW_3D,
  type Vec3,
} from '@/graphing/threeD';
import {
  curl,
  divergence,
  gradientField,
  streamlines,
  vectorField,
} from '@/graphing/fields';
import {
  autoLevels,
  colorRamp,
  contourLines,
  heatmapCells,
  implicitCurve,
  marchingSquares,
  sampleGrid,
  PALETTE_NAMES,
} from '@/graphing/implicit';

const wholeInterval = { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5 };

describe('3D surfaces', () => {
  it('samples z = f(x, y) and reports the value range', () => {
    const grid = sampleSurface((x, y) => x * x + y * y, { ...wholeInterval, xMin: -2, xMax: 2, yMin: -2, yMax: 2, steps: 20 });
    expect(grid.steps).toBe(20);
    expect(grid.xs).toHaveLength(21);
    expect(grid.zs).toHaveLength(21);
    expect(grid.minZ).toBeCloseTo(0, 12);
    expect(grid.maxZ).toBeCloseTo(8, 12);
    expect(grid.zs[10]![10]).toBeCloseTo(0, 12);
  });

  it('marks undefined samples as null instead of inventing values', () => {
    const grid = sampleSurface((x, y) => 1 / x + y, { ...wholeInterval, steps: 30 });
    const flat = grid.zs.flat();
    expect(flat.some((value) => value === null)).toBe(true);
    expect(flat.filter((value) => value === null).length).toBe(31); // the whole x = 0 column
  });

  it('refuses a degenerate range', () => {
    expect(() => sampleSurface((x, y) => x + y, { xMin: 1, xMax: 1, yMin: 0, yMax: 1 })).toThrow();
  });

  it('rotates and projects without distorting lengths', () => {
    const point: Vec3 = { x: 3, y: -2, z: 1 };
    expect(distance(rotate(point, 0.7, -0.4), { x: 0, y: 0, z: 0 })).toBeCloseTo(
      distance(point, { x: 0, y: 0, z: 0 }),
      12,
    );
    const tilted = rotate({ x: 0, y: 0, z: 1 }, 0, Math.PI / 2);
    expect(tilted.y).toBeCloseTo(-1, 12);
    expect(tilted.z).toBeCloseTo(0, 12);

    const view = { ...DEFAULT_VIEW_3D, yaw: 0, pitch: 0, scale: 10, originU: 100, originV: 100 };
    expect(project({ x: 2, y: 0, z: 3 }, view)).toMatchObject({ u: 120, v: 70 });
    // Perspective: a point nearer the camera projects further from the centre.
    const near = project({ x: 1, y: 5, z: 0 }, { ...view, distance: 20 });
    const far = project({ x: 1, y: -5, z: 0 }, { ...view, distance: 20 });
    expect(near.u - 100).toBeGreaterThan(far.u - 100);
  });

  it('builds a wireframe and shaded quads with depth ordering', () => {
    const grid = sampleSurface((x, y) => x - y, { ...wholeInterval, steps: 10 });
    const lines = surfaceWireframe(grid);
    expect(lines).toHaveLength(22); // 11 rows + 11 columns
    expect(lines[0]!.points).toHaveLength(11);
    expect(meanDepth(lines[0]!.points, DEFAULT_VIEW_3D)).toBeTypeOf('number');

    const quads = surfaceQuads(grid, DEFAULT_VIEW_3D);
    expect(quads).toHaveLength(100);
    for (const quad of quads) {
      expect(quad.shade).toBeGreaterThanOrEqual(0);
      expect(quad.shade).toBeLessThanOrEqual(1);
    }
    // The normal of a plane z = x − y is (−1, 1, 1)/√3 for every quad.
    const flatVector = cross({ x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: -1 });
    expect(Math.abs(normalise(flatVector).z)).toBeCloseTo(1 / Math.sqrt(3), 12);
  });

  it('samples space curves and drops undefined points', () => {
    const helix = spaceCurve((t) => ({ x: Math.cos(t), y: Math.sin(t), z: t }), {
      tMin: 0,
      tMax: 4 * Math.PI,
      steps: 400,
    });
    expect(helix).toHaveLength(401);
    for (const point of helix) expect(Math.hypot(point.x, point.y)).toBeCloseTo(1, 9);
    const broken = spaceCurve((t) => ({ x: 1 / t, y: 0, z: 0 }), { tMin: -1, tMax: 1, steps: 10 });
    expect(broken.length).toBeLessThan(11);
  });
});

describe('vector fields', () => {
  it('samples a rotational field and normalises the arrows', () => {
    const field = vectorField((_x, y) => -y, (x, _y) => x, { ...wholeInterval, steps: 10 });
    expect(field.arrows).toHaveLength(121);
    expect(field.maxMagnitude).toBeCloseTo(Math.hypot(1.5, 1.5), 10); // largest at a corner

    const normalised = vectorField((_x, y) => -y, (x, _y) => x, {
      ...wholeInterval,
      steps: 10,
      scaling: 'direction',
    });
    for (const arrow of normalised.arrows) {
      if (arrow.magnitude < 1e-9) continue;
      expect(Math.hypot(arrow.dx, arrow.dy)).toBeCloseTo(0.9, 12);
    }
    const raw = vectorField((_x, y) => -y, (x, _y) => x, { ...wholeInterval, steps: 10, scaling: 'raw' });
    expect(raw.arrows[0]).toMatchObject({ x: -1.5, y: -1.5, dx: 1.5, dy: -1.5 });
  });

  it('finds the stagnation point of a rotation field and refuses bad bounds', () => {
    const field = vectorField((_x, y) => -y, (x, _y) => x, { xMin: -0.5, xMax: 0.5, yMin: -0.5, yMax: 0.5, steps: 8 });
    expect(field.zeros).toHaveLength(1);
    expect(field.zeros[0]!.x).toBeCloseTo(0, 6);
    expect(field.zeros[0]!.y).toBeCloseTo(0, 6);
    expect(() => vectorField((_x, y) => y, (x, _y) => x, { xMin: 0, xMax: 0, yMin: 0, yMax: 1 })).toThrow();
  });

  it('differentiates fields numerically', () => {
    const gradient = gradientField((x, y) => x * x + y * y, 1, 2);
    expect(gradient.fx).toBeCloseTo(2, 5);
    expect(gradient.fy).toBeCloseTo(4, 5);
    expect(divergence((x, _y) => x, (_x, y) => y, 0.7, -0.3)).toBeCloseTo(2, 5);
    expect(divergence((_x, y) => -y, (x, _y) => x, 0.7, -0.3)).toBeCloseTo(0, 5);
    expect(curl((x, _y) => x, (_x, y) => y, 0.7, -0.3)).toBeCloseTo(0, 5);
    expect(curl((_x, y) => -y, (x, _y) => x, 0.7, -0.3)).toBeCloseTo(2, 5);
  });

  it('traces streamlines that stay on the stream function level curves', () => {
    const box = { xMin: -1, xMax: 1, yMin: -1, yMax: 1 };
    const lines = streamlines((_x, y) => -y, (x, _y) => x, { ...box, seeds: 3, maxSteps: 400 });
    expect(lines.length).toBe(3);
    expect(lines.some((line) => line.closed)).toBe(true);
    for (const line of lines) {
      expect(line.points.length).toBeGreaterThan(20);
      const radius = Math.hypot(line.points[0]!.x, line.points[0]!.y);
      for (const point of line.points) {
        // Points clamped onto the plotting box border are the documented exception.
        const onBorder =
          Math.abs(Math.abs(point.x) - 1) < 1e-9 || Math.abs(Math.abs(point.y) - 1) < 1e-9;
        if (onBorder) continue;
        expect(Math.hypot(point.x, point.y)).toBeCloseTo(radius, 2);
        expect(Math.abs(point.x)).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});

describe('implicit curves, contours and heat maps', () => {
  it('draws straight implicit lines exactly', () => {
    const diagonal = implicitCurve((x, y) => y - x, { ...wholeInterval, steps: 100, level: 0 });
    expect(diagonal.length).toBeGreaterThan(100);
    let total = 0;
    for (const segment of diagonal) {
      expect(segment.a.y - segment.a.x).toBeCloseTo(0, 9);
      expect(segment.b.y - segment.b.x).toBeCloseTo(0, 9);
      total += Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
    }
    expect(total).toBeCloseTo(3 * Math.SQRT2, 6);
  });

  it('recovers a circle of the expected length', () => {
    const circle = marchingSquares(sampleGrid((x, y) => x * x + y * y, { ...wholeInterval, steps: 200 }), 1);
    expect(circle.length).toBeGreaterThan(400);
    let total = 0;
    for (const segment of circle) {
      expect(Math.hypot(segment.a.x, segment.a.y)).toBeCloseTo(1, 3);
      total += Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
    }
    expect(total).toBeCloseTo(2 * Math.PI, 2);
  });

  it('skips cells that touch an undefined sample', () => {
    const grid = sampleGrid((x, y) => Math.sqrt(x) + y, { ...wholeInterval, steps: 20 });
    const cells = heatmapCells(grid);
    expect(cells.length).toBeLessThan(20 * 20);
    for (const cell of cells) expect(cell.x).toBeGreaterThanOrEqual(0);
    expect(cells.length).toBe(10 * 20); // x ∈ [0, 1.5] only, 10 of 20 columns
  });

  it('picks human-friendly levels and shades a heat map', () => {
    expect(autoLevels(0, 10, 8)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(autoLevels(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(autoLevels(5, 5, 4)).toEqual([]);

    expect(colorRamp(0, 'mono')).toBe('#0b1020');
    expect(colorRamp(1, 'mono')).toBe('#ffffff');
    expect(colorRamp(-3, 'thermal')).toBe(colorRamp(0, 'thermal'));
    expect(colorRamp(9, 'thermal')).toBe(colorRamp(1, 'thermal'));
    for (const name of PALETTE_NAMES) expect(colorRamp(0.5, name)).toMatch(/^#[0-9a-f]{6}$/);

    const { grid, sets } = contourLines((x, y) => x * x + y * y, { ...wholeInterval, steps: 60, count: 6 });
    expect(sets.length).toBeGreaterThan(3);
    expect(sets.map((set) => set.level)).toEqual([...sets].map((set) => set.level).sort((a, b) => a - b));
    for (const set of sets) if (set.level > grid.min) expect(set.segments.length).toBeGreaterThan(0);
    expect(grid.min).toBeCloseTo(0, 12);
    expect(grid.max).toBeCloseTo(4.5, 12);
  });
});
