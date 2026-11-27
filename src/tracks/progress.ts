import { dot, type Vector2 } from '../core/math';
import { difference, shift, type Track } from './track';

export interface Travel {
  from: Vector2;
  to: Vector2;
  startTime: number;
  endTime: number;
}
export type TravelFact =
  | {
      kind: 'move';
      time: number;
      delta: number;
      distance: number;
      fromS: number;
      toS: number;
    }
  | { kind: 'invalidate'; time: number; uncreditedDistance?: number }
  | { kind: 'start'; time: number; station: number }
  | { kind: 'gate'; time: number; gate: number }
  | { kind: 'finish'; time: number; lapTime: number };
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
  facts?: TravelFact[],
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
  if (count > track.length) {
    facts?.push({
      kind: 'invalidate',
      time: move.startTime,
      uncreditedDistance: distance,
    });
    return invalidateLap(prior, track.project(move.to).s);
  }
  const probes = facts ? ([] as { t: number; s: number }[]) : undefined;
  // A solver correction may separate this travel's physical start from the last accepted end.
  let fraction = 0;
  let station = facts ? track.project(move.from, prior.s).s : 0;
  const emitMove = (t: number, s: number) => {
    if (facts && t > fraction)
      facts.push({
        kind: 'move',
        time: move.startTime + (move.endTime - move.startTime) * t,
        delta: s - station,
        distance: distance * (t - fraction),
        fromS: station,
        toS: s,
      });
    fraction = t;
    station = s;
  };
  for (let i = 1; i <= count; i++) {
    const projection = track.project(
      shift(move.from, delta, i / count),
      result.s,
    );
    const cuttingInside =
      projection.s > result.s + 1e-8 &&
      projection.lateral * projection.curvature > 0 &&
      projection.distance > track.def.width / 2 + 1e-7;
    result.s = projection.s;
    if (
      cuttingInside ||
      projection.distance > track.def.width / 2 + track.def.runoff + 1e-7
    ) {
      // The race validator rejects this travel before resolving its gates.
      facts?.push({
        kind: 'invalidate',
        time: move.startTime,
        uncreditedDistance: distance,
      });
      return invalidateLap(result, track.project(move.to, result.s).s);
    }
    probes?.push({ t: i / count, s: projection.s });
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
  let probe = 0;
  for (const h of hits) {
    if (probes) {
      while (probe < probes.length && probes[probe].t <= h.t) {
        const p = probes[probe++];
        emitMove(p.t, p.s);
      }
      if (h.t > fraction)
        emitMove(h.t, track.project(shift(move.from, delta, h.t), station).s);
    }
    const time = move.startTime + (move.endTime - move.startTime) * h.t;
    if (!h.forward) {
      facts?.push({ kind: 'invalidate', time });
      result = invalidateLap(result, result.s);
      continue;
    }
    if (h.index === 0) {
      if (result.valid && result.next === 0 && result.started !== null) {
        result.last = time - result.started;
        result.laps++;
        facts?.push({ kind: 'finish', time, lapTime: result.last });
      }
      result = { ...result, next: 1, started: time, valid: true, certified: 0 };
      facts?.push({ kind: 'start', time, station });
    } else if (result.valid && h.index === result.next) {
      result.certified = (h.index * track.length) / track.gates.length;
      facts?.push({ kind: 'gate', time, gate: h.index });
      result.next = (h.index + 1) % track.gates.length;
    } else {
      facts?.push({ kind: 'invalidate', time });
      result = invalidateLap(result, result.s);
    }
  }
  if (probes)
    for (; probe < probes.length; probe++)
      emitMove(probes[probe].t, probes[probe].s);
  return result;
}
