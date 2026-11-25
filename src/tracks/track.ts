import { dot, headingAxes, normalizeAngle, type Vector2 } from '../core/math';
import { requireFinite } from '../core/validation';
import type { SurfaceQuery } from '../physics/surface';

type Piece =
  | { kind: 'line'; length: number }
  | { kind: 'arc'; radius: number; turnRad: number };
export interface TrackDefinition {
  schema: 1;
  id: string;
  name: string;
  origin: Vector2;
  heading: number;
  pieces: readonly Piece[];
  width: number;
  runoff: number;
  barrierThickness: number;
  startDistance: number;
  gateCount: number;
  grid: { behind: number; columnGap: number; rowGap: number; stagger: number };
  colors: { grass: number; asphalt: number; curb: number };
}
const quarter: Piece = { kind: 'arc', radius: 35, turnRad: -Math.PI / 2 };
export const academy: TrackDefinition = {
  schema: 1,
  id: 'academy',
  name: 'Academy Training Circuit',
  origin: { x: -75, y: 70 },
  heading: 0,
  pieces: [
    { kind: 'line', length: 150 },
    quarter,
    { kind: 'line', length: 70 },
    quarter,
    { kind: 'line', length: 150 },
    quarter,
    { kind: 'line', length: 70 },
    quarter,
  ],
  width: 12,
  runoff: 8,
  barrierThickness: 0.3,
  startDistance: 75,
  gateCount: 8,
  grid: { behind: 8, columnGap: 4, rowGap: 10, stagger: 5 },
  colors: { grass: 0x405d42, asphalt: 0x393e44, curb: 0xdc563b },
};
export const shift = (p: Vector2, v: Vector2, d: number): Vector2 => ({
  x: p.x + v.x * d,
  y: p.y + v.y * d,
});
export const difference = (a: Vector2, b: Vector2): Vector2 => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
export function wrap(n: number, total: number) {
  return ((n % total) + total) % total;
}
interface Segment {
  start: Vector2;
  heading: number;
  curvature: number;
  length: number;
  offset: number;
}
function at(seg: Segment, t: number) {
  const heading = seg.heading + seg.curvature * t;
  const { forward: tangent, left: normal } = headingAxes(heading);
  const position =
    seg.curvature === 0
      ? shift(seg.start, tangent, t)
      : {
          x:
            seg.start.x +
            (Math.sin(heading) - Math.sin(seg.heading)) / seg.curvature,
          y:
            seg.start.y +
            (Math.cos(seg.heading) - Math.cos(heading)) / seg.curvature,
        };
  return { position, tangent, normal, heading: normalizeAngle(heading) };
}
function positive(v: number) {
  if (!(requireFinite(v, 'track dimension') > 0))
    throw Error('Expected positive track dimension');
  return v;
}
export interface Barrier {
  id: string;
  a: Vector2;
  b: Vector2;
  outerA: Vector2;
  outerB: Vector2;
}
function intersects(a: Vector2, b: Vector2, c: Vector2, d: Vector2) {
  if (
    Math.max(a.x, b.x) < Math.min(c.x, d.x) ||
    Math.max(c.x, d.x) < Math.min(a.x, b.x) ||
    Math.max(a.y, b.y) < Math.min(c.y, d.y) ||
    Math.max(c.y, d.y) < Math.min(a.y, b.y)
  )
    return false;
  const side = (p: Vector2, q: Vector2, r: Vector2) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return (
    side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0
  );
}
export function createTrack(input: TrackDefinition = academy) {
  // Copy flat records so caller-owned data cannot change the compiled geometry.
  const def = {
    ...input,
    origin: { ...input.origin },
    pieces: input.pieces.map((p) => ({ ...p })),
    grid: { ...input.grid },
    colors: { ...input.colors },
  };
  if (
    def.schema !== 1 ||
    !def.id.trim() ||
    !def.name.trim() ||
    !Number.isSafeInteger(def.gateCount) ||
    def.gateCount < 2 ||
    def.gateCount > 256
  )
    throw Error('Invalid track header');
  for (const v of [
    def.width,
    def.runoff,
    def.barrierThickness,
    ...Object.values(def.grid),
  ])
    positive(v);
  for (const value of Object.values(def.colors))
    if (!Number.isInteger(value) || value < 0 || value > 0xffffff)
      throw Error('Invalid track color');
  const edge = def.width / 2 + def.runoff;
  let length = 0,
    start = def.origin,
    heading = def.heading;
  const segments: Segment[] = [];
  for (const p of def.pieces) {
    if (p.kind !== 'line' && p.kind !== 'arc')
      throw Error('Invalid segment kind');
    const curvature =
      p.kind === 'line' ? 0 : Math.sign(p.turnRad) / positive(p.radius);
    if (
      p.kind === 'arc' &&
      (p.radius <= edge + def.barrierThickness || Math.abs(p.turnRad) > Math.PI)
    )
      throw Error('Unsupported arc');
    const span = positive(
      p.kind === 'line' ? p.length : p.radius * Math.abs(p.turnRad),
    );
    const seg = { start, heading, curvature, length: span, offset: length };
    segments.push(seg);
    const end = at(seg, span);
    start = end.position;
    heading = end.heading;
    length += span;
  }
  if (
    !segments.length ||
    length > 10000 ||
    Math.hypot(start.x - def.origin.x, start.y - def.origin.y) > 1e-7 ||
    Math.abs(normalizeAngle(heading - def.heading)) > 1e-7
  )
    throw Error('Track must close smoothly');
  if (!(def.startDistance >= 0 && def.startDistance < length))
    throw Error('Invalid start distance');
  function sample(s: number, lateral = 0) {
    const t = wrap(requireFinite(s, 'distance') + def.startDistance, length);
    const seg =
      segments.find((seg) => t < seg.offset + seg.length) ??
      segments[segments.length - 1];
    const pose = at(seg, t - seg.offset);
    return {
      ...pose,
      position: shift(
        pose.position,
        pose.normal,
        requireFinite(lateral, 'lateral offset'),
      ),
    };
  }
  function project(p: Vector2, hint?: number) {
    requireFinite(p.x, 'world x');
    requireFinite(p.y, 'world y');
    let best = Infinity,
      result = { s: 0, lateral: 0, distance: 0 };
    for (const seg of segments) {
      const { forward, left } = headingAxes(seg.heading);
      const delta = difference(p, seg.start);
      let t = dot(delta, forward);
      if (seg.curvature) {
        const k = seg.curvature;
        const angle = Math.atan2(
          k * dot(delta, forward),
          1 - k * dot(delta, left),
        );
        t = angle / k;
        if (
          t < 0 &&
          Math.hypot(
            p.x - at(seg, seg.length).position.x,
            p.y - at(seg, seg.length).position.y,
          ) < Math.hypot(delta.x, delta.y)
        )
          t = seg.length;
      }
      t = Math.max(0, Math.min(seg.length, t));
      const pose = at(seg, t),
        off = difference(p, pose.position),
        distance = Math.hypot(off.x, off.y);
      let s = wrap(seg.offset + t - def.startDistance, length);
      if (hint !== undefined) {
        s += Math.round((hint - s) / length) * length;
        if (Math.abs(s - hint) > length / 4) continue;
      }
      if (distance < best) {
        best = distance;
        result = { s, lateral: dot(off, pose.normal), distance };
      }
    }
    if (!Number.isFinite(best)) throw Error('No local projection');
    return result;
  }
  const stations = segments.flatMap((seg) => {
    const maxStep = seg.curvature
      ? Math.min(
          1 / (1 + Math.abs(seg.curvature) * (edge + def.barrierThickness)),
          (2 *
            Math.acos(
              1 -
                0.02 /
                  (1 / Math.abs(seg.curvature) + edge + def.barrierThickness),
            )) /
            Math.abs(seg.curvature),
        )
      : 1;
    const count = Math.ceil(seg.length / maxStep);
    return Array.from(
      { length: count },
      (_, i) => seg.offset - def.startDistance + (seg.length * i) / count,
    );
  });
  const barriers: Barrier[] = [];
  for (const side of [-1, 1]) {
    const inner = stations.map((s) => sample(s, side * edge).position),
      outer = stations.map(
        (s) => sample(s, side * (edge + def.barrierThickness)).position,
      );
    for (let i = 0; i < stations.length; i++) {
      const j = (i + 1) % stations.length;
      for (let k = i + 2; k < inner.length; k++)
        if (
          (k + 1) % inner.length !== i &&
          intersects(
            inner[i],
            inner[j],
            inner[k],
            inner[(k + 1) % inner.length],
          )
        )
          throw Error('Self-intersecting track boundary');
      barriers.push({
        id: `wall-${side}-${i}`,
        a: inner[i],
        b: inner[j],
        outerA: outer[i],
        outerB: outer[j],
      });
    }
  }
  const surfaceQuery: SurfaceQuery = (p) =>
    project(p).distance <= def.width / 2 + 1e-9 ? 'asphalt' : 'grass';
  const gates = Array.from({ length: def.gateCount }, (_, i) =>
    sample((i * length) / def.gateCount),
  );
  return {
    def,
    length,
    sample,
    project,
    stations,
    barriers,
    gates,
    surfaceQuery,
  };
}
export type Track = ReturnType<typeof createTrack>;
