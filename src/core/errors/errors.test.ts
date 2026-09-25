import { describe, expect, it } from 'vitest';
import { CalcError, errorCode, errorMessage, isCalcError } from './index';

describe('CalcError', () => {
  it('keeps code, message and position', () => {
    const err = new CalcError('DIV_ZERO', 'Division by zero', { position: 3, length: 1 });
    expect(err.code).toBe('DIV_ZERO');
    expect(err.message).toBe('Division by zero');
    expect(err.position).toBe(3);
    expect(isCalcError(err)).toBe(true);
    expect(errorCode(err)).toBe('DIV_ZERO');
    expect(errorMessage(err)).toBe('Division by zero');
  });

  it('classifies foreign errors as INTERNAL', () => {
    expect(errorCode(new TypeError('boom'))).toBe('INTERNAL');
    expect(errorMessage(new TypeError('boom'))).toBe('boom');
    expect(errorMessage('plain string')).toBe('plain string');
  });
});
