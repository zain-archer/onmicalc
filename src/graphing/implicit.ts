/**
 * Implicit curves, contours and heat maps.
 *
 * Marching squares turns a sampled scalar grid into line segments, which is all
 * that is needed for implicit plots (F(x, y) = 0), contour lines of a surface
 * and the level curves used in engineering data review.
 */

import { CalcError } from '@/core/errors';

export interface Bounds2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface ScalarGrid {
  xs: number[];
  ys: number[];
  /** Values, `null` where the function is undefined or not finite. */
  values: (number | null)[][];
  min: number;
  max: number;
  steps: number;
}

export interface SampleGridOptions extends Bounds2D {
  steps?: number;
}

/** Samples z = f(x, y) for plotting; identical layout to the 3D surface grid. */
export function sampleGrid(
  f: (x: number, y: number) => number,
  options: SampleGridOptions,
): ScalarGrid {
  const steps = Math.max(2, Math.min(300, Math.floor(options.steps ?? 60)));
  if (!(options.xMax > options.xMin) || !(options.yMax > options.yMin)) {
    throw new CalcError('INPUT', 'A contour plot needs a range with max > min on both axes');
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= steps; i += 1) xs.push(options.xMin + ((options.xMax - options.xMin) * i) / steps);
  for (let j = 0; j <= steps; j += 1) ys.push(options.yMin + ((options.yMax - options.yMin) * j) / steps);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const values = ys.map((y) =>
    xs.map((x) => {
      let value: number;
      try {
        value = f(x, y);
      } catch {
        return null;
      }
      if (!Number.isFinite(value)) return null;
      if (value < min) min = value;
      if (value > max) max = value;
      return value;
    }),
  );
  return {
    xs,
    ys,
    values,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    steps,
  };
}

export interface Segment2D {
  a: { x: number; y: number };
  b: { x: number; y: number };
}

/**
 * Marching squares for one level. Cells that touch an undefined sample are
 * skipped rather than guessed, so poles show up as gaps instead of fake lines.
 */
export function marchingSquares(grid: ScalarGrid, level: number): Segment2D[] {
  const segments: Segment2D[] = [];
  for (let j = 0; j + 1 < grid.ys.length; j += 1) {
    for (let i = 0; i + 1 < grid.xs.length; i += 1) {
      const x0 = grid.xs[i]!;
      const x1 = grid.xs[i + 1]!;
      const y0 = grid.ys[j]!;
      const y1 = grid.ys[j + 1]!;
      const v00 = grid.values[j]?.[i];
      const v10 = grid.values[j]?.[i + 1];
      const v11 = grid.values[j + 1]?.[i + 1];
      const v01 = grid.values[j + 1]?.[i];
      if (v00 === null || v00 === undefined) continue;
      if (v10 === null || v10 === undefined) continue;
      if (v11 === null || v11 === undefined) continue;
      if (v01 === null || v01 === undefined) continue;
      const inside = [v00 >= level, v10 >= level, v11 >= level, v01 >= level].map((flag) => (flag ? 1 : 0));
      const code = inside[0]! + 2 * inside[1]! + 4 * inside[2]! + 8 * inside[3]!;
      if (code === 0 || code === 15) continue;
      const bottom = () => ({ x: lerp(x0, x1, ratio(v00, v10, level)), y: y0 });
      const right = () => ({ x: x1, y: lerp(y0, y1, ratio(v10, v11, level)) });
      const top = () => ({ x: lerp(x0, x1, ratio(v01, v11, level)), y: y1 });
      const left = () => ({ x: x0, y: lerp(y0, y1, ratio(v00, v01, level)) });
      push(segments, code, bottom, right, top, left);
    }
  }
  return segments;
}

function push(
  target: Segment2D[],
  code: number,
  bottom: () => { x: number; y: number },
  right: () => { x: number; y: number },
  top: () => { x: number; y: number },
  left: () => { x: number; y: number },
): void {
  switch (code) {
    case 1:
    case 14:
      target.push({ a: bottom(), b: left() });
      break;
    case 2:
    case 13:
      target.push({ a: bottom(), b: right() });
      break;
    case 3:
    case 12:
      target.push({ a: left(), b: right() });
      break;
    case 4:
    case 11:
      target.push({ a: right(), b: top() });
      break;
    case 5:
      target.push({ a: bottom(), b: left() });
      target.push({ a: right(), b: top() });
      break;
    case 6:
    case 9:
      target.push({ a: bottom(), b: top() });
      break;
    case 7:
    case 8:
      target.push({ a: left(), b: top() });
      break;
    case 10:
      target.push({ a: bottom(), b: right() });
      target.push({ a: left(), b: top() });
      break;
    default:
      break;
  }
}

function ratio(a: number, b: number, level: number): number {
  const denominator = b - a;
  if (Math.abs(denominator) < 1e-15) return 0.5;
  const t = (level - a) / denominator;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Implicit curve F(x, y) = level, sampled on a grid of the given size. */
export function implicitCurve(
  f: (x: number, y: number) => number,
  options: SampleGridOptions & { level?: number },
): Segment2D[] {
  const grid = sampleGrid(f, options);
  return marchingSquares(grid, options.level ?? 0);
}

/**
 * Evenly spaced, human-friendly levels inside [min, max] (values of the form
 * 1, 2, 2.5 or 5 times a power of ten).
 */
export function autoLevels(min: number, max: number, count = 8): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) return [];
  const steps = Math.max(2, Math.min(40, Math.floor(count)));
  const raw = (max - min) / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalised = raw / magnitude;
  const nice = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  const step = nice * magnitude;
  const levels: number[] = [];
  const first = Math.ceil(min / step) * step;
  for (let value = first; value <= max + step * 1e-9; value += step) {
    levels.push(Number(value.toPrecision(12)));
  }
  return levels;
}

export interface ContourSet {
  level: number;
  segments: Segment2D[];
}

/** Contour lines of a scalar field with automatically chosen levels. */
export function contourLines(
  f: (x: number, y: number) => number,
  options: SampleGridOptions & { levels?: number[]; count?: number },
): { grid: ScalarGrid; sets: ContourSet[] } {
  const grid = sampleGrid(f, options);
  const levels = options.levels ?? autoLevels(grid.min, grid.max, options.count ?? 8);
  return { grid, sets: levels.map((level) => ({ level, segments: marchingSquares(grid, level) })) };
}

/* --------------------------------- colours -------------------------------- */

export type PaletteName = 'spectral' | 'thermal' | 'terrain' | 'cool-warm' | 'mono';

/** Anchor colours per palette, dark/low to bright/high. */
const PALETTES: Record<PaletteName, string[]> = {
  spectral: ['#3b0f70', '#3f5aa6', '#2f9e8f', '#a8db34', '#f5b642', '#e05242', '#6d1b3a'],
  thermal: ['#05010d', '#42127f', '#b21f77', '#f26d21', '#f9d423', '#fffbe6'],
  terrain: ['#0b3d5c', '#12718a', '#4ea56a', '#d8c98b', '#9c6b47', '#f4f4f4'],
  'cool-warm': ['#3b4cc0', '#7d9bf0', '#c9d7f2', '#f2d7cf', '#e88b73', '#b40426'],
  mono: ['#0b1020', '#4a5570', '#8a93ab', '#c3c9d6', '#ffffff'],
};

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

/** Maps t in [0, 1] to a hex colour of the chosen palette (linear interpolation). */
export function colorRamp(t: number, palette: PaletteName = 'spectral'): string {
  const anchors = PALETTES[palette] ?? PALETTES.spectral;
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const scaled = clamped * (anchors.length - 1);
  const index = Math.min(anchors.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return mixHex(anchors[index]!, anchors[index + 1]!, local);
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

export interface HeatCell {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  value: number;
}

/**
 * One coloured cell per grid mesh, in world coordinates, for painting a heat map.
 * Cells touching an undefined sample are skipped.
 */
export function heatmapCells(
  grid: ScalarGrid,
  options: { palette?: PaletteName; min?: number; max?: number } = {},
): HeatCell[] {
  const min = options.min ?? grid.min;
  const max = options.max ?? grid.max;
  const span = max - min;
  const cells: HeatCell[] = [];
  for (let j = 0; j + 1 < grid.ys.length; j += 1) {
    for (let i = 0; i + 1 < grid.xs.length; i += 1) {
      const value = grid.values[j]?.[i];
      if (value === null || value === undefined) continue;
      const t = span < 1e-15 ? 0.5 : (value - min) / span;
      cells.push({
        x: grid.xs[i]!,
        y: grid.ys[j]!,
        width: grid.xs[i + 1]! - grid.xs[i]!,
        height: grid.ys[j + 1]! - grid.ys[j]!,
        fill: colorRamp(t, options.palette ?? 'spectral'),
        value,
      });
    }
  }
  return cells;
}
