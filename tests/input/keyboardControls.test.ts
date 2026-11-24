import { describe, expect, it } from 'vitest';
import { runHeadlessTicks } from '../../src/core/ticks';
import {
  DIRECTION_HOLD_TICKS,
  type DirectionState,
} from '../../src/input/controlInput';
import {
  NEUTRAL_KEYBOARD_STATE,
  stepKeyboardControls,
  type KeyboardButtons,
  type KeyboardSample,
} from '../../src/input/keyboardControls';

const noButtons = { forward: false, reverse: false, left: false, right: false };
const stopped = { x: 0, y: 0 };

function simulateKeyboard(direction: DirectionState['direction'] = 'forward') {
  let keyboard = NEUTRAL_KEYBOARD_STATE;
  let drive: DirectionState = { direction, oppositeHeldTicks: 0 };
  return (
    pressed: Partial<KeyboardButtons> = {},
    velocity = stopped,
    settings: Omit<KeyboardSample, 'buttons'> = {},
    sensitivity = 1,
  ) => {
    const result = stepKeyboardControls(
      keyboard,
      { ...settings, buttons: { ...noButtons, ...pressed } },
      drive,
      velocity,
      sensitivity,
    );
    keyboard = result.keyboard;
    drive = result.directionState;
    return result;
  };
}

describe('fixed-tick keyboard controls', () => {
  it('rejects invalid stored pedal state before it can produce an invalid command', () => {
    const drive: DirectionState = {
      direction: 'forward',
      oppositeHeldTicks: 0,
    };
    for (const keyboard of [
      { throttle: 2, steering: 0 },
      { throttle: 0, steering: NaN },
    ]) {
      expect(() =>
        stepKeyboardControls(keyboard, { buttons: noButtons }, drive, stopped),
      ).toThrow(RangeError);
    }
  });

  it('ramps throttle linearly to full in 15 ticks and reaches zero on the eighth release tick (CTRL-002, CTRL-007)', () => {
    const step = simulateKeyboard();
    runHeadlessTicks(15, ({ index }) => {
      expect(step({ forward: true }).input.throttle).toBeCloseTo(index / 15);
    });
    runHeadlessTicks(7, ({ index }) => {
      const result = step();
      expect(result.input.throttle).toBeCloseTo(1 - index / (60 * 0.12));
      expect(result.input.brake).toBe(0);
    });
    expect(step().input).toEqual({
      throttle: 0,
      brake: 0,
      steering: 0,
      direction: 'forward',
    });
  });

  it('ramps steering up in 15 ticks, returns in 12 and reverses continuously through zero (CTRL-003)', () => {
    const step = simulateKeyboard();
    runHeadlessTicks(15, ({ index }) =>
      expect(step({ left: true }).input.steering).toBeCloseTo(-index / 15),
    );
    runHeadlessTicks(12, ({ index }) =>
      expect(step().input.steering).toBeCloseTo(-1 + index / 12),
    );
    runHeadlessTicks(15, () => step({ right: true }));
    runHeadlessTicks(30, ({ index }) =>
      expect(step({ left: true }).input.steering).toBeCloseTo(1 - index / 15),
    );
  });

  it('treats both steering keys as target zero and both directions as immediate braking (CTRL-006)', () => {
    const step = simulateKeyboard();
    runHeadlessTicks(15, () => step({ forward: true, right: true }));
    const result = step({
      forward: true,
      reverse: true,
      left: true,
      right: true,
    });
    expect(result.input).toMatchObject({
      throttle: 0,
      brake: 1,
      direction: 'forward',
    });
    expect(result.input.steering).toBeCloseTo(11 / 12);
    expect(result.directionState.oppositeHeldTicks).toBe(0);
    expect(
      step({ left: true, right: true }, stopped, { reset: true }).input
        .steering,
    ).toBe(0);
  });

  it('bounds sensitivity to 0.5–1.5 and changes steering ramp only (CTRL-009)', () => {
    const low = simulateKeyboard()(
      { forward: true, right: true },
      stopped,
      {},
      -3,
    ).input;
    const high = simulateKeyboard()(
      { forward: true, right: true },
      stopped,
      {},
      50,
    ).input;
    expect(low.steering).toBeCloseTo(0.5 / 15);
    expect(high.steering).toBeCloseTo(1.5 / 15);
    expect(low.throttle).toBe(high.throttle);
    const step = simulateKeyboard();
    runHeadlessTicks(10, () => step({ right: true }, stopped, {}, 1.5));
    expect(step({ right: true }, stopped, {}, 1.5).input.steering).toBe(1);
    expect(() => step({}, stopped, {}, Infinity)).toThrow(RangeError);
  });

  it.each([
    ['forward', 'reverse'],
    ['reverse', 'forward'],
  ] as const)(
    'brakes while moving and ramps from zero on an accepted change from %s to %s (CTRL-004)',
    (from, to) => {
      const step = simulateKeyboard(from);
      const opposite = { [to]: true };
      expect(
        step(opposite, { x: 0, y: 0.051 }).directionState.oppositeHeldTicks,
      ).toBe(0);
      runHeadlessTicks(DIRECTION_HOLD_TICKS - 1, () => {
        expect(step(opposite).input).toMatchObject({
          throttle: 0,
          brake: 1,
          direction: from,
        });
      });
      const change = step(opposite);
      expect(change.input.throttle).toBeCloseTo(1 / 15);
      expect(change.input).toMatchObject({ brake: 0, direction: to });
      expect(change.directionState.oppositeHeldTicks).toBe(0);
    },
  );

  it('clears hold and pedal state on pause and uses fresh commands after suspension (CTRL-010)', () => {
    const step = simulateKeyboard();
    runHeadlessTicks(17, () => step({ reverse: true, left: true }));
    const paused = step({ reverse: true, left: true }, stopped, {
      suspended: true,
    });
    expect(paused.input).toEqual({
      throttle: 0,
      brake: 0,
      steering: 0,
      direction: 'forward',
    });
    expect(paused.directionState.oppositeHeldTicks).toBe(0);
    const resumed = step({ reverse: true }, stopped, { reset: true });
    expect(resumed.directionState.oppositeHeldTicks).toBe(1);
    expect(resumed.input.steering).toBe(0);
  });
});
