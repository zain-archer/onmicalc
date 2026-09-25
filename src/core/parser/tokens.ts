export type TokenType =
  | 'number'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'eof';

export interface Token {
  type: TokenType;
  /** Normalised text: operators are ASCII, identifiers are lowercase. */
  value: string;
  /** Present for number tokens. */
  num?: number;
  /** 0-based index of the first character in the source string. */
  start: number;
  /** 0-based index just past the last character. */
  end: number;
}
