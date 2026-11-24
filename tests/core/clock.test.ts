import { describe, expect, it, vi } from 'vitest';
import { FixedStepClock } from '../../src/core/fixedStepClock';
import { SeededRandom } from '../../src/core/random';
import {
  runHeadlessTicks,
  TICK_SECONDS,
  type Tick,
} from '../../src/core/ticks';

describe('FixedStepClock', () => {
  it('accumulates variable frame lengths and emits fixed ticks', () => {
    const clock = new FixedStepClock();
    const ticks: Tick[] = [];
    const step = (tick: Tick) => ticks.push(tick);

    expect(clock.advanceFrame(0, step).executedTicks).toBe(0);
    expect(clock.advanceFrame(0.005, step).alpha).toBeCloseTo(0.3);
    expect(clock.advanceFrame(0.024, step).executedTicks).toBe(1);
    expect(clock.advanceFrame(0.05, step).executedTicks).toBe(2);

    expect(ticks).toEqual(
      [1, 2, 3].map((index) => ({
        index,
        dt: TICK_SECONDS,
        timeSeconds: index / 60,
      })),
    );
    expect(clock.timeSeconds).toBe(0.05);
  });

  it('caps catch-up and carries only the fractional remainder', () => {
    const clock = new FixedStepClock();
    const step = vi.fn();
    clock.advanceFrame(0, step);
    clock.advanceFrame(0.5 * TICK_SECONDS, step);

    const result = clock.advanceFrame(0.5 * TICK_SECONDS + 0.5, step);

    expect(result.executedTicks).toBe(8);
    expect(result.discardedTicks).toBe(7);
    expect(result.discardedSeconds).toBeCloseTo(0.25 + 7 * TICK_SECONDS);
    expect(result.alpha).toBeCloseTo(0.5);
    expect(step).toHaveBeenCalledTimes(8);
    expect(clock.timeSeconds).toBe(8 / 60);

    const next = clock.advanceFrame(0.5 + TICK_SECONDS, step);
    expect(next.executedTicks).toBe(1);
    expect(next.discardedTicks).toBe(0);
    expect(next.alpha).toBeCloseTo(0);
    expect(clock.timeSeconds).toBe(9 / 60);
  });

  it('preserves the fraction of an overloaded frame without any frame-gap clamp', () => {
    const clock = new FixedStepClock();
    const step = vi.fn();
    clock.advanceFrame(0, step);

    const result = clock.advanceFrame(10.75 * TICK_SECONDS, step);
    expect(result.executedTicks).toBe(8);
    expect(result.discardedTicks).toBe(2);
    expect(result.discardedSeconds).toBeCloseTo(2 * TICK_SECONDS);
    expect(result.alpha).toBeCloseTo(0.75);
  });

  it('clears pending time on pause and reinitializes the timestamp on resume', () => {
    const clock = new FixedStepClock();
    const step = vi.fn();
    clock.advanceFrame(0, step);
    clock.advanceFrame(1.75 * TICK_SECONDS, step);
    clock.pause();
    expect(clock.paused).toBe(true);
    expect(clock.advanceFrame(70, step)).toEqual({
      executedTicks: 0,
      alpha: 0,
      discardedTicks: 0,
      discardedSeconds: 0,
    });
    expect(clock.timeSeconds).toBe(TICK_SECONDS);

    clock.stepOnce(step);
    expect(clock.tickIndex).toBe(2);
    expect(step).toHaveBeenCalledTimes(2);
    expect(step).toHaveBeenLastCalledWith({
      index: 2,
      dt: TICK_SECONDS,
      timeSeconds: 2 / 60,
    });

    clock.resume();
    expect(clock.paused).toBe(false);
    expect(() => clock.stepOnce(step)).toThrow();
    expect(clock.advanceFrame(100, step).executedTicks).toBe(0);
    const next = clock.advanceFrame(100 + 0.5 * TICK_SECONDS, step);
    expect(next.executedTicks).toBe(0);
    expect(next.alpha).toBeCloseTo(0.5);
    expect(clock.tickIndex).toBe(2);
  });

  it('scales accumulated time while maintaining the same tick duration', () => {
    const clock = new FixedStepClock();
    const step = vi.fn();
    clock.advanceFrame(0, step);
    expect(clock.advanceFrame(TICK_SECONDS, step, 0).executedTicks).toBe(0);
    expect(clock.advanceFrame(2 * TICK_SECONDS, step, 0.5).alpha).toBeCloseTo(
      0.5,
    );
    expect(clock.advanceFrame(3 * TICK_SECONDS, step, 2).executedTicks).toBe(2);
    expect(step).toHaveBeenLastCalledWith({
      index: 2,
      dt: TICK_SECONDS,
      timeSeconds: 2 / 60,
    });
  });

  it('rejects invalid timestamp or speed without advancing the clock', () => {
    const clock = new FixedStepClock();
    const step = vi.fn();
    clock.advanceFrame(0, step);

    for (const [time, speed] of [
      [NaN, 1],
      [Infinity, 1],
      [-1, 1],
      [1, -1],
      [1, Infinity],
      [1, Number.MAX_VALUE],
    ]) {
      expect(() => clock.advanceFrame(time, step, speed)).toThrow(RangeError);
    }
    expect(step).not.toHaveBeenCalled();
    expect(clock.advanceFrame(TICK_SECONDS, step).executedTicks).toBe(1);
  });

  it('keeps the failed tick pending and preserves completed ticks', () => {
    const clock = new FixedStepClock();
    clock.advanceFrame(0, vi.fn());
    expect(() =>
      clock.advanceFrame(3 * TICK_SECONDS, ({ index }) => {
        if (index === 2) clock.pause();
      }),
    ).toThrow('Clock operations must run between ticks');

    expect(clock.tickIndex).toBe(1);
    const step = vi.fn();
    expect(clock.advanceFrame(3 * TICK_SECONDS, step).executedTicks).toBe(2);
    expect(step.mock.calls.map(([tick]) => tick.index)).toEqual([2, 3]);
  });
});

describe('runHeadlessTicks', () => {
  function createRun(seed: number) {
    const random = new SeededRandom(seed);
    const samples: number[] = [];
    return {
      samples,
      step: ({ index, dt }: Tick) =>
        samples.push(random.next() * dt * (index % 5)),
    };
  }

  it('repeats a seeded run and matches realtime at 30, 60 and 144 FPS', () => {
    const headless = createRun(123);
    const repeated = createRun(123);
    expect(runHeadlessTicks(120, headless.step)).toBe(120);
    runHeadlessTicks(120, repeated.step);
    expect(headless.samples).toEqual(repeated.samples);

    for (const fps of [30, 60, 144]) {
      const frameRun = createRun(123);
      const clock = new FixedStepClock();
      for (let frame = 0; frame <= fps * 2; frame += 1) {
        clock.advanceFrame(frame / fps, frameRun.step);
      }
      expect(clock.timeSeconds).toBe(2);
      expect(frameRun.samples).toEqual(headless.samples);
    }
  });

  it('continues from a completed index and handles zero ticks', () => {
    const step = vi.fn();
    expect(runHeadlessTicks(0, step, 40)).toBe(40);
    expect(step).not.toHaveBeenCalled();
    expect(runHeadlessTicks(2, step, 40)).toBe(42);
    expect(step.mock.calls.map(([tick]) => tick.index)).toEqual([41, 42]);
  });

  it('validates the whole range before calling the simulation', () => {
    const step = vi.fn();
    for (const [count, start] of [
      [-1, 0],
      [0.5, 0],
      [NaN, 0],
      [Infinity, 0],
      [0, -2],
      [1, Number.MAX_SAFE_INTEGER],
    ]) {
      expect(() => runHeadlessTicks(count, step, start)).toThrow(RangeError);
    }
    expect(step).not.toHaveBeenCalled();
  });
});
