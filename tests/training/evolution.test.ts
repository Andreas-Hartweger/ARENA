import { expect, it } from 'vitest';
import { Brain } from '../../src/ai/network';
import { DriveWorld } from '../../src/game/world';
import {
  evaluate,
  scenario,
  scenarioSet,
  type Digest,
  type EpisodeResult,
  type ScoredEpisode,
} from '../../src/training/episode';
import {
  Evolution,
  distribution,
  type EvaluationRow,
} from '../../src/training/evolution';
import { Genome, model } from '../../src/training/genome';
import {
  traceDiagnostics,
  drivingDiagnostics,
} from '../../src/research/traceDiagnostics';
import { permutation, stream } from '../../src/training/random';
const path = '../../scripts/evolution-runtime.mjs';
const { digest }: { digest: Digest } = await import(path);
const short = scenario(digest, {
    task: { maxTicks: 3, graceTicks: 0, noProgressTicks: 3 },
  }),
  m = model(short.modelSignature, [4]);
const start = (opts = {}) =>
  new Evolution(m, [short], digest, { n: 8, generations: 3, ...opts });
const zeros = new Brain(
  short.modelSignature,
  0,
  [4],
  'tanh',
  new Float64Array(m.count),
);
const base = evaluate(short, zeros) as ScoredEpisode;
it('DIA-003 EVO-003 publishes the whole immutable snapshot and owns shallow-frozen input records', () => {
  const e = start();
  expect(e.phase).toBe('initialized');
  expect(e.snapshot).toBeNull();
  const data = { ...base, fitness: { ...base.fitness }, raw: { ...base.raw } };
  const rows = e.collect(() => Object.freeze(data));
  expect(e.phase).toBe('staged');
  e.commit(rows);
  const first = e.snapshot!;
  expect(first.historyIndex).toBe(0);
  expect(first.summary).toBe(e.history[0]);
  expect(first.nextPopulation).toBe(e.population);
  expect(first.champion).toBe(e.champion);
  expect(first.generationBest.hash).toBe(
    first.summary.records[first.summary.order[0]].hash,
  );
  data.raw.distance = 123;
  expect(first.summary.records[0].episodes[0].raw.distance).toBe(0);
  const stopped = e.collect(() => ({
    ok: false,
    reason: 'cancelled',
    tick: 0,
    message: 'stop',
  }));
  expect(() => e.commit(stopped)).toThrow();
  expect(e.phase).toBe('cancelled');
  expect(e.snapshot).toBe(first);
});
it('RNG-005 EPS-010 ADP-009 uses scenario seeds keyed by master, segment and canonical scenario position', () => {
  const both = scenarioSet(digest, 12, 4, [
    { task: short.task },
    { task: short.task, id: 'B' },
  ]);
  expect(both[0].seed).not.toBe(both[1].seed);
  const run = new Evolution(m, both, digest, {
    master: 12,
    segment: 4,
    n: 8,
    generations: 1,
  });
  const rows = run.collect(() => base);
  expect(rows.map((r) => r.seed)).toEqual(
    Array.from({ length: 16 }, (_, i) => both[i % 2].seed),
  );
  expect(
    () =>
      new Evolution(m, [...both].reverse(), digest, { master: 12, segment: 4 }),
  ).toThrow();
  expect(run.champion).toBeNull();
});
it('FIT-001 DR-02B-001 accepts the delegated maximum and rejects schedules above it', () => {
  const task = { laps: 1_000_000 };
  expect(scenario(digest, { task }).task.laps).toBe(task.laps);
  expect(() => scenario(digest, { task: { laps: task.laps + 1 } })).toThrow();
});
function landscape(_: unknown, g: Genome): ScoredEpisode {
  const x = g.parameters(),
    score = 20 + x[0] - Math.abs(x[1]);
  return { ...base, fitness: { ...base.fitness, F: score } };
}
it('EPS-001 EPS-002 EPS-006 EPS-007 EPS-008 REG-006 replays independent real AI worlds, external reset and model failure', () => {
  const s = scenario(digest);
  const stopped = evaluate(s, zeros);
  expect(stopped).toMatchObject({
    ok: true,
    reason: 'noProgress',
    tick: 1200,
    duration: 20,
    fitness: { F: 0 },
  });
  expect(stopped).toEqual(evaluate(s, zeros));
  for (const reason of ['cancelled', 'externalReset'] as const) {
    let t = 0;
    const r = evaluate(s, zeros, undefined, () =>
      ++t === 3 ? reason : undefined,
    );
    expect(r).toMatchObject({ ok: false, reason, tick: 2 });
    expect(r).not.toHaveProperty('fitness');
  }
  const fault = evaluate(s, new Brain('other vehicle'));
  expect(fault).toMatchObject({
    reason: 'modelFault',
    ok: false,
    tick: 0,
    contract: s.key,
    seed: s.seed,
    modelSignature: 'other vehicle',
  });
  expect(fault).not.toHaveProperty('fitness');
}, 30_000);
it('EPS-010 FIT-008 ADP-009 rejects incompatible training structures and holds out validation', () => {
  const s2 = scenarioSet(digest, 42, 0, [
    { task: short.task },
    { id: 'second', task: short.task },
  ])[1];
  const ev = new Evolution(
    m,
    [short, s2],
    digest,
    { n: 8, generations: 1 },
    undefined,
    [Number.MAX_VALUE, Number.MAX_VALUE / 2],
  );
  const rows = ev.collect((s, g) => ({
    ...landscape(s, g),
    fitness: { ...base.fitness, F: s === short ? 1 : 7 },
  }));
  expect(() => ev.commit(rows.slice(0, -1))).toThrow('Incomplete');
  for (const r of ev.commit(rows.reverse()).records)
    expect(r.score).toBeCloseTo(3, 12);
  for (const other of [
    scenario(digest, { fitness: 'Speed', task: short.task }),
    scenario(digest, { purpose: 'validation', task: short.task }),
    scenario(digest, { purpose: 'test', task: short.task }),
  ])
    expect(() => new Evolution(m, [short, other], digest)).toThrow();
});
it('EVO-001 EVO-004 EVO-006 RNG-006 RNG-007 POP-006 selects identically from permuted results and retains elite/champion', () => {
  const runs = [start(), start(), start()],
    prev = [-Infinity, -Infinity, -Infinity];
  for (let g = 0; g < 3; g++) {
    const next = runs.map((r, index) => {
      const rows = r.collect(landscape),
        shuffle =
          index === 2 ? permutation(stream(42, 'diagnostic', g), 8) : [];
      const summary = r.commit(
        index === 0
          ? rows
          : index === 1
            ? rows.reverse()
            : shuffle.map((i) => rows[i]),
      );
      expect(summary.fitness.best).toBeGreaterThanOrEqual(prev[index]);
      prev[index] = summary.fitness.best;
      return [summary, r.population.map((m) => m.genome.hash)];
    });
    expect(next[1]).toEqual(next[0]);
    expect(next[2]).toEqual(next[0]);
  }
  const tied = start();
  tied.commit(tied.collect(() => base));
  const champion = tied.champion;
  tied.commit(tied.collect(() => base));
  expect(tied.champion).toBe(champion);
});
it('EVO-002 EVO-003 EPS-008 RNG-007 rejects missing, duplicate, stale and wrong-genome results and rolls back late reproduction errors', () => {
  let budget = Infinity;
  const r = new Evolution(
    m,
    [short],
    (a, b) => {
      if (--budget === 0) throw Error('generation creation slot 127');
      return digest(a, b);
    },
    { n: 128, generations: 3 },
  );
  r.commit(r.collect(landscape));
  const rows = r.collect(landscape),
    p = r.population,
    h = r.history,
    c = r.champion;
  for (const change of [
    { slot: 128 },
    { slot: 0 },
    { generation: 0 },
    { contract: 'other' },
    { genome: p[0].genome },
    { individual: 'other' },
    { seed: 99 },
    { segment: 88 },
  ]) {
    const altered = [...rows];
    altered[127] = { ...altered[127], ...change };
    expect(() => r.commit(altered)).toThrow(/identity/);
  }
  expect(() => r.commit(rows.slice(0, -1))).toThrow('Incomplete');
  budget = 122;
  expect(() => r.commit(rows)).toThrow(/slot 127/);
  expect(r.population).toBe(p);
  expect(r.history).toBe(h);
  expect(r.champion).toBe(c);
  budget = Infinity;
  r.commit(rows);
  const clean = new Evolution(m, [short], digest, { n: 128, generations: 3 });
  clean.commit(clean.collect(landscape));
  clean.commit(clean.collect(landscape));
  expect(r.population.map((m) => m.genome.hash)).toEqual(
    clean.population.map((m) => m.genome.hash),
  );
});
it('EPS-009 EVO-005 isolates candidates and restricts retries to temporary infrastructure', () => {
  const r = start();
  for (const [reason, transient, expected] of [
    ['infrastructureFault', true, 16],
    ['infrastructureFault', false, 8],
    ['modelFault', true, 8],
    ['simulationFault', true, 8],
  ] as const) {
    let calls = 0;
    const rows = r.collect(() => {
      calls++;
      return { ok: false, reason, tick: 2, message: 'fixture', transient };
    });
    expect(calls).toBe(expected);
    expect(() => r.commit(rows)).toThrow(reason);
    expect(r.history).toHaveLength(0);
  }
  let calls = 0;
  const rows = r.collect(() =>
    ++calls === 1
      ? {
          ok: false,
          reason: 'infrastructureFault',
          tick: 0,
          transient: true,
          message: 'temporary',
        }
      : base,
  );
  expect(rows[0].attempt).toBe(1);
  expect(r.commit(rows).attempts).toBe(9);
});
it('POP-004 POP-005 POP-007 EVO-008 DIA-002 budgets whole generations, stores compact records and supports matched random search', () => {
  const r = start({ budget: 20, generations: 100, randomSearch: true });
  r.commit(r.collect(landscape));
  expect(
    r.population.every((m) => m.origin === 'random' && m.parents.length === 0),
  ).toBe(true);
  const last = r.commit(r.collect(landscape));
  expect(r.history).toHaveLength(2);
  expect(r.population).toHaveLength(0);
  expect(last.lapTimes).toBeNull();
  expect(last.reasons).toEqual({ timeout: 8 });
  expect(JSON.stringify(r.history)).not.toContain('"genome":');
  expect(() => r.collect()).toThrow();
  expect(start({ budget: 7 }).population).toHaveLength(0);
});
it('ADP-003 ADP-006 ADP-007 GEN-005 CRX-004 DIA-006 composes the optional operators through a full rescue window', () => {
  const run = new Evolution(m, [short], digest, {
    n: 32,
    generations: 47,
    crossProbability: 0.1,
    adaptation: {
      probabilityEnabled: true,
      strengthEnabled: true,
      immigrantRate: 0.05,
      rescueEnabled: true,
    },
  });
  let crosses = 0;
  for (let g = 0; g < 47; g++) {
    // An explicitly constant landscape exercises each stagnation deadline exactly.
    const result = run.commit(run.collect(() => base));
    if (g === 15) expect(result.adaptive.p).toBeCloseTo(0.075);
    if (g === 30) expect(result.adaptive.alpha).toBeCloseTo(0.3);
    if (g === 45) expect(result.adaptive.p).toBeCloseTo(0.1125);
    if (g === 0) continue;
    const immigrants = g === 46 ? 5 : 2;
    expect(result.origins).toEqual({
      elite: 2,
      offspring: 30 - immigrants,
      immigrant: immigrants,
    });
    for (const member of result.records.slice(-immigrants)) {
      expect(member.parents).toEqual([]);
      expect(member.mutation).toBeUndefined();
      expect(member.birth).toBe(g);
    }
    for (const child of result.records.slice(2, 32 - immigrants)) {
      expect(child.mutation).toBeDefined();
      if (child.operator === 'neuron-wise') {
        crosses++;
        expect(child.parents).toHaveLength(2);
      }
    }
  }
  expect(crosses).toBeGreaterThan(0);
  expect(run.population).toHaveLength(0);
});
it('DIA-001 DIA-003 DIA-004 DIA-005 DIA-006 DIA-007 EVO-009 REG-003 verifies real selected traces and identical reproduction', () => {
  expect(distribution([3, 1, 4, 2])).toEqual({
    best: 4,
    worst: 1,
    mean: 2.5,
    q1: 1.75,
    q3: 3.25,
    median: 2.5,
  });
  const r = start({
      trace: {
        generation: 1,
        slot: 7,
        maxChanges: 1,
        maxSamples: 1,
        everyTicks: 1,
      },
    }),
    plain = start();
  for (let i = 0; i < 2; i++) {
    const s = r.commit(r.collect()),
      off = plain.commit(plain.collect());
    expect(s.order).toEqual(off.order);
    expect(s.fitness).toEqual(off.fitness);
    expect(s.records.map((x) => x.hash)).toEqual(
      off.records.map((x) => x.hash),
    );
    expect(() => s.order.push(99)).toThrow();
    if (i === 1) {
      const rec = s.records[7];
      expect(rec.episodes[0].trace).toMatchObject({ truncated: true });
      const sample = rec.episodes[0].trace!.samples[0];
      expect(sample.values).toHaveLength(248);
      expect(sample.layers).toHaveLength(2);
      expect(rec.mutation?.details).toHaveLength(1);
      expect(s.records.slice(0, 7).every((x) => !x.episodes[0].trace)).toBe(
        true,
      );
    }
  }
});
it('D-024 counts measured sensor frames and decisions, including masked inputs', () => {
  for (const activation of ['tanh', 'relu', 'leaky'] as const) {
    const contract = model(short.modelSignature, [4], activation);
    const brain = new Brain(short.modelSignature, 31, [4], activation);
    const result = evaluate(short, brain, {
      everyTicks: 1,
      maxSamples: 3,
      dynamics: true,
    });
    if (!result.ok || !result.trace) throw Error('Missing physical trace');
    const samples = result.trace.samples;
    const world = new DriveWorld(
      short.track,
      [short.vehicle],
      false,
      new Map([
        [
          short.vehicle.id,
          { brain, profile: short.sensor, decisionHz: short.decisionHz },
        ],
      ]),
      true,
    );
    const input = new Map();
    for (const sample of samples) {
      const car = world.step(input).cars[0];
      expect(sample.dynamics?.physics).toEqual(car.physics);
      expect(sample.position).toEqual(car.state.positionM);
      expect(sample.input).toEqual(car.input);
    }
    const dynamics = drivingDiagnostics(samples, short.track);
    expect(dynamics.measured).toBe(3);
    expect(dynamics.phases.reduce((total, row) => total + row.samples, 0)).toBe(
      3,
    );
    expect(
      drivingDiagnostics(
        samples.map((sample) => ({ ...sample, dynamics: undefined })),
        short.track,
      ).measured,
    ).toBe(0);
    const audit = traceDiagnostics(samples, contract);
    expect(audit.observations).toBe(2);
    expect(audit.measuredDecisions).toBe(2);
    expect(audit.inputs).toHaveLength(248);
    expect(audit.inputs.find((i) => i.id === 'object00.x')).toMatchObject({
      masked: 2,
      available: 0,
      min: null,
      max: null,
    });
    expect(audit.layers[0].values).toBe(8);
    expect(audit.layers[1]).toMatchObject({
      activation: 'linear',
      values: 6,
      saturated: null,
    });
    expect(audit.layers[0].saturated === null).toBe(activation !== 'tanh');
    expect(
      traceDiagnostics(
        samples.map((s) => ({ ...s, layers: [] })),
        contract,
      ).measuredDecisions,
    ).toBe(0);
    const masked = audit.inputs.findIndex((i) => i.id === 'object00.x');
    const values = [...samples[0].values];
    values[masked] = 0.5;
    expect(() =>
      traceDiagnostics([{ ...samples[0], values }], contract),
    ).toThrow(/Unmasked/);
  }
});
it('EPS-008 EVO-002 rejects nonfinite scores without publishing a generation', () => {
  const r = start(),
    p = r.population;
  const rows: EvaluationRow[] = r.collect(landscape);
  const bad: EpisodeResult = { ...base, fitness: { ...base.fitness, F: NaN } };
  rows[0] = { ...rows[0], result: bad };
  expect(() => r.commit(rows)).toThrow();
  expect(r.population).toBe(p);
  expect(r.champion).toBeNull();
});
it('EVO-002 EPS-007 rejects conflicting result metadata and reports the current staging failure after cancellation', () => {
  const run = start();
  const rows = run.collect(() => base);
  const cancelled = [...rows];
  cancelled[0] = {
    ...rows[0],
    result: { ok: false, reason: 'cancelled', tick: 0, message: 'stop' },
  };
  expect(() => run.commit(cancelled)).toThrow(/cancelled/);
  expect(run.phase).toBe('cancelled');
  expect(() => run.commit(rows.slice(1))).toThrow(/Incomplete/);
  expect(run.phase).toBe('blocked');
  for (const mismatch of [
    { contract: 'other' },
    { seed: 123 },
    { attempt: 1 },
    { scenario: 4 },
  ]) {
    const wrong = [...rows];
    wrong[0] = { ...rows[0], result: { ...base, ...mismatch } };
    expect(() => run.commit(wrong)).toThrow(/identity/);
    expect(run.snapshot).toBeNull();
  }
  expect(run.commit(rows).evaluations).toBe(8);
});
