import { dot, type Vector2 } from '../core/math';
import { difference, shift, type Barrier } from '../tracks/track';
import { corners, type Footprint } from '../tracks/grid';
export interface Body extends Footprint {
  id: string;
  velocity: Vector2;
  yaw: number;
  invMass: number;
  invInertia: number;
}
export interface Contact {
  normal: Vector2;
  point: Vector2;
  depth: number;
}
export const cross = (a: Vector2, b: Vector2) => a.x * b.y - a.y * b.x;
function interval(poly: readonly Vector2[], axis: Vector2) {
  const v = poly.map((p) => dot(p, axis));
  return { min: Math.min(...v), max: Math.max(...v) };
}
function axes(poly: readonly Vector2[]) {
  return poly.map((p, i) => {
    const edge = difference(poly[(i + 1) % poly.length], p),
      length = Math.hypot(edge.x, edge.y);
    return { x: -edge.y / length, y: edge.x / length };
  });
}
export function sat(
  a: readonly Vector2[],
  b: readonly Vector2[],
): Contact | null {
  let depth = Infinity,
    normal = { x: 0, y: 0 };
  for (const axis of [...axes(a), ...axes(b)]) {
    const x = interval(a, axis),
      y = interval(b, axis),
      plus = x.max - y.min,
      minus = y.max - x.min;
    if (Math.min(plus, minus) < -1e-9) return null;
    if (Math.min(plus, minus) < depth) {
      depth = Math.min(plus, minus);
      normal = plus <= minus ? axis : { x: -axis.x, y: -axis.y };
    }
  }
  const tangent = { x: -normal.y, y: normal.x },
    da = interval(a, normal).max,
    db = interval(b, normal).min;
  const faceA = a.filter((p) => dot(p, normal) >= da - 1e-7),
    faceB = b.filter((p) => dot(p, normal) <= db + 1e-7);
  const x = interval(faceA, tangent),
    y = interval(faceB, tangent);
  const across = (Math.max(x.min, y.min) + Math.min(x.max, y.max)) / 2;
  const along = (da + db) / 2;
  return {
    normal,
    depth: Math.max(0, depth),
    point: {
      x: normal.x * along + tangent.x * across,
      y: normal.y * along + tangent.y * across,
    },
  };
}
export function wallShape(wall: Barrier) {
  return [wall.a, wall.b, wall.outerB, wall.outerA];
}
export function bounds(points: readonly Vector2[]) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export function sweptBounds(b: Body, dt: number) {
  const p = b.position,
    q = shift(p, b.velocity, dt),
    r = Math.hypot(b.lengthM, b.widthM) / 2;
  return {
    minX: Math.min(p.x, q.x) - r,
    maxX: Math.max(p.x, q.x) + r,
    minY: Math.min(p.y, q.y) - r,
    maxY: Math.max(p.y, q.y) + r,
  };
}
export function overlaps(
  a: ReturnType<typeof bounds>,
  b: ReturnType<typeof bounds>,
) {
  return (
    a.maxX >= b.minX && a.minX <= b.maxX && a.maxY >= b.minY && a.minY <= b.maxY
  );
}
// Intersect projected time intervals, inflating them by the maximum rotation travel.
export function mayCross(
  a: Body,
  b: Body | null,
  target: readonly Vector2[],
  dt: number,
) {
  const pa = corners(a),
    velocity = difference(a.velocity, b?.velocity ?? { x: 0, y: 0 });
  const pad =
    (dt *
      (Math.abs(a.yaw) * Math.hypot(a.lengthM, a.widthM) +
        (b ? Math.abs(b.yaw) * Math.hypot(b.lengthM, b.widthM) : 0))) /
    2;
  let enter = 0,
    exit = dt;
  for (const n of [...axes(pa), ...axes(target)]) {
    const x = interval(pa, n),
      y = interval(target, n),
      v = dot(velocity, n);
    const lo = y.min - x.max - pad,
      hi = y.max - x.min + pad;
    if (Math.abs(v) < 1e-12) {
      if (lo > 0 || hi < 0) return false;
      continue;
    }
    const t1 = lo / v,
      t2 = hi / v;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return false;
  }
  return true;
}
export function respond(a: Body, b: Body | null, c: Contact) {
  const { normal: n, point } = c,
    ra = difference(point, a.position),
    rb = b ? difference(point, b.position) : { x: 0, y: 0 };
  const rel = () =>
    difference(
      b
        ? { x: b.velocity.x - b.yaw * rb.y, y: b.velocity.y + b.yaw * rb.x }
        : { x: 0, y: 0 },
      { x: a.velocity.x - a.yaw * ra.y, y: a.velocity.y + a.yaw * ra.x },
    );
  const mass = a.invMass + (b?.invMass ?? 0);
  const denominator = (axis: Vector2) =>
    mass +
    cross(ra, axis) ** 2 * a.invInertia +
    cross(rb, axis) ** 2 * (b?.invInertia ?? 0);
  function impulse(axis: Vector2, j: number) {
    a.velocity = shift(a.velocity, axis, -j * a.invMass);
    a.yaw -= cross(ra, axis) * j * a.invInertia;
    if (b) {
      b.velocity = shift(b.velocity, axis, j * b.invMass);
      b.yaw += cross(rb, axis) * j * b.invInertia;
    }
  }
  const vn = dot(rel(), n),
    e = vn < -0.5 ? (b ? 0.1 : 0.15) : 0,
    j = Math.max(0, (-(1 + e) * vn) / denominator(n));
  if (j > 0) {
    impulse(n, j);
    const t = { x: -n.y, y: n.x },
      max = (b ? 0.25 : 0.3) * j;
    impulse(t, Math.max(-max, Math.min(max, -dot(rel(), t) / denominator(t))));
  }
  const correction = Math.min(0.25, Math.max(0, c.depth - 0.01)) / mass;
  a.position = shift(a.position, n, -correction * a.invMass);
  if (b) b.position = shift(b.position, n, correction * b.invMass);
  return { normalSpeed: vn, impulse: j };
}
