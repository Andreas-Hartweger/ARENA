import type { Vector2 } from '../core/math';
import { TICKS_PER_SECOND } from '../core/ticks';
import { requireFinite, requireNonNegativeInteger } from '../core/validation';

export type DriveDirection = 'forward' | 'reverse';

export interface ControlInput {
  readonly throttle: number;
  readonly brake: number;
  readonly steering: number;
  readonly direction: DriveDirection;
}

export type ControlRequest = Omit<ControlInput, 'direction'> & {
  readonly direction: unknown;
};
export type ControlDiagnostic =
  | 'invalid-throttle'
  | 'invalid-brake'
  | 'invalid-steering'
  | 'invalid-direction';

export interface DirectionState {
  readonly direction: DriveDirection;
  readonly oppositeHeldTicks: number;
}

export const DIRECTION_HOLD_TICKS = Math.round(0.3 * TICKS_PER_SECOND);
export const STANDSTILL_SPEED_MPS = 0.05;

export function isDriveDirection(value: unknown): value is DriveDirection {
  return value === 'forward' || value === 'reverse';
}

export function validateDirectionState(state: DirectionState): void {
  if (!isDriveDirection(state.direction))
    throw new RangeError('Invalid current direction');
  if (
    requireNonNegativeInteger(state.oppositeHeldTicks, 'oppositeHeldTicks') >=
    DIRECTION_HOLD_TICKS
  ) {
    throw new RangeError('Completed direction holds must be cleared');
  }
}

export function neutralControl(direction: DriveDirection): ControlInput {
  return { throttle: 0, brake: 0, steering: 0, direction };
}

export function resolveControlTick(
  request: ControlRequest,
  previous: DirectionState,
  velocityMps: Vector2,
  holdInterrupted = false,
): {
  input: ControlInput;
  directionState: DirectionState;
  diagnostics: readonly ControlDiagnostic[];
} {
  validateDirectionState(previous);
  const speed = Math.hypot(
    requireFinite(velocityMps.x, 'velocityMps.x'),
    requireFinite(velocityMps.y, 'velocityMps.y'),
  );
  const diagnostics: ControlDiagnostic[] = [];
  const brake = normalize(request.brake, 0, 'invalid-brake', diagnostics);
  const steering = normalize(
    request.steering,
    -1,
    'invalid-steering',
    diagnostics,
  );
  const throttle = normalize(
    request.throttle,
    0,
    'invalid-throttle',
    diagnostics,
  );

  let direction = previous.direction;
  let oppositeHeldTicks = 0;
  let input: ControlInput = { throttle: 0, brake, steering, direction };
  if (!isDriveDirection(request.direction)) {
    diagnostics.push('invalid-direction');
  } else if (brake === 0 && throttle > 0) {
    if (request.direction !== direction) {
      if (speed <= STANDSTILL_SPEED_MPS) {
        oppositeHeldTicks =
          (holdInterrupted ? 0 : previous.oppositeHeldTicks) + 1;
      }
      if (oppositeHeldTicks === DIRECTION_HOLD_TICKS) {
        direction = request.direction;
        oppositeHeldTicks = 0;
      }
    }
    input =
      direction === request.direction
        ? { throttle, brake, steering, direction }
        : { throttle: 0, brake: 1, steering, direction };
  }
  return {
    input,
    directionState: { direction, oppositeHeldTicks },
    diagnostics,
  };
}

function normalize(
  value: number,
  minimum: number,
  diagnostic: ControlDiagnostic,
  diagnostics: ControlDiagnostic[],
): number {
  if (!Number.isFinite(value)) {
    diagnostics.push(diagnostic);
    return 0;
  }
  return Math.max(minimum, Math.min(1, value)) || 0;
}
