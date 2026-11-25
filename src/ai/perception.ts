import { dot, headingAxes } from '../core/math';
import type { Vehicle, VehicleState } from '../vehicles/vehicle';
import { sampleAxles } from '../physics/surface';
import { difference, type Track } from '../tracks/track';
import { rayPose, standardProfile } from './profile';
import { measure, type Polygon, type wallIndex } from './geometry';
import { preview } from './preview';
import { normalize, registry } from './schema';
export function observe(
  track: Track,
  walls: ReturnType<typeof wallIndex>,
  others: Polygon[],
  vehicle: Vehicle,
  state: VehicleState,
  index: number,
  profile = standardProfile,
  channels = registry(profile),
  reference = false,
) {
  const p = state.positionM,
    h = state.headingRad,
    v = state.velocityMps,
    axes = headingAxes(h);
  const axles = sampleAxles(vehicle, state, axes.forward, track.surfaceQuery);
  const raw = [
    Math.hypot(v.x, v.y),
    dot(v, axes.forward),
    dot(v, axes.left),
    state.yawRateRadPerSecond,
    state.steeringAngleRad,
    state.drive.direction === 'forward' ? 1 : -1,
  ];
  for (const a of [axles.front, axles.rear])
    raw.push(
      Number(a.state.surface === 'asphalt'),
      Number(a.state.surface === 'grass'),
      a.profile.friction,
    );
  const rays = profile.rays.map((s) =>
    measure(track, walls, rayPose(s, p, h), others, reference),
  );
  for (const r of rays) {
    for (const value of [r.edge, r.barrier, r.vehicle])
      raw.push(value ?? 0, Number(value !== null));
    raw.push(
      Number(r.material === 'asphalt'),
      Number(r.material === 'grass'),
      Number(r.material !== null),
    );
  }
  const { local, points } = preview(track, walls, others, p, h);
  const relative = (heading: number) => [
    Math.sin(heading - h),
    Math.cos(heading - h),
  ];
  raw.push(
    ...(local ? [local.offset, ...relative(local.heading), 1] : [0, 0, 0, 0]),
  );
  for (const point of points) {
    if (!point) {
      raw.push(0, 0, 0, 0, 0, 0, 0, 0);
      continue;
    }
    const delta = difference(point.position, p);
    raw.push(
      dot(delta, axes.forward),
      dot(delta, axes.left),
      1,
      ...(point.heading === null ? [0, 0, 0] : [...relative(point.heading), 1]),
      point.curvature ?? 0,
      Number(point.curvature !== null),
    );
  }
  const detected = new Map(
    rays.flatMap((r) => (r.seen ? [[r.seen.id, r.seen] as const] : [])),
  );
  const slots = [...detected.values()]
    .map((body) => {
      const dp = difference(body.position, p),
        dv = difference(body.velocity, v);
      return [
        1,
        dot(dp, axes.forward),
        dot(dp, axes.left),
        dot(dv, axes.forward),
        dot(dv, axes.left),
        ...relative(body.heading),
        Math.hypot(dp.x, dp.y),
      ];
    })
    .sort((a, b) => {
      for (const i of [7, 1, 2, 3, 4, 5, 6])
        if (a[i] !== b[i]) return a[i] - b[i];
      return 0;
    });
  for (let i = 0; i < 4; i++)
    raw.push(...(slots[i] ?? [0, 0, 0, 0, 0, 0, 0, 0]));
  return {
    index,
    raw,
    ...normalize(raw, channels),
    rays: rays.map((r) => ({
      origin: r.origin,
      direction: r.direction,
      range: r.range,
      edge: r.edge,
      barrier: r.barrier,
      vehicle: r.vehicle,
      material: r.material,
    })),
    points,
  };
}
