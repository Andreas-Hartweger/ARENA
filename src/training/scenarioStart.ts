import { bounds, overlaps, sat, wallShape } from '../collision/contact';
import { headingAxes, normalizeAngle } from '../core/math';
import { corners, type Footprint } from '../tracks/grid';
import type { Track } from '../tracks/track';
import { GT_01 } from '../vehicles/vehicleDefinition';
import { bounded } from './fitness';

export interface ScenarioStart {
  version: 1;
  kind: 'road' | 'recovery';
  stationM: number;
  lateralM: number;
  headingRad: number;
  speedMps: number;
}

export function startState(track: Track, start: ScenarioStart) {
  if (
    !start ||
    start.version !== 1 ||
    !['road', 'recovery'].includes(start.kind) ||
    Object.keys(start).some(
      (key) =>
        ![
          'version',
          'kind',
          'stationM',
          'lateralM',
          'headingRad',
          'speedMps',
        ].includes(key),
    )
  )
    throw Error('Invalid scenario start');
  const recovery = start.kind === 'recovery',
    outer = track.def.width / 2 + track.def.runoff;
  bounded(start.stationM, -track.length / 4, -0.001, 'start station');
  bounded(start.lateralM, -outer, outer, 'start lateral offset');
  bounded(
    start.headingRad,
    recovery ? -Math.PI : -Math.PI / 6,
    recovery ? Math.PI : Math.PI / 6,
    'start heading',
  );
  bounded(start.speedMps, 0, 10, 'initial speed');
  const sampled = track.sample(start.stationM, start.lateralM),
    heading = normalizeAngle(sampled.heading + start.headingRad);
  const body: Footprint = {
    position: sampled.position,
    heading,
    lengthM: GT_01.lengthM,
    widthM: GT_01.widthM,
  };
  const polygon = corners(body),
    box = bounds(polygon);
  const projection = track.project(body.position, start.stationM);
  if (
    Math.abs(projection.s - start.stationM) > 1e-7 ||
    Math.abs(projection.lateral - start.lateralM) > 1e-7 ||
    polygon.some((p) => {
      const loc = track.project(p, start.stationM);
      return (
        loc.s >= 0 || loc.distance > (recovery ? outer : track.def.width / 2)
      );
    }) ||
    track.barriers.some((w) => {
      const wall = wallShape(w);
      return overlaps(box, bounds(wall)) && sat(polygon, wall) !== null;
    })
  )
    throw Error('Invalid physical start footprint');
  const { forward } = headingAxes(heading);
  return {
    positionM: body.position,
    headingRad: heading,
    velocityMps: {
      x: forward.x * start.speedMps,
      y: forward.y * start.speedMps,
    },
  };
}
