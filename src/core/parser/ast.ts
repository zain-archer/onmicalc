/** Expression AST. Nodes are plain data so they can be inspected, cloned and stepped through. */
export type BinaryOperator = '+' | '-' | '*' | '/' | '^' | 'mod' | 'and' | 'or' | 'xor';
export type PostfixOperator = '!' | '%';

export interface NumberNode {
  type: 'number';
  value: number;
  start: number;
  end: number;
}

export interface IdentifierNode {
  type: 'identifier';
  name: string;
  start: number;
  end: number;
}

export interface UnaryNode {
  type: 'unary';
  operator: '+' | '-';
  operand: ExpressionNode;
  start: number;
  end: number;
}

export interface BinaryNode {
  type: 'binary';
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
  start: number;
  end: number;
}

export interface PostfixNode {
  type: 'postfix';
  operator: PostfixOperator;
  operand: ExpressionNode;
  start: number;
  end: number;
}

export interface CallNode {
  type: 'call';
  name: string;
  args: ExpressionNode[];
  start: number;
  end: number;
}

export type ExpressionNode =
  | NumberNode
  | IdentifierNode
  | UnaryNode
  | BinaryNode
  | PostfixNode
  | CallNode;
