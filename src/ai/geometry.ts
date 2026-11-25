import { dot, type Vector2 } from '../core/math';
import { difference, shift, type Track } from '../tracks/track';
import { corners, type Footprint } from '../tracks/grid';
export const tolerance = 1e-8;
export type Ray = { origin: Vector2; direction: Vector2; range: number };
export type Body = Footprint & { id: string; velocity: Vector2 };
type Bounds = { xmin: number; xmax: number; ymin: number; ymax: number };
export type Polygon = Bounds & { points: Vector2[]; id: string; body?: Body };
export const cross = (a: Vector2, b: Vector2) => a.x * b.y - a.y * b.x;
export function bounds(points: readonly Vector2[]): Bounds {
  return {
    xmin: Math.min(...points.map((p) => p.x)),
    xmax: Math.max(...points.map((p) => p.x)),
    ymin: Math.min(...points.map((p) => p.y)),
    ymax: Math.max(...points.map((p) => p.y)),
  };
}
export const overlaps = (a: Bounds, b: Bounds) =>
  a.xmin <= b.xmax + tolerance &&
  a.xmax >= b.xmin - tolerance &&
  a.ymin <= b.ymax + tolerance &&
  a.ymax >= b.ymin - tolerance;
export function polygon(id: string, points: Vector2[], body?: Body): Polygon {
  return { ...bounds(points), id, points, body };
}
export const obstacle = (body: Body) => polygon(body.id, corners(body), body);
interface Node {
  box: Bounds;
  leaves?: Polygon[];
  children?: Node[];
}
function tree(items: Polygon[]): Node {
  const box = {
    xmin: Infinity,
    xmax: -Infinity,
    ymin: Infinity,
    ymax: -Infinity,
  };
  for (const p of items) {
    box.xmin = Math.min(box.xmin, p.xmin);
    box.ymin = Math.min(box.ymin, p.ymin);
    box.xmax = Math.max(box.xmax, p.xmax);
    box.ymax = Math.max(box.ymax, p.ymax);
  }
  if (items.length <= 8) return { box, leaves: items };
  const key = box.xmax - box.xmin > box.ymax - box.ymin ? 'xmin' : 'ymin';
  items.sort((a, b) => a[key] - b[key]);
  const mid = items.length >> 1;
  return { box, children: [tree(items.slice(0, mid)), tree(items.slice(mid))] };
}
export function wallIndex(track: Track) {
  const all = track.barriers.map((w) =>
    polygon(w.id, [w.a, w.b, w.outerB, w.outerA]),
  );
  const root = tree(all.slice());
  return {
    all,
    roadBoundaries: compileRoadBoundaries(track),
    query(box: Bounds) {
      const hits: Polygon[] = [];
      function visit(n: Node) {
        if (!overlaps(box, n.box)) return;
        if (n.leaves) {
          for (const p of n.leaves) if (overlaps(box, p)) hits.push(p);
        } else n.children?.forEach(visit);
      }
      visit(root);
      return hits;
    },
  };
}
function segment(ray: Ray, a: Vector2, b: Vector2) {
  const e = difference(b, a),
    v = difference(a, ray.origin),
    denom = cross(ray.direction, e);
  if (Math.abs(denom) < 1e-12) {
    if (Math.abs(cross(v, ray.direction)) > 1e-10) return Infinity;
    const s = dot(v, ray.direction),
      t = dot(difference(b, ray.origin), ray.direction);
    return Math.max(s, t) >= 0 ? Math.max(0, Math.min(s, t)) : Infinity;
  }
  const t = cross(v, e) / denom,
    u = cross(v, ray.direction) / denom;
  return t >= -1e-10 && u >= -1e-10 && u <= 1 + 1e-10
    ? Math.max(0, t)
    : Infinity;
}
export function hit(ray: Ray, p: Polygon) {
  let near = Infinity,
    pos = false,
    neg = false;
  for (let i = 0; i < p.points.length; i++) {
    const a = p.points[i],
      b = p.points[(i + 1) % p.points.length],
      side = cross(difference(b, a), difference(ray.origin, a));
    pos ||= side > 1e-10;
    neg ||= side < -1e-10;
    near = Math.min(near, segment(ray, a, b));
  }
  return pos && neg ? near : 0;
}
type RoadBoundary =
  | { kind: 'line'; a: Vector2; b: Vector2 }
  | {
      kind: 'arc';
      center: Vector2;
      radius: number;
      tangent: Vector2;
      normal: Vector2;
      curvature: number;
      length: number;
    };

function compileRoadBoundaries(track: Track) {
  const edges: RoadBoundary[] = [];
  for (const piece of track.segments) {
    const start = track.sample(piece.offset - track.def.startDistance);
    for (const side of [-track.def.width / 2, track.def.width / 2]) {
      if (piece.curvature === 0) {
        const a = shift(start.position, start.normal, side);
        edges.push({
          kind: 'line',
          a,
          b: shift(a, start.tangent, piece.length),
        });
      } else {
        edges.push({
          kind: 'arc',
          center: shift(start.position, start.normal, 1 / piece.curvature),
          radius: Math.abs(1 / piece.curvature - side),
          tangent: start.tangent,
          normal: start.normal,
          curvature: piece.curvature,
          length: piece.length,
        });
      }
    }
  }
  return edges;
}

// The exhaustive path reconstructs the primitives. The indexed path reuses track geometry.
export function roadEdges(
  track: Track,
  ray: Ray,
  edges: readonly RoadBoundary[] = compileRoadBoundaries(track),
) {
  const roots: number[] = [];
  for (const edge of edges) {
    if (edge.kind === 'line') {
      roots.push(segment(ray, edge.a, edge.b));
      continue;
    }
    const v = difference(ray.origin, edge.center),
      b = dot(v, ray.direction),
      disc = b * b - dot(v, v) + edge.radius * edge.radius;
    if (disc < 0) continue;
    const root = Math.sqrt(disc);
    for (const t of [-b - root, -b + root]) {
      const delta = difference(
        shift(ray.origin, ray.direction, t),
        edge.center,
      );
      const angle = Math.atan2(
        edge.curvature * dot(delta, edge.tangent),
        -edge.curvature * dot(delta, edge.normal),
      );
      const station = angle / edge.curvature;
      if (station >= -tolerance && station <= edge.length + tolerance)
        roots.push(t);
    }
  }
  return roots
    .filter(
      (t) =>
        Number.isFinite(t) && t >= -tolerance && t <= ray.range + tolerance,
    )
    .sort((a, b) => a - b)
    .filter((v, i, a) => i === 0 || v - a[i - 1] > tolerance);
}
export function measure(
  track: Track,
  index: ReturnType<typeof wallIndex>,
  ray: Ray,
  others: Polygon[],
  reference = false,
) {
  const box = bounds([ray.origin, shift(ray.origin, ray.direction, ray.range)]);
  const candidates = reference ? index.all : index.query(box);
  let wall = Infinity,
    car = Infinity;
  let seen: Body | undefined;
  for (const p of candidates) wall = Math.min(wall, hit(ray, p));
  for (const p of others) {
    const t = hit(ray, p);
    if (t < car || (t === car && p.id < (seen?.id ?? ''))) {
      car = t;
      seen = p.body;
    }
  }
  const barrier =
    wall <= ray.range + tolerance && wall <= car + tolerance
      ? Math.min(wall, ray.range)
      : null;
  const vehicle =
    barrier === null && car <= ray.range + tolerance
      ? Math.min(car, ray.range)
      : null;
  const limit = barrier ?? vehicle ?? Infinity;
  let edge: number | null = null,
    material: string | null = null;
  // Neighboring roots delimit intervals of constant material. Include both sides of
  // the range endpoints so a zero-distance or maximum-range crossing can be classified.
  const probeSpan = 1;
  const extended = {
    ...ray,
    origin: shift(ray.origin, ray.direction, -probeSpan),
    range: ray.range + 2 * probeSpan,
  };
  const roots = roadEdges(
    track,
    extended,
    reference ? undefined : index.roadBoundaries,
  ).map((t) => t - probeSpan);
  for (let i = 0; i < roots.length; i++) {
    if (roots[i] < -tolerance) continue;
    if (roots[i] > ray.range + tolerance) break;
    const t = Math.max(0, Math.min(ray.range, roots[i]));
    if (t >= limit - tolerance) break;
    const beforeGap = Math.min(
      probeSpan,
      (t - (roots[i - 1] ?? -Infinity)) / 2,
      t > tolerance ? t : Infinity,
    );
    const remaining = Math.min(limit, ray.range) - t;
    const afterGap = Math.min(
      probeSpan,
      ((roots[i + 1] ?? Infinity) - t) / 2,
      remaining > tolerance ? remaining / 2 : Infinity,
    );
    const before = track.surfaceQuery(
      shift(ray.origin, ray.direction, t - beforeGap),
    );
    const after = track.surfaceQuery(
      shift(ray.origin, ray.direction, t + afterGap),
    );
    if (before !== after) {
      edge = t;
      if (remaining > tolerance) material = after;
      break;
    }
  }
  return {
    ...ray,
    barrier,
    vehicle,
    edge,
    material,
    seen: vehicle === null ? undefined : seen,
  };
}
