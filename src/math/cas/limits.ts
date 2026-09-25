import { differentiateNode, limit as numericLimit } from '@/math/calculus';
import {
  canonical,
  containsVariable,
  div as divNode,
  evaluateAt,
  evaluateRaw,
  format,
  formatNice,
  key,
  num,
  parseNode,
  type Node,
} from './ast';
import { degree, polyDivide, polyGcd, polynomialToNode, toPolynomial } from './polyops';

/**
 * Symbolic limits.
 *
 * Order of attack: cancel removable factors, substitute directly, then apply
 * L'Hôpital's rule symbolically while the form stays indeterminate. Only when
 * no closed form is found does it fall back to the numeric sequence estimator,
 * and the result says which route was used.
 */
export interface SymbolicLimit {
  value: number;
  /** False when the limit does not exist (e.g. 1/x at 0). */
  exists: boolean;
  /** For a two-sided query, what each side does. */
  sides?: { left: number; right: number };
  /** True when the value is exact (substitution, cancellation or L'Hôpital). */
  exact: boolean;
  method: 'substitution' | 'cancellation' | "l'hopital" | 'growth comparison' | 'numeric';
  steps: string[];
  /** Value from the numeric estimator, used as an independent check. */
  numeric: number | null;
  note: string;
}

export type Side = 'both' | 'left' | 'right';

const INDETERMINATE = new Set(['0/0', 'inf/inf', '0*inf', 'inf-inf']);

const show = (value: number): string =>
  Number.isFinite(value) ? String(Math.round(value * 1e10) / 1e10) : value > 0 ? '+∞' : '-∞';

function classify(numerator: Node, denominator: Node, variable: string, at: number): string {
  const a = evaluateAt(numerator, variable, at);
  const b = evaluateAt(denominator, variable, at);
  if (Number.isNaN(a) || Number.isNaN(b)) return 'indeterminate';
  const significant = (value: number) => Math.abs(value) < 1e-12;
  if (significant(a) && significant(b)) return '0/0';
  if (!Number.isFinite(a) && !Number.isFinite(b)) return 'inf/inf';
  return 'determinate';
}

/** Splits a node into numerator/denominator when it is written as a quotient. */
function split(node: Node): { numerator: Node; denominator: Node } {
  const ast = canonical(node);
  if (ast.type === 'binary' && ast.operator === '/') return { numerator: ast.left, denominator: ast.right };
  return { numerator: ast, denominator: num(1) };
}

function removeCommonFactor(
  numerator: Node,
  denominator: Node,
  variable: string,
): { numerator: Node; denominator: Node; cancelled: boolean; notes: string[] } {
  const p = toPolynomial(numerator, variable);
  const q = toPolynomial(denominator, variable);
  if (!p || !q || degree(q) < 1) return { numerator, denominator, cancelled: false, notes: [] };
  const common = polyGcd(p, q);
  if (degree(common) < 1) return { numerator, denominator, cancelled: false, notes: [] };
  const reducedNumerator = polyDivide(p, common).quotient;
  const reducedDenominator = polyDivide(q, common).quotient;
  return {
    numerator: polynomialToNode(reducedNumerator, variable),
    denominator: polynomialToNode(reducedDenominator, variable),
    cancelled: true,
    notes: [
      `Cancel the common factor ${formatNice(polynomialToNode(common, variable))}`,
      `Left with ${formatNice(polynomialToNode(reducedNumerator, variable))} / ${formatNice(
        polynomialToNode(reducedDenominator, variable),
      )}`,
    ],
  };
}

function differentiateOnce(node: Node, variable: string): Node | null {
  try {
    return canonical(differentiateNode(node, variable));
  } catch {
    return null;
  }
}

/** Rational-function limits at ±infinity: compare degrees, then leading coefficients. */
function limitAtInfinity(
  numerator: Node,
  denominator: Node,
  variable: string,
  at: number,
): { value: number; steps: string[] } | null {
  const p = toPolynomial(numerator, variable);
  const q = toPolynomial(denominator, variable);
  if (!p || !q || degree(q) < 1) return null;
  const degreeP = degree(p);
  const degreeQ = degree(q);
  const leadingP = p[degreeP]!;
  const leadingQ = q[degreeQ]!;
  const sign = at > 0 ? 1 : degreeP === degreeQ ? 1 : (degreeP - degreeQ) % 2 === 0 ? 1 : -1;
  const steps: string[] = [
    `Highest power in the numerator: ${variable}^${degreeP}`,
    `Highest power in the denominator: ${variable}^${degreeQ}`,
  ];
  if (degreeP < degreeQ) {
    steps.push('The denominator grows faster, so the limit is 0');
    return { value: 0, steps };
  }
  if (degreeP === degreeQ) {
    steps.push(`Equal degrees: the limit is the ratio of leading coefficients ${leadingP}/${leadingQ}`);
    return { value: leadingP / leadingQ, steps };
  }
  if (degreeP > degreeQ) {
    steps.push('The numerator grows faster, so the limit is infinite');
    return { value: sign * (leadingP / leadingQ > 0 ? Infinity : -Infinity), steps };
  }
  return null;
}

/**
 * Growth comparison for expressions that are not rational: geometric sample
 * points, then a ratio test. Only fast, unmistakable growth is called infinite —
 * anything ambiguous returns null so the caller can decline to answer.
 */
function growthLimit(node: Node, variable: string, at: number): { value: number; steps: string[] } | null {
  const points =
    at > 0 ? [2, 4, 8, 16, 32, 64, 128] : [-2, -4, -8, -16, -32, -64, -128];
  const values = points.map((x) => evaluateRaw(node, variable, x));
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 3) return null;

  const last = finite[finite.length - 1]!;
  const previous = finite[finite.length - 2]!;
  if (previous === 0) return null;
  const ratio = Math.abs(last) / Math.abs(previous);

  if (Math.abs(last) > 1e6 && ratio > 1.5) {
    return { value: Math.sign(last) * Infinity, steps: ['The expression outgrows every bound as the variable grows'] };
  }
  if (Math.abs(last) < 1e-8 && ratio < 0.9) {
    return { value: 0, steps: ['The expression decays towards zero'] };
  }
  if (Math.abs(ratio - 1) < 1e-3 && Math.abs(last - previous) < 1e-3 * Math.max(1, Math.abs(last))) {
    return { value: last, steps: ['The values settle, so the limit is that settled value'] };
  }
  return null;
}

export function symbolicLimit(source: string, point: number, variable = 'x', side: Side = 'both'): SymbolicLimit | null {
  let ast: Node;
  try {
    ast = parseNode(source);
  } catch {
    return null;
  }
  const steps: string[] = [];
  const split0 = split(ast);

  // 1. Cancel removable factors (removable discontinuities).
  let { numerator, denominator, cancelled } = removeCommonFactor(split0.numerator, split0.denominator, variable);
  if (cancelled) {
    steps.push(...removeCommonFactor(split0.numerator, split0.denominator, variable).notes);
    steps.push('The cancelled factor caused a removable discontinuity');
  }

  const atInfinity = !Number.isFinite(point);

  // 2. Substitution.
  if (!atInfinity) {
    const value = evaluateAt(divNode(numerator, denominator), variable, point);
    if (Number.isFinite(value)) {
      steps.push(`Substitute ${variable} = ${point}: the expression is defined and equals ${value}`);
      const numeric = numericSide(ast, point, variable, side)?.value ?? null;
      return {
        value,
        exists: true,
        exact: true,
        method: cancelled ? 'cancellation' : 'substitution',
        steps,
        numeric,
        note: 'exact by substitution',
      };
    }
  } else {
    const growth = limitAtInfinity(numerator, denominator, variable, point);
    if (growth) {
      steps.push(...growth.steps);
      return {
        value: growth.value,
        exists: true,
        exact: true,
        method: 'growth comparison',
        steps,
        numeric: null,
        note: 'exact by comparing leading terms',
      };
    }
    const growthNumeric = growthLimit(divNode(numerator, denominator), variable, point);
    if (growthNumeric) {
      steps.push(...growthNumeric.steps);
      return {
        value: growthNumeric.value,
        exists: true,
        exact: Number.isFinite(growthNumeric.value) ? false : true,
        method: 'growth comparison',
        steps,
        numeric: null,
        note: Number.isFinite(growthNumeric.value)
          ? 'estimated from the trend of the values; treated as approximate'
          : 'exact: grows without bound',
      };
    }
  }

  // 3. L'Hôpital while the form stays indeterminate.
  let currentNumerator = numerator;
  let currentDenominator = denominator;
  for (let round = 1; round <= 6; round += 1) {
    if (!atInfinity) {
      const shape = classify(currentNumerator, currentDenominator, variable, point);
      if (!INDETERMINATE.has(shape) && shape !== 'indeterminate') break;
    }
    const dNumerator = differentiateOnce(currentNumerator, variable);
    const dDenominator = differentiateOnce(currentDenominator, variable);
    if (!dNumerator || !dDenominator) break;
    steps.push(
      `L'Hôpital ${round}: differentiate both parts → ${format(dNumerator)} / ${format(dDenominator)}`,
    );
    currentNumerator = dNumerator;
    currentDenominator = dDenominator;
    if (!atInfinity) {
      const value = evaluateAt(divNode(currentNumerator, currentDenominator), variable, point);
      if (Number.isFinite(value)) {
        const numeric = numericSide(ast, point, variable, side)?.value ?? null;
        const disagreement = numeric !== null && Math.abs(numeric - value) > 1e-6 * Math.max(1, Math.abs(value));
        return {
          value,
          exists: true,
          exact: !disagreement,
          method: "l'hopital",
          steps,
          numeric,
          note: disagreement
            ? 'the numeric check disagreed, so treat this as approximate'
            : "exact after applying L'Hôpital's rule",
        };
      }
    } else {
      const growth = limitAtInfinity(currentNumerator, currentDenominator, variable, point) ?? growthLimit(divNode(currentNumerator, currentDenominator), variable, point);
      if (growth) {
        steps.push(...growth.steps);
        return {
          value: growth.value,
          exists: true,
          exact: true,
          method: "l'hopital",
          steps,
          numeric: null,
          note: "exact after applying L'Hôpital's rule",
        };
      }
    }
  }

  // 3b. Two-sided requests where the sides disagree: report that honestly.
  if (side === 'both' && Number.isFinite(point)) {
    const left = symbolicLimit(source, point, variable, 'left');
    const right = symbolicLimit(source, point, variable, 'right');
    if (left && right) {
      const agree =
        !Number.isFinite(left.value) || !Number.isFinite(right.value)
          ? Object.is(left.value, right.value)
          : Math.abs(left.value - right.value) <= 1e-9 * Math.max(1, Math.abs(left.value));
      if (!agree) {
        return {
          value: Number.NaN,
          exists: false,
          sides: { left: left.value, right: right.value },
          exact: true,
          method: 'growth comparison',
          steps: [
            `From the left the expression heads to ${show(left.value)}`,
            `From the right it heads to ${show(right.value)}`,
            'The sides disagree, so the two-sided limit does not exist',
          ],
          numeric: null,
          note: 'the two-sided limit does not exist',
        };
      }
    }
  }

  // 4. Numeric fallback, one-sided aware.
  const numeric = numericSide(ast, point, variable, side);
  if (!numeric) return null;
  if (Number.isNaN(numeric.value)) {
    return {
      value: Number.NaN,
      exists: false,
      exact: false,
      method: 'numeric',
      steps: [...steps, 'The numeric estimator could not settle on a value'],
      numeric: null,
      note: 'the limit could not be determined from the values available',
    };
  }
  if (numeric.diverges) {
    steps.push(`The values grow without bound from the ${side === 'right' ? 'right' : side === 'left' ? 'left' : 'nearby'}`);
    return {
      value: numeric.value,
      exists: true,
      exact: false,
      method: 'numeric',
      steps,
      numeric: numeric.value,
      note: 'the expression diverges; sign determined numerically',
    };
  }
  return {
    value: numeric.value,
    exists: true,
    exact: false,
    method: 'numeric',
    steps: [...steps, 'No exact form found, so the value comes from the numeric sequence estimator'],
    numeric: numeric.value,
    note: `approximate, estimated error ${numeric.error.toExponential(1)}`,
  };
}

interface NumericSide {
  value: number;
  error: number;
  diverges: boolean;
}

function numericSide(node: Node, point: number, variable: string, side: Side): NumericSide | null {
  void key(node);
  const compiled = (x: number) => evaluateAt(node, variable, x);
  if (!Number.isFinite(point)) {
    const samples = point > 0 ? [1e2, 1e3, 1e4, 1e5, 1e6] : [-1e2, -1e3, -1e4, -1e5, -1e6];
    const values = samples.map((x) => evaluateRaw(node, variable, x)).filter((value) => !Number.isNaN(value));
    if (values.length < 3) return null;
    if (values.some((value) => !Number.isFinite(value))) {
      const last = values[values.length - 1]!;
      return { value: Number.isFinite(last) ? 0 : Math.sign(last) * Infinity, error: Infinity, diverges: true };
    }
    const last = values[values.length - 1]!;
    const previous = values[values.length - 2]!;
    if (Math.abs(last) > 1e8 && Math.abs(last) > Math.abs(previous)) {
      return { value: Math.sign(last) * Infinity, error: Infinity, diverges: true };
    }
    return { value: last, error: Math.abs(last - previous), diverges: false };
  }
  try {
    const result = numericLimit(compiled, point, { side });
    if (Number.isFinite(result.value)) return { value: result.value, error: result.error, diverges: false };
  } catch {
    // The numeric estimator throws for a blow-up or when the sides disagree;
    // the numbers themselves decide which of those it is.
  }

  const h = 1e-6 * Math.max(1, Math.abs(point));
  const rightValue = compiled(point + h);
  const leftValue = compiled(point - h);
  const significant = (value: number) => Number.isFinite(value) && Math.abs(value) > 1e5;
  if (side === 'both') {
    if (significant(rightValue) && significant(leftValue) && Math.sign(rightValue) === Math.sign(leftValue)) {
      return { value: Math.sign(rightValue) * Infinity, error: Infinity, diverges: true };
    }
    return { value: Number.NaN, error: Infinity, diverges: false };
  }
  const wanted = side === 'left' ? leftValue : rightValue;
  if (significant(wanted)) return { value: Math.sign(wanted) * Infinity, error: Infinity, diverges: true };
  return null;
}

/** Both one-sided limits plus the two-sided conclusion. */
export interface TwoSidedLimit {
  left: SymbolicLimit | null;
  right: SymbolicLimit | null;
  twoSided: SymbolicLimit | null;
  agrees: boolean;
  steps: string[];
}

export function oneSidedLimits(source: string, point: number, variable = 'x'): TwoSidedLimit {
  const left = symbolicLimit(source, point, variable, 'left');
  const right = symbolicLimit(source, point, variable, 'right');
  const sameValue = (a: number, b: number): boolean => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Object.is(a, b);
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
  };
  const agrees = left !== null && right !== null && sameValue(left.value, right.value);
  const steps = [`From the left: ${left ? formatNumberish(left.value) : 'not determined'}`,
    `From the right: ${right ? formatNumberish(right.value) : 'not determined'}`];
  if (agrees) steps.push('Both sides agree, so the two-sided limit exists and equals that value');
  else steps.push('The two sides differ, so the two-sided limit does not exist');
  return {
    left,
    right,
    twoSided: agrees ? left : null,
    agrees,
    steps,
  };
}

const formatNumberish = (value: number): string =>
  !Number.isFinite(value) ? (value > 0 ? '∞' : '-∞') : String(Math.round(value * 1e10) / 1e10);

/** True when the expression is defined at the point (used for discontinuity reports). */
export function isDefinedAt(source: string, point: number, variable = 'x'): boolean {
  try {
    return Number.isFinite(evaluateAt(parseNode(source), variable, point));
  } catch {
    return false;
  }
}

export { containsVariable };
