import type { ScalarFunction } from '@/math/calculus';
import { visibleBounds, type Size, type Viewport } from './viewport';

export interface Polyline {
  points: { x: number; y: number }[];
  /** True when the polyline ends at a suspected asymptote rather than a limit. */
  broken: boolean;
}

export interface SampleOptions {
  /** Samples per pixel (1 is usually plenty with the asymptote guard). */
  density?: number;
  /** Largest |y| drawn before a branch is cut (in world units). */
  clipY?: number;
}

/**
 * Samples f across the visible x-range and splits the result into polylines.
 * Domain gaps (NaN), overflow and suspected asymptotes break the curve instead
 * of drawing a straight line across a discontinuity, which would be a lie.
 */
export function sampleFunction(
  f: ScalarFunction,
  viewport: Viewport,
  size: Size,
  options: SampleOptions = {},
): Polyline[] {
  const density = Math.max(0.25, Math.min(4, options.density ?? 1));
  const bounds = visibleBounds(viewport, size);
  const steps = Math.max(8, Math.min(4000, Math.round(size.width * density)));
  const dx = (bounds.maxX - bounds.minX) / steps;
  const clipY = options.clipY ?? Math.max(1e6, Math.abs(bounds.maxY - bounds.minY) * 50);

  const polylines: Polyline[] = [];
  let current: { x: number; y: number }[] = [];
  const push = () => {
    if (current.length > 1) polylines.push({ points: current, broken: false });
    else if (current.length === 1) polylines.push({ points: [...current, ...current], broken: false });
    current = [];
  };

  for (let i = 0; i <= steps; i += 1) {
    const x = bounds.minX + i * dx;
    let y: number;
    try {
      y = f(x);
    } catch {
      y = Number.NaN;
    }

    if (!Number.isFinite(y) || Math.abs(y) > clipY) {
      // Undefined or effectively infinite: end the current branch.
      push();
      continue;
    }

    // Asymptote / jump detection: a huge change between adjacent samples that
    // also reverses the sign is treated as a break.
    const previous = current[current.length - 1];
    if (previous) {
      const jump = Math.abs(y - previous.y);
      const span = Math.max(1e-12, Math.abs(previous.y) + Math.abs(y));
      if (jump > clipY / 10 && jump / span > 0.98 && previous.y * y < 0) {
        push();
      }
    }

    current.push({ x, y });
  }
  push();
  return polylines;
}
