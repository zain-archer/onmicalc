import { CalcError } from '@/core/errors';

/** Positional number systems, bitwise logic and fixed-width integer arithmetic. */

export type Base = 2 | 8 | 10 | 16 | 36;
export type BitWidth = 8 | 16 | 32 | 64;

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function isBase(value: number): value is Base {
  return [2, 8, 10, 16, 36].includes(value);
}

export function isBitWidth(value: number): value is BitWidth {
  return [8, 16, 32, 64].includes(value);
}

/** Parse text in the given base; returns null when it is not a valid number. */
export function parseInBase(input: string, base: Base): number | null {
  const text = input.trim().toLowerCase().replace(/^[+-]?0[bxo]/, (match) => (match.startsWith('-') ? '-' : ''));
  if (!text) return null;
  const negative = text.startsWith('-');
  const body = (negative ? text.slice(1) : text).replace(/_/g, '');
  if (!body) return null;

  let value = 0;
  for (const character of body) {
    const digit = DIGITS.indexOf(character);
    if (digit < 0 || digit >= base) return null;
    value = value * base + digit;
    if (!Number.isFinite(value)) return null;
  }
  return negative ? -value : value;
}

/** Exact parsing into BigInt, so 64-bit input is never rounded. */
export function parseBigIntInBase(input: string, base: Base): bigint | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const negative = raw.startsWith('-');
  const body = (negative ? raw.slice(1) : raw).replace(/[_-]/g, '');
  if (!body) return null;

  let value = 0n;
  const bigBase = BigInt(base);
  for (const character of body) {
    const digit = DIGITS.indexOf(character);
    if (digit < 0 || digit >= base) return null;
    value = value * bigBase + BigInt(digit);
  }
  return negative ? -value : value;
}

/**
 * Format an integer in the given base. Uses BigInt internally so every value a
 * double can represent is printed exactly, and refuses non-integers rather than
 * silently rounding them.
 */
export function formatInBase(value: number, base: Base, uppercase = false): string {
  if (!Number.isFinite(value)) throw new CalcError('DOMAIN', 'Cannot convert a non-finite value');
  if (!Number.isInteger(value)) {
    throw new CalcError('NOT_SUPPORTED', 'Only whole numbers can be converted between bases', {
      details: `Received ${value}. Use the fraction tools to convert fractional values.`,
    });
  }
  return formatBigIntInBase(BigInt(value), base, uppercase);
}

/** Exact 64-bit-safe formatting using BigInt (for values above 2^53). */
export function formatBigIntInBase(value: bigint, base: Base, uppercase = false): string {
  const negative = value < 0n;
  const text = (negative ? -value : value).toString(base);
  return (negative ? '-' : '') + (uppercase ? text.toUpperCase() : text);
}

/** Exact conversion between bases, including the full unsigned 64-bit range. */
export function convertBase(input: string, fromBase: Base, toBase: Base): string | null {
  const parsed = parseBigIntInBase(input, fromBase);
  if (parsed === null) return null;
  return formatBigIntInBase(parsed, toBase);
}

/* ------------------------------------------------------------------ */
/* Bitwise operations                                                  */
/* ------------------------------------------------------------------ */

function maskBigInt(width: BitWidth): bigint {
  return (1n << BigInt(width)) - 1n;
}

/** Numeric mask for widths where a double is exact (8/16/32). */
export function maskForWidth(width: BitWidth): number {
  if (width === 64) {
    // 2^64 − 1 cannot be held exactly by a double; callers should use BigInt.
    throw new CalcError('NOT_SUPPORTED', 'Use BigInt arithmetic for 64-bit masks', {
      details: 'Use maskBigInt(64) instead — a double cannot represent 2^64 − 1 exactly.',
    });
  }
  return 2 ** width - 1;
}

export { maskBigInt };

export type BitwiseOp = 'and' | 'or' | 'xor' | 'not' | 'shl' | 'shr' | 'rol' | 'ror';

export interface BitwiseResult {
  width: BitWidth;
  /** Exact unsigned result as a decimal string (correct for 64-bit values). */
  unsignedDecimal: string;
  /** Exact two's-complement signed value as a decimal string. */
  signedDecimal: string;
  /** Convenience numeric view; exact for 8/16/32-bit results. */
  unsignedNumber: number;
  binary: string;
  hex: string;
  octal: string;
}

function requireIntegerText(value: string, label: string): bigint {
  if (!/^[+-]?\d+$/.test(value.trim())) {
    throw new CalcError('INPUT', `${label} must be a whole number`, { details: `Received "${value}".` });
  }
  return BigInt(value.trim());
}

/** Applies a bitwise operation at the chosen width, exactly, using BigInt. */
export function applyBitwiseBig(op: BitwiseOp, aText: string, bText: string, width: BitWidth): BitwiseResult {
  const a = requireIntegerText(aText, 'The first operand');
  const b = requireIntegerText(bText, 'The second operand');
  const mask = maskBigInt(width);

  if ((op === 'shl' || op === 'shr' || op === 'rol' || op === 'ror') && b < 0n) {
    throw new CalcError('DOMAIN', 'The shift amount must be non-negative');
  }
  const shiftLimit = BigInt(width * 4);
  if ((op === 'shl' || op === 'shr' || op === 'rol' || op === 'ror') && b > shiftLimit) {
    throw new CalcError('DOMAIN', `The shift amount is larger than the ${width}-bit width allows`);
  }

  const unsignedA = a & mask;
  let result: bigint;
  switch (op) {
    case 'and':
      result = (a & b) & mask;
      break;
    case 'or':
      result = (a | b) & mask;
      break;
    case 'xor':
      result = (a ^ b) & mask;
      break;
    case 'not':
      result = ~a & mask;
      break;
    case 'shl':
      result = (a << b) & mask;
      break;
    case 'shr':
      result = (unsignedA >> b) & mask;
      break;
    case 'rol': {
      const shift = b % BigInt(width);
      result = ((unsignedA << shift) | (unsignedA >> (BigInt(width) - shift))) & mask;
      break;
    }
    case 'ror': {
      const shift = b % BigInt(width);
      result = ((unsignedA >> shift) | (unsignedA << (BigInt(width) - shift))) & mask;
      break;
    }
  }

  const unsigned = result & mask;
  const signBit = 1n << BigInt(width - 1);
  const signed = unsigned >= signBit ? unsigned - mask - 1n : unsigned;

  return {
    width,
    unsignedDecimal: unsigned.toString(10),
    signedDecimal: signed.toString(10),
    unsignedNumber: Number(unsigned),
    binary: width === 64 ? unsigned.toString(2) : unsigned.toString(2).padStart(width, '0'),
    hex: unsigned.toString(16).toUpperCase(),
    octal: unsigned.toString(8),
  };
}

/** Convenience wrapper accepting numbers (exact up to 2^53). */
export function applyBitwise(op: BitwiseOp, a: number, b: number, width: BitWidth): BitwiseResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new CalcError('DOMAIN', 'Bitwise operands must be finite numbers', {
      details: `Received ${a} and ${b}.`,
    });
  }
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new CalcError('NOT_SUPPORTED', 'Bitwise operands must be whole numbers', {
      details: `Received ${a} and ${b}.`,
    });
  }
  return applyBitwiseBig(op, String(a), String(b), width);
}

/** Named operations for the programmer panel and tests. */
export const BITWISE_OPS: readonly { id: BitwiseOp; label: string; binary: boolean }[] = [
  { id: 'and', label: 'AND', binary: true },
  { id: 'or', label: 'OR', binary: true },
  { id: 'xor', label: 'XOR', binary: true },
  { id: 'not', label: 'NOT', binary: false },
  { id: 'shl', label: 'Left shift', binary: true },
  { id: 'shr', label: 'Right shift', binary: true },
  { id: 'rol', label: 'Rotate left', binary: true },
  { id: 'ror', label: 'Rotate right', binary: true },
];

/** Type conversions used by the programmer calculator. */
export interface BaseConversion {
  label: string;
  base: Base;
  value: string;
}

export function allBases(value: number): BaseConversion[] {
  if (!Number.isInteger(value)) {
    throw new CalcError('NOT_SUPPORTED', 'Base conversion needs a whole number');
  }
  return [
    { label: 'Binary (BIN)', base: 2, value: formatInBase(value, 2) },
    { label: 'Octal (OCT)', base: 8, value: formatInBase(value, 8) },
    { label: 'Decimal (DEC)', base: 10, value: formatInBase(value, 10) },
    { label: 'Hexadecimal (HEX)', base: 16, value: formatInBase(value, 16, true) },
  ];
}

/** Counts set bits (Hamming weight); exact for 64-bit values via BigInt. */
export function popCount(value: number | bigint): number {
  const big = typeof value === 'bigint' ? (value < 0n ? -value : value) : BigInt(Math.abs(value));
  let count = 0;
  let remaining = big;
  while (remaining > 0n) {
    count += Number(remaining & 1n);
    remaining >>= 1n;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Fixed-width integer arithmetic (programmer calculator)              */
/* ------------------------------------------------------------------ */

export type IntegerOp = 'add' | 'subtract' | 'multiply' | 'divide' | 'mod' | 'power';

export interface IntegerOperationResult {
  /** Unsigned value wrapped to the width, as a decimal string. */
  unsigned: string;
  /** Two's-complement interpretation of the same bits. */
  signed: string;
  /** True when the exact result did not fit and was wrapped. */
  overflowed: boolean;
  binary: string;
  hex: string;
  octal: string;
}

/**
 * Integer arithmetic at a fixed bit width, wrapping exactly like a register.
 * Uses BigInt so 64-bit operations are exact, and reports wrapping rather than
 * hiding it.
 */
export function integerOperation(op: IntegerOp, a: string, b: string, width: BitWidth): IntegerOperationResult {
  const left = BigInt(a.trim());
  const right = BigInt(b.trim());
  const modulo = 1n << BigInt(width);

  let exact: bigint;
  switch (op) {
    case 'add':
      exact = left + right;
      break;
    case 'subtract':
      exact = left - right;
      break;
    case 'multiply':
      exact = left * right;
      break;
    case 'divide':
      if (right === 0n) throw new CalcError('DIV_ZERO', 'Division by zero in integer arithmetic');
      exact = left / right;
      break;
    case 'mod':
      if (right === 0n) throw new CalcError('DIV_ZERO', 'Cannot take the remainder of a division by zero');
      exact = left % right;
      break;
    case 'power':
      if (right < 0n) throw new CalcError('DOMAIN', 'Integer powers need a non-negative exponent');
      if (right > 256n) throw new CalcError('OVERFLOW', 'The exponent is too large for exact integer arithmetic');
      exact = left ** right;
      break;
  }

  const wrapped = ((exact % modulo) + modulo) % modulo;
  const signBit = 1n << BigInt(width - 1);
  const signed = wrapped >= signBit ? wrapped - modulo : wrapped;
  // Wrapping is reported when the exact result falls outside the width's range.
  const maxUnsigned = modulo - 1n;
  const minSigned = -signBit;
  const overflowed = exact > maxUnsigned || exact < minSigned;

  return {
    unsigned: wrapped.toString(10),
    signed: signed.toString(10),
    overflowed,
    binary: wrapped.toString(2).padStart(width, '0'),
    hex: wrapped.toString(16).toUpperCase(),
    octal: wrapped.toString(8),
  };
}
