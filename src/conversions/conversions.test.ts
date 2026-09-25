import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryById } from './definitions';
import { convert, convertAll, findUnit, fromBase, toBase, unitIds } from './engine';
import { CalcError } from '@/core/errors';

const cat = (id: string) => {
  const found = categoryById(id);
  if (!found) throw new Error(`missing category ${id}`);
  return found;
};
const conv = (category: string, value: number, from: string, to: string) =>
  convert(cat(category), value, from, to);

describe('unit tables', () => {
  it('has unique ids and aliases per category', () => {
    for (const category of CATEGORIES) {
      const ids = unitIds(category);
      expect(new Set(ids).size, category.id).toBe(ids.length);
      expect(category.units.length).toBeGreaterThan(3);
      expect(findUnit(category, category.baseUnit), category.id).toBeDefined();
    }
  });

  it('includes every category required by the project', () => {
    const ids = CATEGORIES.map((c) => c.id);
    for (const required of [
      'length',
      'area',
      'volume',
      'mass',
      'temperature',
      'time',
      'speed',
      'pressure',
      'energy',
      'power',
      'data',
      'frequency',
      'angle',
    ]) {
      expect(ids, required).toContain(required);
    }
  });

  it('keeps every base unit self-consistent', () => {
    for (const category of CATEGORIES) {
      expect(convert(category, 1, category.baseUnit, category.baseUnit)).toBeCloseTo(1, 12);
      for (const unit of category.units) {
        const base = toBase(category, unit.id, 1);
        expect(fromBase(category, unit.id, base)).toBeCloseTo(1, 10);
      }
    }
  });
});

describe('length and mass', () => {
  it.each([
    [1, 'in', 'cm', 2.54],
    [1, 'ft', 'm', 0.3048],
    [1, 'mi', 'km', 1.609344],
    [100, 'cm', 'm', 1],
    [1, 'nmi', 'm', 1852],
    [1, 'km', 'mm', 1e6],
    [1, 'au', 'km', 149597870.7],
    [1, 'ly', 'm', 9.4607304725808e15],
  ])('%s %s -> %s = %s', (value, from, to, expected) => {
    expect(conv('length', value as number, from as string, to as string)).toBeCloseTo(expected as number, 8);
  });

  it.each([
    [1, 'lb', 'kg', 0.45359237],
    [1, 'oz', 'g', 28.349523125],
    [1000, 'g', 'kg', 1],
    [1, 'stone', 'lb', 14],
    [1, 't', 'kg', 1000],
  ])('%s %s -> %s = %s', (value, from, to, expected) => {
    expect(conv('mass', value as number, from as string, to as string)).toBeCloseTo(expected as number, 9);
  });

  it('resolves symbols and aliases', () => {
    expect(conv('length', 12, '" ', 'ft')).toBeCloseTo(1, 12);
    expect(conv('length', 1, 'micron', 'm')).toBe(1e-6);
  });
});

describe('temperature (affine scales)', () => {
  it('converts freezing, boiling and absolute zero exactly', () => {
    expect(conv('temperature', 0, 'c', 'f')).toBeCloseTo(32, 10);
    expect(conv('temperature', 100, 'c', 'f')).toBeCloseTo(212, 10);
    expect(conv('temperature', 32, 'f', 'c')).toBeCloseTo(0, 10);
    expect(conv('temperature', -40, 'c', 'f')).toBeCloseTo(-40, 10);
    expect(conv('temperature', 0, 'k', 'c')).toBeCloseTo(-273.15, 10);
    expect(conv('temperature', 0, 'c', 'k')).toBeCloseTo(273.15, 10);
    expect(conv('temperature', 0, 'k', 'f')).toBeCloseTo(-459.67, 10);
    expect(conv('temperature', 0, 'k', 'r')).toBeCloseTo(0, 10);
    expect(conv('temperature', 100, 'c', 're')).toBeCloseTo(80, 10);
  });

  it('round-trips every pair', () => {
    for (const from of cat('temperature').units) {
      for (const to of cat('temperature').units) {
        const there = conv('temperature', 37, from.id, to.id);
        expect(conv('temperature', there, to.id, from.id)).toBeCloseTo(37, 9);
      }
    }
  });
});

describe('other categories', () => {
  it.each([
    ['volume', 1, 'l', 'ml', 1000],
    ['volume', 1, 'gal_us', 'l', 3.785411784],
    ['area', 1, 'ha', 'm2', 10000],
    ['area', 1, 'acre', 'm2', 4046.8564224],
    ['time', 1, 'h', 'min', 60],
    ['time', 1, 'day', 's', 86400],
    ['speed', 100, 'kph', 'mps', 27.77777777777778],
    ['speed', 1, 'mph', 'kph', 1.609344],
    ['speed', 1, 'knot', 'kph', 1.852],
    ['pressure', 1, 'bar', 'kpa', 100],
    ['pressure', 1, 'psi', 'pa', 6894.757293168],
    ['pressure', 1, 'atm', 'kpa', 101.325],
    ['energy', 1, 'kwh', 'j', 3.6e6],
    ['energy', 1, 'kcal', 'j', 4184],
    ['energy', 1, 'ev', 'j', 1.602176634e-19],
    ['power', 1, 'hp_mech', 'w', 745.6998715822702],
    ['data', 1, 'byte', 'b', 8],
    ['data', 1, 'gibyte', 'gbyte', 1073741824 / 1e9],
    ['frequency', 1, 'ghz', 'mhz', 1000],
    ['angle', 180, 'deg', 'rad', Math.PI],
    ['angle', 1, 'turn', 'deg', 360],
    ['angle', 400, 'grad', 'deg', 360],
  ])('%s: %s %s -> %s = %s', (category, value, from, to, expected) => {
    expect(
      conv(category as string, value as number, from as string, to as string),
    ).toBeCloseTo(expected as number, 8);
  });

  it('converts a value into every unit of a category', () => {
    const rows = convertAll(cat('length'), 1, 'mi');
    const km = rows.find((row) => row.unit.id === 'km');
    expect(km?.value).toBeCloseTo(1.609344, 9);
    expect(rows).toHaveLength(cat('length').units.length);
  });
});

describe('conversion errors', () => {
  it('rejects unknown units with a helpful message', () => {
    try {
      conv('length', 1, 'banana', 'm');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CalcError);
      expect((err as CalcError).code).toBe('INPUT');
      expect((err as CalcError).details).toMatch(/Available: nm/);
    }
  });

  it('rejects non-finite inputs', () => {
    expect(() => conv('length', Number.POSITIVE_INFINITY, 'm', 'km')).toThrowError(/finite/);
  });
});
