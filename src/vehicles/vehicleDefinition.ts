import { requireFinite } from '../core/validation';

export interface VehicleDefinition {
  readonly id: string;
  readonly name: string;
  readonly lengthM: number;
  readonly widthM: number;
  readonly wheelbaseM: number;
  readonly frontAxleDistanceM: number;
  readonly rearAxleDistanceM: number;
  readonly massKg: number;
  readonly yawInertiaKgM2: number;
  readonly powerW: number;
  readonly targetZeroToHundredSeconds: number;
  readonly targetTopSpeedMps: number;
  readonly nominalBrakingMps2: number;
  readonly maxSteeringRad: number;
  readonly reverseLimitMps: number;
}

export function requirePositive(value: number, name: string): void {
  if (requireFinite(value, name) <= 0)
    throw new RangeError(`${name} must be positive`);
}

export function defineVehicle(
  definition: VehicleDefinition,
): VehicleDefinition {
  if (!definition.id.trim() || !definition.name.trim()) {
    throw new RangeError('A vehicle definition requires an ID and name');
  }
  const fields = [
    'lengthM',
    'widthM',
    'wheelbaseM',
    'frontAxleDistanceM',
    'rearAxleDistanceM',
    'massKg',
    'yawInertiaKgM2',
    'powerW',
    'targetZeroToHundredSeconds',
    'targetTopSpeedMps',
    'nominalBrakingMps2',
    'maxSteeringRad',
    'reverseLimitMps',
  ] as const;
  for (const field of fields) requirePositive(definition[field], field);
  if (
    definition.wheelbaseM >= definition.lengthM ||
    Math.max(definition.frontAxleDistanceM, definition.rearAxleDistanceM) >
      definition.lengthM / 2 ||
    Math.abs(
      definition.frontAxleDistanceM +
        definition.rearAxleDistanceM -
        definition.wheelbaseM,
    ) > 1e-9
  ) {
    throw new RangeError(
      'Axle distances must match the wheelbase and fit inside the vehicle',
    );
  }
  if (definition.maxSteeringRad >= Math.PI / 2) {
    throw new RangeError('Mechanical steering limit must be below pi/2');
  }
  return Object.freeze({ ...definition });
}

export const GT_01 = defineVehicle({
  id: 'gt-01',
  name: 'ARENA GT-01',
  lengthM: 4.5,
  widthM: 1.95,
  wheelbaseM: 2.65,
  frontAxleDistanceM: 1.325,
  rearAxleDistanceM: 1.325,
  massKg: 1300,
  yawInertiaKgM2: 2600,
  powerW: 330974.4375,
  targetZeroToHundredSeconds: 3.8,
  targetTopSpeedMps: 250 / 3.6,
  nominalBrakingMps2: 12,
  maxSteeringRad: Math.PI / 6,
  reverseLimitMps: 30 / 3.6,
});
