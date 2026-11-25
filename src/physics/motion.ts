import { dot, headingAxes, normalizeAngle, type Vector2 } from '../core/math';
import { TICK_SECONDS as dt } from '../core/ticks';
import type { VehicleState } from '../vehicles/vehicle';
import type { VehicleDefinition } from '../vehicles/vehicleDefinition';

import { DYNAMICS_PARAMETERS } from '../vehicles/vehicleSetup';
import { dampMotion } from './stabilization';

export function integrateMotion(
  state: VehicleState,
  definition: VehicleDefinition,
  axes: ReturnType<typeof headingAxes>,
  bodyForce: Vector2,
  torqueNm: number,
  resistanceN: number,
  powered: boolean,
) {
  const mass = definition.massKg;
  const next = {
    x:
      state.velocityMps.x +
      ((axes.forward.x * bodyForce.x + axes.left.x * bodyForce.y) / mass) * dt,
    y:
      state.velocityMps.y +
      ((axes.forward.y * bodyForce.x + axes.left.y * bodyForce.y) / mass) * dt,
  };
  // Apply resistance along the original motion. Spend at most the remaining momentum on this axis.
  const speed = Math.hypot(state.velocityMps.x, state.velocityMps.y);
  if (speed > 0) {
    const direction = {
      x: state.velocityMps.x / speed,
      y: state.velocityMps.y / speed,
    };
    const remaining = Math.max(0, dot(next, direction));
    const decrement = Math.min((resistanceN / mass) * dt, remaining);
    next.x -= decrement * direction.x;
    next.y -= decrement * direction.y;
  }
  const damped = dampMotion(
    next,
    state.yawRateRadPerSecond + (torqueNm / definition.yawInertiaKgM2) * dt,
    axes.left,
  );
  // Only settle sub-nanometre-per-tick residue, including motion at the axle ends.
  const axleSpeedBound =
    Math.hypot(damped.velocityMps.x, damped.velocityMps.y) +
    Math.max(definition.frontAxleDistanceM, definition.rearAxleDistanceM) *
      Math.abs(damped.yawRateRadPerSecond);
  const settled =
    !powered && axleSpeedBound <= DYNAMICS_PARAMETERS.numericalRestSpeedMps;
  const velocityMps = settled ? { x: 0, y: 0 } : damped.velocityMps;
  const yawRateRadPerSecond = settled ? 0 : damped.yawRateRadPerSecond;
  return {
    velocityMps,
    yawRateRadPerSecond,
    headingRad: normalizeAngle(state.headingRad + yawRateRadPerSecond * dt),
    positionM: {
      x: state.positionM.x + velocityMps.x * dt,
      y: state.positionM.y + velocityMps.y * dt,
    },
  };
}
