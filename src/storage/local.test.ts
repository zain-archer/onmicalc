import { describe, expect, it, vi } from 'vitest';
import { readJSON, readRaw, removeRaw, writeJSON, writeRaw } from './local';

describe('local storage wrapper', () => {
  it('round-trips JSON values', () => {
    writeJSON('k', { a: 1, b: [true, null] });
    expect(readJSON('k', null)).toEqual({ a: 1, b: [true, null] });
  });

  it('returns the fallback for corrupt payloads and clears them', () => {
    writeRaw('bad', '{not json');
    expect(readJSON('bad', { ok: true })).toEqual({ ok: true });
    expect(readRaw('bad')).toBeNull();
  });

  it('survives quota errors by falling back to memory', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => writeRaw('q', 'value')).not.toThrow();
    spy.mockRestore();
    expect(readRaw('q')).toBe('value');
  });

  it('removes values', () => {
    writeRaw('r', 'x');
    removeRaw('r');
    expect(readRaw('r')).toBeNull();
  });
});
