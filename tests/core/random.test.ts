import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../../src/core/random';

describe('SeededRandom', () => {
  it('produces the Mulberry32 sequence for a known seed', () => {
    const random = new SeededRandom(1);
    expect([random.next(), random.next(), random.next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it('restores the exact next samples, including in a separate generator', () => {
    const random = new SeededRandom(0);
    random.next();
    const saved = random.getState();
    const expected = [random.next(), random.next()];
    const restored = new SeededRandom(0xffffffff);
    expect(restored.next()).not.toBe(expected[0]);
    restored.restoreState(saved);
    random.restoreState(saved);
    expect([restored.next(), restored.next()]).toEqual(expected);
    expect([random.next(), random.next()]).toEqual(expected);
    expect(restored.getState()).toBe(random.getState());
    expect(expected.every((sample) => sample >= 0 && sample < 1)).toBe(true);
  });

  it.each([-1, 0.5, 0x1_0000_0000, NaN, Infinity])(
    'rejects invalid uint32 state %s',
    (state) => {
      const random = new SeededRandom(42);
      expect(() => new SeededRandom(state)).toThrow(RangeError);
      expect(() => random.restoreState(state)).toThrow(RangeError);
      expect(random.getState()).toBe(42);
    },
  );
});
