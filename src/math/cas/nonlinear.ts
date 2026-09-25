import { parseNode, type Node } from './ast';
import { createContext, getDefaultRegistry } from '@/core/engine';
import { evaluateNode } from '@/core/evaluator/evaluate';

/**
 * Numerical solver for small systems of (possibly nonlinear) equations, e.g.
 *   x^2 + y^2 = 25, x - y = 1
 * Uses damped Newton iterations with a numerical Jacobian and multiple starting
 * points, then verifies every root by substituting it back. Results are always
 * labelled numerical — the symbolic solver in `algebra` handles the linear case.
 */
export interface NonlinearSystemResult {
  variables: string[];
  solutions: { values: number[]; residuals: number[]; maxResidual: number; iterations: number }[];
  /** How the solve was performed — shown to the user, never hidden. */
  method: string;
  notes: string[];
  solved: boolean;
}

const CONSTANT_NAMES = new Set(['pi', 'e', 'tau', 'phi', 'inf', 'nan', 'ans']);

function variableNames(equations: string[]): string[] {
  const known = new Set(getDefaultRegistry().primaryNames().map((name) => name.toLowerCase()));
  const found = new Set<string>();
  for (const equation of equations) {
    // The parser does not accept "=", so each side is inspected separately.
    const sides = equation.split('=');
    if (sides.length !== 2) continue;
    for (const side of sides) {
      let node: Node;
      try {
        node = parseNode(side);
      } catch {
        continue;
      }
      collect(node);
    }
  }
  return [...found].sort();

  function collect(node: Node): void {
    if (node.type === 'identifier') {
      const name = node.name.toLowerCase();
      if (!known.has(name) && !CONSTANT_NAMES.has(name)) found.add(node.name);
    }
    switch (node.type) {
      case 'unary':
      case 'postfix':
        collect(node.operand);
        break;
      case 'binary':
        collect(node.left);
        collect(node.right);
        break;
      case 'call':
        node.args.forEach(collect);
        break;
      default:
        break;
    }
  }
}

/** Builds F(variables) for one equation using the engine (multi-variable). */
function compiledWith(equation: string, variables: string[]): ((values: number[]) => number) | null {
  try {
    const [left, right] = equation.includes('=') ? equation.split('=') : [equation, '0'];
    const node = parseNode(`(${left}) - (${right})`);
    const names = variables;
    return (values: number[]) =>
      evaluateWith(node, Object.fromEntries(names.map((name, index) => [name, values[index] ?? 0])));
  } catch {
    return null;
  }
}

function evaluateWith(node: Node, variables: Record<string, number>): number {
  try {
    const value = evaluateNode(node, createContext({ variables }));
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function norm(vector: number[]): number {
  return Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
}

/** Solves a small dense linear system by Gaussian elimination with pivoting. */
function solveSystem(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) {
      if (Math.abs(a[row]![column]!) > Math.abs(a[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(a[pivot]![column]!) < 1e-14) return null;
    [a[column], a[pivot]] = [a[pivot]!, a[column]!];
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = a[row]![column]! / a[column]![column]!;
      if (factor === 0) continue;
      for (let k = column; k <= n; k += 1) a[row]![k] = a[row]![k]! - factor * a[column]![k]!;
    }
  }
  return Array.from({ length: n }, (_, i) => a[i]![n]! / a[i]![i]!);
}

export function solveNonlinearSystem(
  equations: string[],
  options: { guesses?: number[][]; tolerance?: number; maxIterations?: number; starts?: number } = {},
): NonlinearSystemResult {
  const notes: string[] = [];
  const cleaned = equations.map((equation) => equation.trim()).filter((equation) => equation.length > 0);
  if (cleaned.length === 0) {
    return { variables: [], solutions: [], method: 'none', notes: ['no equations were given'], solved: false };
  }
  const variables = variableNames(cleaned);
  if (variables.length === 0) {
    return { variables, solutions: [], method: 'none', notes: ['no variables found in the equations'], solved: false };
  }
  if (variables.length > 3) {
    return {
      variables,
      solutions: [],
      method: 'none',
      notes: [`found ${variables.length} variables (${variables.join(', ')}); the solver handles up to three`],
      solved: false,
    };
  }
  if (cleaned.length !== variables.length) {
    notes.push(
      cleaned.length > variables.length
        ? `${cleaned.length} equations for ${variables.length} unknowns — solving the first ${variables.length}`
        : `${cleaned.length} equations for ${variables.length} unknowns — the system is under-determined and numeric roots are not unique`,
    );
  }

  const functions = cleaned.slice(0, variables.length).map((equation) => compiledWith(equation, variables));
  if (functions.some((fn) => fn === null)) {
    return { variables, solutions: [], method: 'none', notes: [...notes, 'an equation could not be parsed'], solved: false };
  }
  const residuals = functions as ((values: number[]) => number)[];

  const tolerance = options.tolerance ?? 1e-10;
  const maxIterations = options.maxIterations ?? 60;
  const evaluate = (values: number[]): number[] => residuals.map((fn) => fn(values));

  /** Rows are equations, columns are variables — the orientation the solver expects. */
  const jacobian = (values: number[]): number[][] => {
    const h = 1e-6;
    const columns: number[][] = variables.map((_, column) => {
      const shifted = [...values];
      const ahead = [...values];
      shifted[column] = (shifted[column] ?? 0) + h;
      ahead[column] = (ahead[column] ?? 0) - h;
      const forward = evaluate(shifted);
      const backward = evaluate(ahead);
      return forward.map((value, row) => (value - (backward[row] ?? 0)) / (2 * h));
    });
    return residuals.map((_, row) => variables.map((_, column) => columns[column]![row]!));
  };

  const starts: number[][] = [...(options.guesses ?? [])];
  const gridValues = [0, 1, -1, 2, -2, 3, -3];
  const limit = options.starts ?? 30;
  const buildStarts = (prefix: number[]): void => {
    if (prefix.length === variables.length) {
      if (starts.length < limit) starts.push([...prefix]);
      return;
    }
    for (const value of gridValues) {
      if (starts.length >= limit) return;
      buildStarts([...prefix, value]);
    }
  };
  buildStarts([]);
  if (starts.length === 0) starts.push(new Array<number>(variables.length).fill(0));

  const solutions: NonlinearSystemResult['solutions'] = [];
  for (const start of starts) {
    let values = [...start];
    let currentNorm = norm(evaluate(values));
    let iterations = 0;
    for (let step = 0; step < maxIterations; step += 1) {
      iterations = step + 1;
      const current = evaluate(values);
      if (!current.every((value) => Number.isFinite(value))) break;
      const jac = jacobian(values);
      const delta = solveSystem(jac, current.map((value) => -value));
      if (!delta) {
        // Singular Jacobian: nudge deterministically and retry.
        values = values.map((value, index) => value + 1e-3 * ((index % 2 === 0 ? 1 : -1) * (step + 1)));
        continue;
      }
      let scale = 1;
      let accepted = false;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = values.map((value, index) => value + scale * (delta[index] ?? 0));
        const candidateNorm = norm(evaluate(candidate));
        if (candidateNorm < currentNorm || candidateNorm < tolerance) {
          values = candidate;
          currentNorm = candidateNorm;
          accepted = true;
          break;
        }
        scale /= 2;
      }
      if (!accepted) break;
      if (currentNorm < tolerance) break;
    }

    const finalResiduals = evaluate(values);
    const maxResidual = Math.max(...finalResiduals.map((value) => Math.abs(value)));
    if (!Number.isFinite(maxResidual) || maxResidual > 1e-6) continue;
    const rounded = values.map((value) => (Math.abs(value - Math.round(value)) < 1e-7 ? Math.round(value) : value));
    const duplicate = solutions.some((solution) =>
      solution.values.every((value, index) => Math.abs(value - rounded[index]!) < 1e-6),
    );
    if (duplicate) continue;
    solutions.push({
      values: rounded,
      residuals: finalResiduals,
      maxResidual,
      iterations,
    });
  }

  solutions.sort((a, b) => a.maxResidual - b.maxResidual);
  notes.push('every solution was substituted back into the original equations');
  if (solutions.length === 0) {
    notes.push('no solution was found from the starting points tried — it may not exist, or it may lie outside them');
  } else if (variables.length > 1) {
    notes.push('there can be other solutions: the solver reports the roots it actually verified');
  }
  notes.push('these are numerical roots; the linear solver in Equations gives exact results for linear systems');

  return {
    variables,
    solutions: solutions.slice(0, 12),
    method: 'damped Newton–Raphson with a numerical Jacobian, multi-start',
    notes,
    solved: solutions.length > 0,
  };
}

export { variableNames };
