import { CalcError } from '@/core/errors';

/** Electrical, physics and geometry calculators. Pure functions, SI units. */

function requirePositive(value: number, label: string, allowZero = false): number {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new CalcError('DOMAIN', `${label} must be ${allowZero ? 'non-negative' : 'positive'}`, {
      details: `Received ${value}.`,
    });
  }
  return value;
}

/* ---------------------------- Electrical ---------------------------- */

export interface OhmResult {
  voltage: number;
  current: number;
  resistance: number;
  power: number;
  /** Which quantity was solved for. */
  solvedFor: 'voltage' | 'current' | 'resistance' | 'power';
}

/** Ohm's law plus the power relations, given exactly two known quantities. */
export function ohmsLaw(known: Partial<Record<'voltage' | 'current' | 'resistance' | 'power', number>>): OhmResult {
  const { voltage, current, resistance, power } = known;
  const defined = [voltage, current, resistance, power].filter((value) => value !== undefined).length;
  if (defined !== 2) {
    throw new CalcError('INPUT', 'Provide exactly two known quantities', {
      details: 'Ohm’s law needs any two of voltage, current, resistance and power.',
    });
  }

  if (voltage !== undefined && current !== undefined) {
    return finish('power', voltage, current, current === 0 ? Number.POSITIVE_INFINITY : voltage / current, voltage * current);
  }
  if (voltage !== undefined && resistance !== undefined) {
    requirePositive(resistance, 'Resistance');
    const amps = voltage / resistance;
    return finish('current', voltage, amps, resistance, voltage * amps);
  }
  if (voltage !== undefined && power !== undefined) {
    if (voltage === 0) throw new CalcError('DIV_ZERO', 'Voltage cannot be zero when power is given');
    const amps = power / voltage;
    return finish('current', voltage, amps, voltage / amps, power);
  }
  if (current !== undefined && resistance !== undefined) {
    const volts = current * resistance;
    return finish('voltage', volts, current, resistance, volts * current);
  }
  if (current !== undefined && power !== undefined) {
    if (current === 0) throw new CalcError('DIV_ZERO', 'Current cannot be zero when power is given');
    const volts = power / current;
    return finish('voltage', volts, current, volts / current, power);
  }
  if (resistance !== undefined && power !== undefined) {
    requirePositive(resistance, 'Resistance');
    const volts = Math.sqrt(power * resistance);
    return finish('voltage', volts, volts / resistance, resistance, power);
  }
  throw new CalcError('INPUT', 'Unsupported combination of known quantities');

  function finish(
    solvedFor: OhmResult['solvedFor'],
    v: number,
    i: number,
    r: number,
    p: number,
  ): OhmResult {
    return { voltage: v, current: i, resistance: r, power: p, solvedFor };
  }
}

export function seriesResistance(values: readonly number[]): number {
  if (values.length === 0) throw new CalcError('INPUT', 'Add at least one resistor');
  for (const value of values) requirePositive(value, 'Each resistance', true);
  return values.reduce((total, value) => total + value, 0);
}

export function parallelResistance(values: readonly number[]): number {
  if (values.length === 0) throw new CalcError('INPUT', 'Add at least one resistor');
  for (const value of values) requirePositive(value, 'Each resistance');
  return 1 / values.reduce((total, value) => total + 1 / value, 0);
}

/** Capacitor energy in joules and the RC time constant. */
export function capacitorEnergy(capacitance: number, voltage: number): { energy: number } {
  requirePositive(capacitance, 'Capacitance');
  return { energy: 0.5 * capacitance * voltage * voltage };
}

export function rcTimeConstant(resistance: number, capacitance: number): { tau: number; halfLife: number } {
  requirePositive(resistance, 'Resistance');
  requirePositive(capacitance, 'Capacitance');
  const tau = resistance * capacitance;
  return { tau, halfLife: tau * Math.LN2 };
}

/** Charge stored on a capacitor. */
export function capacitorCharge(capacitance: number, voltage: number): number {
  requirePositive(capacitance, 'Capacitance');
  return capacitance * voltage;
}

/* ------------------------------ Physics ----------------------------- */

export function force(mass: number, acceleration: number): number {
  return requirePositive(mass, 'Mass', true) * acceleration;
}

export function weight(mass: number, gravity = 9.80665): number {
  return requirePositive(mass, 'Mass', true) * gravity;
}

export function work(forceValue: number, distance: number, angleDegrees = 0): number {
  const radians = (angleDegrees * Math.PI) / 180;
  return forceValue * distance * Math.cos(radians);
}

export function kineticEnergy(mass: number, velocity: number): number {
  return 0.5 * requirePositive(mass, 'Mass', true) * velocity * velocity;
}

export function potentialEnergy(mass: number, height: number, gravity = 9.80665): number {
  return requirePositive(mass, 'Mass', true) * gravity * height;
}

export function momentum(mass: number, velocity: number): number {
  return requirePositive(mass, 'Mass', true) * velocity;
}

export function density(mass: number, volume: number): number {
  requirePositive(volume, 'Volume');
  return mass / volume;
}

export function pressure(forceValue: number, area: number): number {
  requirePositive(area, 'Area');
  return forceValue / area;
}

export function velocity(distance: number, time: number): number {
  requirePositive(time, 'Time');
  return distance / time;
}

export function acceleration(changeInVelocity: number, time: number): number {
  requirePositive(time, 'Time');
  return changeInVelocity / time;
}

/** Kinematic displacement with initial velocity and constant acceleration. */
export function kinematics(
  initialVelocity: number,
  accelerationValue: number,
  time: number,
): { displacement: number; finalVelocity: number } {
  return {
    displacement: initialVelocity * time + 0.5 * accelerationValue * time * time,
    finalVelocity: initialVelocity + accelerationValue * time,
  };
}

/* ----------------------------- Geometry ----------------------------- */

export interface GeometryResult {
  area?: number;
  perimeter?: number;
  volume?: number;
  surfaceArea?: number;
  /** Shape-specific extra outputs (radius, slant height, …). */
  extra?: { label: string; value: number }[];
}

export function circle(radius: number): GeometryResult {
  requirePositive(radius, 'Radius', true);
  return {
    area: Math.PI * radius ** 2,
    perimeter: 2 * Math.PI * radius,
    extra: [
      { label: 'Diameter', value: 2 * radius },
      { label: 'Circumference', value: 2 * Math.PI * radius },
    ],
  };
}

export function rectangle(width: number, height: number): GeometryResult {
  requirePositive(width, 'Width', true);
  requirePositive(height, 'Height', true);
  return {
    area: width * height,
    perimeter: 2 * (width + height),
    extra: [{ label: 'Diagonal', value: Math.hypot(width, height) }],
  };
}

export function square(side: number): GeometryResult {
  return rectangle(side, side);
}

export function triangle(a: number, b: number, c: number): GeometryResult {
  requirePositive(a, 'Side a', true);
  requirePositive(b, 'Side b', true);
  requirePositive(c, 'Side c', true);
  if (a + b <= c || a + c <= b || b + c <= a) {
    throw new CalcError('DOMAIN', 'These side lengths cannot form a triangle', {
      details: 'Each side must be shorter than the sum of the other two.',
    });
  }
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  const angleA = (Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180) / Math.PI;
  const angleB = (Math.acos((a * a + c * c - b * b) / (2 * a * c)) * 180) / Math.PI;
  return {
    area,
    perimeter: a + b + c,
    extra: [
      { label: 'Semi-perimeter', value: s },
      { label: 'Angle opposite a (degrees)', value: angleA },
      { label: 'Angle opposite b (degrees)', value: angleB },
      { label: 'Angle opposite c (degrees)', value: 180 - angleA - angleB },
    ],
  };
}

export function cube(side: number): GeometryResult {
  requirePositive(side, 'Side', true);
  return {
    volume: side ** 3,
    surfaceArea: 6 * side ** 2,
    extra: [{ label: 'Face diagonal', value: side * Math.SQRT2 }, { label: 'Space diagonal', value: side * Math.sqrt(3) }],
  };
}

export function cylinder(radius: number, height: number): GeometryResult {
  requirePositive(radius, 'Radius', true);
  requirePositive(height, 'Height', true);
  return {
    volume: Math.PI * radius ** 2 * height,
    surfaceArea: 2 * Math.PI * radius * (radius + height),
    extra: [{ label: 'Base area', value: Math.PI * radius ** 2 }, { label: 'Lateral surface', value: 2 * Math.PI * radius * height }],
  };
}

export function sphere(radius: number): GeometryResult {
  requirePositive(radius, 'Radius', true);
  return {
    volume: (4 / 3) * Math.PI * radius ** 3,
    surfaceArea: 4 * Math.PI * radius ** 2,
    extra: [{ label: 'Great-circle circumference', value: 2 * Math.PI * radius }],
  };
}

export function cone(radius: number, height: number): GeometryResult {
  requirePositive(radius, 'Radius', true);
  requirePositive(height, 'Height', true);
  const slant = Math.hypot(radius, height);
  return {
    volume: (Math.PI * radius ** 2 * height) / 3,
    surfaceArea: Math.PI * radius * (radius + slant),
    extra: [{ label: 'Slant height', value: slant }, { label: 'Lateral surface', value: Math.PI * radius * slant }],
  };
}

/** Rectangle-based prism volume (also used by the cube/box tools). */
export function rectangularPrism(width: number, height: number, depth: number): GeometryResult {
  requirePositive(width, 'Width', true);
  requirePositive(height, 'Height', true);
  requirePositive(depth, 'Depth', true);
  return {
    volume: width * height * depth,
    surfaceArea: 2 * (width * height + width * depth + height * depth),
  };
}

export function cylinderVolume(radius: number, height: number): number {
  return cylinder(radius, height).volume!;
}

export function coneVolume(radius: number, height: number): number {
  return cone(radius, height).volume!;
}

export function sphereVolume(radius: number): number {
  return sphere(radius).volume!;
}
