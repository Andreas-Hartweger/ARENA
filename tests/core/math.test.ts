import { describe, expect, it } from 'vitest';
import {
  dot,
  headingAxes,
  interpolateAngle,
  interpolatePosition,
  metersPerSecondToKilometersPerHour,
  normalizeAngle,
} from '../../src/core/math';

describe('world coordinates', () => {
  it.each([
    [0, 1, 0],
    [Math.PI / 2, 0, 1],
    [Math.PI, -1, 0],
    [-Math.PI / 2, 0, -1],
  ])('maps heading %s rad to forward and left axes', (angle, x, y) => {
    const { forward, left } = headingAxes(angle);
    expect(forward.x).toBeCloseTo(x);
    expect(forward.y).toBeCloseTo(y);
    expect(left.x).toBeCloseTo(-y);
    expect(left.y).toBeCloseTo(x);
  });

  it('projects velocity onto the world axes and converts speed for display', () => {
    const { forward, left } = headingAxes(Math.PI / 2);
    expect(dot({ x: -2, y: 10 }, forward)).toBeCloseTo(10);
    expect(dot({ x: -2, y: 10 }, left)).toBeCloseTo(2);
    expect(metersPerSecondToKilometersPerHour(10)).toBe(36);
  });

  it('normalizes both ends of the interval and wraps whole turns', () => {
    expect(normalizeAngle(Math.PI)).toBe(-Math.PI);
    expect(normalizeAngle(-Math.PI)).toBe(-Math.PI);
    expect(normalizeAngle(-4 * Math.PI)).toBe(0);
    expect(normalizeAngle((9 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
    expect(normalizeAngle((-9 * Math.PI) / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it('interpolates by the shortest angle through the wrap boundary', () => {
    const rad = Math.PI / 180;
    expect(interpolateAngle(170 * rad, -170 * rad, 0.25)).toBeCloseTo(
      175 * rad,
    );
    expect(interpolateAngle(-170 * rad, 170 * rad, 0.25)).toBeCloseTo(
      -175 * rad,
    );
    expect(interpolateAngle(0, Math.PI, 0.5)).toBe(-Math.PI / 2);
    expect(interpolateAngle(0, 1, 2)).toBe(1);
  });

  it('interpolates a position without changing its source values', () => {
    const from = Object.freeze({ x: -2, y: 0 });
    const to = Object.freeze({ x: 6, y: 12 });
    expect(interpolatePosition(from, to, 0.25)).toEqual({ x: 0, y: 3 });
    expect(interpolatePosition(from, to, -1)).toEqual(from);
    expect(interpolatePosition(from, to, 2)).toEqual(to);
  });

  it('rejects non-finite inputs and overflow', () => {
    expect(() => normalizeAngle(Infinity)).toThrow(RangeError);
    expect(() => interpolateAngle(0, NaN, 0)).toThrow(RangeError);
    expect(() =>
      interpolatePosition({ x: 0, y: 0 }, { x: 1, y: 1 }, NaN),
    ).toThrow(RangeError);
    expect(() =>
      interpolatePosition({ x: 0, y: 0 }, { x: Infinity, y: 1 }, 0),
    ).toThrow(RangeError);
    expect(() => dot({ x: Number.MAX_VALUE, y: 0 }, { x: 2, y: 0 })).toThrow(
      RangeError,
    );
    expect(() => metersPerSecondToKilometersPerHour(Number.MAX_VALUE)).toThrow(
      RangeError,
    );
  });
});
