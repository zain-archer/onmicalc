import { describe, expect, it } from 'vitest';
import {
  allBases,
  integerOperation,
  applyBitwise,
  applyBitwiseBig,
  maskBigInt,
  convertBase,
  formatInBase,
  maskForWidth,
  parseInBase,
  popCount,
} from './index';
import { CalcError } from '@/core/errors';

describe('base conversion', () => {
  it('parses integers in every supported base', () => {
    expect(parseInBase('1011', 2)).toBe(11);
    expect(parseInBase('777', 8)).toBe(511);
    expect(parseInBase('255', 10)).toBe(255);
    expect(parseInBase('ff', 16)).toBe(255);
    expect(parseInBase('z', 36)).toBe(35);
    expect(parseInBase('-101', 2)).toBe(-5);
  });

  it('rejects digits outside the base and empty input', () => {
    expect(parseInBase('12', 2)).toBeNull();
    expect(parseInBase('8', 8)).toBeNull();
    expect(parseInBase('g', 16)).toBeNull();
    expect(parseInBase('', 10)).toBeNull();
    expect(parseInBase('  ', 10)).toBeNull();
  });

  it('formats values in every base', () => {
    expect(formatInBase(11, 2)).toBe('1011');
    expect(formatInBase(511, 8)).toBe('777');
    expect(formatInBase(255, 16)).toBe('ff');
    expect(formatInBase(255, 16, true)).toBe('FF');
    expect(formatInBase(0, 2)).toBe('0');
    expect(formatInBase(-5, 2)).toBe('-101');
  });

  it('handles the full 64-bit range that a double cannot hold exactly', () => {
    const max64 = '18446744073709551615'; // 2^64 − 1
    expect(convertBase(max64, 10, 16)).toBe('ffffffffffffffff');
    expect(convertBase('ffffffffffffffff', 16, 2)).toHaveLength(64);
    expect(convertBase(max64, 10, 2)).toHaveLength(64);
  });

  it('refuses fractional values instead of truncating them', () => {
    expect(() => formatInBase(1.5, 2)).toThrowError(/whole numbers/);
    expect(() => formatInBase(Number.NaN, 2)).toThrowError(CalcError);
  });

  it('lists all representations for the programmer calculator', () => {
    const rows = allBases(255);
    expect(rows.map((row) => row.value)).toEqual(['11111111', '377', '255', 'FF']);
    expect(() => allBases(2.5)).toThrowError(CalcError);
  });
});

describe('bitwise operations', () => {
  it('computes AND, OR, XOR and NOT with the width mask', () => {
    expect(applyBitwise('and', 0b1100, 0b1010, 8).unsignedNumber).toBe(0b1000);
    expect(applyBitwise('or', 0b1100, 0b1010, 8).unsignedNumber).toBe(0b1110);
    expect(applyBitwise('xor', 0b1100, 0b1010, 8).unsignedNumber).toBe(0b0110);
    expect(applyBitwise('not', 0b00001111, 0, 8).unsignedNumber).toBe(0b11110000);
  });

  it('shifts left and right within the selected width', () => {
    expect(applyBitwise('shl', 1, 3, 8).unsignedNumber).toBe(8);
    expect(applyBitwise('shr', 16, 2, 8).unsignedNumber).toBe(4);
    // Bits shifted past the width are discarded.
    expect(applyBitwise('shl', 255, 4, 8).unsignedNumber).toBe(240);
    expect(applyBitwise('shr', 255, 4, 8).unsignedNumber).toBe(15);
  });

  it('rotates bits', () => {
    expect(applyBitwise('rol', 0b10000001, 1, 8).unsignedNumber).toBe(0b00000011);
    expect(applyBitwise('ror', 0b00000011, 1, 8).unsignedNumber).toBe(0b10000001);
  });

  it('reports signed and unsigned values for the selected width', () => {
    const result = applyBitwise('not', 0, 0, 8);
    expect(result.unsignedNumber).toBe(255);
    expect(result.signedDecimal).toBe('-1');
    expect(result.binary).toBe('11111111');
    expect(result.hex).toBe('FF');
    expect(result.octal).toBe('377');
    expect(result.width).toBe(8);

    expect(applyBitwise('not', 0, 0, 16).signedDecimal).toBe('-1');
    expect(applyBitwise('not', 0, 0, 16).unsignedNumber).toBe(65535);
    expect(applyBitwise('not', 0, 0, 32).unsignedNumber).toBe(4294967295);
    expect(applyBitwise('not', 0, 0, 32).binary).toHaveLength(32);
    expect(maskForWidth(8)).toBe(255);
    expect(maskForWidth(16)).toBe(65535);
    expect(maskBigInt(64)).toBe(2n ** 64n - 1n);
    expect(() => maskForWidth(64)).toThrowError(/BigInt/);
  });

  it('validates operands and shift amounts', () => {
    expect(() => applyBitwise('and', 1.5, 1, 8)).toThrowError(/whole number/);
    expect(() => applyBitwise('shl', 1, Number.NaN, 8)).toThrowError(/finite/);
    expect(() => applyBitwise('shl', 1, -1, 8)).toThrowError(/non-negative/);
    expect(() => applyBitwise('shl', 1, 100, 8)).toThrowError(/larger than/);
  });

  it('counts set bits', () => {
    expect(popCount(0)).toBe(0);
    expect(popCount(255)).toBe(8);
    expect(popCount(0b1011)).toBe(3);
    expect(popCount(2n ** 64n - 1n)).toBe(64);
  });

  it('stays exact across the full 64-bit width using BigInt', () => {
    const notZero = applyBitwiseBig('not', '0', '0', 64);
    expect(notZero.unsignedDecimal).toBe('18446744073709551615');
    expect(notZero.signedDecimal).toBe('-1');
    expect(notZero.binary).toHaveLength(64);
    expect(notZero.hex).toBe('FFFFFFFFFFFFFFFF');

    const shifted = applyBitwiseBig('shl', '1', '63', 64);
    expect(shifted.unsignedDecimal).toBe('9223372036854775808');
    expect(shifted.signedDecimal).toBe('-9223372036854775808');

    const rotated = applyBitwiseBig('rol', '1', '1', 8);
    expect(rotated.unsignedDecimal).toBe('2');
    expect(applyBitwiseBig('ror', '2', '1', 8).unsignedDecimal).toBe('1');
  });
});

describe('fixed-width integer arithmetic', () => {
  it('adds, subtracts, multiplies and divides exactly', () => {
    expect(integerOperation('add', '2', '3', 32).unsigned).toBe('5');
    expect(integerOperation('subtract', '2', '3', 32).signed).toBe('-1');
    expect(integerOperation('multiply', '123456', '654321', 64).unsigned).toBe('80779853376');
    expect(integerOperation('multiply', '123456', '654321', 32).unsigned).toBe('3470442048');
    expect(integerOperation('divide', '7', '2', 32).unsigned).toBe('3');
    expect(integerOperation('mod', '7', '2', 32).unsigned).toBe('1');
    expect(integerOperation('power', '2', '10', 32).unsigned).toBe('1024');
  });

  it('wraps to the width and reports the overflow', () => {
    const wrapped = integerOperation('add', '200', '100', 8);
    expect(wrapped.unsigned).toBe('44');
    expect(wrapped.signed).toBe('44');
    expect(wrapped.overflowed).toBe(true);

    // −1 fits the signed range, so it is not reported as an overflow.
    const negative = integerOperation('subtract', '0', '1', 8);
    expect(negative.unsigned).toBe('255');
    expect(negative.signed).toBe('-1');
    expect(negative.overflowed).toBe(false);

    // −200 is below the signed minimum and is reported.
    expect(integerOperation('subtract', '0', '200', 8).overflowed).toBe(true);

    const fits = integerOperation('add', '10', '20', 8);
    expect(fits.overflowed).toBe(false);
    expect(integerOperation('add', '100', '100', 8).overflowed).toBe(false);
  });

  it('stays exact across the full 64-bit range', () => {
    const big = integerOperation('multiply', '4294967296', '4294967296', 64); // 2^64 wraps to 0
    expect(big.unsigned).toBe('0');
    expect(big.overflowed).toBe(true);

    const almost = integerOperation('subtract', '0', '1', 64);
    expect(almost.unsigned).toBe('18446744073709551615');
    expect(almost.signed).toBe('-1');
    expect(almost.binary).toHaveLength(64);
  });

  it('refuses division by zero and negative exponents', () => {
    expect(() => integerOperation('divide', '1', '0', 32)).toThrowError(/Division by zero/);
    expect(() => integerOperation('mod', '1', '0', 32)).toThrowError(/remainder/);
    expect(() => integerOperation('power', '2', '-1', 32)).toThrowError(/non-negative/);
    expect(() => integerOperation('power', '2', '300', 32)).toThrowError(/too large/);
  });
});
