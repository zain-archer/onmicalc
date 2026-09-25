import { describe, expect, it } from 'vitest';
import {
  acceleration,
  capacitorCharge,
  capacitorEnergy,
  circle,
  cone,
  cube,
  cylinder,
  density,
  force,
  kinematics,
  kineticEnergy,
  momentum,
  ohmsLaw,
  parallelResistance,
  potentialEnergy,
  pressure,
  rcTimeConstant,
  rectangle,
  rectangularPrism,
  seriesResistance,
  sphere,
  triangle,
  velocity,
  weight,
  work,
} from './index';
import { CalcError } from '@/core/errors';

describe('electrical', () => {
  it('solves Ohm’s law from any two quantities', () => {
    const fromVI = ohmsLaw({ voltage: 12, current: 2 });
    expect(fromVI.resistance).toBeCloseTo(6, 12);
    expect(fromVI.power).toBeCloseTo(24, 12);

    const fromVR = ohmsLaw({ voltage: 12, resistance: 4 });
    expect(fromVR.current).toBeCloseTo(3, 12);
    expect(fromVR.power).toBeCloseTo(36, 12);

    const fromIR = ohmsLaw({ current: 0.5, resistance: 220 });
    expect(fromIR.voltage).toBeCloseTo(110, 12);

    const fromVP = ohmsLaw({ voltage: 230, power: 1000 });
    expect(fromVP.current).toBeCloseTo(1000 / 230, 10);
    expect(fromVP.resistance).toBeCloseTo((230 * 230) / 1000, 8);

    const fromIP = ohmsLaw({ current: 5, power: 100 });
    expect(fromIP.voltage).toBeCloseTo(20, 12);

    const fromRP = ohmsLaw({ resistance: 50, power: 200 });
    expect(fromRP.voltage).toBeCloseTo(100, 10);
    expect(fromRP.current).toBeCloseTo(2, 10);
  });

  it('validates the number of known quantities', () => {
    expect(() => ohmsLaw({ voltage: 12 })).toThrowError(/exactly two/);
    expect(() => ohmsLaw({ voltage: 12, current: 2, resistance: 3 })).toThrowError(CalcError);
    expect(() => ohmsLaw({ voltage: 0, power: 5 })).toThrowError(/cannot be zero/);
  });

  it('combines resistors in series and parallel', () => {
    expect(seriesResistance([100, 220, 470])).toBeCloseTo(790, 12);
    expect(parallelResistance([100, 100])).toBeCloseTo(50, 12);
    expect(parallelResistance([100, 220])).toBeCloseTo(1 / (1 / 100 + 1 / 220), 12);
    expect(parallelResistance([4, 4, 4])).toBeCloseTo(4 / 3, 12);
    expect(() => seriesResistance([])).toThrowError(/at least one/);
    expect(() => parallelResistance([0])).toThrowError(/positive/);
  });

  it('computes capacitor energy, charge and time constant', () => {
    expect(capacitorEnergy(0.001, 100).energy).toBeCloseTo(5, 12);
    expect(capacitorCharge(0.001, 100)).toBeCloseTo(0.1, 12);
    const rc = rcTimeConstant(1000, 1e-6);
    expect(rc.tau).toBeCloseTo(1e-3, 12);
    expect(rc.halfLife).toBeCloseTo(1e-3 * Math.LN2, 12);
    expect(() => capacitorEnergy(0, 5)).toThrowError(CalcError);
  });
});

describe('physics', () => {
  it('computes force, weight and work', () => {
    expect(force(10, 2)).toBeCloseTo(20, 12);
    expect(weight(10)).toBeCloseTo(98.0665, 6);
    expect(work(10, 5)).toBeCloseTo(50, 12);
    expect(work(10, 5, 60)).toBeCloseTo(25, 12);
    expect(work(10, 5, 90)).toBeCloseTo(0, 10);
  });

  it('computes energies and momentum', () => {
    expect(kineticEnergy(2, 3)).toBeCloseTo(9, 12);
    expect(potentialEnergy(2, 10)).toBeCloseTo(196.133, 6);
    expect(potentialEnergy(2, 10, 10)).toBeCloseTo(200, 12);
    expect(momentum(3, 4)).toBeCloseTo(12, 12);
  });

  it('computes density, pressure, velocity and acceleration', () => {
    expect(density(10, 2)).toBeCloseTo(5, 12);
    expect(pressure(100, 4)).toBeCloseTo(25, 12);
    expect(velocity(100, 8)).toBeCloseTo(12.5, 12);
    expect(acceleration(20, 4)).toBeCloseTo(5, 12);
    expect(() => density(1, 0)).toThrowError(/Volume/);
  });

  it('solves kinematics', () => {
    const result = kinematics(5, 9.80665, 2);
    expect(result.finalVelocity).toBeCloseTo(24.6133, 6);
    expect(result.displacement).toBeCloseTo(29.6133, 6);
  });
});

describe('geometry', () => {
  it('handles circles and rectangles', () => {
    const c = circle(2);
    expect(c.area).toBeCloseTo(4 * Math.PI, 12);
    expect(c.perimeter).toBeCloseTo(4 * Math.PI, 12);
    expect(c.extra?.find((item) => item.label === 'Diameter')?.value).toBe(4);

    const r = rectangle(3, 4);
    expect(r.area).toBe(12);
    expect(r.perimeter).toBe(14);
    expect(r.extra?.[0]?.value).toBe(5);
  });

  it('validates triangles with the triangle inequality', () => {
    const t = triangle(3, 4, 5);
    expect(t.area).toBeCloseTo(6, 12);
    expect(t.perimeter).toBe(12);
    const angle = t.extra?.find((item) => item.label === 'Angle opposite c (degrees)')?.value;
    expect(angle).toBeCloseTo(90, 8);
    expect(() => triangle(1, 2, 10)).toThrowError(/cannot form a triangle/);
  });

  it('handles solids', () => {
    expect(cube(2).volume).toBe(8);
    expect(cube(2).surfaceArea).toBe(24);
    expect(cylinder(1, 3).volume).toBeCloseTo(3 * Math.PI, 12);
    expect(sphere(3).volume).toBeCloseTo(36 * Math.PI, 12);
    expect(sphere(3).surfaceArea).toBeCloseTo(36 * Math.PI, 12);
    expect(cone(3, 4).volume).toBeCloseTo(12 * Math.PI, 12);
    expect(cone(3, 4).extra?.find((item) => item.label === 'Slant height')?.value).toBeCloseTo(5, 12);
    expect(rectangularPrism(2, 3, 4).volume).toBe(24);
  });

  it('rejects negative dimensions', () => {
    expect(() => circle(-1)).toThrowError(/Radius/);
    expect(() => cylinder(1, -2)).toThrowError(CalcError);
  });
});
