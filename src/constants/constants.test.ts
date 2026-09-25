import { describe, expect, it } from 'vitest';
import { constantRecords, searchConstants } from './index';
import { PHYSICAL_CONSTANTS } from './physical';
import { MATH_CONSTANT_VALUES } from './math';
import { evaluateExpression } from '@/core/engine';

describe('constants database', () => {
  it('gives every constant the required fields', () => {
    for (const record of constantRecords()) {
      expect(record.name).toBeTruthy();
      expect(record.symbol).toBeTruthy();
      expect(Number.isFinite(record.value)).toBe(true);
      expect(record.description.length).toBeGreaterThan(10);
      expect(record.source.length).toBeGreaterThan(3);
      expect(record.display.length).toBeGreaterThan(0);
    }
  });

  it('uses unique names and aliases', () => {
    const names = PHYSICAL_CONSTANTS.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('matches the CODATA values used by the engine', () => {
    const byName = new Map(constantRecords().map((c) => [c.name, c.value]));
    expect(byName.get('c')).toBe(299792458);
    expect(byName.get('h')).toBeCloseTo(6.62607015e-34, 45);
    expect(byName.get('n_a')).toBeCloseTo(6.02214076e23, 10);
    expect(byName.get('k_b')).toBeCloseTo(1.380649e-23, 45);
    expect(byName.get('g_0')).toBe(9.80665);
    expect(byName.get('alpha')).toBeCloseTo(7.2973525693e-3, 13);
  });

  it('keeps mathematical constants consistent with the engine table', () => {
    for (const [name, value] of Object.entries(MATH_CONSTANT_VALUES)) {
      const records = constantRecords();
      const record = records.find((r) => r.name === name || (r.aliases ?? []).includes(name));
      expect(record, name).toBeDefined();
      expect(record!.value).toBe(value);
    }
  });

  it('searches across name, symbol, unit and description', () => {
    expect(searchConstants('planck').map((c) => c.name)).toContain('h');
    expect(searchConstants('m/s').length).toBeGreaterThanOrEqual(2);
    expect(searchConstants('kelvin').map((c) => c.name)).toContain('k_b');
    expect(searchConstants('gravitation').map((c) => c.name)).toContain('G');
    expect(searchConstants('π').map((c) => c.name)).toContain('pi');
    expect(searchConstants('').length).toBe(constantRecords().length);
  });

  it('evaluates inserted constant names in the engine', () => {
    const result = evaluateExpression('c', { constants: { c: 299792458 } });
    expect(result.ok && result.value).toBe(299792458);
  });
});
