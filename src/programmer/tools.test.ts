import { describe, expect, it } from 'vitest';
import {
  adler32,
  applyProgrammerBitwise,
  base64Decode,
  base64Encode,
  baseArithmetic,
  compressIPv6,
  crc16,
  crc32,
  crc8,
  expandIPv6,
  hashText,
  groupHexBytes,
  integerTypeInfo,
  ipv6NetworkPrefix,
  macInfo,
  parseProgrammerBigInt,
  programmerRepresentations,
  randomInteger,
  subnetForHosts,
  testRegex,
  textToHex,
  timestampToDate,
  dateToTimestamp,
  evaluateProgrammerExpression,
  ipv4Cidr,
  reverseBits,
} from './tools';

describe('programmer toolbox', () => {
  it('converts arbitrary bases without going through Number', () => {
    const value = parseProgrammerBigInt('zz', 36);
    expect(value).toBe(1295n);
    expect(programmerRepresentations(value).hexadecimal).toBe('50F');
    expect(baseArithmetic('ff', '1', 16, '+')).toBe(256n);
    expect(parseProgrammerBigInt('1_000', 10)).toBe(1000n);
    expect(() => parseProgrammerBigInt('1__0', 10)).toThrow(/valid base-10/);
  });

  it('does fixed-width bitwise operations and rotations', () => {
    expect(applyProgrammerBitwise('nand', 0b1100n, 0b1010n, 8).unsigned).toBe(0b11110111n);
    expect(applyProgrammerBitwise('nor', 0b1100n, 0b1010n, 8).unsigned).toBe(0b11110001n);
    expect(applyProgrammerBitwise('xnor', 0b1100n, 0b1010n, 8).unsigned).toBe(0b11111001n);
    expect(applyProgrammerBitwise('ashr', 0b10000000n, 2n, 8).signed).toBe(-32n);
    expect(applyProgrammerBitwise('rol', 0x81n, 1n, 8).unsigned).toBe(0x03n);
    expect(applyProgrammerBitwise('shl', 1n, 8n, 8).unsigned).toBe(0n);
  });

  it('reports integer limits and reverses bits', () => {
    expect(integerTypeInfo(255n, 8, 'unsigned').maximum).toBe(255n);
    expect(integerTypeInfo(128n, 8, 'signed').overflow).toBe(true);
    expect(reverseBits(0b00000001n, 8)).toBe(0b10000000n);
  });

  it('handles Unicode and Base64 locally', () => {
    expect(base64Encode('Hello, 👋')).toBe('SGVsbG8sIPCfkYs=');
    expect(base64Decode('SGVsbG8sIPCfkYs=')).toBe('Hello, 👋');
    expect(textToHex('é')).toBe('C3 A9');
  });

  it('calculates IPv4 CIDR and formats IPv6', () => {
    const info = ipv4Cidr('192.168.1.20/24');
    expect(info.network).toBe('192.168.1.0');
    expect(info.broadcast).toBe('192.168.1.255');
    expect(info.usableHosts).toBe(254n);
    expect(compressIPv6('2001:0db8:0000:0000:0000:ff00:0042:8329')).toBe('2001:db8::ff00:42:8329');
    expect(expandIPv6('2001:db8::1')).toBe('2001:0db8:0000:0000:0000:0000:0000:0001');
    expect(ipv6NetworkPrefix('2001:db8::1234/64')).toBe('2001:db8::/64');
    expect(() => expandIPv6('1:2:3:4:5:6:7:8::')).toThrow(/Invalid IPv6/);
    expect(() => subnetForHosts(4_294_967_295n)).toThrow(/cannot provide/);
    expect(randomInteger(7n, 7n)).toBe(7n);
    expect(randomInteger(0n, 255n)).toBeGreaterThanOrEqual(0n);
    expect(randomInteger(0n, 255n)).toBeLessThanOrEqual(255n);
  });

  it('normalizes MAC addresses and checks flags', () => {
    const mac = macInfo('02-00-00-00-00-01');
    expect(mac.colon).toBe('02:00:00:00:00:01');
    expect(mac.unicast).toBe(true);
    expect(mac.multicast).toBe(false);
    expect(mac.locallyAdministered).toBe(true);
    expect(mac.globallyAdministered).toBe(false);
    expect(macInfo('01:00:5e:00:00:01').multicast).toBe(true);
  });

  it('keeps timestamp units exact around microseconds and nanoseconds', () => {
    expect(timestampToDate('1000000', 'us').toISOString()).toBe('1970-01-01T00:00:01.000Z');
    expect(dateToTimestamp('1970-01-01T00:00:00.001Z', 'ns')).toBe('1000000');
  });

  it('supports checksums, hashes and guarded regular expressions', async () => {
    expect(crc8('123456789')).toBe(0xf4);
    expect(crc16('123456789')).toBe(0xbb3d);
    expect(crc32('123456789')).toBe(0xcbf43926);
    expect(adler32('Wikipedia')).toBe(0x11e60398);
    expect(await hashText('hello', 'MD5')).toBe('5d41402abc4b2a76b9719d911017c592');
    expect(await hashText('hello', 'SHA-224')).toBe('ea09ae9cc6768c50fcee903ed054556e5bfc8347907f12598aa24193');
    expect(await hashText('hello', 'SHA-256')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    expect(await hashText('hello', 'SHA-384')).toBe('59e1748777448c69de6b800d7a33bbfb9ff1b463e44354c3553bcdb9c666fa90125a3c79f90397bdf5f6a13de828684f');
    expect(await hashText('hello', 'SHA-512')).toBe('9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043');
    expect(await hashText('hello', 'SHA-3-224')).toBe('b87f88c72702fff1748e58b87e9141a42c0dbedc29a78cb0d4a5cd81');
    expect(await hashText('hello', 'SHA-3-256')).toBe('3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392');
    expect(await hashText('hello', 'SHA-3-384')).toBe('720aea11019ef06440fbf05d87aa24680a2153df3907b23631e7177ce620fa1330ff07c0fddee54699a4c3ee0ee9d887');
    expect(await hashText('hello', 'SHA-3-512')).toBe('75d527c368f2efe848ecf6b073a36767800805e9eef2b1857d5f984f036eb6df891d75f72d9b154518c1cd58835286d1da9a38deba3de98b5a53e5ed78a84976');
    expect(testRegex('(?<word>\\w+)', 'gi', 'hello world').matches[0]?.namedGroups.word).toBe('hello');
    expect(groupHexBytes('12345678', 2)).toBe('12 34 | 56 78');
    expect(() => testRegex('(a+)+$', '', 'aaaaaaaaaaaaaaaa!')).toThrow(/risky repetition/);
  });

  it('evaluates safe programmer expressions', () => {
    expect(evaluateProgrammerExpression('(0xff & 0b1111) << 4 | 3')).toBe(243n);
    expect(() => evaluateProgrammerExpression('1 / 0')).toThrow(/Division by zero/);
  });
});
