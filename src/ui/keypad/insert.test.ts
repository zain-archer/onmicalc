import { describe, expect, it } from 'vitest';
import { backspace, insertSnippet } from './insert';
import { BASIC_KEYS, SCIENTIFIC_KEYS, trigKeys } from './keys';

describe('insertSnippet', () => {
  it('inserts at the caret and returns the new caret position', () => {
    expect(insertSnippet('2+3', '4', 0)).toEqual({ text: '42+3', caret: 1 });
    expect(insertSnippet('2+3', '4', 3)).toEqual({ text: '2+34', caret: 4 });
  });

  it('places the caret inside brackets', () => {
    expect(insertSnippet('', 'sqrt(', 0, 0, -1)).toEqual({ text: 'sqrt(', caret: 4 });
    expect(insertSnippet('1+', 'sqrt(', 2, 2, -1).text).toBe('1+sqrt(');
  });

  it('replaces the selection', () => {
    expect(insertSnippet('12345', '+', 1, 4)).toEqual({ text: '1+5', caret: 2 });
  });

  it('clamps out-of-range carets instead of corrupting text', () => {
    expect(insertSnippet('12', '3', 99)).toEqual({ text: '123', caret: 3 });
    expect(insertSnippet('12', '3', -5)).toEqual({ text: '312', caret: 1 });
  });
});

describe('backspace', () => {
  it('removes the character before the caret', () => {
    expect(backspace('2+3', 3)).toEqual({ text: '2+', caret: 2 });
    expect(backspace('2+3', 0)).toEqual({ text: '2+3', caret: 0 });
  });

  it('removes a selection', () => {
    expect(backspace('12345', 1, 4)).toEqual({ text: '15', caret: 1 });
  });
});

describe('keypad definitions', () => {
  it('has no duplicate labels in a layout', () => {
    const labels = BASIC_KEYS.map((k) => k.label);
    expect(new Set(labels).size).toBe(labels.length);
    const sci = SCIENTIFIC_KEYS.map((k) => k.label);
    expect(new Set(sci).size).toBe(sci.length);
  });

  it('switches trig keys between plain, inverse and hyperbolic', () => {
    expect(trigKeys({ inverse: false, hyperbolic: false }).map((k) => k.insert)).toEqual(['sin(', 'cos(', 'tan(']);
    expect(trigKeys({ inverse: true, hyperbolic: false }).map((k) => k.insert)).toEqual(['asin(', 'acos(', 'atan(']);
    expect(trigKeys({ inverse: false, hyperbolic: true }).map((k) => k.insert)).toEqual(['sinh(', 'cosh(', 'tanh(']);
    expect(trigKeys({ inverse: true, hyperbolic: true }).map((k) => k.insert)).toEqual(['asinh(', 'acosh(', 'atanh(']);
  });
});
