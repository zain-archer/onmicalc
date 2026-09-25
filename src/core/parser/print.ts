import type { ExpressionNode } from './ast';

const PRECEDENCE: Record<string, number> = {
  or: 1,
  xor: 1,
  and: 2,
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4,
  mod: 4,
  '^': 6,
};

function wrap(node: ExpressionNode, minPrec: number): string {
  const text = printExpression(node);
  const prec = PRECEDENCE[node.type === 'binary' ? node.operator : ''] ?? 7;
  return prec < minPrec ? `(${text})` : text;
}

/** Render an AST back to a canonical, re-parseable string (used by tests and graphing). */
export function printExpression(node: ExpressionNode): string {
  switch (node.type) {
    case 'number':
      return String(node.value);
    case 'identifier':
      return node.name;
    case 'unary':
      return `${node.operator}${wrap(node.operand, 5)}`;
    case 'postfix':
      return `${wrap(node.operand, 6)}${node.operator}`;
    case 'binary': {
      const prec = PRECEDENCE[node.operator] ?? 3;
      const left = wrap(node.left, prec);
      // Right side of ^ is right-associative, right side of - and / needs care.
      const rightMin = node.operator === '^' ? prec : prec + 1;
      return `${left} ${node.operator} ${wrap(node.right, rightMin)}`;
    }
    case 'call':
      return `${node.name}(${node.args.map(printExpression).join(', ')})`;
  }
}
