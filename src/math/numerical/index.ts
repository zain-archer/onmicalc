import { CalcError } from '@/core/errors';

/**
 * Numerical methods with visible working: every routine returns the iteration
 * history, the error estimate and a convergence verdict, so the UI can show
 * *how* an answer was reached instead of just asserting it.
 */
export type ScalarFunction = (x: number) => number;

export interface Iteration {
  step: number;
  x: number;
  fx: number;
  /** Absolute change from the previous iterate (or the bracket width). */
  error: number;
}

export interface RootResult {
  method: 'bisection' | 'newton' | 'secant' | 'regula-falsi';
  root: number;
  iterations: Iteration[];
  converged: boolean;
  /** |f(root)|, the residual left at the reported root. */
  residual: number;
  note: string;
}

function safe(f: ScalarFunction, x: number): number {
  try {
    const value = f(x);
    return typeof value === 'number' ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

const MAX_STEPS = 200;

export function bisection(f: ScalarFunction, a: number, b: number, tolerance = 1e-12): RootResult {
  let left = a;
  let right = b;
  let fLeft = safe(f, left);
  let fRight = safe(f, right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight)) {
    throw new CalcError('DOMAIN', 'The function must be defined at both ends of the interval');
  }
  if (fLeft * fRight > 0) {
    throw new CalcError('CONVERGENCE', 'The function has the same sign at both ends, so no root is bracketed here', {
      details: 'Pick an interval where the function changes sign.',
    });
  }
  const iterations: Iteration[] = [];
  let middle = (left + right) / 2;
  for (let step = 1; step <= MAX_STEPS; step += 1) {
    middle = (left + right) / 2;
    const fMiddle = safe(f, middle);
    iterations.push({ step, x: middle, fx: fMiddle, error: Math.abs(right - left) / 2 });
    if (Math.abs(fMiddle) < tolerance || Math.abs(right - left) < tolerance) break;
    if (fLeft * fMiddle < 0) {
      right = middle;
      fRight = fMiddle;
    } else {
      left = middle;
      fLeft = fMiddle;
    }
    void fRight;
  }
  const residual = Math.abs(safe(f, middle));
  return {
    method: 'bisection',
    root: middle,
    iterations,
    converged: residual < Math.max(tolerance, 1e-8),
    residual,
    note: 'Bisection halves the interval every step: slow but guaranteed once a sign change is bracketed.',
  };
}

export function newtonRaphson(
  f: ScalarFunction,
  start: number,
  options: { derivative?: ScalarFunction; tolerance?: number; maxSteps?: number } = {},
): RootResult {
  const tolerance = options.tolerance ?? 1e-13;
  const maxSteps = Math.min(options.maxSteps ?? 60, MAX_STEPS);
  const derivative =
    options.derivative ??
    ((x: number) => {
      const h = 1e-7 * Math.max(1, Math.abs(x));
      return (safe(f, x + h) - safe(f, x - h)) / (2 * h);
    });

  let x = start;
  const iterations: Iteration[] = [];
  for (let step = 1; step <= maxSteps; step += 1) {
    const fx = safe(f, x);
    const dfx = derivative(x);
    if (!Number.isFinite(fx) || !Number.isFinite(dfx)) break;
    if (Math.abs(dfx) < 1e-300) break;
    const next = x - fx / dfx;
    iterations.push({ step, x: next, fx: safe(f, next), error: Math.abs(next - x) });
    x = next;
    if (Math.abs(fx) < tolerance || Math.abs(iterations[iterations.length - 1]!.error) < tolerance) break;
  }
  const residual = Math.abs(safe(f, x));
  return {
    method: 'newton',
    root: x,
    iterations,
    converged: residual < Math.max(tolerance, 1e-8),
    residual,
    note: 'Newton–Raphson converges quadratically near a simple root, but can jump away when f′ is small.',
  };
}

export function secant(f: ScalarFunction, a: number, b: number, tolerance = 1e-13): RootResult {
  let previous = a;
  let current = b;
  let fPrevious = safe(f, previous);
  let fCurrent = safe(f, current);
  const iterations: Iteration[] = [];
  for (let step = 1; step <= 80; step += 1) {
    if (Math.abs(fCurrent - fPrevious) < 1e-300) break;
    const next = current - (fCurrent * (current - previous)) / (fCurrent - fPrevious);
    const fNext = safe(f, next);
    iterations.push({ step, x: next, fx: fNext, error: Math.abs(next - current) });
    previous = current;
    fPrevious = fCurrent;
    current = next;
    fCurrent = fNext;
    if (Math.abs(fNext) < tolerance || Math.abs(iterations[iterations.length - 1]!.error) < tolerance) break;
  }
  const residual = Math.abs(safe(f, current));
  return {
    method: 'secant',
    root: current,
    iterations,
    converged: residual < Math.max(tolerance, 1e-8),
    residual,
    note: 'The secant method needs no derivative: it draws a straight line through the last two points.',
  };
}

export function regulaFalsi(f: ScalarFunction, a: number, b: number, tolerance = 1e-13): RootResult {
  let left = a;
  let right = b;
  let fLeft = safe(f, left);
  let fRight = safe(f, right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight)) {
    throw new CalcError('DOMAIN', 'The function must be defined at both ends of the interval');
  }
  if (fLeft * fRight > 0) {
    throw new CalcError('CONVERGENCE', 'No sign change in that interval, so the false-position method cannot start');
  }
  const iterations: Iteration[] = [];
  let current = left;
  for (let step = 1; step <= MAX_STEPS; step += 1) {
    current = (left * fRight - right * fLeft) / (fRight - fLeft);
    const fCurrent = safe(f, current);
    iterations.push({ step, x: current, fx: fCurrent, error: Math.abs(right - left) });
    if (Math.abs(fCurrent) < tolerance) break;
    if (fLeft * fCurrent < 0) {
      right = current;
      fRight = fCurrent;
    } else {
      left = current;
      fLeft = fCurrent;
    }
    if (Math.abs(right - left) < tolerance) break;
  }
  const residual = Math.abs(safe(f, current));
  return {
    method: 'regula-falsi',
    root: current,
    iterations,
    converged: residual < Math.max(tolerance, 1e-8),
    residual,
    note: 'False position keeps a bracket and interpolates inside it: safe, though sometimes one-sided.',
  };
}

/** Runs several methods and reports which ones agree — a cross-check, not a vote. */
export function solveWithAllMethods(
  f: ScalarFunction,
  options: { bracket?: [number, number]; start?: number } = {},
): { results: RootResult[]; agree: boolean; spread: number } {
  const results: RootResult[] = [];
  const [a, b] = options.bracket ?? [-10, 10];
  try {
    results.push(bisection(f, a, b));
  } catch {
    /* no sign change: skip */
  }
  try {
    results.push(regulaFalsi(f, a, b));
  } catch {
    /* same */
  }
  try {
    results.push(newtonRaphson(f, options.start ?? (a + b) / 2));
  } catch {
    /* derivative failed */
  }
  try {
    results.push(secant(f, a, b));
  } catch {
    /* same */
  }
  const roots = results.map((result) => result.root);
  const spread = roots.length > 1 ? Math.max(...roots) - Math.min(...roots) : 0;
  const agree = roots.length > 1 && spread < 1e-4;
  return { results, agree, spread };
}

/* ------------------------------ optimisation ------------------------------ */

export interface OptimisationResult {
  method: 'golden-section' | 'gradient-descent' | 'newton';
  point: number[] | number;
  value: number;
  iterations: Iteration[];
  converged: boolean;
  kind: 'minimum' | 'maximum';
  note: string;
}

/** Golden-section search for a minimum on a bracket (no derivatives needed). */
export function goldenSection(
  f: ScalarFunction,
  a: number,
  b: number,
  options: { kind?: 'minimum' | 'maximum'; tolerance?: number } = {},
): OptimisationResult {
  const kind = options.kind ?? 'minimum';
  const g = kind === 'minimum' ? f : (x: number) => -f(x);
  const tolerance = options.tolerance ?? 1e-10;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let left = a;
  let right = b;
  let c = right - ratio * (right - left);
  let d = left + ratio * (right - left);
  let fc = safe(g, c);
  let fd = safe(g, d);
  const iterations: Iteration[] = [];
  for (let step = 1; step <= 200; step += 1) {
    iterations.push({ step, x: fc < fd ? c : d, fx: Math.min(fc, fd), error: Math.abs(right - left) });
    if (Math.abs(right - left) < tolerance) break;
    if (fc < fd) {
      right = d;
      d = c;
      fd = fc;
      c = right - ratio * (right - left);
      fc = safe(g, c);
    } else {
      left = c;
      c = d;
      fc = fd;
      d = left + ratio * (right - left);
      fd = safe(g, d);
    }
  }
  const point = (left + right) / 2;
  const value = f(point);
  return {
    method: 'golden-section',
    point,
    value,
    iterations,
    converged: Math.abs(right - left) < Math.max(tolerance * 100, 1e-8),
    kind,
    note: 'Golden-section search shrinks the bracket by a fixed factor, so it always converges on a unimodal interval.',
  };
}

export function goldenSectionMaximum(f: ScalarFunction, a: number, b: number): OptimisationResult {
  return goldenSection(f, a, b, { kind: 'maximum' });
}

/** Gradient descent on a multivariable function, with a simple backtracking line search. */
export function gradientDescent(
  f: (point: number[]) => number,
  start: number[],
  options: { tolerance?: number; maxSteps?: number; learningRate?: number } = {},
): OptimisationResult {
  const tolerance = options.tolerance ?? 1e-9;
  const maxSteps = options.maxSteps ?? 2000;
  const step0 = options.learningRate ?? 0.1;
  let point = [...start];
  let rate = step0;
  const iterations: Iteration[] = [];
  for (let step = 1; step <= maxSteps; step += 1) {
    const gradient = point.map((_, index) => {
      const h = 1e-6 * Math.max(1, Math.abs(point[index]!));
      const ahead = [...point];
      const behind = [...point];
      ahead[index] = ahead[index]! + h;
      behind[index] = behind[index]! - h;
      return (f(ahead) - f(behind)) / (2 * h);
    });
    const magnitude = Math.sqrt(gradient.reduce((total, value) => total + value * value, 0));
    const current = f(point);
    let improved = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = point.map((value, index) => value - rate * gradient[index]!);
      const candidateValue = f(candidate);
      if (Number.isFinite(candidateValue) && candidateValue < current) {
        point = candidate;
        rate *= 1.2;
        improved = true;
        break;
      }
      rate /= 2;
    }
    iterations.push({ step, x: point[0]!, fx: f(point), error: magnitude });
    if (Math.abs(magnitude) < tolerance) break;
    if (!improved) break;
  }
  return {
    method: 'gradient-descent',
    point,
    value: f(point),
    iterations,
    converged: iterations[iterations.length - 1]!.error < Math.max(tolerance * 100, 1e-6),
    kind: 'minimum',
    note: 'Gradient descent walks downhill; it finds a local minimum, not necessarily the global one.',
  };
}

/** Newton optimisation in one variable (root of f′), with a numeric second derivative. */
export function newtonOptimise(f: ScalarFunction, start: number, kind: 'minimum' | 'maximum' = 'minimum'): OptimisationResult {
  const g = kind === 'minimum' ? f : (x: number) => -f(x);
  const first = (x: number) => {
    const h = 1e-6 * Math.max(1, Math.abs(x));
    return (safe(g, x + h) - safe(g, x - h)) / (2 * h);
  };
  const second = (x: number) => {
    const h = 1e-5 * Math.max(1, Math.abs(x));
    return (safe(g, x + h) - 2 * safe(g, x) + safe(g, x - h)) / (h * h);
  };
  let x = start;
  const iterations: Iteration[] = [];
  for (let step = 1; step <= 100; step += 1) {
    const d1 = first(x);
    const d2 = second(x);
    if (!Number.isFinite(d1) || !Number.isFinite(d2) || Math.abs(d2) < 1e-300) break;
    const next = x - d1 / d2;
    iterations.push({ step, x: next, fx: f(next), error: Math.abs(next - x) });
    x = next;
    if (Math.abs(iterations[iterations.length - 1]!.error) < 1e-12) break;
  }
  // Newton stalls where f″ → 0 (flat or multiple stationary points) because the
  // numerical derivatives run out of significance there. Polish inside a tiny
  // bracket around the estimate — the refined point is strictly better or kept.
  const width = 1e-3 * Math.max(1, Math.abs(x));
  const polished = kind === 'minimum'
    ? goldenSection(g, x - width, x + width)
    : goldenSectionMaximum(g, x - width, x + width);
  if (typeof polished.point === 'number' && polished.value <= g(x)) x = polished.point;
  return {
    method: 'newton',
    point: x,
    value: f(x),
    iterations,
    converged: Math.abs(first(x)) < 1e-6,
    kind,
    note: 'Newton optimisation solves f′(x) = 0 directly, so it needs a smooth function and a good starting point.',
  };
}

/* ------------------------------ interpolation ----------------------------- */

export interface InterpolationResult {
  /** Coefficients for the given basis, in the order they should be combined. */
  coefficients: number[];
  /** Best fit value at x. */
  valueAt: (x: number) => number;
  text: string;
  /** Largest deviation from the data (0 for exact interpolation). */
  maxDeviation: number;
  method: 'linear' | 'lagrange' | 'newton-divided-differences' | 'least-squares';
}

export function linearInterpolation(points: [number, number][], x: number): number {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0) throw new CalcError('INPUT', 'At least one point is needed');
  if (x <= sorted[0]![0]) return sorted[0]![1];
  if (x >= sorted[sorted.length - 1]![0]) return sorted[sorted.length - 1]![1];
  for (let i = 0; i + 1 < sorted.length; i += 1) {
    const [x0, y0] = sorted[i]!;
    const [x1, y1] = sorted[i + 1]!;
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return sorted[sorted.length - 1]![1];
}

/** Lagrange form — stable for a handful of points and easy to explain. */
export function lagrangeInterpolation(points: [number, number][]): InterpolationResult {
  const basis = (x: number): number => {
    let total = 0;
    for (let i = 0; i < points.length; i += 1) {
      let term = points[i]![1];
      for (let j = 0; j < points.length; j += 1) {
        if (i === j) continue;
        term *= (x - points[j]![0]) / (points[i]![0] - points[j]![0]);
      }
      total += term;
    }
    return total;
  };
  const maxDeviation = points.reduce((worst, [x, y]) => Math.max(worst, Math.abs(basis(x) - y)), 0);
  return {
    coefficients: points.map((point) => point[1]),
    valueAt: basis,
    text: `Lagrange polynomial through ${points.length} points`,
    maxDeviation,
    method: 'lagrange',
  };
}

/** Newton's divided differences: the same polynomial, built incrementally. */
export function newtonInterpolation(points: [number, number][]): InterpolationResult {
  const n = points.length;
  const coefficients = points.map((point) => point[1]);
  for (let order = 1; order < n; order += 1) {
    for (let i = n - 1; i >= order; i -= 1) {
      coefficients[i] =
        (coefficients[i]! - coefficients[i - 1]!) / (points[i]![0] - points[i - order]![0]);
    }
  }
  const evaluate = (x: number): number => {
    let total = coefficients[n - 1]!;
    for (let i = n - 2; i >= 0; i -= 1) {
      total = total * (x - points[i]![0]) + coefficients[i]!;
    }
    return total;
  };
  const maxDeviation = points.reduce((worst, [x, y]) => Math.max(worst, Math.abs(evaluate(x) - y)), 0);
  return {
    coefficients,
    valueAt: evaluate,
    text: `Newton divided-difference polynomial with coefficients ${coefficients.map((c) => c.toPrecision(6)).join(', ')}`,
    maxDeviation,
    method: 'newton-divided-differences',
  };
}

/** Least-squares polynomial fit of the given degree (degree 1 = straight line). */
export function leastSquares(points: [number, number][], degree = 1): InterpolationResult {
  const n = points.length;
  if (n < degree + 1) throw new CalcError('INPUT', `A degree ${degree} fit needs at least ${degree + 1} points`);
  const size = degree + 1;
  const sums: number[] = new Array(2 * degree + 1).fill(0);
  const rhs: number[] = new Array(size).fill(0);
  for (const [x, y] of points) {
    let power = 1;
    for (let k = 0; k <= 2 * degree; k += 1) {
      sums[k] += power;
      power *= x;
    }
    power = 1;
    for (let k = 0; k < size; k += 1) {
      rhs[k] += y * power;
      power *= x;
    }
  }
  const matrix: number[][] = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => sums[row + column]!),
  );
  // Gaussian elimination with partial pivoting.
  const augmented = matrix.map((row, index) => [...row, rhs[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(augmented[pivot]![column]!) < 1e-300) {
      throw new CalcError('CONVERGENCE', 'The data do not determine a unique fit of that degree');
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]! / augmented[column]![column]!;
      for (let k = column; k <= size; k += 1) augmented[row]![k] = augmented[row]![k]! - factor * augmented[column]![k]!;
    }
  }
  const coefficients = Array.from({ length: size }, (_, index) => augmented[index]![size]! / augmented[index]![index]!);
  const valueAt = (x: number) => coefficients.reduce((total, coefficient, power) => total + coefficient * x ** power, 0);
  const maxDeviation = points.reduce((worst, [x, y]) => Math.max(worst, Math.abs(valueAt(x) - y)), 0);
  const terms = coefficients
    .map((coefficient, power) => (power === 0 ? coefficient.toPrecision(6) : `${coefficient.toPrecision(6)}x^${power}`))
    .join(' + ');
  return {
    coefficients,
    valueAt,
    text: `y ≈ ${terms}`,
    maxDeviation,
    method: 'least-squares',
  };
}

/* ------------------------------ differential equations --------------------- */

export type OdeMethod = 'euler' | 'midpoint' | 'rk4';

export interface OdeResult {
  method: OdeMethod;
  /** [x, y] pairs, one per step. */
  points: [number, number][];
  steps: number;
  stepSize: number;
  converged: boolean;
  note: string;
}

/**
 * Solves dy/dx = f(x, y) from an initial condition. Euler is shown for teaching,
 * midpoint and RK4 for accuracy; the caller can compare them side by side.
 */
export function solveOde(
  f: (x: number, y: number) => number,
  options: { x0: number; y0: number; x1: number; stepSize: number; method?: OdeMethod },
): OdeResult {
  const method = options.method ?? 'rk4';
  const { x0, y0, x1 } = options;
  const stepSize = options.stepSize;
  if (!(stepSize > 0)) throw new CalcError('INPUT', 'The step size must be positive');
  if (!(x1 > x0)) throw new CalcError('INPUT', 'The end of the interval must be larger than the start');
  const steps = Math.min(Math.ceil((x1 - x0) / stepSize), 100000);
  const h = (x1 - x0) / steps;
  const points: [number, number][] = [[x0, y0]];
  let x = x0;
  let y = y0;
  for (let i = 0; i < steps; i += 1) {
    const k1 = f(x, y);
    let next: number;
    if (method === 'euler') {
      next = y + h * k1;
    } else if (method === 'midpoint') {
      next = y + h * f(x + h / 2, y + (h * k1) / 2);
    } else {
      const k2 = f(x + h / 2, y + (h * k1) / 2);
      const k3 = f(x + h / 2, y + (h * k2) / 2);
      const k4 = f(x + h, y + h * k3);
      next = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    x += h;
    y = next;
    if (!Number.isFinite(y)) {
      return {
        method,
        points,
        steps: points.length - 1,
        stepSize: h,
        converged: false,
        note: 'The solution left the range of double-precision numbers — try a smaller interval or step.',
      };
    }
    points.push([x, y]);
  }
  const notes: Record<OdeMethod, string> = {
    euler: 'Euler is the simplest method and the least accurate: error grows like the step size.',
    midpoint: 'The midpoint method is second-order: it samples the slope at the halfway point.',
    rk4: 'Runge–Kutta 4 averages four slope estimates per step for fourth-order accuracy.',
  };
  return { method, points, steps, stepSize: h, converged: true, note: notes[method] };
}

/** Compares methods on the same problem so their accuracy can be seen directly. */
export function compareOdeMethods(
  f: (x: number, y: number) => number,
  options: { x0: number; y0: number; x1: number; stepSize: number },
): Record<OdeMethod, number> {
  return {
    euler: solveOde(f, { ...options, method: 'euler' }).points.slice(-1)[0]![1],
    midpoint: solveOde(f, { ...options, method: 'midpoint' }).points.slice(-1)[0]![1],
    rk4: solveOde(f, { ...options, method: 'rk4' }).points.slice(-1)[0]![1],
  };
}

/* ------------------------------ numerical calculus ------------------------- */

export function numericalDerivative(f: ScalarFunction, x: number, h = 1e-6 * Math.max(1, Math.abs(x))): number {
  return (safe(f, x + h) - safe(f, x - h)) / (2 * h);
}

export function numericalSecondDerivative(f: ScalarFunction, x: number, h = 1e-4 * Math.max(1, Math.abs(x))): number {
  return (safe(f, x + h) - 2 * safe(f, x) + safe(f, x - h)) / (h * h);
}

/** Simpson's rule with an explicit error estimate from the two-halves comparison. */
export function simpson(f: ScalarFunction, a: number, b: number, intervals = 1000): { value: number; error: number } {
  const n = Math.max(2, intervals % 2 === 0 ? intervals : intervals + 1);
  const h = (b - a) / n;
  let sum = safe(f, a) + safe(f, b);
  for (let i = 1; i < n; i += 1) sum += safe(f, a + i * h) * (i % 2 === 0 ? 2 : 4);
  const coarse = (h / 3) * sum;
  const half = simpsonHalf(f, a, b, n * 2);
  return { value: half, error: Math.abs(half - coarse) / 15 };
}

function simpsonHalf(f: ScalarFunction, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let sum = safe(f, a) + safe(f, b);
  for (let i = 1; i < n; i += 1) sum += safe(f, a + i * h) * (i % 2 === 0 ? 2 : 4);
  return (h / 3) * sum;
}

export { MAX_STEPS };
