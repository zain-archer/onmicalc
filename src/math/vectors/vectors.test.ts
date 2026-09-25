import { describe, expect, it } from 'vitest';
import {
  add,
  angleBetween,
  cross,
  distance,
  dot,
  equals,
  formatVector,
  magnitude,
  normalize,
  parseVector,
  projection,
  projectionScalar,
  scale,
  subtract,
} from './index';
import { CalcError } from '@/core/errors';

const u = [1, 2, 3];
const v = [4, -5, 6];

describe('vector arithmetic', () => {
  it('adds, subtracts and scales', () => {
    expect(add(u, v)).toEqual([5, -3, 9]);
    expect(subtract(u, v)).toEqual([-3, 7, -3]);
    expect(scale(u, 2)).toEqual([2, 4, 6]);
    expect(() => add(u, [1, 2])).toThrowError(/same number of components/);
    expect(() => add([], [1])).toThrowError(CalcError);
  });

  it('computes dot and cross products', () => {
    expect(dot(u, v)).toBe(4 - 10 + 18);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(cross([2, 3, 4], [5, 6, 7])).toEqual([-3, 6, -3]);
    expect(dot(u, [1, 0, 0])).toBe(1);
    expect(() => cross([1, 2], [3, 4, 5])).toThrowError(/3-component/);
  });

  it('computes magnitude and normalises', () => {
    expect(magnitude([3, 4])).toBe(5);
    expect(magnitude([0, 0, 0])).toBe(0);
    expect(equals(normalize([3, 4]), [0.6, 0.8])).toBe(true);
    expect(magnitude(normalize([1e-200, 1e-200]))).toBeCloseTo(1, 10);
    expect(() => normalize([0, 0])).toThrowError(/zero vector/);
  });

  it('computes distance and angles', () => {
    expect(distance([1, 1], [4, 5])).toBe(5);
    expect(angleBetween([1, 0], [0, 1])).toBeCloseTo(Math.PI / 2, 12);
    expect(angleBetween([1, 0], [1, 0])).toBeCloseTo(0, 12);
    expect(angleBetween([1, 0], [-1, 0])).toBeCloseTo(Math.PI, 12);
    expect(() => angleBetween([0, 0], [1, 1])).toThrowError(/undefined/);
  });

  it('projects vectors', () => {
    expect(projectionScalar([3, 4], [1, 0])).toBe(3);
    expect(equals(projection([3, 4], [1, 0]), [3, 0])).toBe(true);
    expect(equals(projection([1, 1], [2, 0]), [1, 0])).toBe(true);
    expect(() => projection([1, 1], [0, 0])).toThrowError(/zero vector/);
  });

  it('parses and prints vectors', () => {
    expect(parseVector('1 2 3')).toEqual([1, 2, 3]);
    expect(parseVector('(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseVector('[1,2,3]')).toEqual([1, 2, 3]);
    expect(parseVector('1;2')).toBeNull();
    expect(parseVector('a b')).toBeNull();
    expect(parseVector('')).toBeNull();
    expect(formatVector([1 / 3, 2])).toBe('(0.333333, 2)');
  });
});
