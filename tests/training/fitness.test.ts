import { expect, it } from 'vitest';
import vectors from '../../docs/first-evolution/specification/reference_vectors.json';
import {
  ProgressLedger,
  normalized,
  profiles,
  scoreFitness,
} from '../../src/training/fitness';
import {
  impactCost,
  Penalties,
  type TickSample,
} from '../../src/training/penalties';
import {
  initialLap,
  recordTravel,
  type TravelFact,
} from '../../src/tracks/progress';
import { createTrack } from '../../src/tracks/track';
import { deadline, standardTask } from '../../src/training/episode';

it.each(vectors.fitness)(
  'FIT-002 FIT-003 FIT-004 FIT-005 $case / $profile',
  (v) => {
    const t = v.S ? (1 - v.T) * 120 : 17;
    const result = scoreFitness(
      v.N,
      v.L,
      !!v.S,
      v.P,
      v.A,
      v.K,
      t,
      120,
      v.errors,
      profiles[v.profile as keyof typeof profiles],
    );
    for (const k of ['Q', 'R', 'F', 'T'] as const)
      expect(Math.abs(result[k] - v[k])).toBeLessThan(1e-9);
  },
);
it('FIT-001 FIT-004 FIT-006 FIT-007 checks hierarchy, protected completion and custom weights', () => {
  for (const n of [1, 2, 10])
    for (let l = 0; l < n; l++) {
      const max = scoreFitness(
        n,
        l,
        false,
        1,
        1,
        1,
        0,
        120,
        [0, 0, 0, 0, 0, 0],
        profiles.Balanced,
      );
      const min = scoreFitness(
        n,
        l + 1,
        false,
        0,
        0,
        0,
        120,
        120,
        [1, 1, 1, 1, 1, 1],
        profiles.Balanced,
      );
      expect(max.R).toBe(1000);
      expect(min.F - max.F).toBe(100);
    }
  expect(normalized([Number.MAX_VALUE, Number.MAX_VALUE, 0])).toEqual([
    0.5, 0.5, 0,
  ]);
  for (const bad of [[-1, 2], [NaN], [Infinity], [0, 0]])
    expect(() => normalized(bad)).toThrow();
  expect(() =>
    scoreFitness(
      1,
      0,
      true,
      1,
      1,
      1,
      0,
      120,
      Array(6).fill(0),
      [0, 0, 0, 0, 0, 0, 1],
    ),
  ).toThrow();
  const call = (s: boolean, t: number) =>
    scoreFitness(
      1,
      Number(s),
      s,
      s ? 1 : 0.5,
      1,
      1,
      t,
      120,
      Array(6).fill(0),
      profiles.Balanced,
    );
  for (const t of [0, 40, 120]) {
    expect(call(true, t).T).toBeCloseTo(1 - t / 120);
    expect(call(false, t).T).toBe(0.5);
  }
});
const move = (a: number, b: number, time = 0): TravelFact => ({
  kind: 'move',
  fromS: a,
  toS: b,
  delta: b - a,
  distance: Math.abs(b - a),
  time,
});
it('PRG-007 PRG-009 repeated contact corrections never farm travel over the same road', () => {
  const l = new ProgressLedger(100, 4, 1, -8);
  for (let i = 0; i < 10; i++) l.accept([move(-8, -7)]);
  expect(l.approach).toBe(1);
  l.accept([move(-7, 0), { kind: 'start', time: 1, station: 0 }]);
  for (let i = 0; i < 10; i++) l.accept([move(0, 1)]);
  expect(l.partial).toBe(1);
  l.accept([move(10, 11)]);
  expect(l.partial).toBe(2);
});
it('PRG-001 PRG-002 PRG-005 PRG-006 retains only high water and distinct ordinal gates', () => {
  const l = new ProgressLedger(1000, 4, 3, -8);
  expect(l.fractions.A).toBe(0);
  l.accept([move(-8, -4)]);
  expect(l.fractions.A).toBe(0.5);
  l.accept([move(-4, 0), { kind: 'start', time: 1, station: 0 }]);
  expect(l.fractions.A).toBe(1);
  expect(l.completed).toBe(0);
  for (const [a, b, high] of [
    [0, 100, 100],
    [100, 60, 100],
    [60, 100, 100],
    [100, 120, 120],
  ]) {
    l.accept([move(a, b)]);
    expect(l.partial).toBe(high);
  }
  l.accept([move(120, 400)]);
  expect(l.partial).toBe(250);
  l.accept([
    { kind: 'gate', gate: 1, time: 2 },
    { kind: 'invalidate', time: 3 },
    move(400, 900),
  ]);
  expect(l.partial).toBe(250);
  const K = l.fractions.K;
  l.accept([
    { kind: 'start', time: 4, station: 0 },
    move(0, 250),
    { kind: 'gate', gate: 1, time: 5 },
  ]);
  expect(l.fractions.K).toBe(K);
  l.accept([
    move(250, 500),
    { kind: 'gate', gate: 2, time: 6 },
    move(500, 750),
    { kind: 'gate', gate: 3, time: 7 },
    move(750, 1000),
    { kind: 'finish', time: 8, lapTime: 4 },
    { kind: 'start', time: 8, station: 0 },
    move(0, 250),
    { kind: 'gate', gate: 1, time: 9 },
    move(250, 500),
  ]);
  expect(l.completed).toBe(1);
  expect(l.fractions.P).toBe(0.5);
});
it('PRG-003 PRG-004 PRG-007 PRG-008 PRG-012 EPS-005 uses authoritative Academy gates, seam and actual travel starts', () => {
  const track = createTrack(),
    l = new ProgressLedger(track.length, 8, 1, -8);
  let lap = initialLap(-8),
    time = 0;
  function travel(a: number, b: number, lateral = 0) {
    const facts: TravelFact[] = [];
    lap = recordTravel(
      track,
      lap,
      {
        from: track.sample(a, lateral).position,
        to: track.sample(b, lateral).position,
        startTime: time++,
        endTime: time,
      },
      facts,
    );
    l.accept(facts);
    return facts;
  }
  travel(-8, 1);
  expect(l.active).toBe(true);
  expect(l.partial).toBeCloseTo(1, 8);
  // Geometric correction from station 1 to 11 creates no Travel.
  travel(11, 12);
  expect(l.partial).toBeCloseTo(2, 8);
  for (let a = 12; a < track.length + 2; a += 0.5) travel(a, a + 0.5);
  expect(l.completed).toBe(1);
  expect(l.partial).toBe(0);
  expect(l.fractions.K).toBe(1);
  expect(l.fractions.P).toBe(1);
  expect(l.lapTimes).toEqual([lap.last]);
  expect(l.finishedAt).toBeLessThan(time);
  const old = l.distance;
  travel(2, 4);
  expect(l.distance).toBe(old);
  const backwards = travel(1, -1);
  expect(backwards.some((f) => f.kind === 'invalidate')).toBe(true);
  const outside = travel(-1, 1, track.def.width / 2 + 1);
  expect(outside.some((f) => f.kind === 'start')).toBe(false);
  const cutoff = travel(1, 2, track.def.width / 2 + track.def.runoff + 2);
  expect(cutoff.map((f) => f.kind)).toEqual(['invalidate']);
});
const neutral: TickSample = {
  speed: 0,
  longitudinal: 0,
  lateral: 0,
  tangential: 0,
  grassAxles: 0,
  reverse: false,
  steering: 0,
  pedal: 0,
  fallback: false,
};
it('PEN-001 PEN-002 PEN-003 PEN-010 groups accepted contact time including resting and clips the terminal interval', () => {
  [0, 1, 5, 10, 15, 30].forEach((v, i) =>
    expect(impactCost(v)).toBeCloseTo(
      [0.05, 0.052, 0.1, 0.25, 0.5, 0.5][i],
      12,
    ),
  );
  const p = new Penalties();
  for (let i = 1; i <= 120; i++)
    p.accept(
      i,
      i / 60,
      neutral,
      [{ start: (i - 1) / 60, end: i / 60, approach: 5, partners: ['wall'] }],
      0,
    );
  expect(p.errors[0]).toBeCloseTo(0.12, 12);
  expect(p.raw.clusters).toBe(1);
  p.accept(
    135,
    135 / 60,
    neutral,
    [{ start: 134 / 60, end: 135 / 60, approach: 8, partners: ['other wall'] }],
    0,
  );
  expect(p.raw.clusters).toBe(1);
  const start = 2.5;
  p.accept(
    151,
    start + 0.003,
    neutral,
    [{ start, end: start + 1 / 60, approach: 0, partners: ['wall'] }],
    0,
  );
  expect(p.raw.clusters).toBe(2);
  expect(p.raw.contactSeconds).toBeCloseTo(2 + 1 / 60 + 0.003, 12);
});
it('FIT-009 PEN-005 PEN-006 PEN-007 PEN-008 PEN-011 PEN-012 PRG-010 PRG-011 integrates tolerated exposure and leaves raw totals available', () => {
  const p = new Penalties();
  for (let i = 1; i <= 1500; i++) {
    p.accept(i, i / 60, { ...neutral, grassAxles: i <= 120 ? 1 : 2 }, [], 0);
    if ([119, 120, 179, 180].includes(i)) expect(p.raw.idleSeconds).toBe(0);
    if (i === 120) expect(p.errors[1]).toBeCloseTo(0.05);
    if (i === 181) expect(p.raw.idleSeconds).toBeCloseTo(1 / 60);
  }
  expect(p.errors[1]).toBe(1);
  expect(p.raw.grassSeconds).toBeCloseTo(24);
  expect(p.raw.idleSeconds).toBeCloseTo(22);
  expect(p.errors[2]).toBe(1);
  const q = new Penalties();
  for (let i = 1; i <= 121; i++) {
    q.accept(
      i,
      i / 60,
      {
        ...neutral,
        speed: 6,
        longitudinal: 0,
        lateral: 6,
        tangential: -2,
        reverse: true,
      },
      [],
      0,
    );
    if (i === 30) expect(q.raw.unstableSeconds).toBe(0);
    if (i === 31) expect(q.raw.unstableSeconds).toBeCloseTo(1 / 60);
    if (i === 120) expect(q.raw.wrongWaySeconds).toBe(0);
  }
  expect(q.raw.wrongWaySeconds).toBeCloseTo(1 / 60);
  q.accept(
    122,
    122 / 60,
    { ...neutral, speed: 10, longitudinal: 9, lateral: 4, tangential: 9 },
    [],
    1,
  );
  expect(q.raw.recoveries).toBe(1);
  for (let i = 123; i < 300; i++)
    q.accept(
      i,
      i / 60,
      { ...neutral, speed: 6, tangential: -1, longitudinal: 6, reverse: true },
      [],
      0,
    );
  expect(q.raw.wrongWaySeconds).toBeCloseTo(1 / 60);
  expect(q.raw.unstableSeconds).toBeCloseTo(91 / 60);
});
it('PEN-009 PEN-010 charges consecutive complete high-variation windows once', () => {
  const p = new Penalties();
  for (let i = 1; i <= 240; i++) {
    p.accept(
      i,
      i === 240 ? (i - 0.5) / 60 : i / 60,
      { ...neutral, steering: i % 2 },
      [],
      0,
    );
    if (i === 60) expect(p.raw.steeringWindows).toBe(0);
    if (i === 120) expect(p.raw.steeringWindows).toBe(2);
  }
  expect(p.raw.steeringWindows).toBe(3);
  const q = new Penalties();
  for (let i = 1; i <= 180; i++)
    q.accept(
      i,
      i / 60,
      { ...neutral, steering: i % 60 < 4 ? i % 2 : 0 },
      [],
      0,
    );
  expect(q.raw.steeringWindows).toBe(0);
});
it('EPS-002 EPS-003 EPS-004 EPS-005 fixes exact deadline precedence and renews only on threshold', () => {
  const state = { last: 300, anchor: 0 };
  deadline(standardTask, 300, 12, state, false);
  expect(deadline(standardTask, 1199, 13.999, state, false).reason).toBeNull();
  expect(deadline(standardTask, 1200, 13.999, state, false).reason).toBe(
    'noProgress',
  );
  expect(deadline(standardTask, 1200, 14, state, false).reason).toBeNull();
  expect(state.last).toBe(1200);
  expect(deadline(standardTask, 7200, 14, state, false)).toEqual({
    reason: 'timeout',
    stalled: true,
  });
  expect(deadline(standardTask, 7200, 14, state, true).reason).toBe(
    'completed',
  );
});
