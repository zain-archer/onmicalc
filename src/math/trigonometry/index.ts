import { CalcError } from '@/core/errors';
import { EPSILON, isNearlyInteger } from '@/core/numbers';
import { fromRadians, toRadians, type AngleMode } from '@/core/numbers/angle';

/** Full turn expressed in the given angle mode. */
export function fullTurn(mode: AngleMode): number {
  return mode === 'DEG' ? 360 : mode === 'GRAD' ? 400 : 2 * Math.PI;
}

const S3 = Math.sqrt(3);

/**
 * Trigonometry is exact at every twelfth of a turn (30° steps). Values below are
 * the closed forms, so sin(30°) is 0.5 — not 0.49999999999999994 as a raw
 * radian conversion would give.
 */
const S2 = Math.SQRT2;
/** Exact values at every eighth of a turn (45° steps). */
const SIN_EIGHTH = [0, S2 / 2, 1, S2 / 2, 0, -S2 / 2, -1, -S2 / 2] as const;
const COS_EIGHTH = [1, S2 / 2, 0, -S2 / 2, -1, -S2 / 2, 0, S2 / 2] as const;

const SIN_TWELFTH = [0, 0.5, S3 / 2, 1, S3 / 2, 0.5, 0, -0.5, -S3 / 2, -1, -S3 / 2, -0.5] as const;
const COS_TWELFTH = [1, S3 / 2, 0.5, 0, -0.5, -S3 / 2, -1, -S3 / 2, -0.5, 0, 0.5, S3 / 2] as const;

/**
 * Index of the twelfth of a turn, or null when the angle is not an exact
 * twelfth. Radian input is never snapped: floating-point π is not symbolic π,
 * so claiming exactness there would be dishonest.
 */
function fractionIndex(angle: number, mode: AngleMode, divisions: number): number | null {
  if (mode === 'RAD') return null;
  const period = fullTurn(mode);
  const normalised = ((angle % period) + period) % period;
  const units = (normalised / period) * divisions;
  if (!isNearlyInteger(units, 1e-10)) return null;
  return ((Math.round(units) % divisions) + divisions) % divisions;
}

/** Exact sine/cosine at twelfth- and eighth-of-a-turn angles, else null. */
function exactSinCos(angle: number, mode: AngleMode): readonly [number, number] | null {
  const twelfth = fractionIndex(angle, mode, 12);
  if (twelfth !== null) return [SIN_TWELFTH[twelfth]!, COS_TWELFTH[twelfth]!];
  const eighth = fractionIndex(angle, mode, 8);
  if (eighth !== null) return [SIN_EIGHTH[eighth]!, COS_EIGHTH[eighth]!];
  return null;
}

/** Avoids "-0": tan(180°) must read 0, not -0. */
function norm(value: number): number {
  return value === 0 ? 0 : value;
}

function undefinedAtQuarter(name: string, mode: AngleMode, angle: number): never {
  const unit = mode === 'DEG' ? '°' : mode === 'GRAD' ? ' grad' : ' rad';
  throw new CalcError('DOMAIN', `${name} is undefined at ${angle}${unit}`, {
    details: 'The function has a vertical asymptote there, so no finite value exists.',
  });
}

export function sin(angle: number, mode: AngleMode): number {
  const exact = exactSinCos(angle, mode);
  if (exact) return norm(exact[0]);
  return norm(Math.sin(toRadians(angle, mode)));
}

export function cos(angle: number, mode: AngleMode): number {
  const exact = exactSinCos(angle, mode);
  if (exact) return norm(exact[1]);
  return norm(Math.cos(toRadians(angle, mode)));
}

export function tan(angle: number, mode: AngleMode): number {
  const exact = exactSinCos(angle, mode);
  if (exact) {
    if (exact[1] === 0) undefinedAtQuarter('tan', mode, angle);
    return norm(exact[0] / exact[1]);
  }
  const value = Math.tan(toRadians(angle, mode));
  if (!Number.isFinite(value)) undefinedAtQuarter('tan', mode, angle);
  return norm(value);
}

export function cot(angle: number, mode: AngleMode): number {
  const tangent = tan(angle, mode);
  if (tangent === 0) undefinedAtQuarter('cot', mode, angle);
  return 1 / tangent;
}

export function sec(angle: number, mode: AngleMode): number {
  const cosine = cos(angle, mode);
  if (cosine === 0) undefinedAtQuarter('sec', mode, angle);
  return 1 / cosine;
}

export function csc(angle: number, mode: AngleMode): number {
  const sine = sin(angle, mode);
  if (sine === 0) undefinedAtQuarter('csc', mode, angle);
  return 1 / sine;
}

/**
 * Inverse results in degree/gradian mode are snapped to the nearest whole unit
 * when they are within 1e-9 of it: asin(0.5) should read 30, not 30.000000000000004.
 */
function snapAngle(value: number, mode: AngleMode): number {
  if (mode === 'RAD') return value;
  const nearest = Math.round(value);
  return Math.abs(value - nearest) <= 1e-9 * Math.max(1, Math.abs(value)) ? nearest : value;
}

function requireUnitRange(name: string, x: number): void {
  if (Math.abs(x) > 1 + EPSILON) {
    throw new CalcError('DOMAIN', `${name}() is only defined for inputs between -1 and 1`, {
      details: `Received ${x}.`,
    });
  }
}

/** Clamp tiny overshoots (asin(1.0000000000000002)) before applying Math. */
function clampUnit(x: number): number {
  return x > 1 ? 1 : x < -1 ? -1 : x;
}

export function asin(x: number, mode: AngleMode): number {
  requireUnitRange('asin', x);
  return snapAngle(fromRadians(Math.asin(clampUnit(x)), mode), mode);
}

export function acos(x: number, mode: AngleMode): number {
  requireUnitRange('acos', x);
  return snapAngle(fromRadians(Math.acos(clampUnit(x)), mode), mode);
}

export function atan(x: number, mode: AngleMode): number {
  return snapAngle(fromRadians(Math.atan(x), mode), mode);
}

export function atan2(y: number, x: number, mode: AngleMode): number {
  if (x === 0 && y === 0) {
    throw new CalcError('DOMAIN', 'atan2(0, 0) is undefined');
  }
  return snapAngle(fromRadians(Math.atan2(y, x), mode), mode);
}

export function acot(x: number, mode: AngleMode): number {
  if (x === 0) return snapAngle(fromRadians(Math.PI / 2, mode), mode);
  return snapAngle(fromRadians(Math.atan(1 / x), mode) + (x < 0 ? fullTurn(mode) / 2 : 0), mode);
}

export function asec(x: number, mode: AngleMode): number {
  if (Math.abs(x) < 1) {
    throw new CalcError('DOMAIN', 'asec() is only defined for |x| >= 1', { details: `Received ${x}.` });
  }
  return acos(1 / x, mode);
}

export function acsc(x: number, mode: AngleMode): number {
  if (Math.abs(x) < 1) {
    throw new CalcError('DOMAIN', 'acsc() is only defined for |x| >= 1', { details: `Received ${x}.` });
  }
  return asin(1 / x, mode);
}

export function sinh(x: number): number {
  return Math.sinh(x);
}

export function cosh(x: number): number {
  return Math.cosh(x);
}

export function tanh(x: number): number {
  return Math.tanh(x);
}

export function coth(x: number): number {
  if (x === 0) throw new CalcError('DOMAIN', 'coth(0) is undefined');
  const t = Math.tanh(x);
  if (t === 0 || Math.abs(t) < Number.MIN_VALUE) {
    throw new CalcError('OVERFLOW', 'coth() result is too large to represent');
  }
  return 1 / t;
}

export function asinh(x: number): number {
  return Math.asinh(x);
}

export function acosh(x: number): number {
  if (x < 1) throw new CalcError('DOMAIN', 'acosh() is only defined for x >= 1', { details: `Received ${x}.` });
  return Math.acosh(x);
}

export function atanh(x: number): number {
  if (Math.abs(x) >= 1) {
    throw new CalcError('DOMAIN', 'atanh() is only defined for |x| < 1', { details: `Received ${x}.` });
  }
  return Math.atanh(x);
}
