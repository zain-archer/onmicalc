import { describe, expect, it } from 'vitest';
import {
  add,
  characteristicPolynomial,
  cols,
  createMatrix,
  determinant,
  eigenvalues,
  equals,
  formatMatrix,
  gaussianElimination,
  identity,
  inverse,
  multiply,
  parseMatrix,
  rank,
  rows,
  rref,
  scale,
  subtract,
  trace,
  transpose,
} from './index';
import { CalcError } from '@/core/errors';

const A = [
  [4, 3],
  [6, 3],
];

describe('matrix construction', () => {
  it('validates shape and entries', () => {
    expect(rows(A)).toBe(2);
    expect(cols(A)).toBe(2);
    expect(createMatrix(2, 3)[0]).toEqual([0, 0, 0]);
    expect(identity(3)).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    expect(() => createMatrix(0, 3)).toThrowError(/at least 1/);
    expect(parseMatrix('1 2\n3')).toBeNull();
  });

  it('parses semicolon, newline and bracket notation', () => {
    expect(parseMatrix('1 2; 3 4')).toEqual([[1, 2], [3, 4]]);
    expect(parseMatrix('1 2\n3 4')).toEqual([[1, 2], [3, 4]]);
    expect(parseMatrix('[[1,2],[3,4]]')).toEqual([[1, 2], [3, 4]]);
    expect(parseMatrix('1 2 3 4')).toEqual([[1, 2, 3, 4]]);
    expect(parseMatrix('-1.5 2e3')).toEqual([[-1.5, 2000]]);
    expect(parseMatrix('a b')).toBeNull();
    expect(parseMatrix('')).toBeNull();
  });
});

describe('matrix arithmetic', () => {
  it('adds, subtracts and scales', () => {
    expect(add(A, A)).toEqual([[8, 6], [12, 6]]);
    expect(subtract(A, A)).toEqual([[0, 0], [0, 0]]);
    expect(scale(A, 2)).toEqual([[8, 6], [12, 6]]);
    expect(() => add(A, [[1, 2, 3]])).toThrowError(/same size/);
    expect(() => scale(A, Number.NaN)).toThrowError(/finite/);
  });

  it('multiplies with dimension checks', () => {
    expect(multiply(A, [[1, 0], [0, 1]])).toEqual(A);
    expect(multiply([[1, 2, 3], [4, 5, 6]], [[7], [8], [9]])).toEqual([[50], [122]]);
    expect(() => multiply(A, [[1, 2, 3]])).toThrowError(/Inner dimensions/);
  });

  it('transposes and traces', () => {
    expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]]);
    expect(trace(A)).toBe(7);
    expect(() => trace([[1, 2, 3]])).toThrowError(/square/);
  });
});

describe('determinant, inverse, rank', () => {
  it('computes determinants', () => {
    expect(determinant([[1, 2], [3, 4]])).toBeCloseTo(-2, 10);
    expect(determinant(A)).toBeCloseTo(-6, 10);
    expect(determinant(identity(5))).toBe(1);
    expect(determinant([[2, 0, 0], [0, 3, 0], [0, 0, 4]])).toBeCloseTo(24, 10);
    expect(determinant([[1, 2], [2, 4]])).toBe(0);
    expect(determinant([[7]])).toBe(7);
    expect(() => determinant([[1, 2, 3]])).toThrowError(/square/);
  });

  it('supports 2×2 through 5×5', () => {
    for (const size of [2, 3, 4, 5]) {
      const m = createMatrix(size, size);
      for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) m[i]![j] = i === j ? 2 : 1;
      }
      const det = determinant(m);
      expect(Number.isFinite(det)).toBe(true);
      const inv = inverse(m);
      expect(equals(multiply(m, inv), identity(size), 1e-8)).toBe(true);
    }
  });

  it('inverts and reports singular matrices', () => {
    const inv = inverse([[4, 7], [2, 6]]);
    expect(equals(inv, [[0.6, -0.7], [-0.2, 0.4]], 1e-10)).toBe(true);
    expect(() => inverse([[1, 2], [2, 4]])).toThrowError(CalcError);
    try {
      inverse([[1, 2], [2, 4]]);
    } catch (err) {
      expect((err as CalcError).code).toBe('SINGULAR');
    }
    expect(() => inverse([[1, 2, 3]])).toThrowError(/square/);
  });

  it('computes rank and RREF', () => {
    expect(rank(A)).toBe(2);
    expect(rank([[1, 2], [2, 4]])).toBe(1);
    expect(rank(createMatrix(3, 3))).toBe(0);
    expect(rref([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 0, -1], [0, 1, 2]]);
    expect(rref([[1, 2], [2, 4]])).toEqual([[1, 2], [0, 0]]);
  });

  it('describes each Gaussian elimination step', () => {
    const steps = gaussianElimination([[2, 1, 5], [1, -1, 1]]);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0]!.description).toMatch(/Swap row|Divide row/);
    const last = steps[steps.length - 1]!.matrix;
    // Solved system: x = 2, y = 1
    expect(last[0]![0]).toBeCloseTo(1, 9);
    expect(last[1]![1]).toBeCloseTo(1, 9);
    expect(last[0]![2]).toBeCloseTo(2, 9);
    expect(last[1]![2]).toBeCloseTo(1, 9);
  });
});

describe('eigenvalues and eigenvectors', () => {
  it('finds the characteristic polynomial', () => {
    // A = [[4,3],[6,3]] → λ² − 7λ − 6
    expect(characteristicPolynomial(A)).toEqual([1, -7, -6]);
    expect(characteristicPolynomial(identity(3))).toEqual([1, -3, 3, -1]);
  });

  it('solves 2×2, 3×3 and 4×4 eigenvalues', () => {
    const two = eigenvalues([[2, 0], [0, 5]]);
    expect(two.values).toEqual([2, 5]);

    const three = eigenvalues([[2, 0, 0], [0, 3, 0], [0, 0, 4]]);
    expect(three.values).toEqual([2, 3, 4]);

    const four = eigenvalues([[1, 0, 0, 0], [0, 2, 0, 0], [0, 0, 3, 0], [0, 0, 0, 4]]);
    expect(four.values).toEqual([1, 2, 3, 4]);

    const symmetric = eigenvalues([[2, 1], [1, 2]]);
    expect(symmetric.values[0]).toBeCloseTo(1, 8);
    expect(symmetric.values[1]).toBeCloseTo(3, 8);
  });

  it('returns an eigenvector that satisfies A·v = λ·v', () => {
    const result = eigenvalues(A);
    expect(result.values).toHaveLength(2);
    for (let index = 0; index < result.values.length; index += 1) {
      const lambda = result.values[index]!;
      const v = result.vectors[index]!;
      const av = multiply(A, v.map((value) => [value])).map((row) => row[0]!);
      for (let i = 0; i < v.length; i += 1) expect(av[i]!).toBeCloseTo(lambda * v[i]!, 6);
    }
    expect(Math.hypot(...result.vectors[0]!)).toBeCloseTo(1, 9);
  });

  it('refuses matrices beyond the reliable closed-form size', () => {
    const big = identity(7);
    expect(() => eigenvalues(big)).toThrowError(/6×6/);
    expect(() => characteristicPolynomial(big)).toThrowError(CalcError);
  });

  it('reports rotations with no real eigenvalues instead of inventing them', () => {
    const rotation = eigenvalues([[0, -1], [1, 0]]);
    expect(rotation.values).toEqual([]);
  });
});

describe('matrix formatting', () => {
  it('renders aligned columns and rounds for display', () => {
    expect(formatMatrix([[1, 2], [3, 4]])).toBe('1  2\n3  4');
    expect(formatMatrix([[1 / 3]], 4)).toBe('0.3333');
  });
});
