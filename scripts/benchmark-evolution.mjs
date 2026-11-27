import { digest, environment } from './evolution-runtime.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
const { Evolution } = await import('../src/training/evolution.ts');
const { scenario, evaluate } = await import('../src/training/episode.ts');
const { model, Genome } = await import('../src/training/genome.ts');
const { stream, derivedSeed, gaussian } =
  await import('../src/training/random.ts');
const { crossover, mutate, standardMutation, ranking, tournament } =
  await import('../src/training/operators.ts');
const { diversity, adapt, standardAdaptation } =
  await import('../src/training/adaptation.ts');
const { ProgressLedger, scoreFitness, profiles } =
  await import('../src/training/fitness.ts');
const { Penalties } = await import('../src/training/penalties.ts');
const [suite, output, baselineDirectory] = process.argv.slice(2);
if (
  !['components', 'world', 'scale', 'endurance'].includes(suite) ||
  !output ||
  existsSync(output)
)
  throw Error(
    'Expected suite, unused output filename, and a detached PRE-B01 checkout for world',
  );
const log = {
  ...environment(),
  suite,
  seed: 42,
  started: new Date().toISOString(),
  rows: [],
  notes:
    'Serial per benchmark process; other machine load uncontrolled. Elapsed wall time includes allocations. Peak RSS is the process lifetime high-water mark in KiB.',
};
const save = () => writeFileSync(output, JSON.stringify(log, null, 2) + '\n');
const memory = () => ({
  ...process.memoryUsage(),
  maxRssKiB: process.resourceUsage().maxRSS,
});
function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted.at(-1),
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
  };
}
function bench(
  name,
  config,
  operation,
  { warmup = 1000, group = 1, seconds = 5, repeats = 3, units = 1 } = {},
) {
  for (let i = 0; i < warmup; i++) operation(i);
  const samples = [];
  for (let rep = 0; rep < repeats; rep++) {
    const before = memory(),
      cpu = process.cpuUsage(),
      start = performance.now();
    let count = 0,
      ms;
    do {
      for (let i = 0; i < group; i++) operation(count++);
      ms = performance.now() - start;
    } while (ms < seconds * 1000);
    samples.push({
      count,
      ms,
      cpu: process.cpuUsage(cpu),
      before,
      after: memory(),
      operationsPerSecond: (count * units * 1000) / ms,
      nsPerOperation: (ms * 1e6) / (count * units),
    });
  }
  log.rows.push({
    name,
    config,
    warmup,
    units,
    group,
    targetSeconds: seconds,
    samples,
    operationsPerSecond: summary(samples.map((s) => s.operationsPerSecond)),
    nsPerOperation: summary(samples.map((s) => s.nsPerOperation)),
  });
  save();
  process.stdout.write(name + ' ' + JSON.stringify(config) + '\n');
}
const hiddenSizes = [
  [16, 8],
  [32, 16],
  [64, 32],
  [128, 128, 128, 128],
];
const seed = derivedSeed(42, 'scenario');
const training = scenario(digest, { seed });
if (suite === 'components') {
  const r = stream(42, 'mutation');
  bench('rng-gaussian', {}, () => gaussian(r), { group: 1024 });
  const p = new Penalties(),
    l = new ProgressLedger(660, 8, 1, -8),
    sample = {
      speed: 4,
      longitudinal: 4,
      lateral: 0,
      tangential: 4,
      grassAxles: 0,
      reverse: false,
      steering: 0,
      pedal: 0.3,
      fallback: false,
    };
  const fact = [
    {
      kind: 'move',
      delta: 0.02,
      fromS: -8,
      toS: -7.98,
      distance: 0.02,
      time: 1 / 60,
    },
  ];
  let tick = 0;
  bench(
    'fitness-progress-penalty',
    { fixture: 'repeated accepted physical segment, correction back to start' },
    () => {
      tick++;
      l.accept(fact);
      p.accept(tick, tick / 60, sample, [], 0);
      const f = l.fractions,
        result = scoreFitness(
          1,
          0,
          false,
          f.P,
          f.A,
          f.K,
          1 / 60,
          120,
          p.errors,
          profiles.Balanced,
        );
      if (Math.abs(result.F - 0.025) > 1e-10)
        throw Error('Fitness fixture drift');
    },
    { group: 256 },
  );
  for (const hidden of hiddenSizes) {
    const m = model(training.modelSignature, hidden),
      a = Genome.initialize(m, 111, digest),
      b = Genome.initialize(m, 222, digest),
      x = a.parameters(),
      c = { parameters: m.count };
    bench('mutation', c, () => mutate(m, x, standardMutation, r));
    bench('mutation-selected-trace', c, () =>
      mutate(m, x, standardMutation, r, 64),
    );
    for (const operator of ['uniform', 'neuron-wise'])
      bench('crossover', { ...c, operator }, () =>
        crossover(a, b, operator, r),
      );
    bench('sha256', c, () => digest(m.key, x));
  }
  for (const n of [8, 32, 128, 512, 1024]) {
    const m = model(training.modelSignature),
      genomes = Array.from({ length: n }, (_, i) =>
        Genome.initialize(m, derivedSeed(42, 'init', 0, i), digest),
      );
    const scores = Array.from({ length: n }, (_, i) => i % 7);
    bench('selection-generation', { n }, () => {
      const order = ranking(scores, r);
      for (let i = 0; i < n; i++) tournament(order, 3, r);
    });
    bench('diversity-generation', { n, parameters: m.count }, () =>
      diversity(genomes),
    );
  }
  for (const enabled of [false, true]) {
    const a = {
      ...standardAdaptation,
      probabilityEnabled: enabled,
      strengthEnabled: enabled,
      rescueEnabled: enabled,
    };
    let state = null;
    bench(
      'adaptation',
      { n: 128, enabled },
      () => {
        state = adapt(state, 1, a, standardMutation);
      },
      { group: 256 },
    );
  }
}
if (suite === 'world') {
  if (!baselineDirectory) throw Error('Missing 02A checkout');
  const base = resolve(baselineDirectory),
    work = resolve('.');
  log.baseline = execFileSync('git', ['-C', base, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (log.baseline !== '61cd54a2be454915647b9089bc6da5c5d1bc16d8')
    throw Error('Wrong baseline');
  const snapshots = new Map();
  log.paired = [];
  for (const [label, root, measure] of [
    ['02A', base, false],
    ['02B-off', work, false],
    ['02B-feed', work, true],
  ]) {
    const load = (file) =>
      import(pathToFileURL(join(root, 'src', file + '.ts')).href);
    const [
      { DriveWorld },
      { Brain },
      { profile, standardProfile },
      { signature },
      { createVehicle },
      { createTrack },
      { startGrid },
    ] = await Promise.all(
      [
        'game/world',
        'ai/network',
        'ai/profile',
        'ai/schema',
        'vehicles/vehicle',
        'tracks/track',
        'tracks/grid',
      ].map(load),
    );
    const track = createTrack(),
      v = createVehicle({ id: 'candidate', startNumber: 0 }),
      pose = startGrid(track, 1, v.definition.lengthM, v.definition.widthM)[0];
    const options = {
      id: v.id,
      startNumber: 0,
      initialState: { positionM: pose.position, headingRad: pose.heading },
    };
    for (const hz of [30, 60])
      for (const trace of [false, true]) {
        const sensor = profile(standardProfile.rays, hz),
          brain = new Brain(signature(v, sensor, hz), derivedSeed(42, 'init')),
          ai = new Map([[v.id, { brain, profile: sensor, decisionHz: hz }]]),
          cmd = new Map();
        let world;
        const block = () => {
          world = new DriveWorld(track, [options], false, ai, measure);
          world.trace = trace;
          for (let i = 0; i < 600; i++) world.step(cmd);
        };
        block();
        const { index, cars, events, fallback } = world.frame,
          key = hz + '/' + trace,
          hash = digest(JSON.stringify({ index, cars, events, fallback }));
        if (snapshots.has(key) && snapshots.get(key) !== hash)
          throw Error('02A replay drift ' + key);
        snapshots.set(key, hash);
        log.paired.push({ label, hz, trace, hash });
        bench(
          'paired-world',
          { label, hz, trace, measure, blockTicks: 600 },
          block,
          { warmup: 1, units: 600 },
        );
      }
    // Human regression includes contact, recovery, control smoothing and previous HUD state.
    const human = new DriveWorld(track, [options], false, new Map(), measure);
    const hashes = [];
    for (let i = 1; i <= 1200; i++) {
      const f = human.step(
        new Map([
          [
            v.id,
            {
              recover: i === 950,
              command: {
                kind: 'analog',
                request: {
                  throttle: 1,
                  brake: 0,
                  steering: i < 250 ? 0.05 : 0.3,
                  direction: 'forward',
                },
              },
            },
          ],
        ]),
      );
      hashes.push(
        digest(JSON.stringify([f.index, f.cars, f.events, f.fallback])),
      );
    }
    const hash = digest(hashes.join(''));
    if (snapshots.has('human') && snapshots.get('human') !== hash)
      throw Error('Human frame sequence drift');
    snapshots.set('human', hash);
    log.paired.push({ label, humanTicks: 1200, hash });
  }
  for (const hz of [30, 60]) {
    const s = scenario(digest, { seed, sensorHz: hz, decisionHz: hz }),
      m = model(s.modelSignature),
      g = Genome.initialize(m, derivedSeed(42, 'init'), digest);
    let baseline;
    for (const trace of [false, true]) {
      const run = () => {
        const result = evaluate(
          s,
          g.brain(),
          trace ? { maxSamples: 32, everyTicks: 5 } : undefined,
        );
        if (!result.ok) throw Error(result.message);
        return result;
      };
      const { fitness, tick, duration, reason } = run();
      if (baseline !== undefined && fitness.F !== baseline)
        throw Error('Trace fitness drift');
      baseline = fitness.F;
      bench(
        'real-episode',
        {
          hz,
          trace,
          ticks: tick,
          simulatedSeconds: duration,
          fitness: fitness.F,
          reason,
        },
        run,
        { warmup: Math.ceil(600 / tick) },
      );
      const row = log.rows.at(-1);
      row.vehicleTicksPerSecond = row.operationsPerSecond.median * tick;
      row.simulatedSecondsPerWallSecond =
        row.operationsPerSecond.median * duration;
      save();
    }
  }
}
if (suite === 'scale') {
  // Full populations above 128 exercise the full world, genetics and coordinator using a short task.
  // Full-length outcomes belong only to the explicit reference and standard episode rows.
  const s = scenario(digest, {
    seed,
    task: { maxTicks: 6, graceTicks: 0, noProgressTicks: 6 },
  });
  for (const hidden of hiddenSizes) {
    const m = model(s.modelSignature, hidden);
    for (const n of m.count > 20000 ? [8, 32] : [8, 32, 128, 512, 1024]) {
      const run = () => {
        const e = new Evolution(m, [s], digest, { n, generations: 2 });
        const result = e.commit(e.collect());
        if (result.evaluations !== n || e.population.length !== n)
          throw Error('Population drift');
      };
      bench('real-generation', { n, parameters: m.count, taskTicks: 6 }, run, {
        warmup: Math.ceil(600 / (n * 6)),
      });
      const row = log.rows.at(-1);
      row.episodesPerSecond = row.operationsPerSecond.median * n;
      row.vehicleTicksPerSecond = row.episodesPerSecond * 6;
      save();
    }
  }
  for (const trace of [false, true]) {
    const n = 128,
      m = model(s.modelSignature),
      opts = {
        n,
        generations: 2,
        ...(trace
          ? {
              trace: {
                generation: 0,
                slot: 3,
                maxSamples: 3,
                everyTicks: 1,
                maxChanges: 64,
              },
            }
          : {}),
      };
    let identical;
    const op = () => {
      const e = new Evolution(m, [s], digest, opts);
      const summary = e.commit(e.collect());
      identical = digest(
        JSON.stringify([
          summary.records.map((r) => r.score),
          e.population.map((m) => m.genome.hash),
        ]),
      );
    };
    bench('selected-trace', { n, trace }, op, { warmup: 1 });
    log.rows.at(-1).reproductionDigest = identical;
    save();
  }
  if (log.rows.at(-1).reproductionDigest !== log.rows.at(-2).reproductionDigest)
    throw Error('Selected trace altered generation');
}
if (suite === 'endurance') {
  const { DriveWorld } = await import('../src/game/world.ts');
  function retainedByPublishedState(run) {
    const seen = new Set(),
      pending = [run.history, run.snapshot, run.population, run.champion];
    let genomes = 0,
      worlds = 0;
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (value instanceof Genome) {
        genomes++;
        continue;
      }
      if (value instanceof DriveWorld) {
        worlds++;
        continue;
      }
      for (const child of Object.values(value)) pending.push(child);
    }
    if (worlds > 0 || genomes > run.population.length + 2)
      throw Error('Unexpected retained world or genome');
    return {
      distinctGenomes: genomes,
      worlds,
      plainObjectsAndArrays: seen.size - genomes - worlds,
    };
  }
  const s = scenario(digest, {
      seed,
      task: { maxTicks: 8, graceTicks: 0, noProgressTicks: 8 },
    }),
    m = model(s.modelSignature, [16, 8]);
  const warm = new Evolution(m, [s], digest, { n: 8, generations: 10 });
  while (warm.population.length) warm.commit(warm.collect());
  for (let repeat = 0; repeat < 3; repeat++) {
    const run = new Evolution(m, [s], digest, { n: 8, generations: 200 }),
      samples = [],
      start = performance.now(),
      cpu = process.cpuUsage();
    while (run.population.length) {
      const t = performance.now(),
        g = run.commit(run.collect());
      const generationMs = performance.now() - t;
      const retained = [0, 99, 199].includes(g.generation)
        ? retainedByPublishedState(run)
        : undefined;
      if (retained && globalThis.gc) globalThis.gc();
      samples.push({
        g: g.generation,
        ms: generationMs,
        retained,
        forcedGc: !!(retained && globalThis.gc),
        history: run.history.length,
        livePopulation: run.population.length,
        champion: Boolean(run.champion),
        ...memory(),
      });
    }
    log.rows.push({
      repeat,
      config: { n: 8, generations: 200, taskTicks: 8, parameters: m.count },
      samples,
      ms: performance.now() - start,
      cpu: process.cpuUsage(cpu),
      final: run.history.at(-1).champion,
      records: run.history.reduce((a, r) => a + r.evaluations, 0),
      generationMs: summary(samples.map((s) => s.ms)),
    });
    save();
  }
}
log.finished = new Date().toISOString();
save();
