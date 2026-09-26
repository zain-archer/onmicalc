import { CalcError } from '@/core/errors';

/** Exact, browser-safe utilities used by the Programmer calculator. */

export type ProgrammerBase = number;
export type IntegerWidth = 4 | 8 | 16 | 32 | 64 | 128;
export type SignedMode = 'signed' | 'unsigned';

export const INTEGER_WIDTHS: readonly IntegerWidth[] = [4, 8, 16, 32, 64, 128];
export const PROGRAMMER_BASES: readonly number[] = Array.from({ length: 35 }, (_, index) => index + 2);
export const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function inputError(message: string, details?: string): CalcError {
  return new CalcError('INPUT', message, details ? { details } : undefined);
}

export function assertBase(base: number): ProgrammerBase {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw inputError('A base must be a whole number from 2 to 36.', `Received base ${base}.`);
  }
  return base;
}

export function parseProgrammerBigInt(input: string, base: ProgrammerBase): bigint {
  assertBase(base);
  const raw = input.trim().toLowerCase();
  if (!raw) throw inputError('Enter a value to convert.');
  const negative = raw.startsWith('-');
  const positive = raw.startsWith('+');
  const rawUnsigned = raw.slice(negative || positive ? 1 : 0);
  if (/^_|_$|__/.test(rawUnsigned)) throw inputError(`“${input}” is not a valid base-${base} integer.`);
  const unsigned = rawUnsigned.replace(/_/g, '');
  const prefixes: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };
  const prefix = prefixes[base];
  const body = prefix && unsigned.startsWith(prefix) ? unsigned.slice(2) : unsigned;
  if (!body || !new RegExp(`^[${DIGITS.slice(0, base)}]+$`, 'i').test(body)) {
    throw inputError(`“${input}” is not a valid base-${base} integer.`, `Allowed digits: ${DIGITS.slice(0, base).toUpperCase()}.`);
  }
  let result = 0n;
  const radix = BigInt(base);
  for (const character of body) result = result * radix + BigInt(DIGITS.indexOf(character));
  return negative ? -result : result;
}

export function formatProgrammerBigInt(value: bigint, base: ProgrammerBase, prefix = false, uppercase = false): string {
  assertBase(base);
  const negative = value < 0n;
  const text = (negative ? -value : value).toString(base);
  const rendered = uppercase ? text.toUpperCase() : text;
  const prefixes: Record<number, string> = { 2: '0b', 8: '0o', 16: '0x' };
  return `${negative ? '-' : ''}${prefix && prefixes[base] ? prefixes[base] : ''}${rendered}`;
}

export function programmerRepresentations(value: bigint): { binary: string; octal: string; decimal: string; hexadecimal: string; base36: string } {
  return {
    binary: formatProgrammerBigInt(value, 2),
    octal: formatProgrammerBigInt(value, 8),
    decimal: formatProgrammerBigInt(value, 10),
    hexadecimal: formatProgrammerBigInt(value, 16, false, true),
    base36: formatProgrammerBigInt(value, 36),
  };
}

export function baseArithmetic(a: string, b: string, base: ProgrammerBase, operation: '+' | '-' | '*' | '/' | '%' | '^'): bigint {
  const left = parseProgrammerBigInt(a, base);
  const right = parseProgrammerBigInt(b, base);
  if ((operation === '/' || operation === '%') && right === 0n) {
    throw new CalcError('DIV_ZERO', operation === '/' ? 'Division by zero.' : 'Remainder by zero.');
  }
  if (operation === '^' && right < 0n) throw new CalcError('DOMAIN', 'Integer powers need a non-negative exponent.');
  if (operation === '^' && right > 4096n) throw new CalcError('OVERFLOW', 'That exponent is too large for an exact result.');
  switch (operation) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '^': return left ** right;
  }
}

/* -------------------------------------------------------------------------- */
/* Bitwise and bit manipulation                                               */
/* -------------------------------------------------------------------------- */

export type ProgrammerBitwiseOperation =
  | 'and' | 'or' | 'xor' | 'not' | 'nand' | 'nor' | 'xnor'
  | 'shl' | 'shr' | 'ashr' | 'lshr' | 'rol' | 'ror';

export const PROGRAMMER_BITWISE_OPS: readonly { id: ProgrammerBitwiseOperation; label: string; needsOperand: boolean }[] = [
  { id: 'and', label: 'AND', needsOperand: true },
  { id: 'or', label: 'OR', needsOperand: true },
  { id: 'xor', label: 'XOR', needsOperand: true },
  { id: 'not', label: 'NOT', needsOperand: false },
  { id: 'nand', label: 'NAND', needsOperand: true },
  { id: 'nor', label: 'NOR', needsOperand: true },
  { id: 'xnor', label: 'XNOR', needsOperand: true },
  { id: 'shl', label: 'Left shift <<', needsOperand: true },
  { id: 'shr', label: 'Right shift >>', needsOperand: true },
  { id: 'ashr', label: 'Arithmetic right shift', needsOperand: true },
  { id: 'lshr', label: 'Logical right shift', needsOperand: true },
  { id: 'rol', label: 'Rotate left', needsOperand: true },
  { id: 'ror', label: 'Rotate right', needsOperand: true },
];

function widthMask(width: IntegerWidth): bigint {
  return (1n << BigInt(width)) - 1n;
}

export function unsignedAtWidth(value: bigint, width: IntegerWidth): bigint {
  const modulo = 1n << BigInt(width);
  return ((value % modulo) + modulo) % modulo;
}

export function signedAtWidth(value: bigint, width: IntegerWidth): bigint {
  const unsigned = unsignedAtWidth(value, width);
  const sign = 1n << BigInt(width - 1);
  return unsigned >= sign ? unsigned - (1n << BigInt(width)) : unsigned;
}

export interface ProgrammerBitwiseResult {
  unsigned: bigint;
  signed: bigint;
  binary: string;
  hex: string;
  octal: string;
}

export function applyProgrammerBitwise(
  operation: ProgrammerBitwiseOperation,
  left: bigint,
  right: bigint,
  width: IntegerWidth,
): ProgrammerBitwiseResult {
  const mask = widthMask(width);
  const a = unsignedAtWidth(left, width);
  const b = unsignedAtWidth(right, width);
  let result: bigint;
  switch (operation) {
    case 'and': result = a & b; break;
    case 'or': result = a | b; break;
    case 'xor': result = a ^ b; break;
    case 'not': result = ~a; break;
    case 'nand': result = ~(a & b); break;
    case 'nor': result = ~(a | b); break;
    case 'xnor': result = ~(a ^ b); break;
    case 'shl': result = a << checkedShift(right, width); break;
    case 'shr':
    case 'lshr': result = a >> checkedShift(right, width); break;
    case 'ashr': result = signedAtWidth(a, width) >> checkedShift(right, width); break;
    case 'rol': result = rotate(a, right, width, false); break;
    case 'ror': result = rotate(a, right, width, true); break;
  }
  const unsigned = result & mask;
  return {
    unsigned,
    signed: signedAtWidth(unsigned, width),
    binary: unsigned.toString(2).padStart(width, '0'),
    hex: unsigned.toString(16).toUpperCase(),
    octal: unsigned.toString(8),
  };
}

function checkedShift(value: bigint, width: IntegerWidth): bigint {
  if (value < 0n) throw new CalcError('DOMAIN', 'The shift amount must not be negative.');
  // Shifts at or above the register width are valid and produce zero; cap only
  // pathological inputs so a typo cannot ask BigInt to allocate enormous data.
  if (value > 1_000_000n) throw new CalcError('DOMAIN', `The shift amount is too large for ${width}-bit arithmetic.`);
  return value;
}

function rotate(value: bigint, amount: bigint, width: IntegerWidth, right: boolean): bigint {
  const shift = amount % BigInt(width);
  if (shift === 0n) return value;
  const bits = BigInt(width);
  return right
    ? (value >> shift) | ((value << (bits - shift)) & widthMask(width))
    : ((value << shift) & widthMask(width)) | (value >> (bits - shift));
}

function checkedPosition(position: number, width: IntegerWidth): void {
  if (!Number.isInteger(position) || position < 0 || position >= width) {
    throw inputError(`Bit position must be a whole number from 0 to ${width - 1}.`);
  }
}

export function setBit(value: bigint, position: number, width: IntegerWidth): bigint {
  checkedPosition(position, width); return unsignedAtWidth(value, width) | (1n << BigInt(position));
}
export function clearBit(value: bigint, position: number, width: IntegerWidth): bigint {
  checkedPosition(position, width); return unsignedAtWidth(value, width) & ~(1n << BigInt(position));
}
export function toggleBit(value: bigint, position: number, width: IntegerWidth): bigint {
  checkedPosition(position, width); return unsignedAtWidth(value, width) ^ (1n << BigInt(position));
}
export function testBit(value: bigint, position: number, width: IntegerWidth): boolean {
  checkedPosition(position, width); return (unsignedAtWidth(value, width) & (1n << BigInt(position))) !== 0n;
}
export function extractBitRange(value: bigint, start: number, length: number, width: IntegerWidth): bigint {
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1 || start + length > width) {
    throw inputError('The bit range must fit inside the selected width.');
  }
  return (unsignedAtWidth(value, width) >> BigInt(start)) & ((1n << BigInt(length)) - 1n);
}
export function insertBitRange(value: bigint, inserted: bigint, start: number, length: number, width: IntegerWidth): bigint {
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1 || start + length > width) {
    throw inputError('The inserted bit range must fit inside the selected width.');
  }
  const rangeMask = ((1n << BigInt(length)) - 1n) << BigInt(start);
  return (unsignedAtWidth(value, width) & ~rangeMask) | ((inserted << BigInt(start)) & rangeMask);
}
export function countSetBits(value: bigint, width?: IntegerWidth): number {
  let remaining = width ? unsignedAtWidth(value, width) : (value < 0n ? -value : value);
  let count = 0;
  while (remaining) { count += Number(remaining & 1n); remaining >>= 1n; }
  return count;
}
export function countZeroBits(value: bigint, width: IntegerWidth): number {
  return width - countSetBits(value, width);
}
export function highestSetBit(value: bigint, width?: IntegerWidth): number | null {
  const unsigned = width ? unsignedAtWidth(value, width) : (value < 0n ? -value : value);
  return unsigned === 0n ? null : unsigned.toString(2).length - 1;
}
export function lowestSetBit(value: bigint, width?: IntegerWidth): number | null {
  const unsigned = width ? unsignedAtWidth(value, width) : (value < 0n ? -value : value);
  if (unsigned === 0n) return null;
  let position = 0;
  let current = unsigned;
  while ((current & 1n) === 0n) { position += 1; current >>= 1n; }
  return position;
}
export function reverseBits(value: bigint, width: IntegerWidth): bigint {
  const source = unsignedAtWidth(value, width);
  let result = 0n;
  for (let index = 0; index < width; index += 1) if ((source & (1n << BigInt(index))) !== 0n) result |= 1n << BigInt(width - index - 1);
  return result;
}
export function reverseBytes(value: bigint, width: IntegerWidth): bigint {
  if (width % 8 !== 0) throw inputError('Byte reversal needs a width divisible by 8.');
  const bytes = width / 8;
  let result = 0n;
  const source = unsignedAtWidth(value, width);
  for (let index = 0; index < bytes; index += 1) result |= ((source >> BigInt(index * 8)) & 0xffn) << BigInt((bytes - index - 1) * 8);
  return result;
}
export function generateBitMask(start: number, length: number, width: IntegerWidth): bigint {
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 0 || length < 1 || start + length > width) throw inputError('The mask range does not fit in the selected width.');
  return ((1n << BigInt(length)) - 1n) << BigInt(start);
}
export function applyBitMask(value: bigint, mask: bigint, operation: 'and' | 'or' | 'xor' | 'clear', width: IntegerWidth): bigint {
  const a = unsignedAtWidth(value, width); const b = unsignedAtWidth(mask, width);
  if (operation === 'and') return a & b;
  if (operation === 'or') return a | b;
  if (operation === 'xor') return a ^ b;
  return a & ~b & widthMask(width);
}

export interface IntegerTypeInfo {
  width: IntegerWidth;
  unsigned: bigint;
  signed: bigint;
  minimum: bigint;
  maximum: bigint;
  overflow: boolean;
  underflow: boolean;
  binary: string;
  signExtended: bigint;
  zeroExtended: bigint;
}

export function integerTypeInfo(value: bigint, width: IntegerWidth, mode: SignedMode): IntegerTypeInfo {
  const unsigned = unsignedAtWidth(value, width);
  const signed = signedAtWidth(unsigned, width);
  const minimum = mode === 'signed' ? -(1n << BigInt(width - 1)) : 0n;
  const maximum = mode === 'signed' ? (1n << BigInt(width - 1)) - 1n : width === 128 ? (1n << 128n) - 1n : (1n << BigInt(width)) - 1n;
  return {
    width, unsigned, signed, minimum, maximum,
    overflow: value > maximum,
    underflow: value < minimum,
    binary: unsigned.toString(2).padStart(width, '0'),
    signExtended: signed,
    zeroExtended: unsigned,
  };
}

export function signExtend(value: bigint, from: IntegerWidth, to: IntegerWidth): bigint {
  if (to < from) throw inputError('The destination width must be at least the source width.');
  return signedAtWidth(value, from);
}
export function zeroExtend(value: bigint, from: IntegerWidth, to: IntegerWidth): bigint {
  if (to < from) throw inputError('The destination width must be at least the source width.');
  return unsignedAtWidth(value, from);
}

export function powerOfTwo(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 1_000_000) throw inputError('The exponent must be an integer from 0 to 1,000,000.');
  return 1n << BigInt(exponent);
}
export function integerLog2(value: bigint): number {
  if (value <= 0n || (value & (value - 1n)) !== 0n) throw inputError('log2 is exact here only for a positive power of two.');
  return value.toString(2).length - 1;
}
export function isPowerOfTwo(value: bigint): boolean { return value > 0n && (value & (value - 1n)) === 0n; }
export function nextPowerOfTwo(value: bigint): bigint { if (value <= 1n) return 1n; return 1n << BigInt((value - 1n).toString(2).length); }
export function previousPowerOfTwo(value: bigint): bigint { if (value < 1n) return 0n; return 1n << BigInt(value.toString(2).length - 1); }
export function nearestPowerOfTwo(value: bigint): bigint {
  if (value <= 1n) return 1n;
  const lower = previousPowerOfTwo(value); const upper = nextPowerOfTwo(value);
  return value - lower < upper - value ? lower : upper;
}

/* -------------------------------------------------------------------------- */
/* Data sizes, text, encoding                                                 */
/* -------------------------------------------------------------------------- */

export const DATA_UNITS = [
  { id: 'bit', label: 'bits', bytes: 1 / 8 }, { id: 'B', label: 'bytes', bytes: 1 },
  { id: 'KB', label: 'KB (decimal)', bytes: 1000 }, { id: 'KiB', label: 'KiB (binary)', bytes: 1024 },
  { id: 'MB', label: 'MB (decimal)', bytes: 1000 ** 2 }, { id: 'MiB', label: 'MiB (binary)', bytes: 1024 ** 2 },
  { id: 'GB', label: 'GB (decimal)', bytes: 1000 ** 3 }, { id: 'GiB', label: 'GiB (binary)', bytes: 1024 ** 3 },
  { id: 'TB', label: 'TB (decimal)', bytes: 1000 ** 4 }, { id: 'TiB', label: 'TiB (binary)', bytes: 1024 ** 4 },
  { id: 'PB', label: 'PB (decimal)', bytes: 1000 ** 5 }, { id: 'PiB', label: 'PiB (binary)', bytes: 1024 ** 5 },
  { id: 'EB', label: 'EB (decimal)', bytes: 1000 ** 6 }, { id: 'EiB', label: 'EiB (binary)', bytes: 1024 ** 6 },
] as const;

export function convertDataSize(value: number, from: string, to: string): number {
  if (!Number.isFinite(value)) throw inputError('Enter a finite data size.');
  const source = DATA_UNITS.find((unit) => unit.id === from); const target = DATA_UNITS.find((unit) => unit.id === to);
  if (!source || !target) throw inputError('Unknown data-size unit.');
  return value * source.bytes / target.bytes;
}

export const DATA_TYPE_SIZES = [
  { name: 'bool / _Bool', bytes: 1 }, { name: 'char / byte', bytes: 1 }, { name: 'short / i16', bytes: 2 },
  { name: 'int / i32', bytes: 4 }, { name: 'long long / i64', bytes: 8 }, { name: 'float32', bytes: 4 },
  { name: 'double / float64', bytes: 8 }, { name: 'pointer (32-bit)', bytes: 4 }, { name: 'pointer (64-bit)', bytes: 8 },
] as const;

export function memoryAddress(address: bigint, offset: bigint, elementSize = 1n, index = 0n): bigint {
  if (elementSize < 1n) throw inputError('Element size must be positive.');
  return address + offset + elementSize * index;
}

export function codePointToCharacter(value: string | number): string {
  const point = typeof value === 'number' ? BigInt(value) : parseProgrammerBigInt(value.trim().replace(/^u\+/i, ''), 16);
  if (point < 0n || point > 0x10ffffn || (point >= 0xd800n && point <= 0xdfffn)) throw inputError('That is not a valid Unicode code point.');
  return String.fromCodePoint(Number(point));
}

export function characterCodePoints(text: string): number[] {
  if (!text) throw inputError('Enter a character or text.');
  return Array.from(text, (character) => character.codePointAt(0) ?? 0);
}

export function utf8Bytes(text: string): Uint8Array { return new TextEncoder().encode(text); }
export function bytesToUtf8(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw inputError('The bytes are not valid UTF-8.'); }
}
export function textToAscii(text: string): number[] {
  const values = characterCodePoints(text); if (values.some((value) => value > 127)) throw inputError('ASCII only supports code points 0 through 127.'); return values;
}
export function asciiToText(input: string): string {
  const parts = input.trim().split(/[\s,]+/).filter(Boolean); if (!parts.length) throw inputError('Enter one or more ASCII codes.');
  const values = parts.map((part) => Number(part)); if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 127)) throw inputError('ASCII codes must be integers from 0 through 127.');
  return String.fromCharCode(...values);
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!; const b = bytes[index + 1]; const c = bytes[index + 2];
    result += BASE64[a >> 2] + BASE64[((a & 3) << 4) | ((b ?? 0) >> 4)] + (b === undefined ? '=' : BASE64[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? '=' : BASE64[c & 63]);
  }
  return result;
}
function base64ToBytes(input: string): Uint8Array {
  const text = input.trim(); if (!text || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw inputError('Invalid Base64 text.');
  const output: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    const a = BASE64.indexOf(text[index]!); const b = BASE64.indexOf(text[index + 1]!); const c = text[index + 2] === '=' ? 0 : BASE64.indexOf(text[index + 2]!); const d = text[index + 3] === '=' ? 0 : BASE64.indexOf(text[index + 3]!);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw inputError('Invalid Base64 text.');
    if (text[index + 2] === '=' && (b & 15) !== 0) throw inputError('Invalid Base64 padding.');
    if (text[index + 3] === '=' && text[index + 2] !== '=' && (c & 3) !== 0) throw inputError('Invalid Base64 padding.');
    if ((text[index + 2] === '=' || text[index + 3] === '=') && index + 4 !== text.length) throw inputError('Base64 padding must be at the end.');
    output.push((a << 2) | (b >> 4)); if (text[index + 2] !== '=') output.push(((b & 15) << 4) | (c >> 2)); if (text[index + 3] !== '=') output.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(output);
}
export function base64Encode(text: string): string { return bytesToBase64(utf8Bytes(text)); }
export function base64Decode(input: string): string { return bytesToUtf8(base64ToBytes(input)); }
export function urlEncode(text: string): string { return encodeURIComponent(text); }
export function urlDecode(text: string): string { try { return decodeURIComponent(text); } catch { throw inputError('Invalid URL-encoded text.'); } }
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function htmlEncode(text: string): string { return text.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]!); }
export function htmlDecode(text: string): string { const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }; return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => entity.toLowerCase().startsWith('#x') ? String.fromCodePoint(parseInt(entity.slice(2), 16)) : entity.startsWith('#') ? String.fromCodePoint(Number(entity.slice(1))) : named[entity.toLowerCase()]!); }
export function textToBinary(text: string): string { return [...utf8Bytes(text)].map((value) => value.toString(2).padStart(8, '0')).join(' '); }
export function binaryToText(input: string): string { const parts = input.trim().split(/[\s,]+/).filter(Boolean); if (!parts.length || parts.some((part) => !/^[01]{8}$/.test(part))) throw inputError('Binary text must contain 8-bit byte groups.'); return bytesToUtf8(new Uint8Array(parts.map((part) => parseInt(part, 2)))); }
export function textToHex(text: string): string { return [...utf8Bytes(text)].map((value) => value.toString(16).padStart(2, '0')).join(' ').toUpperCase(); }
export function hexToText(input: string): string { const clean = input.replace(/[\s,:-]/g, ''); if (!clean || clean.length % 2 || !/^[\da-f]+$/i.test(clean)) throw inputError('Hex text must contain complete byte pairs.'); const bytes = new Uint8Array(clean.match(/../g)!.map((pair) => parseInt(pair, 16))); return bytesToUtf8(bytes); }

/* -------------------------------------------------------------------------- */
/* IPv4, IPv6 and MAC                                                         */
/* -------------------------------------------------------------------------- */

function ipv4ToNumber(parts: number[]): number { return parts.reduce((result, part) => result * 256 + part, 0); }
function numberToIpv4(value: number): string { return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.'); }
export function parseIPv4(input: string): number {
  const parts = input.trim().split('.'); if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) throw inputError('Invalid IPv4 address.'); return ipv4ToNumber(parts.map(Number));
}
export function ipv4ToBinary(input: string): string { return parseIPv4(input).toString(2).padStart(32, '0').match(/.{8}/g)!.join('.'); }
export function ipv4ToHex(input: string): string { return `0x${parseIPv4(input).toString(16).padStart(8, '0').toUpperCase()}`; }
export interface IPv4Info { ip: string; prefix: number; mask: string; wildcard: string; network: string; broadcast: string; first: string; last: string; addresses: bigint; usableHosts: bigint; }
export function ipv4Cidr(input: string): IPv4Info {
  const parts = input.trim().split('/'); if (parts.length !== 2) throw inputError('Enter an IPv4 address followed by one CIDR prefix, such as 192.168.1.10/24.');
  const [address, prefixText] = parts; const prefix = Number(prefixText); if (!address || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw inputError('CIDR prefix must be an integer from 0 to 32.');
  const ip = parseIPv4(address); const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0; const network = (ip & mask) >>> 0; const broadcast = (network | (~mask >>> 0)) >>> 0; const addresses = 1n << BigInt(32 - prefix); const usableHosts = prefix >= 31 ? addresses : addresses - 2n;
  return { ip: numberToIpv4(ip), prefix, mask: numberToIpv4(mask), wildcard: numberToIpv4(~mask >>> 0), network: numberToIpv4(network), broadcast: numberToIpv4(broadcast), first: numberToIpv4(prefix >= 31 ? network : network + 1), last: numberToIpv4(prefix >= 31 ? broadcast : broadcast - 1), addresses, usableHosts };
}
export function subnetForHosts(hosts: bigint): { prefix: number; addresses: bigint; usableHosts: bigint; mask: string } {
  if (hosts < 1n) throw inputError('Required hosts must be positive.');
  let hostBits = 0;
  while (hostBits < 32 && (1n << BigInt(hostBits)) - (hostBits >= 1 ? 2n : 0n) < hosts) hostBits += 1;
  if ((1n << BigInt(hostBits)) - (hostBits >= 1 ? 2n : 0n) < hosts) {
    throw new CalcError('OVERFLOW', 'IPv4 cannot provide that many usable hosts.');
  }
  const prefix = 32 - hostBits; const addresses = 1n << BigInt(hostBits); return { prefix, addresses, usableHosts: prefix >= 31 ? addresses : addresses - 2n, mask: numberToIpv4(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0) };
}
export function subnetsForCount(basePrefix: number, count: bigint): { prefix: number; subnets: bigint; hostsPerSubnet: bigint } {
  if (!Number.isInteger(basePrefix) || basePrefix < 0 || basePrefix > 32 || count < 1n) throw inputError('Enter a valid base prefix and subnet count.');
  let bits = 0; while ((1n << BigInt(bits)) < count && basePrefix + bits <= 32) bits += 1; if (basePrefix + bits > 32) throw new CalcError('OVERFLOW', 'There are not enough host bits for that many subnets.');
  const prefix = basePrefix + bits; return { prefix, subnets: 1n << BigInt(bits), hostsPerSubnet: 1n << BigInt(32 - prefix) };
}

function parseIPv6BigInt(input: string): bigint {
  let text = input.trim().toLowerCase();
  if (text.includes('.')) { const lastColon = text.lastIndexOf(':'); if (lastColon < 0) throw inputError('An IPv4-embedded IPv6 address needs a colon before the IPv4 part.'); const ipv4 = parseIPv4(text.slice(lastColon + 1)); text = `${text.slice(0, lastColon)}:${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`; }
  const halves = text.split('::'); if (halves.length > 2) throw inputError('Invalid IPv6 address.');
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : []; const right = halves[1] ? halves[1].split(':').filter(Boolean) : []; const missing = halves.length === 2 ? 8 - left.length - right.length : 0; if ((halves.length === 2 && missing < 1) || (halves.length === 1 && left.length !== 8)) throw inputError('Invalid IPv6 address.');
  const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right]; if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) throw inputError('Invalid IPv6 address.');
  return groups.reduce((result, group) => (result << 16n) | BigInt(parseInt(group, 16)), 0n);
}
export function expandIPv6(input: string): string { const value = parseIPv6BigInt(input); const groups: string[] = []; for (let index = 7; index >= 0; index -= 1) groups.push(((value >> BigInt(index * 16)) & 0xffffn).toString(16).padStart(4, '0')); return groups.join(':'); }
export function compressIPv6(input: string): string {
  const groups = expandIPv6(input).split(':'); let bestStart = -1; let bestLength = 0;
  for (let index = 0; index < groups.length;) { if (groups[index] !== '0000') { index += 1; continue; } const start = index; while (index < groups.length && groups[index] === '0000') index += 1; if (index - start > bestLength) { bestStart = start; bestLength = index - start; } }
  const short = groups.map((group) => group.replace(/^0+/, '') || '0'); if (bestLength < 2) return short.join(':'); const left = short.slice(0, bestStart).join(':'); const right = short.slice(bestStart + bestLength).join(':'); return left && right ? `${left}::${right}` : left ? `${left}::` : `::${right}`;
}
export function ipv6NetworkPrefix(input: string): string {
  const parts = input.trim().split('/'); if (parts.length !== 2) throw inputError('Enter an IPv6 address followed by one prefix length, such as 2001:db8::1/64.');
  const [address, prefixText] = parts; const prefix = Number(prefixText); if (!address || !Number.isInteger(prefix) || prefix < 0 || prefix > 128) throw inputError('IPv6 prefix length must be from 0 to 128.');
  const value = parseIPv6BigInt(address); const network = (value >> BigInt(128 - prefix)) << BigInt(128 - prefix); return `${compressIPv6(expandIPv6(network.toString(16).padStart(32, '0').match(/.{4}/g)!.join(':')) || '::')}/${prefix}`;
}

export interface MacInfo { normalized: string; colon: string; hyphen: string; cisco: string; plain: string; binary: string; hex: string; unicast: boolean; multicast: boolean; locallyAdministered: boolean; globallyAdministered: boolean; }
export function macInfo(input: string): MacInfo {
  const clean = input.replace(/[.:-]/g, '').trim().toUpperCase(); if (!/^[\da-f]{12}$/i.test(clean)) throw inputError('A MAC address must contain exactly 12 hexadecimal digits.');
  const bytes = clean.match(/../g)!; const first = parseInt(bytes[0]!, 16); const unicast = (first & 1) === 0; const locallyAdministered = (first & 2) !== 0;
  return { normalized: clean, colon: bytes.join(':'), hyphen: bytes.join('-'), cisco: `${clean.slice(0, 4)}.${clean.slice(4, 8)}.${clean.slice(8)}`, plain: clean, binary: bytes.map((value) => parseInt(value, 16).toString(2).padStart(8, '0')).join(''), hex: `0x${clean}`, unicast, multicast: !unicast, locallyAdministered, globallyAdministered: !locallyAdministered };
}

/* -------------------------------------------------------------------------- */
/* Time, IEEE-754, checksums and hashes                                       */
/* -------------------------------------------------------------------------- */

export type TimestampUnit = 's' | 'ms' | 'us' | 'ns';
const TIMESTAMP_PER_MILLISECOND: Record<TimestampUnit, bigint> = { s: 1000n, ms: 1n, us: 1n, ns: 1n };
const MILLISECONDS_PER_TIMESTAMP: Record<TimestampUnit, bigint> = { s: 1n, ms: 1n, us: 1000n, ns: 1_000_000n };
export function timestampToDate(value: string, unit: TimestampUnit): Date {
  const text = value.trim(); if (!/^[+-]?\d+$/.test(text)) throw inputError('Timestamps must be whole integers in the selected unit.');
  let timestamp: bigint; try { timestamp = BigInt(text); } catch { throw inputError('Enter a valid integer timestamp.'); }
  const milliseconds = timestamp * TIMESTAMP_PER_MILLISECOND[unit] / MILLISECONDS_PER_TIMESTAMP[unit];
  const number = Number(milliseconds); const date = new Date(number);
  if (!Number.isSafeInteger(number) || !Number.isFinite(date.getTime())) throw inputError('That timestamp is outside the supported date range.');
  return date;
}
export function dateToTimestamp(input: string, unit: TimestampUnit): string {
  const date = new Date(input); if (!Number.isFinite(date.getTime())) throw inputError('Enter a valid date and time.');
  return (BigInt(date.getTime()) * MILLISECONDS_PER_TIMESTAMP[unit] / TIMESTAMP_PER_MILLISECOND[unit]).toString();
}
export function timeRepresentations(date: Date): { utc: string; local: string; iso: string; rfc3339: string } { return { utc: date.toUTCString(), local: date.toString(), iso: date.toISOString(), rfc3339: date.toISOString() }; }

export interface FloatInfo { value: number; width: 32 | 64; sign: number; exponent: number; fraction: string; rawBinary: string; rawHex: string; classification: string; }
export function floatInfo(value: number, width: 32 | 64): FloatInfo {
  const buffer = new ArrayBuffer(width / 8); const view = new DataView(buffer); if (width === 32) view.setFloat32(0, value, false); else view.setFloat64(0, value, false);
  const bits = width === 32 ? BigInt(view.getUint32(0, false)) : view.getBigUint64(0, false); const exponentBits = width === 32 ? 8 : 11; const fractionBits = width === 32 ? 23 : 52; const sign = Number(bits >> BigInt(width - 1)); const exponent = Number((bits >> BigInt(fractionBits)) & ((1n << BigInt(exponentBits)) - 1n)); const fraction = (bits & ((1n << BigInt(fractionBits)) - 1n)).toString(2).padStart(fractionBits, '0');
  let classification = 'normal'; const maxExponent = (1 << exponentBits) - 1; if (exponent === maxExponent) classification = fraction.includes('1') ? 'NaN' : sign ? '-Infinity' : 'Infinity'; else if (exponent === 0) classification = fraction.includes('1') ? 'subnormal' : sign ? 'negative zero' : 'positive zero';
  return { value: width === 32 ? view.getFloat32(0, false) : view.getFloat64(0, false), width, sign, exponent, fraction, rawBinary: bits.toString(2).padStart(width, '0'), rawHex: bits.toString(16).padStart(width / 4, '0').toUpperCase(), classification };
}
export function rawToFloat(raw: string, width: 32 | 64): number {
  const clean = raw.trim().replace(/^0x/i, ''); const max = width / 4; if (!new RegExp(`^[\\da-f]{1,${max}}$`, 'i').test(clean)) throw inputError(`Enter a ${width}-bit IEEE-754 hexadecimal value.`); const value = BigInt(`0x${clean}`); const view = new DataView(new ArrayBuffer(width / 8)); if (width === 32) view.setUint32(0, Number(value), false); else view.setBigUint64(0, value, false); return width === 32 ? view.getFloat32(0, false) : view.getFloat64(0, false);
}

function bytesFromInput(input: string, mode: 'text' | 'hex'): Uint8Array { if (mode === 'text') return utf8Bytes(input); const clean = input.replace(/[\s,:-]/g, ''); if (!clean || clean.length % 2 || !/^[\da-f]+$/i.test(clean)) throw inputError('Enter valid hexadecimal bytes.'); return new Uint8Array(clean.match(/../g)!.map((pair) => parseInt(pair, 16))); }
export function crc8(input: string, mode: 'text' | 'hex' = 'text'): number { let crc = 0; for (const byte of bytesFromInput(input, mode)) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x80) ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff; } return crc; }
export function crc16(input: string, mode: 'text' | 'hex' = 'text'): number { let crc = 0x0000; for (const byte of bytesFromInput(input, mode)) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (crc >>> 1) ^ 0xa001 : crc >>> 1; } return crc; }
export function crc16Modbus(input: string, mode: 'text' | 'hex' = 'text'): number { let crc = 0xffff; for (const byte of bytesFromInput(input, mode)) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (crc >>> 1) ^ 0xa001 : crc >>> 1; } return crc; }
export function crc32(input: string, mode: 'text' | 'hex' = 'text'): number { let crc = 0xffffffff; for (const byte of bytesFromInput(input, mode)) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; } return (crc ^ 0xffffffff) >>> 0; }
export function adler32(input: string, mode: 'text' | 'hex' = 'text'): number { let a = 1; let b = 0; for (const byte of bytesFromInput(input, mode)) { a = (a + byte) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
export function xorChecksum(input: string, mode: 'text' | 'hex' = 'text'): number { let result = 0; for (const byte of bytesFromInput(input, mode)) result ^= byte; return result; }

function rotateLeft32(value: number, amount: number): number { return (value << amount) | (value >>> (32 - amount)); }
function md5(input: Uint8Array): string {
  const bytes = Array.from(input); const bitLength = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0); for (let index = 0; index < 8; index += 1) bytes.push(Math.floor(bitLength / 2 ** (8 * index)) & 255);
  let a0 = 0x67452301; let b0 = 0xefcdab89; let c0 = 0x98badcfe; let d0 = 0x10325476;
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]; const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0);
  for (let offset = 0; offset < bytes.length; offset += 64) { const words = Array.from({ length: 16 }, (_, index) => bytes[offset + index * 4]! | bytes[offset + index * 4 + 1]! << 8 | bytes[offset + index * 4 + 2]! << 16 | bytes[offset + index * 4 + 3]! << 24); let a = a0; let b = b0; let c = c0; let d = d0;
    for (let index = 0; index < 64; index += 1) { let f: number; let g: number; if (index < 16) { f = (b & c) | (~b & d); g = index; } else if (index < 32) { f = (d & b) | (~d & c); g = (5 * index + 1) % 16; } else if (index < 48) { f = b ^ c ^ d; g = (3 * index + 5) % 16; } else { f = c ^ (b | ~d); g = (7 * index) % 16; } const next = (a + f + constants[index]! + words[g]!) >>> 0; const shift = shifts[(index % 4) + (index < 16 ? 0 : index < 32 ? 4 : index < 48 ? 8 : 12)]!; const oldD = d; d = c; c = b; b = (b + rotateLeft32(next, shift)) >>> 0; a = oldD; }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].flatMap((word) => Array.from({ length: 4 }, (_, index) => (word >>> (8 * index)) & 255)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

const SHA256_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
const SHA256_IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
function sha256(input: Uint8Array, initial = SHA256_IV, outputWords = 8): string {
  const bytes = Array.from(input); const bitLength = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0); for (let index = 7; index >= 0; index -= 1) bytes.push(Math.floor(bitLength / 2 ** (index * 8)) & 255);
  const hash = initial.slice(); const rotr = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  for (let offset = 0; offset < bytes.length; offset += 64) { const words = new Array<number>(64).fill(0); for (let index = 0; index < 16; index += 1) words[index] = (bytes[offset + index * 4]! << 24 | bytes[offset + index * 4 + 1]! << 16 | bytes[offset + index * 4 + 2]! << 8 | bytes[offset + index * 4 + 3]!) >>> 0; for (let index = 16; index < 64; index += 1) { const s0 = rotr(words[index - 15]!, 7) ^ rotr(words[index - 15]!, 18) ^ (words[index - 15]! >>> 3); const s1 = rotr(words[index - 2]!, 17) ^ rotr(words[index - 2]!, 19) ^ (words[index - 2]! >>> 10); words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0; } let [a, b, c, d, e, f, g, h] = hash; for (let index = 0; index < 64; index += 1) { const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25); const choose = (e & f) ^ (~e & g); const t1 = (h + s1 + choose + SHA256_K[index]! + words[index]!) >>> 0; const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22); const majority = (a & b) ^ (a & c) ^ (b & c); const t2 = (s0 + majority) >>> 0; [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0]; } for (let index = 0; index < 8; index += 1) hash[index] = (hash[index]! + [a, b, c, d, e, f, g, h][index]!) >>> 0; }
  return hash.slice(0, outputWords).map((word) => word.toString(16).padStart(8, '0')).join('');
}

const KECCAK_ROTATIONS = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
const KECCAK_RC = [1n, 0x8082n, 0x800000000000808an, 0x8000000080008000n, 0x808bn, 0x80000001n, 0x8000000080008081n, 0x8000000000008009n, 0x8an, 0x88n, 0x80008009n, 0x8000000an, 0x8000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n, 0x800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x80000001n, 0x8000000080008008n];
const KECCAK_MASK = (1n << 64n) - 1n;
function rotl64(value: bigint, amount: number): bigint { if (amount === 0) return value; return ((value << BigInt(amount)) | (value >> BigInt(64 - amount))) & KECCAK_MASK; }
function sha3(input: Uint8Array, outputBytes: number, rate: number): string {
  const data = Array.from(input); data.push(0x06); while (data.length % rate !== rate - 1) data.push(0); data.push(0x80);
  const state = Array.from({ length: 25 }, () => 0n);
  for (let offset = 0; offset < data.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane += 1) { let word = 0n; for (let byte = 0; byte < 8; byte += 1) word |= BigInt(data[offset + lane * 8 + byte]!) << BigInt(byte * 8); state[lane] = state[lane]! ^ word; }
    keccakF(state);
  }
  const output: number[] = [];
  while (output.length < outputBytes) { for (let lane = 0; lane < rate / 8 && output.length < outputBytes; lane += 1) for (let byte = 0; byte < 8 && output.length < outputBytes; byte += 1) output.push(Number((state[lane]! >> BigInt(byte * 8)) & 255n)); if (output.length < outputBytes) keccakF(state); }
  return output.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function keccakF(state: bigint[]): void { for (const rc of KECCAK_RC) { const c = Array.from({ length: 5 }, (_, x) => state[x]! ^ state[x + 5]! ^ state[x + 10]! ^ state[x + 15]! ^ state[x + 20]!); const d = Array.from({ length: 5 }, (_, x) => c[(x + 4) % 5]! ^ rotl64(c[(x + 1) % 5]!, 1)); for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) state[x + 5 * y] = state[x + 5 * y]! ^ d[x]!; const b = Array.from({ length: 25 }, () => 0n); for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl64(state[x + 5 * y]!, KECCAK_ROTATIONS[x + 5 * y]!); for (let x = 0; x < 5; x += 1) for (let y = 0; y < 5; y += 1) state[x + 5 * y] = b[x + 5 * y]! ^ ((~b[(x + 1) % 5 + 5 * y]! ) & b[(x + 2) % 5 + 5 * y]!); state[0] = state[0]! ^ rc; } }

export type HashAlgorithm = 'MD5' | 'SHA-1' | 'SHA-224' | 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-3-224' | 'SHA-3-256' | 'SHA-3-384' | 'SHA-3-512';
export const HASH_ALGORITHMS: readonly HashAlgorithm[] = ['MD5', 'SHA-1', 'SHA-224', 'SHA-256', 'SHA-384', 'SHA-512', 'SHA-3-224', 'SHA-3-256', 'SHA-3-384', 'SHA-3-512'];
export async function hashBytes(input: Uint8Array, algorithm: HashAlgorithm): Promise<string> {
  if (algorithm === 'MD5') return md5(input); if (algorithm === 'SHA-224') return sha256(input, [0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4], 7);
  if (algorithm.startsWith('SHA-3-')) { const size = Number(algorithm.slice(6)); const rate = (1600 - size * 2) / 8; return sha3(input, size / 8, rate); }
  const subtleName = algorithm;
  if (globalThis.crypto?.subtle) { const buffer = await globalThis.crypto.subtle.digest(subtleName, input as unknown as BufferSource); return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
  if (algorithm === 'SHA-1') return sha1(input); if (algorithm === 'SHA-256') return sha256(input); throw new CalcError('NOT_SUPPORTED', `${algorithm} needs Web Crypto in this browser.`);
}
function sha1(input: Uint8Array): string { const bytes = Array.from(input); const bitLength = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0); for (let index = 7; index >= 0; index -= 1) bytes.push(Math.floor(bitLength / 2 ** (index * 8)) & 255); let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]; for (let offset = 0; offset < bytes.length; offset += 64) { const w = new Array<number>(80).fill(0); for (let index = 0; index < 16; index += 1) w[index] = (bytes[offset + index * 4]! << 24 | bytes[offset + index * 4 + 1]! << 16 | bytes[offset + index * 4 + 2]! << 8 | bytes[offset + index * 4 + 3]!) >>> 0; for (let index = 16; index < 80; index += 1) w[index] = rotateLeft32(w[index - 3]! ^ w[index - 8]! ^ w[index - 14]! ^ w[index - 16]!, 1) >>> 0; let [a, b, c, d, e] = [h0, h1, h2, h3, h4]; for (let index = 0; index < 80; index += 1) { let f = 0; let k = 0; if (index < 20) { f = (b & c) | (~b & d); k = 0x5a827999; } else if (index < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; } else if (index < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; } else { f = b ^ c ^ d; k = 0xca62c1d6; } const temp = (rotateLeft32(a, 5) + f + e + k + w[index]!) >>> 0; e = d; d = c; c = rotateLeft32(b, 30) >>> 0; b = a; a = temp; } h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0; } return [h0, h1, h2, h3, h4].map((word) => word.toString(16).padStart(8, '0')).join(''); }
export async function hashText(input: string, algorithm: HashAlgorithm): Promise<string> { return hashBytes(utf8Bytes(input), algorithm); }

/* -------------------------------------------------------------------------- */
/* Endianness, colour, safe expressions, generators and regex                 */
/* -------------------------------------------------------------------------- */

export function hexBytes(input: string): number[] { const clean = input.replace(/[\s,:-]/g, ''); if (!clean || clean.length % 2 || !/^[\da-f]+$/i.test(clean)) throw inputError('Enter valid hexadecimal bytes.'); return clean.match(/../g)!.map((pair) => parseInt(pair, 16)); }
export function bytesToHex(bytes: ArrayLike<number>, separator = ' '): string { return Array.from({ length: bytes.length }, (_, index) => bytes[index]!).map((byte) => { if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw inputError('Byte values must be from 0 to 255.'); return byte.toString(16).padStart(2, '0').toUpperCase(); }).join(separator); }
export function byteSwap(input: string): string { return bytesToHex(hexBytes(input).reverse()); }
export function wordSwap(input: string, wordBytes: number): string { const bytes = hexBytes(input); if (bytes.length % wordBytes) throw inputError('The byte count must be divisible by the word size.'); const output: number[] = []; for (let index = 0; index < bytes.length; index += wordBytes) output.push(...bytes.slice(index, index + wordBytes).reverse()); return bytesToHex(output); }
export function groupHexBytes(input: string, group = 1): string {
  const bytes = hexBytes(input); if (!Number.isInteger(group) || group < 1) throw inputError('The group size must be positive.');
  const groups: string[] = []; for (let index = 0; index < bytes.length; index += group) groups.push(bytesToHex(bytes.slice(index, index + group)));
  return groups.join(' | ');
}
export function hexColorToRgba(input: string): { r: number; g: number; b: number; a: number } { const clean = input.trim().replace(/^#/, ''); const expanded = clean.length === 3 || clean.length === 4 ? clean.split('').map((value) => value + value).join('') : clean; if (!/^[\da-f]{6}(?:[\da-f]{2})?$/i.test(expanded)) throw inputError('Use #RGB, #RGBA, #RRGGBB or #RRGGBBAA.'); return { r: parseInt(expanded.slice(0, 2), 16), g: parseInt(expanded.slice(2, 4), 16), b: parseInt(expanded.slice(4, 6), 16), a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) : 255 }; }
export function rgbaToHex(r: number, g: number, b: number, a = 255): string { const values = [r, g, b, a]; if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) throw inputError('RGB and alpha channels must be integers from 0 to 255.'); return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`; }

interface ExpressionToken { kind: 'number' | 'operator' | 'open' | 'close'; text: string; }
function expressionTokens(source: string): ExpressionToken[] { const tokens: ExpressionToken[] = []; let index = 0; while (index < source.length) { const character = source[index]!; if (/\s/.test(character)) { index += 1; continue; } if (source.slice(index, index + 2) === '<<' || source.slice(index, index + 2) === '>>') { tokens.push({ kind: 'operator', text: source.slice(index, index + 2) }); index += 2; continue; } if ('+-*/%&|^~'.includes(character)) { tokens.push({ kind: 'operator', text: character }); index += 1; continue; } if (character === '(') { tokens.push({ kind: 'open', text: character }); index += 1; continue; } if (character === ')') { tokens.push({ kind: 'close', text: character }); index += 1; continue; } const match = source.slice(index).match(/^(?:0[bB][01_]+|0[oO][0-7_]+|0[xX][\da-fA-F_]+|\d[\da-zA-Z_]*)/); if (!match) throw inputError(`Unexpected character “${character}” in the expression.`); tokens.push({ kind: 'number', text: match[0] }); index += match[0].length; } return tokens; }
export function evaluateProgrammerExpression(source: string): bigint { const tokens = expressionTokens(source); let index = 0; const peek = () => tokens[index]; const accept = (text: string) => { if (peek()?.text === text) { index += 1; return true; } return false; }; const primary = (): bigint => { if (accept('(')) { const value = bitOr(); if (!accept(')')) throw inputError('Missing closing parenthesis.'); return value; } const token = tokens[index]; if (!token || token.kind !== 'number') throw inputError('Expected an integer.'); index += 1; return parseProgrammerBigInt(token.text, token.text.toLowerCase().startsWith('0b') ? 2 : token.text.toLowerCase().startsWith('0o') ? 8 : token.text.toLowerCase().startsWith('0x') ? 16 : 10); }; const unary = (): bigint => { const token = peek()?.text; if (token === '+' || token === '-' || token === '~') { index += 1; const value = unary(); return token === '+' ? value : token === '-' ? -value : ~value; } return primary(); }; const multiply = (): bigint => { let value = unary(); while (['*', '/', '%'].includes(peek()?.text ?? '')) { const op = tokens[index++]!.text; const right = unary(); if ((op === '/' || op === '%') && right === 0n) throw new CalcError('DIV_ZERO', 'Division by zero.'); value = op === '*' ? value * right : op === '/' ? value / right : value % right; } return value; }; const add = (): bigint => { let value = multiply(); while (peek()?.text === '+' || peek()?.text === '-') { const op = tokens[index++]!.text; const right = multiply(); value = op === '+' ? value + right : value - right; } return value; }; const shifts = (): bigint => { let value = add(); while (peek()?.text === '<<' || peek()?.text === '>>') { const op = tokens[index++]!.text; const right = add(); if (right < 0n) throw new CalcError('DOMAIN', 'Shift amount must not be negative.'); value = op === '<<' ? value << right : value >> right; } return value; }; const and = (): bigint => { let value = shifts(); while (accept('&')) value &= shifts(); return value; }; const xor = (): bigint => { let value = and(); while (accept('^')) value ^= and(); return value; }; const bitOr = (): bigint => { let value = xor(); while (accept('|')) value |= xor(); return value; }; const result = bitOr(); if (index !== tokens.length) throw inputError(`Unexpected token “${tokens[index]!.text}”.`); return result; }

export type CodeLanguage = 'c' | 'cpp' | 'csharp' | 'java' | 'javascript' | 'typescript' | 'python' | 'rust';
export function codeLiteral(value: bigint, language: CodeLanguage, base: 'decimal' | 'hex' | 'binary' | 'octal'): string { const digits = base === 'hex' ? formatProgrammerBigInt(value, 16, true) : base === 'binary' ? formatProgrammerBigInt(value, 2, true) : base === 'octal' ? formatProgrammerBigInt(value, 8, true) : value.toString(10); if (language === 'javascript' || language === 'typescript') return `${digits}${(value > 9007199254740991n || value < -9007199254740991n) ? 'n' : ''}`; if (language === 'python') return digits; if (language === 'rust') return `${digits}${base === 'hex' ? 'u128' : ''}`; if (language === 'csharp') return `${digits}UL`; if (language === 'java') return `${digits}L`; return `${digits}ULL`; }

export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 1 || length > 1_000_000) throw inputError('Byte length must be from 1 to 1,000,000.');
  const bytes = new Uint8Array(length); const secure = globalThis.crypto?.getRandomValues;
  if (secure) {
    // Browsers cap one getRandomValues call at 65,536 bytes.
    for (let offset = 0; offset < bytes.length; offset += 65_536) secure.call(globalThis.crypto, bytes.subarray(offset, Math.min(offset + 65_536, bytes.length)));
  } else {
    for (let index = 0; index < length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}
export function randomInteger(min: bigint, max: bigint): bigint {
  if (min > max) throw inputError('Minimum must not exceed maximum.');
  const span = max - min + 1n; if (span === 1n) return min;
  const bits = (span - 1n).toString(2).length; const bytes = Math.ceil(bits / 8); const excessBits = bytes * 8 - bits; const mask = (1n << BigInt(bits)) - 1n;
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let value = 0n; for (const byte of randomBytes(bytes)) value = (value << 8n) | BigInt(byte);
    if (excessBits) value &= mask;
    if (value < span) return min + value;
  }
  throw new CalcError('INTERNAL', 'Could not generate a random integer.');
}
export function randomUuid(): string { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); const bytes = randomBytes(16); bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80; const hex = bytesToHex(bytes, '').toLowerCase(); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }
export function randomMac(): string { const bytes = randomBytes(6); bytes[0] = (bytes[0]! & 0xfc) | 0x02; return bytesToHex(bytes, ':'); }
export function randomIPv4(): string { return Array.from(randomBytes(4)).join('.'); }

export interface RegexResult { matched: boolean; matches: { text: string; index: number; groups: string[]; namedGroups: Record<string, string> }[]; }

function assertRegexSafe(pattern: string): void {
  if (pattern.length > 2000) throw inputError('Regular expressions are limited to 2,000 characters.');
  // Nested quantifiers and quantified alternations are the common source of
  // catastrophic backtracking in JavaScript's backtracking engine. Refuse the
  // risky shape instead of letting a local tester freeze the page.
  if (/\([^()]*[+*?{][^()]*\)[+*?{]/.test(pattern)
    || /\(?:[^()]*\|[^()]*\)[+*?{]/.test(pattern)
    || /(?:\{\d{4,}(?:,\d*)?\}|\{\d+,\d{4,}\})/.test(pattern)) {
    throw inputError('This pattern contains a risky repetition and was blocked to prevent a runaway regex.');
  }
  if (/\\[1-9]/.test(pattern) || pattern.includes('(?<=') || pattern.includes('(?<!')) {
    throw inputError('Backreferences and variable lookbehind are not allowed in the local regex tester.');
  }
}

export function testRegex(pattern: string, flags: string, text: string): RegexResult {
  if (text.length > 200_000) throw inputError('Regex test text is limited to 200,000 characters to keep the app responsive.');
  assertRegexSafe(pattern);
  let expression: RegExp;
  try { expression = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`); }
  catch (error) { throw inputError(error instanceof Error ? error.message : 'Invalid regular expression.'); }
  const matches: RegexResult['matches'] = [];
  for (const match of text.matchAll(expression)) matches.push({ text: match[0], index: match.index ?? 0, groups: match.slice(1).map((group) => group ?? ''), namedGroups: { ...(match.groups ?? {}) } });
  return { matched: matches.length > 0, matches };
}

export const PROGRAMMER_REFERENCES = {
  ascii: Array.from({ length: 128 }, (_, code) => ({ code, character: code < 32 || code === 127 ? ` control ${code}` : String.fromCharCode(code), hex: code.toString(16).padStart(2, '0').toUpperCase() })),
  powersOfTwo: Array.from({ length: 17 }, (_, exponent) => ({ exponent, value: 1n << BigInt(exponent) })),
  commonMasks: [8, 16, 32, 64, 128].flatMap((width) => [{ name: `${width}-bit low mask`, value: (1n << BigInt(width)) - 1n }, { name: `${width}-bit sign bit`, value: 1n << BigInt(width - 1) }]),
  ports: [{ port: 20, name: 'FTP data' }, { port: 22, name: 'SSH' }, { port: 25, name: 'SMTP' }, { port: 53, name: 'DNS' }, { port: 67, name: 'DHCP server' }, { port: 68, name: 'DHCP client' }, { port: 80, name: 'HTTP' }, { port: 110, name: 'POP3' }, { port: 123, name: 'NTP' }, { port: 143, name: 'IMAP' }, { port: 443, name: 'HTTPS' }, { port: 3389, name: 'RDP' }],
} as const;
