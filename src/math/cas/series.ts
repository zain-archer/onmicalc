import { differentiateNode } from '@/math/calculus';
import { canonical, evaluateAt, formatNice, id, num, parseNode, type Node } from './ast';
import { toPolynomial } from './polyops';

/**
 * Taylor/Maclaurin expansions built from *symbolic* derivatives, so the
 * coefficients are exact whenever the engine can differentiate exactly, with a
 * numeric fallback that reports its own uncertainty. The radius of convergence
 * is estimated, never asserted: the caller is told how it was obtained.
 */

export interface SeriesTerm {
  power: number;
  /** Exact coefficient where available. */
  coefficient: number;
  /** Human-readable term, e.g. `x^3 / 6`. */
  text: string;
}

export interface SeriesResult {
  /** `taylor` or `maclaurin` (centre 0). */
  kind: 'taylor' | 'maclaurin';
  centre: number;
  order: number;
  terms: SeriesTerm[];
  polynomial: string;
  /** Long-form expansion including the remainder note. */
  expansion: string;
  exact: boolean;
  radius: { value: number | 'infinite' | null; note: string };
  /** Independent check at sample points. */
  verification: { maxError: number; checked: number; agrees: boolean; points: number[] };
  steps: string[];
}

/** Series the CAS knows by name, with their exact radius of convergence. */
// Patterns are matched against the source with all spaces removed, so
// "1 / (1 - x)" and "1/(1-x)" behave identically.
const KNOWN: { pattern: RegExp; name: string; build: (x: string) => string; radius: number | 'infinite'; note: string }[] = [
  { pattern: /^sin\((x)\)$/, name: 'sin', build: (x) => `${x} - ${x}^3/6 + ${x}^5/120 - ${x}^7/5040 + …`, radius: 'infinite', note: 'sin is entire: the series converges for every x' },
  { pattern: /^cos\((x)\)$/, name: 'cos', build: (x) => `1 - ${x}^2/2 + ${x}^4/24 - ${x}^6/720 + …`, radius: 'infinite', note: 'cos is entire: the series converges for every x' },
  { pattern: /^exp?\((x)\)$|^e\^\(?(x)\)?$/, name: 'exp', build: (x) => `1 + ${x} + ${x}^2/2 + ${x}^3/6 + ${x}^4/24 + …`, radius: 'infinite', note: 'exp is entire: the series converges for every x' },
  { pattern: /^ln\(1\+(x)\)$/, name: 'ln(1+x)', build: (x) => `${x} - ${x}^2/2 + ${x}^3/3 - ${x}^4/4 + …`, radius: 1, note: 'converges for |x| < 1 (logarithmic singularity at x = −1)' },
  { pattern: /^ln\(1-(x)\)$/, name: 'ln(1−x)', build: (x) => `-${x} - ${x}^2/2 - ${x}^3/3 - ${x}^4/4 - …`, radius: 1, note: 'converges for |x| < 1' },
  { pattern: /^1\/\(1-(x)\)$/, name: '1/(1−x)', build: (x) => `1 + ${x} + ${x}^2 + ${x}^3 + …`, radius: 1, note: 'geometric series, converges for |x| < 1' },
  { pattern: /^1\/\(1\+(x)\)$/, name: '1/(1+x)', build: (x) => `1 - ${x} + ${x}^2 - ${x}^3 + …`, radius: 1, note: 'geometric series, converges for |x| < 1' },
  { pattern: /^atan\((x)\)$/, name: 'atan', build: (x) => `${x} - ${x}^3/3 + ${x}^5/5 - ${x}^7/7 + …`, radius: 1, note: 'converges for |x| ≤ 1' },
  { pattern: /^sqrt\(1\+(x)\)$/, name: 'sqrt(1+x)', build: (x) => `1 + ${x}/2 - ${x}^2/8 + ${x}^3/16 - …`, radius: 1, note: 'binomial series with exponent 1/2, converges for |x| < 1' },
  { pattern: /^sinh\((x)\)$/, name: 'sinh', build: (x) => `${x} + ${x}^3/6 + ${x}^5/120 + …`, radius: 'infinite', note: 'sinh is entire' },
  { pattern: /^cosh\((x)\)$/, name: 'cosh', build: (x) => `1 + ${x}^2/2 + ${x}^4/24 + …`, radius: 'infinite', note: 'cosh is entire' },
];

function knownSeries(source: string, group: (match: RegExpMatchArray) => string): { name: string; expansion: string; radius: number | 'infinite'; note: string } | null {
  const compact = source.replace(/\s+/g, '');
  for (const entry of KNOWN) {
    const match = compact.match(entry.pattern);
    if (match) {
      return { name: entry.name, expansion: entry.build(group(match)), radius: entry.radius, note: entry.note };
    }
  }
  return null;
}

function factorial(n: number): number {
  let total = 1;
  for (let i = 2; i <= n; i += 1) total *= i;
  return total;
}

/** Exact derivatives at the centre, or null as soon as one is unavailable. */
function coefficientsFromSymbolic(source: string, variable: string, centre: number, order: number): number[] | null {
  let node: Node;
  try {
    node = parseNode(source);
  } catch {
    return null;
  }
  const coefficients: number[] = [];
  let current = node;
  for (let k = 0; k <= order; k += 1) {
    const value = evaluateAt(current, variable, centre);
    if (!Number.isFinite(value)) return null;
    coefficients.push(value / factorial(k));
    if (k === order) break;
    try {
      current = canonical(differentiateNode(current, variable));
    } catch {
      return null;
    }
  }
  return coefficients;
}

/** Numeric high-order derivatives when symbolic differentiation is unavailable. */
function coefficientsNumeric(source: string, variable: string, centre: number, order: number): number[] | null {
  let node: Node;
  try {
    node = parseNode(source);
  } catch {
    return null;
  }
  const step = 1e-3;
  const coefficients: number[] = [];
  for (let k = 0; k <= order; k += 1) {
    // Central difference of order k using binomial weights.
    let total = 0;
    for (let j = 0; j <= k; j += 1) {
      const weight = binomial(k, j) * (j % 2 === 0 ? 1 : -1);
      const value = evaluateAt(node, variable, centre + (k / 2 - j) * step);
      if (!Number.isFinite(value)) return null;
      total += weight * value;
    }
    const derivative = total / step ** k;
    coefficients.push(derivative / factorial(k));
  }
  return coefficients;
}

function binomial(n: number, k: number): number {
  return Math.round(factorial(n) / (factorial(k) * factorial(n - k)));
}

function estimateRadius(coefficients: number[]): { value: number | 'infinite' | null; note: string } {
  const magnitudes = coefficients.map((c) => Math.abs(c)).filter((c) => c > 1e-14);
  if (magnitudes.length < 3) {
    return { value: null, note: 'not enough non-zero terms to estimate a radius' };
  }
  const ratios: number[] = [];
  for (let i = 0; i + 1 < magnitudes.length; i += 1) {
    if (magnitudes[i + 1]! > 1e-14) ratios.push(magnitudes[i]! / magnitudes[i + 1]!);
  }
  if (ratios.length === 0) return { value: null, note: 'not enough non-zero terms to estimate a radius' };
  const last = ratios[ratios.length - 1]!;
  const stable = ratios.slice(-3).every((ratio) => Math.abs(ratio - last) < 0.2 * Math.max(1, Math.abs(last)));
  if (!stable) return { value: null, note: 'ratio test did not settle within the expansion order' };
  if (last > 1e12) return { value: 'infinite', note: 'the ratio test suggests every x converges (entire function)' };
  return { value: last, note: `estimated from the ratio test: R ≈ ${last.toFixed(4)}` };
}

export function series(source: string, options: { centre?: number; order?: number; variable?: string } = {}): SeriesResult | null {
  const centre = options.centre ?? 0;
  const order = Math.min(Math.max(options.order ?? 6, 1), 12);
  const variable = options.variable ?? 'x';
  if (!Number.isFinite(centre)) return null;

  const exactCoefficients = coefficientsFromSymbolic(source, variable, centre, order);
  const coefficients = exactCoefficients ?? coefficientsNumeric(source, variable, centre, order);
  if (!coefficients) return null;
  const exact = exactCoefficients !== null;

  const terms: SeriesTerm[] = coefficients.map((coefficient, power) => ({
    power,
    coefficient,
    text: termText(coefficient, power, variable, centre),
  }));

  const expansionText = terms.map((term) => term.text).filter((text) => text.length > 0).join(' + ');
  const polynomial = expansionText.replace(/\+ -/g, '- ');

  // Independent check: compare the truncated polynomial with the function.
  const node = parseNode(source);
  const truncated = coefficients.reduce<Node | null>((accumulator, coefficient, power) => {
    if (Math.abs(coefficient) < 1e-14) return accumulator;
    const offset = centre === 0 ? id(variable) : { type: 'binary' as const, operator: '-' as const, left: id(variable), right: num(centre), start: 0, end: 0 };
    const powerNode: Node = power === 0 ? num(1) : power === 1 ? offset : { type: 'binary', operator: '^', left: offset, right: num(power), start: 0, end: 0 };
    const term: Node = { type: 'binary', operator: '*', left: num(coefficient), right: powerNode, start: 0, end: 0 };
    return accumulator === null ? term : { type: 'binary', operator: '+', left: accumulator, right: term, start: 0, end: 0 };
  }, null);

  const base = Math.max(1, Math.abs(centre));
  const offsets = [0.05, 0.1, 0.2].map((fraction) => centre + fraction * base);
  let maxError = 0;
  let checked = 0;
  if (truncated) {
    for (const point of offsets) {
      const actual = evaluateAt(node, variable, point);
      const approximate = evaluateAt(truncated, variable, point);
      if (!Number.isFinite(actual) || !Number.isFinite(approximate)) continue;
      checked += 1;
      maxError = Math.max(maxError, Math.abs(actual - approximate));
      void point;
    }
  }

  const known = knownSeries(source, () => variable);
  const radiusEstimate = estimateRadius(coefficients);
  const radius = known
    ? { value: known.radius, note: known.note }
    : radiusEstimate;

  const steps = [
    `${centre === 0 ? 'Maclaurin' : 'Taylor'} series: Σ f⁽ᵏ⁾(a)/k! · (${variable} − a)^k with a = ${centre}`,
    exact
      ? 'Coefficients come from exact symbolic derivatives'
      : 'Symbolic derivatives were unavailable, so coefficients come from finite differences (approximate)',
    `Radius of convergence: ${radius.value === null ? 'not determined' : radius.value === 'infinite' ? '∞' : radius.value}`,
  ];

  return {
    kind: centre === 0 ? 'maclaurin' : 'taylor',
    centre,
    order,
    terms,
    polynomial,
    expansion: (polynomial || '0') + ' + …',
    exact,
    radius,
    verification: { maxError, checked, agrees: checked > 0 && maxError < 1e-3, points: offsets },
    steps,
  };
}

function termText(coefficient: number, power: number, variable: string, centre: number): string {
  const rounded = Math.abs(coefficient) < 1e-14 ? 0 : coefficient;
  if (rounded === 0) return '';
  const variablePart =
    power === 0
      ? ''
      : centre === 0
        ? power === 1
          ? variable
          : `${variable}^${power}`
        : power === 1
          ? `(${variable} - ${centre})`
          : `(${variable} - ${centre})^${power}`;
  const magnitude = Math.abs(rounded);
  const sign = rounded < 0 ? '-' : '';
  if (power === 0) return `${sign}${magnitude}`;
  const fraction = approximateFraction(magnitude);
  const coefficientText = fraction ?? String(Number(magnitude.toFixed(10)));
  if (coefficientText === '1') return `${sign}${variablePart}`;
  if (coefficientText.startsWith('1/')) return `${sign}${variablePart}/${coefficientText.slice(2)}`;
  return `${sign}${coefficientText}${variablePart}`.replace(/^(\d+)\/(\d+)/, '($1/$2)');
}

/** `0.3333…` → `1/3` when it is within 1e-9 of a small fraction. */
function approximateFraction(value: number): string | null {
  if (Number.isInteger(value)) return String(value);
  for (let denominator = 2; denominator <= 5040; denominator += 1) {
    const numerator = value * denominator;
    if (Math.abs(numerator - Math.round(numerator)) < 1e-9) {
      return `${Math.round(numerator)}/${denominator}`;
    }
  }
  return null;
}

/** Convenience for the UI: "-x^3/6 + …" style text for a known function. */
export function popularSeries(): { name: string; expansion: string; radius: string }[] {
  return KNOWN.map((entry) => ({
    name: entry.name,
    expansion: entry.build('x'),
    radius: entry.radius === 'infinite' ? 'all x' : `|x| < ${entry.radius}`,
  }));
}

export { formatNice, toPolynomial };
