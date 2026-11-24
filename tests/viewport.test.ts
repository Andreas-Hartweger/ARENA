import { describe, expect, it } from 'vitest';
import { getViewport } from '../src/rendering/viewport';

describe('getViewport', () => {
  it('preserves proportions on a wide display', () => {
    expect(getViewport(800, 400, 1.5)).toEqual({
      width: 800,
      height: 400,
      halfWidth: 7,
      halfHeight: 3.5,
      pixelRatio: 1.5,
    });
  });

  it('preserves the visible width in portrait and caps pixel density', () => {
    expect(getViewport(300, 600, 4)).toMatchObject({
      halfWidth: 3.5,
      halfHeight: 7,
      pixelRatio: 2,
    });
  });

  it.each([
    [0, 500],
    [500, -1],
    [Infinity, 500],
    [500, NaN],
  ])('skips invalid dimensions %s × %s', (width, height) =>
    expect(getViewport(width, height, 1)).toBeNull(),
  );

  it.each([NaN, Infinity, 0.5])('uses a safe pixel ratio for %s', (ratio) => {
    expect(getViewport(400, 400, ratio)?.pixelRatio).toBe(1);
  });
});
