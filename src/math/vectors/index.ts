import { CalcError } from '@/core/errors';
import { EPSILON } from '@/core/numbers';

export type Vector = number[];

export function assertVector(v: Vector, label = 'vector'): Vector {
  if (v.length === 0) throw new CalcError('DIMENSION', `The ${label} is empty`);
  if (!v.every(Number.isFinite)) throw new CalcError('DIMENSION', `The ${label} must contain finite numbers`);
  return v;
}

function sameLength(a: Vector, b: Vector): void {
  if (a.length !== b.length) {
    throw new CalcError('DIMENSION', 'Vectors must have the same number of components', {
      details: `Received lengths ${a.length} and ${b.length}.`,
    });
  }
}

export function add(a: Vector, b: Vector): Vector {
  assertVector(a, 'first vector');
  assertVector(b, 'second vector');
  sameLength(a, b);
  return a.map((value, index) => value + b[index]!);
}

export function subtract(a: Vector, b: Vector): Vector {
  assertVector(a, 'first vector');
  assertVector(b, 'second vector');
  sameLength(a, b);
  return a.map((value, index) => value - b[index]!);
}

export function scale(a: Vector, factor: number): Vector {
  assertVector(a);
  if (!Number.isFinite(factor)) throw new CalcError('DOMAIN', 'The scalar must be finite');
  return a.map((value) => value * factor);
}

export function dot(a: Vector, b: Vector): number {
  assertVector(a, 'first vector');
  assertVector(b, 'second vector');
  sameLength(a, b);
  return a.reduce((sum, value, index) => sum + value * b[index]!, 0);
}

/** 3-component cross product (also defined for 2D by treating z as 0). */
export function cross(a: Vector, b: Vector): Vector {
  assertVector(a, 'first vector');
  assertVector(b, 'second vector');
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  if (a.length === 2 && b.length === 2) return [az * bx - ax * bz + (ax * by - ay * bx)];
  if (a.length !== 3 || b.length !== 3) {
    throw new CalcError('DIMENSION', 'The cross product is defined for 3-component vectors', {
      details: `Received lengths ${a.length} and ${b.length}.`,
    });
  }
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

export function magnitude(a: Vector): number {
  assertVector(a);
  return Math.hypot(...a);
}

export function normalize(a: Vector): Vector {
  assertVector(a);
  const length = magnitude(a);
  if (length === 0) {
    throw new CalcError('DOMAIN', 'The zero vector has no direction, so it cannot be normalised');
  }
  return a.map((value) => {
    const scaled = value / length;
    return Math.abs(scaled) < 1e-15 ? 0 : Number(scaled.toPrecision(12));
  });
}

export function distance(a: Vector, b: Vector): number {
  return magnitude(subtract(a, b));
}

/** Scalar projection of a onto b. */
export function projectionScalar(a: Vector, b: Vector): number {
  const length = magnitude(b);
  if (length === 0) throw new CalcError('DOMAIN', 'Cannot project onto the zero vector');
  return dot(a, b) / length;
}

/** Vector projection of a onto b. */
export function projection(a: Vector, b: Vector): Vector {
  const lengthSquared = dot(b, b);
  if (lengthSquared === 0) throw new CalcError('DOMAIN', 'Cannot project onto the zero vector');
  return scale(b, dot(a, b) / lengthSquared);
}

/** Angle between two vectors in radians; throws when a vector is zero. */
export function angleBetween(a: Vector, b: Vector): number {
  const lengths = magnitude(a) * magnitude(b);
  if (lengths === 0) throw new CalcError('DOMAIN', 'The angle is undefined when a vector is zero');
  const cosine = dot(a, b) / lengths;
  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

export function equals(a: Vector, b: Vector, tolerance = 1e-9): boolean {
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]!) <= tolerance);
}

export function formatVector(a: Vector, precision = 6): string {
  return `(${a.map((value) => Number(value.toPrecision(precision))).join(', ')})`;
}

export function parseVector(input: string): Vector | null {
  const text = input.trim();
  if (!text) return null;
  const inner = /^[([{](.*)[)\]}]$/s.exec(text);
  const source = inner ? inner[1]! : text;
  const parts = source.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const values: number[] = [];
  for (const part of parts) {
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(part)) return null;
    values.push(Number(part));
  }
  return values;
}

export { EPSILON };
