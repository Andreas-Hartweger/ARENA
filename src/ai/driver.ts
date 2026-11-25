import type { Vehicle, VehicleState } from '../vehicles/vehicle';
import type { DriveDirection } from '../input/controlInput';
import type { Track } from '../tracks/track';
import { Brain } from './network';
import { observe } from './perception';
import { profile as defineProfile, period, standardProfile } from './profile';
import { registry, signature } from './schema';
import type { Polygon, wallIndex } from './geometry';
export function targets(
  output: readonly number[],
  previous: DriveDirection = 'forward',
) {
  if (
    output.length !== 3 ||
    ![output[0], output[1], output[2]].every(Number.isFinite)
  )
    throw Error('Invalid controller output');
  const [pedal, steering, d] = output.map(Math.tanh);
  const direction = directionRequest(d, previous);
  return {
    throttle: Math.max(0, pedal),
    brake: Math.max(0, -pedal),
    steering,
    direction,
  };
}
export function directionRequest(
  normalized: number,
  previous: DriveDirection,
): DriveDirection {
  return normalized >= 0.5
    ? 'forward'
    : normalized <= -0.5
      ? 'reverse'
      : previous;
}
export interface AiState {
  observation: ReturnType<typeof observe>;
  decisionTick: number;
  inputTick: number;
  output: number[];
  target: ReturnType<typeof targets>;
  layers: ReturnType<Brain['evaluate']>['layers'];
  decisionInput?: number[];
}
export interface DriverOptions {
  brain: Brain;
  profile?: typeof standardProfile;
  decisionHz?: number;
}
export function driver(
  options: DriverOptions,
  vehicle: Vehicle,
  track: Track,
  walls: ReturnType<typeof wallIndex>,
) {
  const { brain, decisionHz = 30 } = options;
  const source = options.profile ?? standardProfile;
  if (source.id !== standardProfile.id)
    throw Error('Unknown perception profile');
  const profile = defineProfile(source.rays, source.hz);
  const sensorPeriod = period(profile.hz),
    decisionPeriod = period(decisionHz),
    channels = registry(profile);
  if (
    vehicle.definition.id !== 'gt-01' ||
    brain.signature !== signature(vehicle, profile, decisionHz)
  )
    throw Error('Incompatible model for ' + vehicle.id);
  return (
    index: number,
    state: VehicleState,
    others: Polygon[],
    old: AiState | undefined,
    trace: boolean,
  ): AiState => {
    try {
      const observation =
        !old || index % sensorPeriod === 0
          ? observe(
              track,
              walls,
              others,
              vehicle,
              state,
              index,
              profile,
              channels,
            )
          : old.observation;
      if (old && index % decisionPeriod !== 0)
        return old.observation === observation ? old : { ...old, observation };
      const { output, layers } = brain.evaluate(observation.values, trace);
      return {
        observation,
        decisionTick: index,
        inputTick: observation.index,
        decisionInput: trace ? observation.values : undefined,
        output,
        layers,
        target: targets(output, old?.target.direction),
      };
    } catch (cause) {
      throw new Error(
        'AI ' +
          vehicle.id +
          ' seed ' +
          brain.seed +
          ' frame ' +
          index +
          ': ' +
          String(cause),
        { cause },
      );
    }
  };
}
