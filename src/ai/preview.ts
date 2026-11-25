import { GT_01 } from '../vehicles/vehicleDefinition';
import { dot, headingAxes, type Vector2 } from '../core/math';
import { shift, difference, wrap, type Track } from '../tracks/track';
import {
  bounds,
  overlaps,
  tolerance,
  type Polygon,
  type wallIndex,
} from './geometry';
export const distances = Object.freeze([5, 10, 20, 40, 60, 100, 150]);
type Point = {
  position: Vector2;
  heading: number | null;
  curvature: number | null;
};
// The swept sight triangle is expanded by the maximum chord error. Separating axes from both polygons suffice.
function separated(triangle: Vector2[], p: Polygon, pad: number) {
  for (const shape of [triangle, p.points]) {
    for (let i = 0; i < shape.length; i++) {
      const e = difference(shape[(i + 1) % shape.length], shape[i]);
      const length = Math.hypot(e.x, e.y);
      if (length < 1e-12) continue;
      const n = { x: -e.y / length, y: e.x / length };
      const a = triangle.map((v) => dot(n, v)),
        b = p.points.map((v) => dot(n, v));
      if (
        Math.min(...a) > Math.max(...b) + pad ||
        Math.min(...b) > Math.max(...a) + pad
      )
        return true;
    }
  }
  return false;
}
export function preview(
  track: Track,
  index: ReturnType<typeof wallIndex>,
  others: Polygon[],
  position: Vector2,
  heading: number,
) {
  const axes = headingAxes(heading),
    eye = shift(position, axes.forward, 2.2);
  const points: (Point | null)[] = distances.map(() => null);
  function clear(origin: Vector2, a: Vector2, b: Vector2, pad: number) {
    const triangle = [origin, a, b],
      box = bounds(triangle);
    pad += tolerance;
    box.xmin -= pad;
    box.xmax += pad;
    box.ymin -= pad;
    box.ymax += pad;
    return [
      ...index.query(box),
      ...others.filter((p) => overlaps(box, p)),
    ].every((p) => separated(triangle, p, pad));
  }
  const possibles = [];
  for (const s of track.segments) {
    const delta = difference(position, s.start),
      frame = headingAxes(s.heading);
    const t = s.curvature
      ? Math.atan2(
          s.curvature * dot(delta, frame.forward),
          1 - s.curvature * dot(delta, frame.left),
        ) / s.curvature
      : dot(delta, frame.forward);
    const start = s.offset - track.def.startDistance,
      station = start + Math.max(0, Math.min(s.length, t)),
      sample = track.sample(station);
    const v = difference(position, sample.position),
      distance = Math.hypot(v.x, v.y);
    if (distance <= 12 && clear(position, position, sample.position, 0))
      possibles.push({ station, sample, distance });
  }
  possibles.sort((a, b) => a.distance - b.distance);
  const anchor = possibles[0];
  if (!anchor) return { local: null, points };
  const align = dot(anchor.sample.tangent, axes.forward);
  if (
    Math.abs(align) < tolerance ||
    possibles.some(
      (p) =>
        Math.abs(p.distance - anchor.distance) < tolerance &&
        Math.hypot(
          p.sample.position.x - anchor.sample.position.x,
          p.sample.position.y - anchor.sample.position.y,
        ) > tolerance,
    )
  )
    return { local: null, points };
  const sign = Math.sign(align),
    start = anchor.station;
  const sample = (d: number) => track.sample(start + sign * d);
  // Orientation requires a visible tangent neighborhood, even when the anchor itself is visible.
  const before = sample(-0.25).position,
    after = sample(0.25).position;
  if (
    !clear(
      position,
      before,
      anchor.sample.position,
      0.25 ** 2 / (4 * track.def.width),
    ) ||
    !clear(
      position,
      anchor.sample.position,
      after,
      0.25 ** 2 / (4 * track.def.width),
    )
  )
    return { local: null, points };
  const local = {
    heading: anchor.sample.heading + (sign < 0 ? Math.PI : 0),
    offset:
      sign *
      dot(difference(position, anchor.sample.position), anchor.sample.normal),
  };
  const curvature = (d: number) => {
    const s = wrap(start + sign * d + track.def.startDistance, track.length);
    return (
      (track.segments.find((v) => s < v.offset + v.length) ?? track.segments[0])
        .curvature * sign
    );
  };
  function certify(lo: number, hi: number, depth = 0): boolean {
    const a = sample(lo).position,
      b = sample(hi).position;
    // Intervals are split at every join. The bound on chord error is |curvature| * length² / 8.
    const k = Math.abs(curvature((lo + hi) / 2)),
      pad = (k * (hi - lo) ** 2) / 8;
    const deltaA = difference(a, eye),
      deltaB = difference(b, eye);
    const minProjection =
      Math.min(dot(deltaA, axes.forward), dot(deltaB, axes.forward)) - pad;
    // Local orientation covers the short connection under the nose. Occlusion is still checked from the eye.
    const near =
      hi <= distances[0] &&
      [a, b].every((p) => {
        const local = difference(p, position);
        return (
          Math.abs(dot(local, axes.forward)) + pad <= GT_01.lengthM / 2 &&
          Math.abs(dot(local, axes.left)) + pad <= GT_01.widthM / 2
        );
      });
    const inRange =
      Math.max(Math.hypot(deltaA.x, deltaA.y), Math.hypot(deltaB.x, deltaB.y)) +
        pad <=
      150 + tolerance;
    if (
      (minProjection >= -tolerance || near) &&
      inRange &&
      clear(eye, a, b, pad) &&
      (!near || clear(position, a, b, pad))
    )
      return true;
    if (depth >= 12 || hi - lo < 0.005) return false;
    const mid = (hi + lo) / 2;
    return certify(lo, mid, depth + 1) && certify(mid, hi, depth + 1);
  }
  // Certify straight intervals with zero chord error, including endpoints on the sight plane.
  function visible(lo: number, hi: number): boolean {
    const cuts = [lo, hi];
    if (lo < 2.2 && hi > 2.2) cuts.push(2.2);
    for (const seg of track.segments) {
      const d = wrap(
        sign * (seg.offset - track.def.startDistance - start),
        track.length,
      );
      if (d > lo && d < hi) cuts.push(d);
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i];
      if (!certify(a, b)) return false;
    }
    return true;
  }
  let last = 0;
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i];
    if (!visible(last, d)) break;
    const target = sample(d),
      neighborhood = visible(d - 0.5, d + 0.5);
    const delta = difference(target.position, eye);
    if (
      dot(delta, axes.forward) < -tolerance ||
      Math.hypot(delta.x, delta.y) > 150 + tolerance
    )
      break;
    points[i] = {
      position: target.position,
      heading: neighborhood ? target.heading + (sign < 0 ? Math.PI : 0) : null,
      curvature:
        neighborhood && curvature(d - 0.5) === curvature(d + 0.5)
          ? curvature(d)
          : null,
    };
    last = d;
  }
  return { local, points };
}
