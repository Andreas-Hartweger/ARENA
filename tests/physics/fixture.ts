import {
  neutralControl,
  type ControlInput,
} from '../../src/input/controlInput';
import { VehicleTickSession } from '../../src/physics/vehicleTick';
import type { SurfaceQuery } from '../../src/physics/surface';
import type { VehicleState } from '../../src/vehicles/vehicle';

export const coast = neutralControl('forward');
export const forward = { ...coast, throttle: 1 };
export const reverse = { ...forward, direction: 'reverse' } as const;
export const brake = { ...coast, brake: 1 };

export function fixture(
  initialState: Partial<VehicleState> = {},
  query: SurfaceQuery = () => 'asphalt',
) {
  return new VehicleTickSession(
    { id: 'fixture', startNumber: 1, initialState },
    query,
    true,
  );
}

export function advance(
  session: VehicleTickSession,
  request: ControlInput,
  count = 1,
) {
  for (let i = 0; i < count; i++) session.step({ kind: 'analog', request });
  return session.frame;
}
