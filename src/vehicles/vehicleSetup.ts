import { requireFinite } from '../core/validation';
import {
  GT_01,
  requirePositive,
  type VehicleDefinition,
} from './vehicleDefinition';

export type SurfaceId = 'asphalt' | 'grass';

export interface SurfaceSetup {
  friction: number;
  rollingResistance: number;
}

export interface VehicleSetup {
  gravityMps2: number;
  airDensityKgM3: number;
  dragAreaM2: number;
  drivetrainEfficiency: number;
  maxDriveForceN: number;
  reverseDriveFactor: number;
  frontStaticLoadFraction: number;
  frontCorneringStiffnessNPerRad: number;
  rearCorneringStiffnessNPerRad: number;
  maxSteeringRateRadPerSecond: number;
  handlingBlendStartMps: number;
  handlingBlendEndMps: number;
  steeringReferenceSpeedMps: number;
  forwardTaperStartMps: number;
  forwardTaperEndMps: number;
  reverseTaperStartMps: number;
  surfaceTransitionSeconds: number;
  surfaces: Record<SurfaceId, SurfaceSetup>;
}

const gt01BaseSetup: Readonly<Omit<VehicleSetup, 'surfaces'>> = Object.freeze({
  gravityMps2: 9.81,
  airDensityKgM3: 1.225,
  dragAreaM2: 0.75,
  drivetrainEfficiency: 0.85,
  maxDriveForceN: 9800,
  reverseDriveFactor: 0.35,
  frontStaticLoadFraction: 0.5,
  frontCorneringStiffnessNPerRad: 45000,
  rearCorneringStiffnessNPerRad: 50000,
  maxSteeringRateRadPerSecond: (120 * Math.PI) / 180,
  handlingBlendStartMps: 5 / 3.6,
  handlingBlendEndMps: 15 / 3.6,
  steeringReferenceSpeedMps: 15,
  forwardTaperStartMps: 240 / 3.6,
  forwardTaperEndMps: 260 / 3.6,
  reverseTaperStartMps: 25 / 3.6,
  surfaceTransitionSeconds: 0.1,
});

export function createGT01Setup(): VehicleSetup {
  return {
    ...gt01BaseSetup,
    surfaces: {
      asphalt: { friction: 1.25, rollingResistance: 0.015 },
      grass: { friction: 0.45, rollingResistance: 0.08 },
    },
  };
}

export function validateVehicleSetup(
  setup: VehicleSetup,
  definition: VehicleDefinition = GT_01,
): void {
  for (const field of Object.keys(
    gt01BaseSetup,
  ) as (keyof typeof gt01BaseSetup)[]) {
    requirePositive(setup[field], field);
  }
  if (
    setup.drivetrainEfficiency > 1 ||
    setup.reverseDriveFactor > 1 ||
    setup.frontStaticLoadFraction >= 1
  ) {
    throw new RangeError('Invalid drivetrain or axle load fraction');
  }
  if (
    setup.handlingBlendStartMps >= setup.handlingBlendEndMps ||
    setup.forwardTaperStartMps >= setup.forwardTaperEndMps ||
    setup.reverseTaperStartMps >= definition.reverseLimitMps
  ) {
    throw new RangeError('Invalid speed transition bounds');
  }
  for (const surface of ['asphalt', 'grass'] as const) {
    const { friction, rollingResistance } = setup.surfaces[surface];
    requirePositive(friction, `${surface} friction`);
    if (requireFinite(rollingResistance, `${surface} rolling resistance`) < 0) {
      throw new RangeError('Rolling resistance must be non-negative');
    }
  }
}
