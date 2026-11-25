import { dot, type Vector2 } from '../core/math';
import { difference, shift, type Track } from './track';

export interface Travel {
  from: Vector2;
  to: Vector2;
  startTime: number;
  endTime: number;
}
export interface LapState {
  s: number;
  next: number;
  valid: boolean;
  started: number | null;
  last: number | null;
  laps: number;
  certified: number;
}
export const initialLap = (s: number): LapState => ({
  s,
  next: 0,
  valid: false,
  started: null,
  last: null,
  laps: 0,
  certified: 0,
});
export function invalidateLap(lap: LapState, s: number): LapState {
  return { ...lap, s, valid: false, started: null, next: 0, certified: 0 };
}
export function recordTravel(
  track: Track,
  prior: LapState,
  move: Travel,
): LapState {
  if (
    !Number.isFinite(move.startTime) ||
    !Number.isFinite(move.endTime) ||
    move.endTime < move.startTime
  )
    throw Error('Invalid travel time');
  const delta = difference(move.to, move.from),
    distance = Math.hypot(delta.x, delta.y);
  let result = { ...prior };
  // Walk long segments locally to unwrap the seam and detect shortcuts through the infield.
  const count = Math.max(1, Math.ceil(distance));
  if (count > track.length)
    return invalidateLap(prior, track.project(move.to).s);
  for (let i = 1; i <= count; i++) {
    const projection = track.project(
      shift(move.from, delta, i / count),
      result.s,
    );
    result.s = projection.s;
    if (projection.distance > track.def.width / 2 + track.def.runoff + 1e-7)
      return invalidateLap(result, track.project(move.to, result.s).s);
  }
  const hits = track.gates
    .flatMap((g, index) => {
      const a = dot(difference(move.from, g.position), g.tangent),
        b = dot(difference(move.to, g.position), g.tangent);
      if (!((a < 0 && b >= 0) || (a >= 0 && b < 0))) return [];
      const t = a / (a - b),
        p = shift(move.from, delta, t);
      return Math.abs(dot(difference(p, g.position), g.normal)) <=
        track.def.width / 2
        ? [{ index, t, forward: b > a }]
        : [];
    })
    .sort((a, b) => a.t - b.t);
  for (const h of hits) {
    if (!h.forward) {
      result = invalidateLap(result, result.s);
      continue;
    }
    const time = move.startTime + (move.endTime - move.startTime) * h.t;
    if (h.index === 0) {
      if (result.valid && result.next === 0 && result.started !== null) {
        result.last = time - result.started;
        result.laps++;
      }
      result = { ...result, next: 1, started: time, valid: true, certified: 0 };
    } else if (result.valid && h.index === result.next) {
      result.certified = (h.index * track.length) / track.gates.length;
      result.next = (h.index + 1) % track.gates.length;
    } else result = invalidateLap(result, result.s);
  }
  return result;
}
