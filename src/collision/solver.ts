import { normalizeAngle, type Vector2 } from '../core/math';
import { TICK_SECONDS } from '../core/ticks';
import { corners } from '../tracks/grid';
import { shift, type Barrier } from '../tracks/track';
import type { Travel } from '../tracks/progress';
import {
  bounds,
  mayCross,
  overlaps,
  respond,
  sat,
  sweptBounds,
  wallShape,
  type Body,
} from './contact';
export interface CollisionEvent {
  tick: number;
  a: string;
  b: string;
  point: Vector2;
  normal: Vector2;
  normalSpeed: number;
  impulse: number;
}
export function compileWalls(barriers: readonly Barrier[]) {
  return barriers.map((w) => {
    const shape = wallShape(w);
    return { id: w.id, shape, box: bounds(shape) };
  });
}
export function solveContacts(
  bodies: Body[],
  walls: ReturnType<typeof compileWalls>,
  tick: number,
  shared = true,
): { events: CollisionEvent[]; paths: Travel[][]; fallback: boolean } {
  if (!shared && bodies.length > 1) {
    const results = bodies.map((body) => solveContacts([body], walls, tick));
    return {
      events: results.flatMap((r) => r.events),
      paths: results.map((r) => r.paths[0]),
      fallback: results.some((r) => r.fallback),
    };
  }
  const events: CollisionEvent[] = [],
    paths = bodies.map(() => [] as Travel[]);
  let fallback = false,
    elapsed = 0;
  const base = (tick - 1) * TICK_SECONDS;
  for (let step = 0; elapsed < TICK_SECONDS - 1e-12; step++) {
    const remaining = TICK_SECONDS - elapsed;
    const envelopes = bodies.map((b) => sweptBounds(b, remaining));
    const candidates = bodies.flatMap((a, i) => {
      const pairs: { i: number; j: number; wall: number }[] = [];
      walls.forEach((w, k) => {
        if (overlaps(envelopes[i], w.box)) pairs.push({ i, j: -1, wall: k });
      });
      if (shared)
        for (let j = i + 1; j < bodies.length; j++)
          if (overlaps(envelopes[i], envelopes[j]))
            pairs.push({ i, j, wall: -1 });
      return pairs;
    });
    const maxSpeed = Math.max(
      0,
      ...bodies.map(
        (b) =>
          Math.hypot(b.velocity.x, b.velocity.y) +
          (Math.abs(b.yaw) * Math.hypot(b.widthM, b.lengthM)) / 2,
      ),
    );
    const dt = candidates.length
      ? Math.min(remaining, 0.1 / Math.max(1e-12, maxSpeed))
      : remaining;
    if (step >= 32) {
      fallback = true;
      break;
    }
    const acceptedEvents = events.length;
    const before = bodies.map((b) => ({ ...b }));
    bodies.forEach((b) => {
      b.position = shift(b.position, b.velocity, dt);
      b.heading = normalizeAngle(b.heading + b.yaw * dt);
    });
    const ends = bodies.map((b) => b.position);
    let ambiguous = false;
    for (let iter = 0; iter < 6; iter++) {
      let changed = false;
      for (const pair of candidates) {
        const { i, j, wall } = pair,
          a = bodies[i],
          b = bodies[j] ?? null;
        const target = b ? corners(b) : walls[wall].shape,
          c = sat(corners(a), target);
        if (!c) {
          if (iter === 0) {
            const oldTarget = b ? corners(before[j]) : target;
            if (
              !sat(corners(before[i]), oldTarget) &&
              mayCross(before[i], before[j] ?? null, oldTarget, dt)
            )
              ambiguous = true;
          }
          continue;
        }
        const impact = respond(a, b, c);
        changed ||= c.depth > 0.010001 || impact.impulse > 1e-6;
        const id = b?.id ?? walls[wall].id;
        if (
          impact.impulse > 0 &&
          impact.normalSpeed < -0.5 &&
          !events.some((ev) => ev.a === a.id && ev.b === id)
        )
          events.push({
            tick,
            a: a.id,
            b: id,
            point: c.point,
            normal: c.normal,
            ...impact,
          });
      }
      if (!changed) break;
    }
    if (
      ambiguous ||
      candidates.some(
        ({ i, j, wall }) =>
          (sat(
            corners(bodies[i]),
            j >= 0 ? corners(bodies[j]) : walls[wall].shape,
          )?.depth ?? 0) > 0.011,
      )
    ) {
      events.length = acceptedEvents;
      before.forEach((old, i) => Object.assign(bodies[i], old));
      fallback = true;
      break;
    }
    bodies.forEach((_, i) =>
      paths[i].push({
        from: before[i].position,
        to: ends[i],
        startTime: base + elapsed,
        endTime: base + elapsed + dt,
      }),
    );
    elapsed += dt;
  }
  if (fallback)
    for (const b of bodies) {
      b.velocity = { x: 0, y: 0 };
      b.yaw = 0;
    }
  return { events, paths, fallback };
}
