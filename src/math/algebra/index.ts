import { CalcError } from '@/core/errors';
import { evaluateExpression, getDefaultRegistry } from '@/core/engine';
import { realPolynomialRoots } from '@/math/matrices';

/** Everything the equation tools need, shared with the polynomial/matrix solvers. */

export interface ParsedEquation {
  left: string;
  right: string;
  /** Variables found in the equation, sorted, excluding known constants/functions. */
  variables: string[];
}

const RESERVED = new Set(['pi', 'e', 'tau', 'phi', 'sqrt2', 'sqrt3', 'ans', 'm']);

/** Splits on the first top-level '=' (not inside brackets). */
export function parseEquation(input: string): ParsedEquation {
  const text = input.trim();
  if (!text) throw new CalcError('INPUT', 'Enter an equation');
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if ((ch === '=' || text.startsWith('==', i)) && depth === 0) {
      const left = text.slice(0, i).trim();
      const right = text.slice(i + (text.startsWith('==', i) ? 2 : 1)).trim();
      if (!left || !right) throw new CalcError('SYNTAX', 'Both sides of the equation are required');
      return { left, right, variables: findVariables(`${left} ${right}`) };
    }
  }
  throw new CalcError('SYNTAX', 'An equation needs an "=" sign, e.g. 2x + 5 = 15');
}

/** Identifiers that are neither constants nor functions: candidate unknowns. */
export function findVariables(source: string): string[] {
  const found = new Set<string>();
  const matches = source.matchAll(/([A-Za-z_][A-Za-z0-9_]*)/g);
  for (const match of matches) {
    const name = match[1]!.toLowerCase();
    if (RESERVED.has(name)) continue;
    if (isKnownFunctionName(name)) continue;
    found.add(name);
  }
  return [...found].sort();
}

let functionNames: Set<string> | null = null;

/** Function names come from the engine registry, so `sin(x)` never becomes an unknown. */
function isKnownFunctionName(name: string): boolean {
  functionNames ??= new Set(
    getDefaultRegistry()
      .definitions()
      .flatMap((def) => [def.name, ...(def.aliases ?? [])]),
  );
  return functionNames.has(name);
}

/** Numeric evaluation with substituted variables; throws on engine errors. */
export function evaluateWith(source: string, variables: Record<string, number>): number {
  const result = evaluateExpression(source, { variables, angleMode: 'RAD' });
  if (!result.ok) {
    throw new CalcError(result.error.code, result.error.message, { details: result.error.details });
  }
  return result.value;
}

/** f(x) = left(x) − right(x) for the single free variable. */
export function makeDifference(
  equation: ParsedEquation,
  free: string,
  base: Record<string, number> = {},
): (x: number) => number {
  return (x: number) => {
    const scope = { ...base, [free]: x };
    return evaluateWith(equation.left, scope) - evaluateWith(equation.right, scope);
  };
}

/* ------------------------------------------------------------------ */
/* Linear equations: a·x + b = 0                                       */
/* ------------------------------------------------------------------ */

export interface LinearSolution {
  variable: string;
  /** Exact when the coefficients came out as integers/simple decimals. */
  value: number;
  exact: boolean;
  steps: string[];
}

/**
 * Solves a single-variable linear equation by sampling the affine function.
 * Two evaluations determine slope and intercept exactly (affine ⇒ no error).
 */
export function solveLinear(equation: ParsedEquation, variable: string): LinearSolution {
  const f = makeDifference(equation, variable);
  const y0 = f(0);
  const y1 = f(1);
  const slope = y1 - y0;

  if (Math.abs(slope) < 1e-14) {
    if (Math.abs(y0) < 1e-12) {
      throw new CalcError('NOT_SUPPORTED', 'This equation is true for every value of ' + variable, {
        details: 'Both sides are identical, so there is no single solution to report.',
      });
    }
    throw new CalcError('DOMAIN', `This equation has no solution for ${variable}`, {
      details: 'The variable cancels out, leaving a contradiction.',
    });
  }

  const value = -y0 / slope;
  const steps = [
    `Move everything to one side: ${equation.left} − (${equation.right}) = 0`,
    `Evaluate at ${variable} = 0 → ${format(y0)}`,
    `Evaluate at ${variable} = 1 → ${format(y1)}, so the coefficient of ${variable} is ${format(slope)}`,
    `Divide both sides by ${format(slope)}: ${variable} = −(${format(y0)}) ÷ ${format(slope)}`,
    `${variable} = ${format(value)}`,
  ];
  const exact = Number.isInteger(value) || Math.abs(value * 1e6 - Math.round(value * 1e6)) < 1e-9;
  return { variable, value, exact, steps };
}

function format(value: number): string {
  return Number(value.toPrecision(12)).toString();
}

/* ------------------------------------------------------------------ */
/* Polynomial equations                                                */
/* ------------------------------------------------------------------ */

export interface PolynomialSolution {
  variable: string;
  /** Coefficients, highest power first, as recovered from the expression. */
  coefficients: number[];
  roots: number[];
  complexPairs: number;
  steps: string[];
}

/**
 * Recovers polynomial coefficients by fitting samples of f(x).
 * A degree-n polynomial is uniquely determined by n+1 points, so this is exact
 * for polynomial equations and it refuses anything that is not a polynomial.
 */
export function polynomialCoefficients(
  f: (x: number) => number,
  degree: number,
): number[] {
  // Build the Vandermonde system with points x = 0, 1, 2, … (well conditioned
  // for the small degrees we claim to support).
  const n = degree + 1;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const row = [f(x)];
    for (let power = degree; power >= 0; power -= 1) row.push(x ** power);
    matrix.push(row);
  }

  // Gauss–Jordan on the augmented system.
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(matrix[r]![col + 1]!) > Math.abs(matrix[pivot]![col + 1]!)) pivot = r;
    }
    if (Math.abs(matrix[pivot]![col + 1]!) < 1e-12) {
      throw new CalcError('CONVERGENCE', 'Could not determine the polynomial coefficients', {
        details: 'The equation may not be a polynomial of the requested degree.',
      });
    }
    [matrix[col], matrix[pivot]] = [matrix[pivot]!, matrix[col]!];
    const divisor = matrix[col]![col + 1]!;
    for (let j = 0; j <= n; j += 1) matrix[col]![j]! /= divisor;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = matrix[r]![col + 1]!;
      if (factor === 0) continue;
      for (let j = 0; j <= n; j += 1) matrix[r]![j]! -= factor * matrix[col]![j]!;
    }
  }

  const coefficients = matrix.map((row) => row[0]!);
  return coefficients.map((value) => (Math.abs(value) < 1e-10 ? 0 : Number(value.toPrecision(12))));
}

/**
 * Lowest degree (1…maxDegree) that reproduces the equation as a polynomial,
 * or null when the equation is not polynomial (so callers can refuse politely).
 */
export function detectPolynomialDegree(
  equation: ParsedEquation,
  variable: string,
  maxDegree = 6,
): number | null {
  const f = makeDifference(equation, variable);
  const probes = [-1.5, 0.5, 3.25, 7.125];
  for (let degree = 1; degree <= maxDegree; degree += 1) {
    let coefficients: number[];
    try {
      coefficients = polynomialCoefficients(f, degree);
    } catch {
      continue;
    }
    if (coefficients[0] === 0) continue; // lower degree would have matched already
    const matches = probes.every(
      (probe) => Math.abs(horner(coefficients, probe) - f(probe)) <= 1e-6 * Math.max(1, Math.abs(f(probe))),
    );
    if (matches) return degree;
  }
  return null;
}

export function solvePolynomial(equation: ParsedEquation, variable: string, degree: number): PolynomialSolution {
  const f = makeDifference(equation, variable);
  const coefficients = polynomialCoefficients(f, degree);

  if (coefficients.every((value) => value === 0)) {
    throw new CalcError('NOT_SUPPORTED', 'Every value satisfies this equation', {
      details: 'Both sides are identical, so there is no discrete solution set.',
    });
  }

  // Verify the recovered polynomial against the function at points that were
  // never used for the fit: if it does not match, the equation is not a
  // polynomial of this degree and we must not report roots from a bad fit.
  for (const probe of [-1.5, 0.5, 3.25, 7.125]) {
    const expected = f(probe);
    const actual = horner(coefficients, probe);
    if (Math.abs(expected - actual) > 1e-6 * Math.max(1, Math.abs(expected))) {
      throw new CalcError('NOT_SUPPORTED', `This equation is not a polynomial of degree ${degree}`, {
        details:
          'OmniCalc only reports polynomial roots it can verify exactly. Use the numeric tools for transcendental equations such as sin(x) = 0.5.',
      });
    }
  }

  const roots = realPolynomialRoots(coefficients);
  const expectedComplex = Math.max(0, degree - roots.length);

  return {
    variable,
    coefficients,
    roots,
    complexPairs: expectedComplex,
    steps: [
      `Rewrite as a polynomial in ${variable}: ${polynomialToString(coefficients, variable)} = 0`,
      `Degree ${degree} ⇒ at most ${degree} roots; the solver found ${roots.length} real root(s).`,
      roots.length > 0
        ? `Roots: ${roots.map((root) => `${variable} = ${format(root)}`).join(', ')}`
        : 'No real roots: the polynomial does not cross the axis.',
    ],
  };
}

/** Horner evaluation of full coefficients [a_n, …, a_0]. */
export function horner(coefficients: readonly number[], x: number): number {
  let result = 0;
  for (const coefficient of coefficients) result = result * x + coefficient;
  return result;
}

export function polynomialToString(coefficients: readonly number[], variable = 'x'): string {
  const degree = coefficients.length - 1;
  const terms = coefficients
    .map((value, index) => {
      if (value === 0) return null;
      const power = degree - index;
      const magnitude = Math.abs(value);
      const sign = value < 0 ? '−' : '+';
      const body = power === 0 ? `${format(magnitude)}` : power === 1 ? `${magnitude === 1 ? '' : format(magnitude)}${variable}` : `${magnitude === 1 ? '' : format(magnitude)}${variable}^${power}`;
      return { sign, body };
    })
    .filter((term): term is { sign: string; body: string } => term !== null);

  if (terms.length === 0) return '0';
  return terms
    .map((term, index) => (index === 0 ? `${term.sign === '−' ? '−' : ''}${term.body}` : ` ${term.sign} ${term.body}`))
    .join('');
}

/* ------------------------------------------------------------------ */
/* Linear systems                                                      */
/* ------------------------------------------------------------------ */

export interface SystemSolution {
  variables: string[];
  values: number[];
  determinant: number;
  /** Whether the solution is unique, and if not, why. */
  status: 'unique' | 'none' | 'infinite';
  steps: string[];
}

/**
 * Solves a linear system with Cramer/Gaussian elimination on numeric
 * coefficients obtained by sampling each equation.
 */
export function solveLinearSystem(inputs: readonly string[], variables: readonly string[]): SystemSolution {
  if (inputs.length !== variables.length) {
    throw new CalcError('DIMENSION', 'Provide exactly one equation per unknown', {
      details: `Received ${inputs.length} equation(s) for ${variables.length} unknown(s).`,
    });
  }

  const equations = inputs.map((input) => parseEquation(input));
  const n = variables.length;
  const matrix: number[][] = [];
  const constants: number[] = [];

  for (const equation of equations) {
    const zero: Record<string, number> = Object.fromEntries(variables.map((name) => [name, 0]));
    const base = evaluateWith(equation.left, zero) - evaluateWith(equation.right, zero);
    const row: number[] = [];
    for (const name of variables) {
      const probe: Record<string, number> = { ...zero, [name]: 1 };
      const shifted = evaluateWith(equation.left, probe) - evaluateWith(equation.right, probe);
      row.push(shifted - base);
    }
    matrix.push(row);
    constants.push(-base);
  }

  const augmented = matrix.map((row, index) => [...row, constants[index]!]);
  const determinantValue = determinantOf(matrix);

  // Rank of the coefficients vs the augmented matrix decides the outcome.
  const rankA = rankOf(matrix);
  const rankAug = rankOf(augmented);

  if (rankA < rankAug) {
    return {
      variables: [...variables],
      values: [],
      determinant: determinantValue,
      status: 'none',
      steps: [
        'Coefficient ranks: rank(A) < rank(A|b) ⇒ the equations are inconsistent.',
        'No values satisfy all equations simultaneously.',
      ],
    };
  }
  if (rankA < n) {
    return {
      variables: [...variables],
      values: [],
      determinant: determinantValue,
      status: 'infinite',
      steps: [
        `rank(A) = ${rankA} < ${n} unknowns ⇒ the system is underdetermined.`,
        'Infinitely many solutions exist; OmniCalc does not pick one arbitrarily.',
      ],
    };
  }

  const values = solveSquare(matrix, constants);
  return {
    variables: [...variables],
    values,
    determinant: determinantValue,
    status: 'unique',
    steps: [
      `Coefficient matrix determinant = ${format(determinantValue)} (non-zero ⇒ unique solution).`,
      ...variables.map((name, index) => `${name} = ${format(values[index]!)}`),
    ],
  };
}

function solveSquare(matrix: number[][], constants: number[]): number[] {
  const n = matrix.length;
  const work = matrix.map((row, index) => [...row, constants[index]!]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(work[r]![col]!) > Math.abs(work[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(work[pivot]![col]!) < 1e-12) {
      throw new CalcError('SINGULAR', 'The system is singular and has no unique solution');
    }
    [work[col], work[pivot]] = [work[pivot]!, work[col]!];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = work[r]![col]! / work[col]![col]!;
      for (let j = col; j <= n; j += 1) work[r]![j]! -= factor * work[col]![j]!;
    }
  }
  return work.map((row, index) => Number((row[n]! / row[index]!).toPrecision(12)));
}

function determinantOf(matrix: number[][]): number {
  const n = matrix.length;
  const work = matrix.map((row) => [...row]);
  let det = 1;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(work[r]![col]!) > Math.abs(work[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(work[pivot]![col]!) < 1e-14) return 0;
    if (pivot !== col) {
      [work[col], work[pivot]] = [work[pivot]!, work[col]!];
      det = -det;
    }
    det *= work[col]![col]!;
    for (let r = col + 1; r < n; r += 1) {
      const factor = work[r]![col]! / work[col]![col]!;
      for (let j = col; j < n; j += 1) work[r]![j]! -= factor * work[col]![j]!;
    }
  }
  return Number(det.toPrecision(12));
}

function rankOf(matrix: number[][], tolerance = 1e-10): number {
  const work = matrix.map((row) => [...row]);
  const rowCount = work.length;
  const colCount = work[0]?.length ?? 0;
  let rank = 0;
  let row = 0;
  for (let col = 0; col < colCount && row < rowCount; col += 1) {
    let pivot = row;
    for (let r = row + 1; r < rowCount; r += 1) {
      if (Math.abs(work[r]![col]!) > Math.abs(work[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(work[pivot]![col]!) <= tolerance) continue;
    [work[row], work[pivot]] = [work[pivot]!, work[row]!];
    for (let r = row + 1; r < rowCount; r += 1) {
      const factor = work[r]![col]! / work[row]![col]!;
      for (let j = col; j < colCount; j += 1) work[r]![j]! -= factor * work[row]![j]!;
    }
    row += 1;
    rank += 1;
  }
  return rank;
}
