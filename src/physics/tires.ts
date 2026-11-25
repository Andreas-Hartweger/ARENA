import type { Vector2 } from '../core/math';

import { DYNAMICS_PARAMETERS } from '../vehicles/vehicleSetup';

export function tireContact(
  u: number,
  w: number,
  yaw: number,
  offsetM: number,
  cos: number,
  sin: number,
) {
  const lateral = w + offsetM * yaw;
  const longitudinalMps = cos * u + sin * lateral;
  const lateralMps = -sin * u + cos * lateral;
  const slipRad = Math.atan2(
    lateralMps,
    Math.max(
      Math.abs(longitudinalMps),
      DYNAMICS_PARAMETERS.minimumSlipSpeedMps,
    ),
  );
  return { longitudinalMps, lateralMps, slipRad };
}

export function limitTireForce(x: number, y: number, gripN: number): Vector2 {
  const magnitude = Math.hypot(x, y);
  const scale = magnitude > gripN ? gripN / magnitude : 1;
  return { x: x * scale, y: y * scale };
}

export function toBody(tire: Vector2, cos: number, sin: number): Vector2 {
  return { x: cos * tire.x - sin * tire.y, y: sin * tire.x + cos * tire.y };
}
