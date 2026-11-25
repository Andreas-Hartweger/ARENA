import { TICK_SECONDS } from '../core/ticks';
import type { Vehicle } from '../vehicles/vehicle';

import { DYNAMICS_PARAMETERS } from '../vehicles/vehicleSetup';

type Parameters = Pick<Vehicle, 'definition' | 'setup'>;

export function steeringStep(
  { definition, setup }: Parameters,
  previous: number,
  steering: number,
  speed: number,
) {
  const limit =
    definition.maxSteeringRad /
    (1 + (speed / setup.steeringReferenceSpeedMps) ** 2);
  const target = -steering * limit;
  const change = setup.maxSteeringRateRadPerSecond * TICK_SECONDS;
  const angle = Math.max(
    previous - change,
    Math.min(previous + change, target),
  );
  return { angle, limit };
}

export function modelWeight(speed: number, start: number, end: number): number {
  const t = Math.min(1, Math.max(0, (speed - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function lowSpeedForces(
  { definition }: Parameters,
  u: number,
  lateralSpeed: number,
  yaw: number,
  angle: number,
) {
  const {
    frontAxleDistanceM: front,
    rearAxleDistanceM: rear,
    wheelbaseM,
    massKg,
    yawInertiaKgM2,
  } = definition;
  const targetYaw = (u * Math.tan(angle)) / wheelbaseM;
  const force =
    (massKg * (rear * targetYaw - lateralSpeed)) /
    DYNAMICS_PARAMETERS.relaxationSeconds;
  const moment =
    (yawInertiaKgM2 * (targetYaw - yaw)) /
    DYNAMICS_PARAMETERS.relaxationSeconds;
  // Solve Ff + Fr = force and lf*Ff - lr*Fr = moment. Express Ff in the steered tire frame.
  return {
    front: (rear * force + moment) / (wheelbaseM * Math.cos(angle)),
    rear: (front * force - moment) / wheelbaseM,
  };
}
