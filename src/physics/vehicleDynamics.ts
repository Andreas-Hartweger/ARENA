import { dot, headingAxes, type Vector2 } from '../core/math';
import { requireFinite } from '../core/validation';
import type { ControlInput } from '../input/controlInput';
import {
  validateVehicleState,
  type AxleSurfaceState,
  type Vehicle,
  type VehicleState,
} from '../vehicles/vehicle';
import { lowSpeedForces, modelWeight, steeringStep } from './handling';
import { axleBrakeForceN, dragForceN, driveForceN } from './longitudinal';
import { integrateMotion } from './motion';
import { sampleAxles, type SurfaceQuery } from './surface';
import { limitTireForce, tireContact, toBody } from './tires';

export interface AxleDiagnostics {
  tireForceN: Vector2;
  bodyForceN: Vector2;
  gripN: number;
  utilization: number;
  slipRad: number;
  rollingResistance: number;
  surface: AxleSurfaceState;
}

export interface PhysicsDiagnostics {
  velocityMps: Vector2;
  longitudinalMps: number;
  lateralMps: number;
  yawRateRadPerSecond: number;
  steeringAngleRad: number;
  steeringLimitRad: number;
  driveN: number;
  brakeN: number;
  dragN: number;
  rollN: number;
  modelWeight: number;
  front: AxleDiagnostics;
  rear: AxleDiagnostics;
}

type AxleSample = ReturnType<typeof sampleAxles>['front'];
function axleDiagnostics(
  sample: AxleSample,
  tire: Vector2,
  body: Vector2,
  slipRad: number,
): AxleDiagnostics {
  return {
    tireForceN: tire,
    bodyForceN: body,
    gripN: sample.gripN,
    utilization: requireFinite(
      Math.hypot(tire.x, tire.y) / sample.gripN,
      'grip utilization',
    ),
    slipRad,
    rollingResistance: sample.profile.rollingResistance,
    surface: sample.state,
  };
}

export function calculateFreeMotion(
  vehicle: Pick<Vehicle, 'definition' | 'setup'>,
  previous: VehicleState,
  input: ControlInput,
  query: SurfaceQuery,
  diagnostics = false,
) {
  const { definition, setup } = vehicle;
  if (
    input.direction !== previous.drive.direction ||
    !(
      input.throttle >= 0 &&
      input.throttle <= 1 &&
      input.brake >= 0 &&
      input.brake <= 1 &&
      Math.abs(input.steering) <= 1
    ) ||
    (input.brake > 0 && input.throttle > 0)
  )
    throw new RangeError('Free motion requires a resolved control command');
  const axes = headingAxes(previous.headingRad);
  const u = dot(previous.velocityMps, axes.forward);
  const w = dot(previous.velocityMps, axes.left);
  const speed = Math.hypot(u, w);
  const { angle, limit } = steeringStep(
    vehicle,
    previous.steeringAngleRad,
    input.steering,
    speed,
  );
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const { front, rear } = sampleAxles(vehicle, previous, axes.forward, query);
  const yaw = previous.yawRateRadPerSecond;
  const low = lowSpeedForces(vehicle, u, w, yaw, angle);
  const driveN = driveForceN(vehicle, input, u);
  const frontContact = tireContact(
    u,
    w,
    yaw,
    definition.frontAxleDistanceM,
    cos,
    sin,
  );
  const rearContact = tireContact(
    u,
    w,
    yaw,
    -definition.rearAxleDistanceM,
    1,
    0,
  );
  const weight = modelWeight(
    speed,
    setup.handlingBlendStartMps,
    setup.handlingBlendEndMps,
  );
  const frontLateral =
    (1 - weight) * low.front -
    weight * setup.frontCorneringStiffnessNPerRad * frontContact.slipRad;
  const rearLateral =
    (1 - weight) * low.rear -
    weight * setup.rearCorneringStiffnessNPerRad * rearContact.slipRad;
  const brakeFront = axleBrakeForceN(
    input.brake,
    definition.nominalBrakingMps2,
    definition.massKg / 2,
    frontContact.longitudinalMps,
  );
  const brakeRear = axleBrakeForceN(
    input.brake,
    definition.nominalBrakingMps2,
    definition.massKg / 2,
    u,
  );
  const frontTire = limitTireForce(
    driveN / 2 + brakeFront,
    frontLateral,
    front.gripN,
  );
  const rearTire = limitTireForce(
    driveN / 2 + brakeRear,
    rearLateral,
    rear.gripN,
  );
  const frontBody = toBody(frontTire, cos, sin);
  const force = { x: frontBody.x + rearTire.x, y: frontBody.y + rearTire.y };
  const torque =
    definition.frontAxleDistanceM * frontBody.y -
    definition.rearAxleDistanceM * rearTire.y;
  const dragN = requireFinite(dragForceN(vehicle, speed), 'drag force');
  const rollN =
    speed > 0
      ? requireFinite(front.rollN + rear.rollN, 'rolling resistance')
      : 0;
  const state = {
    ...previous,
    drive: { ...previous.drive },
    ...integrateMotion(
      previous,
      definition,
      axes,
      force,
      torque,
      dragN + rollN,
      driveN !== 0,
    ),
    steeringAngleRad: angle,
    frontAxle: front.state,
    rearAxle: rear.state,
    discontinuity: false,
  };
  validateVehicleState(state, definition);
  if (!diagnostics) return { state, physics: undefined };
  const nextAxes = headingAxes(state.headingRad);
  const physics: PhysicsDiagnostics = {
    velocityMps: state.velocityMps,
    longitudinalMps: dot(state.velocityMps, nextAxes.forward),
    lateralMps: dot(state.velocityMps, nextAxes.left),
    yawRateRadPerSecond: state.yawRateRadPerSecond,
    steeringAngleRad: angle,
    steeringLimitRad: limit,
    modelWeight: weight,
    driveN: input.throttle > 0 ? frontTire.x + rearTire.x : 0,
    brakeN: input.brake > 0 ? frontTire.x + rearTire.x : 0,
    dragN,
    rollN,
    front: axleDiagnostics(front, frontTire, frontBody, frontContact.slipRad),
    rear: axleDiagnostics(rear, rearTire, rearTire, rearContact.slipRad),
  };
  return { state, physics };
}
