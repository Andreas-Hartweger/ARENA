import { normalizeAngle, type Vector2 } from '../core/math';
import { requireFinite, requireNonNegativeInteger } from '../core/validation';
import {
  validateDirectionState,
  type DirectionState,
} from '../input/controlInput';
import {
  defineVehicle,
  GT_01,
  type VehicleDefinition,
} from './vehicleDefinition';
import {
  createGT01Setup,
  validateVehicleSetup,
  type SurfaceId,
  type VehicleSetup,
} from './vehicleSetup';

export interface VehicleAppearance {
  color: string;
  startNumber: number;
}

export interface AxleSurfaceState {
  surface: SurfaceId | null;
  previousSurface: SurfaceId | null;
  transitionElapsedSeconds: number;
  transitionFromFriction?: number;
  transitionFromRollingResistance?: number;
}

export interface VehicleState {
  positionM: Vector2;
  headingRad: number;
  velocityMps: Vector2;
  yawRateRadPerSecond: number;
  steeringAngleRad: number;
  drive: DirectionState;
  frontAxle: AxleSurfaceState;
  rearAxle: AxleSurfaceState;
  resetStatus: 'none' | 'requested';
  discontinuity: boolean;
}

export interface Vehicle {
  readonly id: string;
  readonly definition: VehicleDefinition;
  readonly setup: VehicleSetup;
  readonly appearance: VehicleAppearance;
  readonly state: VehicleState;
}

export interface VehicleOptions {
  readonly id: string;
  readonly startNumber: number;
  readonly color?: string;
  readonly definition?: VehicleDefinition;
  readonly setup?: VehicleSetup;
  readonly initialState?: Partial<VehicleState>;
}

export function createVehicle(options: VehicleOptions): Vehicle {
  const { id, startNumber, color = '#397ac4', initialState } = options;
  if (!id.trim() || id !== id.trim())
    throw new RangeError('Invalid vehicle ID');
  requireNonNegativeInteger(startNumber, 'startNumber');
  if (!/^#[0-9a-f]{6}$/i.test(color))
    throw new RangeError('Expected an RGB hex color');

  const definition =
    options.definition && options.definition !== GT_01
      ? defineVehicle(options.definition)
      : GT_01;
  const sourceSetup = options.setup ?? createGT01Setup();
  validateVehicleSetup(sourceSetup, definition);
  const setup: VehicleSetup = {
    ...sourceSetup,
    surfaces: {
      asphalt: { ...sourceSetup.surfaces.asphalt },
      grass: { ...sourceSetup.surfaces.grass },
    },
  };
  const state: VehicleState = {
    yawRateRadPerSecond: 0,
    steeringAngleRad: 0,
    resetStatus: 'none',
    discontinuity: true,
    ...initialState,
    positionM: { ...(initialState?.positionM ?? { x: 0, y: 0 }) },
    velocityMps: { ...(initialState?.velocityMps ?? { x: 0, y: 0 }) },
    headingRad: normalizeAngle(initialState?.headingRad ?? 0),
    drive: {
      ...(initialState?.drive ?? {
        direction: 'forward',
        oppositeHeldTicks: 0,
      }),
    },
    frontAxle: createAxleState(initialState?.frontAxle),
    rearAxle: createAxleState(initialState?.rearAxle),
  };
  validateVehicleState(state, definition);
  return { id, definition, setup, state, appearance: { color, startNumber } };
}

export function createVehicles(options: readonly VehicleOptions[]): Vehicle[] {
  const ids = new Set<string>();
  return options.map((option) => {
    if (ids.has(option.id))
      throw new RangeError(`Duplicate vehicle ID: ${option.id}`);
    const vehicle = createVehicle(option);
    ids.add(vehicle.id);
    return vehicle;
  });
}

export function validateVehicleState(
  state: VehicleState,
  definition: VehicleDefinition,
): void {
  requireFinite(state.positionM.x, 'positionM.x');
  requireFinite(state.positionM.y, 'positionM.y');
  requireFinite(state.velocityMps.x, 'velocityMps.x');
  requireFinite(state.velocityMps.y, 'velocityMps.y');
  requireFinite(state.yawRateRadPerSecond, 'yawRateRadPerSecond');
  const heading = requireFinite(state.headingRad, 'headingRad');
  if (heading < -Math.PI || heading >= Math.PI)
    throw new RangeError('Heading must be normalized');
  const steering = requireFinite(state.steeringAngleRad, 'steeringAngleRad');
  if (Math.abs(steering) > definition.maxSteeringRad)
    throw new RangeError('Steering exceeds the mechanical limit');
  validateDirectionState(state.drive);
  if (
    (state.resetStatus !== 'none' && state.resetStatus !== 'requested') ||
    typeof state.discontinuity !== 'boolean'
  ) {
    throw new RangeError('Invalid reset state');
  }
  for (const axle of [state.frontAxle, state.rearAxle]) {
    for (const coefficient of [
      axle.transitionFromFriction,
      axle.transitionFromRollingResistance,
    ]) {
      if (
        coefficient !== undefined &&
        requireFinite(coefficient, 'surface transition coefficient') < 0
      )
        throw new RangeError('Negative surface transition coefficient');
    }
    for (const surface of [axle.surface, axle.previousSurface]) {
      if (surface !== null && surface !== 'asphalt' && surface !== 'grass') {
        throw new RangeError('Invalid axle surface');
      }
    }
    if (
      requireFinite(axle.transitionElapsedSeconds, 'transitionElapsedSeconds') <
      0
    ) {
      throw new RangeError('Surface transition time must be non-negative');
    }
  }
}

function createAxleState(state?: AxleSurfaceState): AxleSurfaceState {
  return state
    ? { ...state }
    : { surface: null, previousSurface: null, transitionElapsedSeconds: 0 };
}
