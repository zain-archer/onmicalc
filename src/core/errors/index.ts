/**
 * Domain error types shared by every layer of OmniCalc.
 * The engine never throws raw strings: callers can always match on `code`.
 */
export type CalcErrorCode =
  | 'SYNTAX'
  | 'UNKNOWN_IDENTIFIER'
  | 'BAD_ARITY'
  | 'DIV_ZERO'
  | 'DOMAIN'
  | 'OVERFLOW'
  | 'NOT_SUPPORTED'
  | 'DIMENSION'
  | 'SINGULAR'
  | 'CONVERGENCE'
  | 'INPUT'
  | 'INTERNAL';

export interface CalcErrorInit {
  /** Character index in the source expression, when known. */
  position?: number;
  /** 1-based length of the offending token, when known. */
  length?: number;
  /** Technical detail. Shown only in the details section of the UI. */
  details?: string;
}

export class CalcError extends Error {
  readonly code: CalcErrorCode;
  readonly position?: number;
  readonly length?: number;
  readonly details?: string;

  constructor(code: CalcErrorCode, message: string, init: CalcErrorInit = {}) {
    super(message);
    this.name = 'CalcError';
    this.code = code;
    this.position = init.position;
    this.length = init.length;
    this.details = init.details;
  }
}

/** Short, user-facing message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof CalcError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function errorCode(err: unknown): CalcErrorCode {
  return err instanceof CalcError ? err.code : 'INTERNAL';
}

export function isCalcError(err: unknown): err is CalcError {
  return err instanceof CalcError;
}
