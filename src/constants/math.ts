/**
 * Mathematical constants available to the expression engine.
 * Values follow the CODATA/IUPAC definitions; Phase 5 extends this into the
 * full searchable database (physical constants, units, sources).
 */
export interface ConstantDef {
  /** Identifier accepted by the parser (lowercase, no spaces). */
  name: string;
  /** Alternative spellings/aliases accepted by the parser. */
  aliases?: readonly string[];
  symbol: string;
  value: number;
  unit: string;
  description: string;
  source: string;
}

export const MATH_CONSTANTS: readonly ConstantDef[] = [
  {
    name: 'pi',
    aliases: ['π'],
    symbol: 'π',
    value: Math.PI,
    unit: '',
    description: 'Ratio of a circle circumference to its diameter.',
    source: 'Mathematical constant',
  },
  {
    name: 'e',
    symbol: 'e',
    value: Math.E,
    unit: '',
    description: 'Base of the natural logarithm (Euler number).',
    source: 'Mathematical constant',
  },
  {
    name: 'tau',
    aliases: ['τ'],
    symbol: 'τ',
    value: 2 * Math.PI,
    unit: '',
    description: 'Full turn constant, 2π.',
    source: 'Mathematical constant',
  },
  {
    name: 'phi',
    aliases: ['φ'],
    symbol: 'φ',
    value: (1 + Math.sqrt(5)) / 2,
    unit: '',
    description: 'Golden ratio.',
    source: 'Mathematical constant',
  },
  {
    name: 'sqrt2',
    symbol: '√2',
    value: Math.SQRT2,
    unit: '',
    description: 'Square root of 2.',
    source: 'Mathematical constant',
  },
  {
    name: 'sqrt3',
    symbol: '√3',
    value: Math.sqrt(3),
    unit: '',
    description: 'Square root of 3.',
    source: 'Mathematical constant',
  },
];

/** Lookup table from every accepted spelling to its value. */
export const MATH_CONSTANT_VALUES: Readonly<Record<string, number>> = Object.freeze(
  MATH_CONSTANTS.reduce<Record<string, number>>((acc, constant) => {
    acc[constant.name] = constant.value;
    for (const alias of constant.aliases ?? []) acc[alias] = constant.value;
    return acc;
  }, {}),
);

/** Mathematical + physical constants combined for lookups and the UI list. */
export { PHYSICAL_CONSTANTS } from './physical';
