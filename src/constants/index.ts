import { MATH_CONSTANTS, type ConstantDef } from './math';
import { PHYSICAL_CONSTANTS } from './physical';

export type { ConstantDef } from './math';
export { MATH_CONSTANTS } from './math';
export { PHYSICAL_CONSTANTS } from './physical';

export type ConstantCategory = 'mathematical' | 'physical';

export interface ConstantRecord extends ConstantDef {
  category: ConstantCategory;
  /** Value rendered with full available precision. */
  display: string;
}

function toRecord(def: ConstantDef, category: ConstantCategory, precision: number): ConstantRecord {
  return { ...def, category, display: def.value.toPrecision(precision) };
}

/** Every constant, with display strings generated at the requested precision. */
export function constantRecords(precision = 9): ConstantRecord[] {
  return [
    ...MATH_CONSTANTS.map((def) => toRecord(def, 'mathematical', precision)),
    ...PHYSICAL_CONSTANTS.map((def) => toRecord(def, 'physical', precision)),
  ];
}

/** Case-insensitive search over name, aliases, symbol, unit and description. */
export function searchConstants(query: string, precision = 9): ConstantRecord[] {
  const all = constantRecords(precision);
  const needle = query.trim().toLowerCase();
  if (!needle) return all;
  return all.filter((record) =>
    [record.name, record.symbol, record.unit, record.description, ...(record.aliases ?? [])]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

/** Every accepted spelling (name + aliases) of every constant. */
export const ALL_CONSTANT_ALIASES: readonly string[] = Object.freeze(
  [...MATH_CONSTANTS, ...PHYSICAL_CONSTANTS].flatMap((def) => [def.name, ...(def.aliases ?? [])]),
);

/**
 * Lookup table for the expression engine: mathematical *and* physical constants,
 * including aliases, so `c`, `h`, `k_b` and friends evaluate in any tool.
 */
export const ALL_CONSTANT_VALUES: Readonly<Record<string, number>> = Object.freeze(
  [...MATH_CONSTANTS, ...PHYSICAL_CONSTANTS].reduce<Record<string, number>>((acc, def) => {
    // The tokenizer lower-cases identifiers, so the lookup table is keyed in
    // lower case as well — otherwise `G` (gravitational constant) would be
    // unreachable to anyone typing it.
    acc[def.name] = def.value;
    acc[def.name.toLowerCase()] = def.value;
    for (const alias of def.aliases ?? []) {
      acc[alias] = def.value;
      acc[alias.toLowerCase()] = def.value;
    }
    return acc;
  }, {}),
);

/**
 * The spelling to insert into an expression. Always the lower-case form, because
 * that is what the tokenizer produces for every identifier.
 */
export function constantExpressionName(record: ConstantRecord): string {
  return record.name.toLowerCase();
}
