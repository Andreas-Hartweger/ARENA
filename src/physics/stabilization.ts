import type { Vector2 } from '../core/math';
import { dot } from '../core/math';
import { TICK_SECONDS } from '../core/ticks';
import { DYNAMICS_PARAMETERS } from '../vehicles/vehicleSetup';

// Applied to the integrated velocities, before integrating position and heading.
export function dampMotion(velocity: Vector2, yaw: number, left: Vector2) {
  const lateralLoss =
    dot(velocity, left) *
    Math.min(1, TICK_SECONDS * DYNAMICS_PARAMETERS.lateralDampingPerSecond);
  return {
    velocityMps: {
      x: velocity.x - lateralLoss * left.x,
      y: velocity.y - lateralLoss * left.y,
    },
    yawRateRadPerSecond:
      yaw *
      (1 - Math.min(1, TICK_SECONDS * DYNAMICS_PARAMETERS.yawDampingPerSecond)),
  };
}
