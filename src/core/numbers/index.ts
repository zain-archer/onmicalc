/** Numeric helpers with no dependencies. Safe for every platform. */
export const EPSILON = 1e-12;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Tolerant equality for floating point results. */
export function nearlyEqual(a: number, b: number, tolerance = 1e-9): boolean {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tolerance * scale;
}

/** True for values that are mathematically integers within tolerance. */
export function isNearlyInteger(value: number, tolerance = 1e-9): boolean {
  return Number.isFinite(value) && Math.abs(value - Math.round(value)) <= tolerance;
}

export function assertFinite(value: number, label = 'result'): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} is not a finite number`);
  }
  return value;
}
