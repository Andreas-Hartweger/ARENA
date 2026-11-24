import { describe, expect, it } from 'vitest';
import type { Vector2 } from '../../src/core/math';
import { runHeadlessTicks } from '../../src/core/ticks';
import {
  DIRECTION_HOLD_TICKS,
  resolveControlTick,
  type ControlRequest,
  type DirectionState,
} from '../../src/input/controlInput';

const forward: DirectionState = { direction: 'forward', oppositeHeldTicks: 0 };
const reverseRequest: ControlRequest = {
  throttle: 1,
  brake: 0,
  steering: 0,
  direction: 'reverse',
};
const stopped = { x: 0, y: 0 };

describe('source-independent controls (CTRL-004, CTRL-006, CTRL-011)', () => {
  it('clamps finite controls, keeps the steering sign and prioritizes braking', () => {
    const result = resolveControlTick(
      { throttle: 7, brake: 0.4, steering: -2, direction: 'forward' },
      forward,
      stopped,
    );
    expect(result.input).toEqual({
      throttle: 0,
      brake: 0.4,
      steering: -1,
      direction: 'forward',
    });
    expect(result.diagnostics).toEqual([]);
    expect(
      resolveControlTick(
        { throttle: 4, brake: -2, steering: 4, direction: 'forward' },
        forward,
        stopped,
      ).input,
    ).toEqual({ throttle: 1, brake: 0, steering: 1, direction: 'forward' });
    expect(
      resolveControlTick(
        { throttle: -1, brake: 4, steering: 0, direction: 'forward' },
        forward,
        stopped,
      ).input.brake,
    ).toBe(1);
  });

  it('neutralizes and diagnoses each non-finite field and rejects malformed direction', () => {
    const result = resolveControlTick(
      {
        throttle: NaN,
        brake: Infinity,
        steering: -Infinity,
        direction: 'sideways',
      },
      { ...forward, oppositeHeldTicks: 17 },
      stopped,
    );
    expect(result.input).toEqual({
      throttle: 0,
      brake: 0,
      steering: 0,
      direction: 'forward',
    });
    expect(result.directionState).toEqual(forward);
    expect(result.diagnostics).toEqual([
      'invalid-brake',
      'invalid-steering',
      'invalid-throttle',
      'invalid-direction',
    ]);
    expect(
      resolveControlTick(
        { ...reverseRequest, direction: undefined },
        forward,
        stopped,
      ).input.throttle,
    ).toBe(0);
    expect(() =>
      resolveControlTick(reverseRequest, forward, { x: 0, y: NaN }),
    ).toThrow(RangeError);
  });

  it('requires 18 consecutive standstill ticks with opposite intent for an external source', () => {
    let drive = forward;
    const atThreshold = Object.freeze({ x: 0.03, y: 0.04 });
    runHeadlessTicks(DIRECTION_HOLD_TICKS - 1, ({ index }) => {
      const result = resolveControlTick(reverseRequest, drive, atThreshold);
      expect(result.input).toEqual({
        throttle: 0,
        brake: 1,
        steering: 0,
        direction: 'forward',
      });
      expect(result.directionState.oppositeHeldTicks).toBe(index);
      drive = result.directionState;
    });
    const change = resolveControlTick(reverseRequest, drive, atThreshold);
    expect(DIRECTION_HOLD_TICKS).toBe(18);
    expect(change.directionState).toEqual({
      direction: 'reverse',
      oppositeHeldTicks: 0,
    });
    expect(change.input).toEqual(reverseRequest);
    expect(atThreshold).toEqual({ x: 0.03, y: 0.04 });
  });

  it.each<Vector2>([
    { x: 1, y: 0 },
    { x: 0, y: 0.051 },
    { x: 0.04, y: 0.04 },
  ])('resets the delay for movement in any direction %o', (velocity) => {
    const result = resolveControlTick(
      reverseRequest,
      { ...forward, oppositeHeldTicks: 17 },
      velocity,
    );
    expect(result.directionState).toEqual(forward);
    expect(result.input.brake).toBe(1);
  });

  it('clears the timer on release, brake, renewed forward command or a between-tick interruption', () => {
    const pending = { ...forward, oppositeHeldTicks: 17 };
    for (const request of [
      { ...reverseRequest, throttle: 0 },
      { ...reverseRequest, brake: 0.1 },
      { ...reverseRequest, direction: 'forward' },
    ]) {
      expect(
        resolveControlTick(request, pending, stopped).directionState,
      ).toEqual(forward);
    }
    expect(
      resolveControlTick(reverseRequest, pending, stopped, true).directionState,
    ).toEqual({ direction: 'forward', oppositeHeldTicks: 1 });
  });
});
