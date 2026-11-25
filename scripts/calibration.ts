import { metersPerSecondToKilometersPerHour as kmh } from '../src/core/math';
import { TICKS_PER_SECOND } from '../src/core/ticks';
import { neutralControl, type ControlInput } from '../src/input/controlInput';
import type { SurfaceQuery } from '../src/physics/surface';
import { VehicleTickSession } from '../src/physics/vehicleTick';
import type { VehicleState } from '../src/vehicles/vehicle';
import { GT_01 } from '../src/vehicles/vehicleDefinition';
import type { SurfaceId } from '../src/vehicles/vehicleSetup';

const coast = neutralControl('forward');
const forward = { ...coast, throttle: 1 };
const brake = { ...coast, brake: 1 };
const reverse = { ...forward, direction: 'reverse' } as const;
const durationTicks = 180 * TICKS_PER_SECOND;

function car(
  initialState: Partial<VehicleState> = {},
  query: SurfaceQuery = () => 'asphalt',
  diagnostics = false,
) {
  return new VehicleTickSession(
    { id: 'calibration', startNumber: 1, initialState },
    query,
    diagnostics,
  );
}
function tick(session: VehicleTickSession, request: ControlInput) {
  return session.step({ kind: 'analog', request });
}
function straightLine() {
  const acceleration = car(),
    braking = car({ velocityMps: { x: 100 / 3.6, y: 0 } }),
    backing = car();
  let accelerationTicks = 0,
    topSpeedKmh = 0,
    reversePeakKmh = 0;
  let finalSecondMin = Infinity,
    finalSecondMax = 0;
  for (let i = 1; i <= durationTicks; i++) {
    const speed = kmh(tick(acceleration, forward).state.velocityMps.x);
    const backwards = -kmh(tick(backing, reverse).state.velocityMps.x);
    if (!accelerationTicks && speed >= 100) accelerationTicks = i;
    topSpeedKmh = Math.max(topSpeedKmh, speed);
    reversePeakKmh = Math.max(reversePeakKmh, backwards);
    if (i >= durationTicks - TICKS_PER_SECOND) {
      finalSecondMin = Math.min(finalSecondMin, speed);
      finalSecondMax = Math.max(finalSecondMax, speed);
    }
  }
  if (!accelerationTicks) throw new Error('Vehicle never reached 100 km/h');
  let brakeTicks = 0;
  while (
    Math.hypot(
      braking.frame.state.velocityMps.x,
      braking.frame.state.velocityMps.y,
    ) > 0
  ) {
    if (brakeTicks >= durationTicks) throw new Error('Vehicle did not stop');
    tick(braking, brake);
    brakeTicks++;
  }
  return {
    accelerationTicks,
    accelerationSeconds: accelerationTicks / TICKS_PER_SECOND,
    topSpeedKmh,
    finalSecondSpreadKmh: finalSecondMax - finalSecondMin,
    brakeDistanceM: braking.frame.state.positionM.x,
    brakeTicks,
    brakeSeconds: brakeTicks / TICKS_PER_SECOND,
    reversePeakKmh,
  };
}
function energy(state: VehicleState) {
  return (
    0.5 *
    (GT_01.massKg * (state.velocityMps.x ** 2 + state.velocityMps.y ** 2) +
      GT_01.yawInertiaKgM2 * state.yawRateRadPerSecond ** 2)
  );
}
function brakeInTurn() {
  const session = car(
    { velocityMps: { x: 24, y: 3 }, yawRateRadPerSecond: 0.2 },
    () => 'asphalt',
    true,
  );
  let previous = energy(session.frame.state),
    maxEnergyGainJ = 0,
    maxUtilization = 0,
    maxSteeringRad = 0,
    maxYawRadPerSecond = 0;
  let combinedForceTicks = 0;
  for (let i = 0; i < 120; i++) {
    const { state, physics } = tick(session, { ...brake, steering: -1 });
    const d = physics!;
    const current = energy(state);
    maxEnergyGainJ = Math.max(maxEnergyGainJ, current - previous);
    previous = current;
    maxUtilization = Math.max(
      maxUtilization,
      d.front.utilization,
      d.rear.utilization,
    );
    maxSteeringRad = Math.max(maxSteeringRad, Math.abs(d.steeringAngleRad));
    maxYawRadPerSecond = Math.max(
      maxYawRadPerSecond,
      Math.abs(d.yawRateRadPerSecond),
    );
    if (d.front.tireForceN.x !== 0 && d.front.tireForceN.y !== 0)
      combinedForceTicks++;
  }
  return {
    ticks: session.frame.index,
    maxEnergyGainJ,
    maxUtilization,
    maxSteeringRad,
    maxYawRadPerSecond,
    combinedForceTicks,
  };
}
function surfaceChange() {
  let material: SurfaceId = 'asphalt';
  const session = car({ velocityMps: { x: 12, y: 0 } }, () => material, true);
  const asphaltGripN = tick(session, forward).physics!.front.gripN;
  material = 'grass';
  const transition = Array.from({ length: 6 }, () => {
    const { front } = tick(session, forward).physics!;
    return {
      elapsedSeconds: front.surface.transitionElapsedSeconds,
      gripN: front.gripN,
      rollingResistance: front.rollingResistance,
    };
  });
  return { asphaltGripN, transition };
}

export function measureVehicle() {
  return {
    straight: straightLine(),
    turn: brakeInTurn(),
    surface: surfaceChange(),
  };
}
