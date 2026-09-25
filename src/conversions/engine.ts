import { CalcError } from '@/core/errors';

/**
 * Data-driven conversion engine.
 *
 * Units are defined either by a linear factor to the category's base unit, or
 * by an affine pair (factor + offset) for scales such as temperature. Nothing
 * here is category-specific, so adding a unit is a data change, never a code
 * change.
 */
export interface LinearUnit {
  id: string;
  label: string;
  symbol: string;
  /** Multiplicative factor towards the base unit of the category. */
  factor: number;
  aliases?: readonly string[];
}

export interface AffineUnit {
  id: string;
  label: string;
  symbol: string;
  /** base = value * factor + offset */
  factor: number;
  offset: number;
  aliases?: readonly string[];
}

export type UnitDef = LinearUnit | AffineUnit;

export interface UnitCategory {
  id: string;
  label: string;
  /** Unit id used as the pivot for conversions inside the category. */
  baseUnit: string;
  units: readonly UnitDef[];
}

export function isAffine(unit: UnitDef): unit is AffineUnit {
  return typeof (unit as AffineUnit).offset === 'number';
}

export function findUnit(category: UnitCategory, idOrAlias: string): UnitDef | undefined {
  const needle = idOrAlias.trim().toLowerCase();
  return category.units.find(
    (unit) =>
      unit.id.toLowerCase() === needle ||
      unit.symbol.toLowerCase() === needle ||
      (unit.aliases ?? []).some((alias) => alias.toLowerCase() === needle),
  );
}

function requireUnit(category: UnitCategory, idOrAlias: string): UnitDef {
  const unit = findUnit(category, idOrAlias);
  if (!unit) {
    throw new CalcError('INPUT', `Unknown unit "${idOrAlias}" for ${category.label}`, {
      details: `Available: ${category.units.map((u) => u.id).join(', ')}`,
    });
  }
  return unit;
}

export function toBase(category: UnitCategory, unitId: string, value: number): number {
  const unit = requireUnit(category, unitId);
  return isAffine(unit) ? value * unit.factor + unit.offset : value * unit.factor;
}

export function fromBase(category: UnitCategory, unitId: string, base: number): number {
  const unit = requireUnit(category, unitId);
  return isAffine(unit) ? (base - unit.offset) / unit.factor : base / unit.factor;
}

/** Convert a value between two units of the same category. */
export function convert(category: UnitCategory, value: number, fromId: string, toId: string): number {
  if (!Number.isFinite(value)) {
    throw new CalcError('DOMAIN', 'Conversion needs a finite value');
  }
  const base = toBase(category, fromId, value);
  return fromBase(category, toId, base);
}

/** Convert to a list of units at once (used by the “all units” table). */
export function convertAll(
  category: UnitCategory,
  value: number,
  fromId: string,
): { unit: UnitDef; value: number }[] {
  const base = toBase(category, fromId, value);
  return category.units.map((unit) => ({ unit, value: fromBase(category, unit.id, base) }));
}

/** All unit ids and aliases, for validation and tests. */
export function unitIds(category: UnitCategory): string[] {
  return category.units.flatMap((unit) => [unit.id, ...(unit.aliases ?? [])]);
}
