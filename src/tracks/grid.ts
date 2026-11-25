import { headingAxes, type Vector2 } from '../core/math';
import { shift, type Track } from './track';
export interface Pose {
  position: Vector2;
  heading: number;
}
export interface Footprint extends Pose {
  lengthM: number;
  widthM: number;
}
export function corners(body: Footprint) {
  const { forward, left } = headingAxes(body.heading);
  if (!(
    Number.isFinite(body.lengthM) &&
    Number.isFinite(body.widthM) &&
    body.lengthM > 0 &&
    body.widthM > 0
  ))
    throw Error('Invalid body dimensions');
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([x, y]) =>
    shift(
      shift(body.position, forward, (x * body.lengthM) / 2),
      left,
      (y * body.widthM) / 2,
    ),
  );
}
export function safePose(
  track: Track,
  body: Footprint,
  occupied: readonly Footprint[],
) {
  const radius = Math.hypot(body.lengthM, body.widthM) / 2;
  return (
    corners(body).every((p) => track.surfaceQuery(p) === 'asphalt') &&
    occupied.every(
      (other) =>
        Math.hypot(
          other.position.x - body.position.x,
          other.position.y - body.position.y,
        ) >
        radius + Math.hypot(other.lengthM, other.widthM) / 2,
    )
  );
}
export function startGrid(
  track: Track,
  count: number,
  lengthM: number,
  widthM: number,
) {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > track.length / track.def.grid.stagger
  )
    throw Error('Invalid grid size');
  const result: Footprint[] = [];
  const grid = track.def.grid;
  for (let i = 0; i < count; i++) {
    const odd = i % 2;
    const pose = track.sample(
      -grid.behind - Math.floor(i / 2) * grid.rowGap - odd * grid.stagger,
      count === 1 ? 0 : (odd - 0.5) * grid.columnGap,
    );
    const body = {
      position: pose.position,
      heading: pose.heading,
      lengthM,
      widthM,
    };
    if (!safePose(track, body, result)) throw Error('Unsafe grid position');
    result.push(body);
  }
  return result;
}
export interface SafePosition extends Footprint {
  s: number;
}
export function recoveryCandidate(
  track: Track,
  history: readonly SafePosition[],
  currentS: number,
  occupied: readonly Footprint[],
) {
  for (let i = history.length - 1; i >= 0; i--) {
    const p = history[i];
    if (p.s <= currentS + 1e-8 && safePose(track, p, occupied)) return p;
  }
  return null;
}
