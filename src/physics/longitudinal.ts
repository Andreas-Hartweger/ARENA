import { TICK_SECONDS } from '../core/ticks';
import type { ControlInput } from '../input/controlInput';
import type { Vehicle } from '../vehicles/vehicle';

import { DYNAMICS_PARAMETERS } from '../vehicles/vehicleSetup';

type Parameters = Pick<Vehicle, 'definition' | 'setup'>;

export function driveForceN(
  { definition, setup }: Parameters,
  input: ControlInput,
  u: number,
): number {
  if (input.brake > 0) return 0;
  const speed = Math.abs(u);
  const reverse = input.direction === 'reverse';
  const end = reverse ? definition.reverseLimitMps : setup.forwardTaperEndMps;
  const start = reverse
    ? setup.reverseTaperStartMps
    : setup.forwardTaperStartMps;
  const taper = Math.min(1, Math.max(0, (end - speed) / (end - start)));
  const available = Math.min(
    setup.maxDriveForceN,
    (setup.drivetrainEfficiency * definition.powerW) /
      Math.max(speed, DYNAMICS_PARAMETERS.minimumPowerSpeedMps),
  );
  return (
    input.throttle *
    available *
    taper *
    (reverse ? -setup.reverseDriveFactor : 1)
  );
}

export function axleBrakeForceN(
  brake: number,
  nominalDeceleration: number,
  massShare: number,
  tireSpeed: number,
): number {
  return (
    -Math.sign(tireSpeed) *
    massShare *
    Math.min(brake * nominalDeceleration, Math.abs(tireSpeed) / TICK_SECONDS)
  );
}

export function dragForceN({ setup }: Parameters, speed: number): number {
  return 0.5 * setup.airDensityKgM3 * setup.dragAreaM2 * speed * speed;
}
