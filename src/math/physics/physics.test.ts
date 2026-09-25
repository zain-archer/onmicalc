import { describe, expect, it } from 'vitest';
import { compileFunctionOf } from '@/math/calculus';
import { PHYSICS_CATEGORIES, PHYSICS_FORMULAS, getPhysicsFormula, searchPhysicsFormulas } from './formulas';
import { physicsScale, solvePhysics, solveWithDefaults } from './index';

/** Physics answers mix scales from 1e-34 to 1e24, so compare them relatively. */
function relative(got: number, want: number, digits = 9): void {
  expect(got / want).toBeCloseTo(1, digits);
}

describe('physics formula library', () => {
  it('describes every formula completely', () => {
    expect(PHYSICS_FORMULAS.length).toBeGreaterThanOrEqual(55);
    expect(new Set(PHYSICS_FORMULAS.map((formula) => formula.id)).size).toBe(PHYSICS_FORMULAS.length);
    for (const formula of PHYSICS_FORMULAS) {
      expect(formula.name.length).toBeGreaterThan(3);
      expect(formula.relation.length).toBeGreaterThan(3);
      expect(formula.residual.length).toBeGreaterThan(0);
      expect(formula.quantities.length).toBeGreaterThan(1);
      expect(PHYSICS_CATEGORIES).toContain(formula.category);
      for (const quantity of formula.quantities) {
        expect(quantity.name.length).toBeGreaterThan(1);
        expect(quantity.unit.length).toBeGreaterThan(0);
        expect(quantity.symbol).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
      }
      // Symbols inside one formula must be distinct, otherwise two different
      // quantities would silently share a single value.
      expect(new Set(formula.quantities.map((quantity) => quantity.symbol)).size).toBe(formula.quantities.length);
      // Every residual must be readable by the app's own expression parser.
      const compiled = compileFunctionOf(
        formula.residual,
        formula.quantities.map((quantity) => quantity.symbol),
      );
      expect(compiled, `${formula.id} residual did not parse`).not.toBeNull();
      // …and it must actually depend on the symbols it claims: a residual that
      // never changes would carry no information.
      const values = Object.fromEntries(
        formula.quantities.map((quantity, index) => [quantity.symbol, quantity.defaultValue ?? index + 2]),
      );
      const atValues = compiled!(values);
      const shifted = compiled!(
        Object.fromEntries(Object.entries(values).map(([symbol, value]) => [symbol, value * 1.37 + 0.11])),
      );
      expect(Number.isFinite(atValues)).toBe(true);
      expect(Math.abs(atValues - shifted)).toBeGreaterThan(0);
      // The declared constants must agree with the app's constants module.
      for (const quantity of formula.quantities) {
        if (quantity.constant) expect(quantity.defaultValue).toBeGreaterThan(0);
      }
    }
  });

  it('finds formulas by name, symbol and unit', () => {
    expect(searchPhysicsFormulas('ohm').map((formula) => formula.id)).toContain('ohm');
    expect(searchPhysicsFormulas('momentum').map((formula) => formula.id)).toContain('momentum');
    expect(searchPhysicsFormulas('J/kg').map((formula) => formula.id)).toContain('latent-heat');
    expect(searchPhysicsFormulas('orbit').length).toBeGreaterThan(0);
    expect(searchPhysicsFormulas('').length).toBe(PHYSICS_FORMULAS.length);
    expect(searchPhysicsFormulas('Thermal sound').length).toBe(0);
    expect(getPhysicsFormula('nope')).toBeUndefined();
  });

  it('scales the search for the unknown by the geometric mean of the knowns', () => {
    expect(physicsScale([100, 1e4])).toBeCloseTo(1000, 9);
    expect(physicsScale([6.62607015e-34, 1e15, 1e-19])).toBeGreaterThan(1e-14);
    expect(physicsScale([])).toBe(1);
  });
});

describe('physics solver', () => {
  it('solves the mechanics relations', () => {
    const force = solvePhysics('newton-second', { m: 2, a: 3 }, 'F');
    relative(force.value, 6, 12);
    expect(force.unit).toBe('N');
    expect(force.verified).toBe(true);
    expect(Math.abs(force.residual)).toBeLessThan(1e-9);

    relative(solvePhysics('newton-second', { F: 6, a: 3 }, 'm').value, 2, 12);
    relative(solvePhysics('newton-second', { F: 6, m: 2 }, 'a').value, 3, 12);

    relative(solveWithDefaults('kinematics-displacement', 's', { u: 0, a: 9.80665, t: 3 }).value, 0.5 * 9.80665 * 9, 12);
    relative(solveWithDefaults('kinetic-energy', 'Ek', { m: 1500, v: 27.77777777777778 }).value, 0.5 * 1500 * 27.77777777777778 ** 2, 12);
    relative(solveWithDefaults('spring-period', 'T', { m: 0.5, k: 20 }).value, 2 * Math.PI * Math.sqrt(0.5 / 20), 12);
    relative(solveWithDefaults('work', 'W', { F: 100, d: 5, theta: 60 }).value, 100 * 5 * Math.cos(Math.PI / 3), 12);
    relative(solveWithDefaults('pendulum-period', 'L', { T: 2, g: 9.80665 }).value, (9.80665 * (2 / (2 * Math.PI)) ** 2), 12);
  });

  it('reports the second physical solution of a quadratic relation', () => {
    // A ball dropped 45 m: t = ±√(2s/a) — the positive root is the real time.
    const result = solveWithDefaults('kinematics-displacement', 't', { s: 45, u: 0, a: 9.80665 });
    relative(result.value, Math.sqrt((2 * 45) / 9.80665), 9);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    relative(result.alternatives[0]!.value, -Math.sqrt((2 * 45) / 9.80665), 9);
    expect(result.alternatives[0]!.note.length).toBeGreaterThan(10);
  });

  it('solves gravitation, orbits and waves', () => {
    relative(solveWithDefaults('orbital-speed', 'v', { M: 5.972e24, r: 6.771e6 }).value, Math.sqrt((6.6743e-11 * 5.972e24) / 6.771e6), 9);
    relative(solveWithDefaults('kepler-third', 'T', { r: 6.771e6, M: 5.972e24 }).value, 2 * Math.PI * Math.sqrt(6.771e6 ** 3 / (6.6743e-11 * 5.972e24)), 9);
    relative(solveWithDefaults('escape-velocity', 'v', { M: 5.972e24, r: 6.371e6 }).value, Math.sqrt((2 * 6.6743e-11 * 5.972e24) / 6.371e6), 9);
    relative(solveWithDefaults('wave-speed', 'lambda', { v: 343, f: 440 }).value, 343 / 440, 12);
    relative(solveWithDefaults('sound-level', 'L', { I: 1e-6 }).value, 60, 9); // 10·log(1e-6/1e-12)
    relative(solveWithDefaults('doppler-approaching', 'fp', { f: 440, v: 343, vo: 0, vs: 30 }).value, (440 * 343) / 313, 9);
  });

  it('solves thermal relations, including absolute temperatures', () => {
    relative(solveWithDefaults('ideal-gas', 'V', { p: 101325, n: 1, T: 273.15 }).value, (1 * 8.314462618 * 273.15) / 101325, 9);
    relative(solveWithDefaults('heat-capacity', 'Q', { m: 2, c: 4200, dT: 10 }).value, 84000, 9);
    relative(solveWithDefaults('heat-engine', 'eta', { Tc: 300, Th: 600 }).value, 0.5, 9);
    relative(solveWithDefaults('stefan-boltzmann', 'T', { P: 100, A: 1 }).value, (100 / 5.670374419e-8) ** 0.25, 9);
    relative(solveWithDefaults('first-law', 'dU', { Q: 500, W: 200 }).value, 300, 9);
    relative(solveWithDefaults('thermal-expansion', 'dL', { alpha: 1.2e-5, L0: 100, dT: 40 }).value, 1.2e-5 * 100 * 40, 12);
  });

  it('solves electrical and magnetic relations', () => {
    relative(solveWithDefaults('ohm', 'V', { I: 2, R: 50 }).value, 100, 9);
    relative(solveWithDefaults('ohm', 'R', { V: 230, I: 5 }).value, 46, 9);
    relative(solveWithDefaults('electric-power', 'P', { V: 230, I: 5 }).value, 1150, 9);
    relative(solveWithDefaults('electric-power-r', 'P', { I: 2, R: 10 }).value, 40, 9);
    relative(solveWithDefaults('resistors-parallel', 'R', { R1: 100, R2: 100 }).value, 50, 9);
    relative(solveWithDefaults('capacitor-energy', 'E', { C: 100e-6, V: 12 }).value, 0.0072, 9);
    relative(solveWithDefaults('rc-time-constant', 'tau', { R: 1000, C: 0.001 }).value, 1, 9);
    relative(solveWithDefaults('coulomb', 'F', { q1: 1e-6, q2: 1e-6, r: 0.1 }).value, (8.9875517923e9 * 1e-12) / 0.01, 9);
    relative(solveWithDefaults('lorentz-force', 'F', { q: 1.6e-19, v: 1e6, B: 0.5, theta: 90 }).value, 1.6e-19 * 1e6 * 0.5, 9);
    relative(solveWithDefaults('transformer', 'Vs', { Vp: 230, Ns: 50, Np: 1000 }).value, 11.5, 9);
    relative(solveWithDefaults('rc-discharge', 't', { V: 5, V0: 10, R: 1000, C: 1 }).value, Math.log(2) * 1000, 9);
  });

  it('solves optics and fluids, and modern physics', () => {
    relative(solveWithDefaults('snell', 'theta2', { n1: 1, theta1: 30, n2: 1.5 }).value, (Math.asin(Math.sin(Math.PI / 6) / 1.5) * 180) / Math.PI, 6);
    relative(solveWithDefaults('thin-lens', 'di', { f: 0.1, do: 0.3 }).value, 1 / (1 / 0.1 - 1 / 0.3), 9);
    relative(solveWithDefaults('hydrostatic', 'p', { h: 10 }).value, 101325 + 1000 * 9.80665 * 10, 9);
    relative(solveWithDefaults('continuity', 'v2', { A1: 0.02, v1: 3, A2: 0.005 }).value, 12, 9);
    relative(solveWithDefaults('pressure', 'A', { p: 2000, F: 500 }).value, 0.25, 9);
    relative(solveWithDefaults('mass-energy', 'E', { m: 1 }).value, 299792458 ** 2, 12);
    // Values this small are compared relatively: an absolute tolerance would
    // say nothing about a wavelength of 0.66 nm.
    relative(solveWithDefaults('de-broglie', 'lambda', { p: 1e-24 }).value, 6.62607015e-34 / 1e-24, 9);
    relative(solveWithDefaults('half-life', 'N', { N0: 1000, t: 5730, Thalf: 5730 }).value, 500, 9);
    relative(solveWithDefaults('half-life', 't', { N: 25, N0: 100, Thalf: 10 }).value, 20, 9);
    relative(solveWithDefaults('photon-wavelength', 'lambda', { E: 1.986445857e-19 }).value, 1e-6, 3);
  });

  it('refuses values that are not physical', () => {
    expect(() => solvePhysics('newton-second', { m: 0, a: 3 }, 'F')).toThrow(/positive/);
    expect(() => solvePhysics('pendulum-period', { L: -1, g: 9.81 }, 'T')).toThrow(/positive/);
    expect(() => solvePhysics('kinematics-velocity', { u: 1, a: 2, t: -5 }, 'v')).toThrow(/negative/);
    expect(() => solvePhysics('newton-second', { m: 2 }, 'nope')).toThrow(/not part of/);
    expect(() => solvePhysics('does-not-exist', {}, 'F')).toThrow(/Unknown formula/);
  });

  it('explains when a relation has no real solution for the values given', () => {
    // A negative right-hand side means v² would be negative: no real speed.
    expect(() => solvePhysics('kinematics-vsq', { u: 10, a: 1, s: -100 }, 'v')).toThrow(/No real value/);
  });

  it('refuses a kinetic energy below the work function instead of inventing one', () => {
    let refusal: unknown;
    try {
      solvePhysics('photoelectric', { f: 1e14, phi: 1e-18 }, 'Ek');
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(Error);
    expect((refusal as { message: string }).message).toMatch(/non-physical/);
    expect((refusal as { details?: string }).details ?? '').toMatch(/work function/);

    relative(solvePhysics('photoelectric', { f: 1e15, phi: 1e-19 }, 'Ek').value, 6.62607015e-34 * 1e15 - 1e-19, 9);
  });

  it('solves for a constant as readily as for a measurement', () => {
    const gravity = solveWithDefaults('weight', 'g', { m: 10, W: 98.0665 });
    relative(gravity.value, 9.80665, 9);
    const planck = solveWithDefaults('photon-energy', 'h', { E: 3.313035075e-19, f: 5e14 });
    relative(planck.value, 6.62607015e-34, 9);
  });

  it('reports the check, the unit and the steps with every answer', () => {
    const result = solveWithDefaults('ohm', 'R', { V: 12, I: 0.5 });
    relative(result.value, 24, 9);
    expect(result.unit).toBe('Ω');
    expect(result.verified).toBe(true);
    const steps = result.steps.join(' ');
    expect(steps).toMatch(/Relation: V = I·R/);
    expect(steps).toMatch(/Known: v = 12, curr = 0\.5/);
    expect(steps).toMatch(/R = 24 Ω/);
    expect(steps).toMatch(/substituting back/);
    expect(result.notes.some((note) => note.startsWith('Units:'))).toBe(true);
  });
});
