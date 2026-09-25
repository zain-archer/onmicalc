import { describe, expect, it } from 'vitest';
import {
  ALL_CONSTANT_ALIASES,
  ALL_CONSTANT_VALUES,
  PHYSICAL_CONSTANTS,
  constantExpressionName,
  constantRecords,
} from './index';
import { evaluateExpression } from '@/core/engine';
import { createDefaultRegistry } from '@/core/evaluator/functions';

const value = (source: string) => {
  const result = evaluateExpression(source);
  if (!result.ok) throw new Error(`${source}: ${result.error.code} ${result.error.message}`);
  return result.value;
};

describe('constants are available to the expression engine', () => {
  it('evaluates every physical constant and alias without error', () => {
    for (const [name, expected] of Object.entries(ALL_CONSTANT_VALUES)) {
      expect(value(name), `${name} should evaluate`).toBeCloseTo(expected, 12);
    }
  });

  it('keeps e as Euler’s number while e_charge stays the elementary charge', () => {
    expect(value('e')).toBeCloseTo(Math.E, 12);
    expect(value('e_charge')).toBeCloseTo(1.602176634e-19, 30);
    expect(value('echarge')).toBeCloseTo(value('e_charge'), 30);
  });

  it('does the classic physics arithmetic', () => {
    // E = m c² for 1 kg
    expect(value('1 * c^2')).toBeCloseTo(8.987551787368176e16, 0);
    // E = h f for a 500 THz photon (h = 6.62607015e-34 J·s)
    expect(value('h * 500e12')).toBeCloseTo(3.313035075e-19, 26);
    // Ideal gas: n R T at 1 mol, 300 K
    // R = 8.314462618 J/(mol·K) × 300 K
    expect(value('1 * r_gas * 300')).toBeCloseTo(2494.3387854, 6);
    // Photon energy in eV
    expect(value('h * 500e12 / e_charge')).toBeCloseTo(2.0678338, 6);
  });

  it('never lets a constant shadow a function name', () => {
    const functionNames = createDefaultRegistry().primaryNames();
    const offenders = ALL_CONSTANT_ALIASES.filter((name) => functionNames.includes(name));
    expect(offenders).toEqual([]);
  });

  it('keeps every spelling reachable for a case-insensitive tokenizer', () => {
    const spellings = Object.entries(ALL_CONSTANT_VALUES).filter(([name]) => /^[A-Za-z][A-Za-z0-9_]*$/.test(name));
    expect(spellings.length).toBeGreaterThan(50);
    for (const [name, expected] of spellings) {
      // Whatever case the user types, the tokenizer produces the lower-case form.
      expect(value(name.toUpperCase()), `${name} typed in upper case`).toBeCloseTo(expected, 12);
    }
  });

  it('uses the lower-case spelling when inserting into an expression', () => {
    for (const record of constantRecords()) {
      expect(constantExpressionName(record)).toBe(record.name.toLowerCase());
    }
    expect(value(constantExpressionName(constantRecords().find((r) => r.name === 'G')!))).toBeCloseTo(
      6.6743e-11,
      20,
    );
  });

  it('documents every constant with a unit, source and non-garbled symbol', () => {
    for (const record of constantRecords()) {
      // Physical quantities carry a unit; dimensionless ratios (alpha) do not.
      if (record.category === 'physical' && record.unit === '') {
        expect(record.description, `${record.name} must say it is dimensionless`).toMatch(/dimensionless|ratio/i);
      }
      expect(record.source.length, `${record.name} source`).toBeGreaterThan(3);
      expect(record.symbol, `${record.name} symbol`).not.toMatch(/[?]/);
      expect(record.description.length, `${record.name} description`).toBeGreaterThan(8);
    }
  });

  it('keeps the physical constant set complete and consistent', () => {
    expect(PHYSICAL_CONSTANTS.length).toBeGreaterThanOrEqual(15);
    const names = PHYSICAL_CONSTANTS.map((def) => def.name);
    expect(new Set(names).size).toBe(names.length);
    for (const def of PHYSICAL_CONSTANTS) {
      expect(Number.isFinite(def.value)).toBe(true);
      expect(def.value).not.toBe(0);
    }
  });
});
