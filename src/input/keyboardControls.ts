import type { Vector2 } from '../core/math';
import { TICK_SECONDS } from '../core/ticks';
import { requireFinite } from '../core/validation';
import {
  neutralControl,
  resolveControlTick,
  type ControlInput,
  type DirectionState,
  type ControlDiagnostic,
} from './controlInput';

export interface KeyboardButtons {
  readonly forward: boolean;
  readonly reverse: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export interface KeyboardSample {
  readonly buttons: KeyboardButtons;
  readonly suspended?: boolean;
  readonly reset?: boolean;
  readonly holdInterrupted?: boolean;
}

export interface KeyboardControlState {
  readonly throttle: number;
  readonly steering: number;
}

export const NEUTRAL_KEYBOARD_STATE: KeyboardControlState = Object.freeze({
  throttle: 0,
  steering: 0,
});

const THROTTLE_RISE_SECONDS = 0.25;
const THROTTLE_FALL_SECONDS = 0.12;
const STEERING_RISE_SECONDS = 0.25;
const STEERING_FALL_SECONDS = 0.2;

export function stepKeyboardControls(
  previous: KeyboardControlState,
  sample: KeyboardSample,
  drive: DirectionState,
  velocityMps: Vector2,
  steeringSensitivity = 1,
): {
  keyboard: KeyboardControlState;
  input: ControlInput;
  directionState: DirectionState;
  diagnostics: readonly ControlDiagnostic[];
} {
  const sensitivity = Math.max(
    0.5,
    Math.min(1.5, requireFinite(steeringSensitivity, 'steeringSensitivity')),
  );
  if (sample.suspended) {
    return {
      ...resolveControlTick(
        neutralControl(drive.direction),
        drive,
        velocityMps,
      ),
      keyboard: NEUTRAL_KEYBOARD_STATE,
    };
  }

  const base = sample.reset ? NEUTRAL_KEYBOARD_STATE : previous;
  const { forward, reverse, left, right } = sample.buttons;
  const braking = forward && reverse;
  const propulsion = forward !== reverse;
  const direction = propulsion
    ? forward
      ? 'forward'
      : 'reverse'
    : drive.direction;
  const steeringTarget = Number(right) - Number(left);
  return stepTargetControls(
    base,
    {
      throttle: Number(propulsion),
      brake: Number(braking),
      direction,
      steering: steeringTarget,
    },
    drive,
    velocityMps,
    sensitivity,
    sample.reset || sample.holdInterrupted,
  );
}
export function stepTargetControls(
  base: KeyboardControlState,
  target: ControlInput,
  drive: DirectionState,
  velocityMps: Vector2,
  sensitivity = 1,
  interrupted = false,
) {
  const previousThrottle = requireFinite(base.throttle, 'keyboard throttle');
  const previousSteering = requireFinite(base.steering, 'keyboard steering');
  if (
    previousThrottle < 0 ||
    previousThrottle > 1 ||
    Math.abs(previousSteering) > 1
  ) {
    throw new RangeError('Keyboard state is out of range');
  }
  const steeringTarget = target.steering;
  const steeringSeconds =
    steeringTarget === 0 ? STEERING_FALL_SECONDS : STEERING_RISE_SECONDS;
  const steering = moveToward(
    previousSteering,
    steeringTarget,
    (TICK_SECONDS / steeringSeconds) * sensitivity,
  );
  const resolved = resolveControlTick(
    { ...target, steering },
    drive,
    velocityMps,
    interrupted,
  );

  const throttleTarget = resolved.input.throttle;
  const throttleSeconds =
    throttleTarget < previousThrottle
      ? THROTTLE_FALL_SECONDS
      : THROTTLE_RISE_SECONDS;
  // Clear the pedal on a brake or accepted reversal so thrust cannot carry across directions.
  const throttle =
    resolved.input.brake > 0
      ? 0
      : moveToward(
          drive.direction === resolved.input.direction ? previousThrottle : 0,
          throttleTarget,
          TICK_SECONDS / throttleSeconds,
        );

  return {
    ...resolved,
    keyboard: { throttle, steering },
    input: { ...resolved.input, throttle },
  };
}

function moveToward(current: number, target: number, step: number): number {
  const delta = target - current;
  return Math.abs(delta) <= step + 1e-12
    ? target
    : current + Math.sign(delta) * step;
}
