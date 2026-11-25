import type { Vector2 } from '../core/math';
import { TICK_SECONDS } from '../core/ticks';
import { requireFinite } from '../core/validation';
import type {
  AxleSurfaceState,
  Vehicle,
  VehicleState,
} from '../vehicles/vehicle';
import type { SurfaceId, VehicleSetup } from '../vehicles/vehicleSetup';

export type SurfaceQuery = (positionM: Vector2) => SurfaceId;

function effectiveProfile(
  setup: VehicleSetup,
  state: AxleSurfaceState,
  material: SurfaceId,
) {
  const target = setup.surfaces[material];
  const from = setup.surfaces[state.previousSurface ?? material];
  const t = Math.min(
    1,
    state.transitionElapsedSeconds / setup.surfaceTransitionSeconds,
  );
  const interpolated = (start: number, end: number) =>
    t === 1 ? end : start * (1 - t) + end * t;
  return {
    friction: Math.min(
      target.friction,
      interpolated(
        state.transitionFromFriction ?? from.friction,
        target.friction,
      ),
    ),
    rollingResistance: interpolated(
      state.transitionFromRollingResistance ?? from.rollingResistance,
      target.rollingResistance,
    ),
  };
}

export function sampleAxles(
  { definition, setup }: Pick<Vehicle, 'definition' | 'setup'>,
  previous: VehicleState,
  forward: Vector2,
  query: SurfaceQuery,
) {
  function sample(old: AxleSurfaceState, distance: number, fraction: number) {
    const position = {
      x: requireFinite(previous.positionM.x + distance * forward.x, 'axle x'),
      y: requireFinite(previous.positionM.y + distance * forward.y, 'axle y'),
    };
    const surface = query(position);
    if (surface !== 'asphalt' && surface !== 'grass')
      throw new RangeError('Unknown axle surface');
    const duration = setup.surfaceTransitionSeconds;
    let state: AxleSurfaceState;
    if (old.surface === null) {
      state = {
        surface,
        previousSurface: null,
        transitionElapsedSeconds: duration,
      };
    } else if (old.surface !== surface) {
      const from = effectiveProfile(setup, old, old.surface);
      state = {
        surface,
        previousSurface: old.surface,
        transitionElapsedSeconds: Math.min(duration, TICK_SECONDS),
        transitionFromFriction: from.friction,
        transitionFromRollingResistance: from.rollingResistance,
      };
    } else {
      const elapsed = old.transitionElapsedSeconds + TICK_SECONDS;
      state = {
        ...old,
        transitionElapsedSeconds:
          elapsed >= duration - Number.EPSILON ? duration : elapsed,
      };
    }
    const profile = effectiveProfile(setup, state, surface);
    const loadN = fraction * definition.massKg * setup.gravityMps2;
    return {
      state,
      gripN: requireFinite(profile.friction * loadN, 'axle grip'),
      rollN: requireFinite(
        profile.rollingResistance * loadN,
        'axle roll resistance',
      ),
      profile,
    };
  }
  return {
    front: sample(
      previous.frontAxle,
      definition.frontAxleDistanceM,
      setup.frontStaticLoadFraction,
    ),
    rear: sample(
      previous.rearAxle,
      -definition.rearAxleDistanceM,
      1 - setup.frontStaticLoadFraction,
    ),
  };
}
