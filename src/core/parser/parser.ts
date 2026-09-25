import { CalcError } from '@/core/errors';
import type {
  BinaryNode,
  BinaryOperator,
  CallNode,
  ExpressionNode,
  PostfixNode,
  UnaryNode,
} from './ast';
import { tokenize } from './tokenizer';
import type { Token } from './tokens';

const BP_ADD = 10;
const BP_MUL = 20;
const BP_UNARY = 30;
const BP_POW = 40;
const BP_POSTFIX = 50;

const BINARY_BP: Readonly<Record<string, number>> = {
  '+': BP_ADD,
  '-': BP_ADD,
  '*': BP_MUL,
  '/': BP_MUL,
  mod: BP_MUL,
  and: BP_MUL,
  or: BP_ADD,
  xor: BP_ADD,
  '^': BP_POW,
};

const POSTFIX_OPS = new Set(['!', '%']);

export interface ParseOptions {
  /** Names that may be called without parentheses (e.g. `sqrt 16`). */
  functions?: ReadonlySet<string>;
}

function startsPrimary(token: Token): boolean {
  return token.type === 'number' || token.type === 'ident' || token.type === 'lparen';
}

/**
 * Recursive-descent / Pratt parser.
 * Never evaluates code: it only builds an AST that the evaluator walks.
 */
class Parser {
  private pos = 0;
  private readonly functions: ReadonlySet<string>;

  constructor(
    private readonly tokens: Token[],
    options: ParseOptions = {},
  ) {
    this.functions = options.functions ?? new Set<string>();
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }

  private next(): Token {
    const token = this.peek();
    this.pos += 1;
    return token;
  }

  private fail(message: string, token = this.peek()): never {
    throw new CalcError('SYNTAX', message, { position: token.start, length: Math.max(1, token.end - token.start) });
  }

  private expectRightParen(openStart: number): Token {
    const token = this.peek();
    if (token.type !== 'rparen') {
      throw new CalcError('SYNTAX', 'Missing closing parenthesis', {
        position: openStart,
        length: 1,
      });
    }
    return this.next();
  }

  parse(): ExpressionNode {
    if (this.peek().type === 'eof') {
      throw new CalcError('SYNTAX', 'Enter an expression to evaluate', { position: 0 });
    }
    const node = this.parseExpression(0);
    const trailing = this.peek();
    if (trailing.type !== 'eof') {
      if (trailing.type === 'rparen') this.fail('Unmatched closing parenthesis', trailing);
      if (trailing.type === 'comma') this.fail('Unexpected comma', trailing);
      this.fail(`Unexpected "${trailing.value}"`, trailing);
    }
    return node;
  }

  private parseExpression(minBp: number): ExpressionNode {
    let left = this.parsePrefix();

    for (;;) {
      const token = this.peek();

      if (token.type === 'op' && POSTFIX_OPS.has(token.value)) {
        if (BP_POSTFIX < minBp) break;
        this.next();
        const node: PostfixNode = {
          type: 'postfix',
          operator: token.value as PostfixNode['operator'],
          operand: left,
          start: left.start,
          end: token.end,
        };
        left = node;
        continue;
      }

      if (token.type === 'op') {
        const bp = BINARY_BP[token.value];
        if (bp === undefined) this.fail(`Unexpected operator "${token.value}"`, token);
        if (bp < minBp) break;
        this.next();
        const rightAssociative = token.value === '^';
        const right = this.parseExpression(rightAssociative ? bp : bp + 1);
        const node: BinaryNode = {
          type: 'binary',
          operator: token.value as BinaryOperator,
          left,
          right,
          start: left.start,
          end: right.end,
        };
        left = node;
        continue;
      }

      // Implicit multiplication: 2(3+4), 3pi, 2sqrt(9), (1+2)(3+4)
      if (startsPrimary(token) && BP_MUL >= minBp) {
        const right = this.parseExpression(BP_MUL + 1);
        const node: BinaryNode = {
          type: 'binary',
          operator: '*',
          left,
          right,
          start: left.start,
          end: right.end,
        };
        left = node;
        continue;
      }

      break;
    }

    return left;
  }

  private parseCall(name: string, start: number): CallNode {
    const open = this.next(); // consume '('
    const args: ExpressionNode[] = [];
    if (this.peek().type !== 'rparen') {
      args.push(this.parseExpression(0));
      while (this.peek().type === 'comma') {
        this.next();
        args.push(this.parseExpression(0));
      }
    }
    const close = this.expectRightParen(open.start);
    return { type: 'call', name, args, start, end: close.end };
  }

  private parsePrefix(): ExpressionNode {
    const token = this.next();

    switch (token.type) {
      case 'number':
        return { type: 'number', value: token.num ?? Number(token.value), start: token.start, end: token.end };

      case 'lparen': {
        const inner = this.parseExpression(0);
        const close = this.expectRightParen(token.start);
        return { ...inner, start: token.start, end: close.end };
      }

      case 'op': {
        if (token.value === '-' || token.value === '+') {
          const operand = this.parseExpression(BP_UNARY);
          const node: UnaryNode = {
            type: 'unary',
            operator: token.value,
            operand,
            start: token.start,
            end: operand.end,
          };
          return node;
        }
        // Word operators double as functions: mod(7,3), and(a,b), ...
        if (BINARY_BP[token.value] !== undefined && this.peek().type === 'lparen') {
          return this.parseCall(token.value, token.start);
        }
        this.fail(`"${token.value}" needs a value on its left`, token);
        break;
      }

      case 'ident': {
        if (this.peek().type === 'lparen') {
          return this.parseCall(token.value, token.start);
        }
        if (this.functions.has(token.value)) {
          const raw = this.peek();
          if (raw.type === 'eof' || raw.type === 'rparen' || raw.type === 'comma') {
            this.fail(`"${token.value}" needs an argument`, token);
          }
          const arg = this.parseExpression(BP_UNARY);
          const node: CallNode = {
            type: 'call',
            name: token.value,
            args: [arg],
            start: token.start,
            end: arg.end,
          };
          return node;
        }
        return { type: 'identifier', name: token.value, start: token.start, end: token.end };
      }

      case 'rparen':
        this.fail('Unmatched closing parenthesis', token);
        break;

      case 'comma':
        this.fail('Unexpected comma', token);
        break;

      case 'eof':
        this.fail('Expression ends unexpectedly', token);
        break;
    }

    this.fail('Unexpected token', token);
  }
}

export function parse(source: string, options: ParseOptions = {}): ExpressionNode {
  return new Parser(tokenize(source), options).parse();
}
