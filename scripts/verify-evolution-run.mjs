import assert from 'node:assert/strict';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import process from 'node:process';

// Independent arithmetic over the published evidence. This verifier does not import the simulator or genetic algorithm.
const partial = process.argv.includes('--partial');
const [directory, prefixFile] = process.argv
  .slice(2)
  .filter((arg) => arg !== '--partial');
if (!directory)
  throw Error(
    'Expected a completed reference directory and optionally comparison-prefix.json',
  );
const read = (name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const run = read('run.json'),
  end = partial ? null : read('end.json');
const summaries = readFileSync(join(directory, 'generations.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
const close = (a, b, epsilon = 1e-9) =>
  assert.ok(
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon,
    `Expected ${a} within ${epsilon} of ${b}`,
  );
assert.deepEqual(
  [
    run.mode,
    run.config.master,
    run.config.generations,
    run.config.n,
    run.config.crossProbability,
    run.config.eliteRate,
    run.config.tournament,
    run.config.poolFraction,
  ],
  ['reference', 42, 100, 128, 0, 0.05, 3, 1],
);
assert.deepEqual(
  [
    run.config.mutation.p,
    run.config.mutation.alpha,
    run.config.mutation.largeProbability,
    run.config.mutation.largeMultiplier,
  ],
  [0.05, 0.2, 0.05, 5],
);
assert.deepEqual(
  [
    run.config.adaptation.immigrantRate,
    run.config.adaptation.rescueEnabled,
    run.config.adaptation.probabilityEnabled,
    run.config.adaptation.strengthEnabled,
  ],
  [0, false, false, false],
);
if (end)
  assert.deepEqual(
    [end.generations, end.evaluations, summaries.length],
    [100, 12800, 100],
  );
const archive = join(directory, 'episodes.ndjson.gz'),
  data = existsSync(archive)
    ? createReadStream(archive).pipe(createGunzip())
    : createReadStream(join(directory, 'episodes.ndjson'));
const prefix = prefixFile ? JSON.parse(readFileSync(prefixFile, 'utf8')) : null;
let evaluated = 0,
  prev = new Map(),
  current = new Map(),
  scores = [],
  durations = [],
  laps = [],
  successes = 0,
  allLaps = 0,
  totalTicks = 0,
  totalSim = 0,
  fastest = null,
  firstSuccess = null,
  eliteRechecks = 0,
  previousBest = -Infinity,
  finished = 0;
const reasons = {},
  trackLength = 440 + 70 * Math.PI,
  timeline = [],
  hashes = [];
let generationDigest = createHash('sha256');
const clamp = (x) => Math.max(0, Math.min(1, x));
for await (const line of createInterface({
  input: data,
  crlfDelay: Infinity,
})) {
  if (partial && finished === summaries.length) break;
  const r = JSON.parse(line),
    g = Math.floor(evaluated / 128),
    slot = evaluated % 128,
    s = summaries[g];
  assert.deepEqual([r.generation, r.slot, r.episodes.length], [g, slot, 1]);
  assert.match(r.hash, /^[a-f0-9]{64}$/);
  const e = r.episodes[0];
  assert.equal(e.contract, run.scenario);
  assert.equal(e.seed, run.scenarioSeed);
  assert.equal(e.attempt, 0);
  assert.equal(e.ok, true);
  assert.ok(['completed', 'timeout', 'noProgress'].includes(e.reason));
  assert.ok(Number.isInteger(e.tick) && e.tick > 0 && e.tick <= 7200);
  assert.equal(e.trace, undefined);
  assert.equal(e.scenario, 0);
  assert.equal(e.lapTimes.length, Number(e.reason === 'completed'));
  assert.ok(
    e.duration <= e.tick / 60 + 1e-11 &&
      e.duration >= (e.tick - 1) / 60 - 1e-11,
  );
  const S = Number(e.reason === 'completed'),
    L = e.lapTimes.length,
    raw = e.raw;
  const P = clamp(L + raw.partial / trackLength),
    A = raw.approach / 8,
    K = e.fitness.K,
    T = S ? clamp(1 - e.duration / 120) : P;
  close(raw.progress, raw.approach + L * trackLength + raw.partial);
  close(K * 7, Math.round(K * 7));
  assert.ok(K >= 0 && K <= 1);
  if (S) {
    close(P, 1);
    close(K, 1);
    assert.equal(raw.partial, 0);
    firstSuccess ??= g;
    successes++;
    allLaps += L;
    for (const time of e.lapTimes) {
      assert.ok(time > 0 && time <= e.duration);
      fastest = fastest === null ? time : Math.min(fastest, time);
    }
  } else {
    close(e.duration, e.tick / 60);
    if (e.reason === 'timeout') assert.equal(e.tick, 7200);
  }
  const errors = [
    raw.impactSum + 0.01 * raw.contactSeconds,
    raw.grassSeconds / 20,
    raw.idleSeconds / 10,
    raw.wrongWaySeconds / 10,
    raw.unstableSeconds / 10,
    raw.steeringWindows / 10,
  ].map(clamp);
  for (let i = 0; i < 6; i++) close(errors[i], e.errors[i]);
  const quality =
    0.5 * T +
    0.25 * (1 - errors[0]) +
    0.08 * (1 - errors[1]) +
    0.07 * (1 - errors[2]) +
    0.04 * (1 - errors[3]) +
    0.06 * (1 - errors[4]);
  const R = 900 * P + 10 * A + 15 * K + 75 * P * quality,
    score = 1100 * (2 * S + L) + R;
  for (const [key, v] of Object.entries({ P, A, T, Q: quality, R, F: score }))
    close(e.fitness[key], v);
  close(r.score, score);
  if (g === 0) {
    assert.equal(r.origin, 'initial');
    assert.equal(r.birth, 0);
    assert.equal(r.parents.length, 0);
  } else if (slot < 6) {
    assert.equal(r.origin, 'elite');
    const parent = prev.get(r.id);
    assert.ok(parent);
    assert.equal(r.hash, parent.hash);
    assert.equal(r.score, parent.score);
    eliteRechecks++;
  } else {
    assert.equal(r.origin, 'offspring');
    assert.equal(r.birth, g);
    assert.equal(r.parents.length, 1);
    assert.ok(prev.has(r.parents[0]));
    assert.equal(r.operator, 'copy');
  }
  if (r.origin !== 'elite')
    assert.equal(r.id, JSON.stringify([run.config.runId, g, slot]));
  assert.ok(!current.has(r.id));
  current.set(r.id, { hash: r.hash, score: r.score });
  reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
  scores.push(r.score);
  durations.push(e.duration);
  laps.push(...e.lapTimes);
  totalTicks += e.tick;
  totalSim += e.duration;
  evaluated++;
  generationDigest.update(line + '\n');
  if (slot === 127) {
    assert.equal(s.generation, g);
    assert.equal(s.evaluations, 128);
    assert.equal(s.attempts, 128);
    assert.equal(s.successes, laps.length);
    assert.equal(s.laps, laps.length);
    if (!laps.length) assert.equal(s.lapTimes, null);
    close(
      s.simulatedSeconds,
      durations.reduce((a, b) => a + b, 0),
      1e-8,
    );
    const sorted = [...scores].sort((a, b) => a - b),
      quantile = (q) => {
        const f = 127 * q,
          j = Math.floor(f);
        return sorted[j] * (1 - f + j) + sorted[Math.ceil(f)] * (f - j);
      };
    for (const [k, v] of Object.entries({
      best: sorted[127],
      worst: sorted[0],
      mean: scores.reduce((a, b) => a + b, 0) / 128,
      median: quantile(0.5),
      q1: quantile(0.25),
      q3: quantile(0.75),
    }))
      close(s.fitness[k], v);
    assert.ok(s.fitness.best >= previousBest);
    previousBest = s.fitness.best;
    assert.equal(s.adaptive.p, 0.05);
    assert.equal(s.adaptive.alpha, 0.2);
    assert.equal(
      s.diversity.unique,
      new Set([...current.values()].map((v) => v.hash)).size,
    );
    const hash = generationDigest.digest('hex');
    if (prefix && g < prefix.generationHashes.length)
      assert.equal(hash, prefix.generationHashes[g]);
    hashes.push(hash);
    if ([0, 24, 49, 74, 99].includes(g) || g === firstSuccess)
      timeline.push({
        generation: g,
        ...s.fitness,
        successes: s.successes,
        laps: s.laps,
        progressBest: s.progress.best,
        unique: s.diversity.unique,
      });
    prev = current;
    current = new Map();
    scores = [];
    durations = [];
    laps = [];
    generationDigest = createHash('sha256');
    finished++;
  }
}
assert.equal(finished, partial ? summaries.length : 100);
assert.equal(evaluated, finished * 128);
assert.equal(eliteRechecks, (finished - 1) * 6);
assert.equal(prev.get(summaries[finished - 1].bestId)?.score, previousBest);
process.stdout.write(
  JSON.stringify(
    {
      sha: run.sha,
      evidenceChecksPassed: true,
      referenceComplete: !partial,
      completedGenerations: finished,
      evaluated,
      eliteRechecks,
      prefixMatches: Math.min(finished, prefix?.generationHashes.length ?? 0),
      reasons,
      successes,
      allLaps,
      firstSuccess,
      fastestLapSeconds: fastest,
      totalTicks,
      totalSimulatedSeconds: totalSim,
      elapsedSeconds: end ? end.elapsedMs / 1000 : null,
      championGenome: end?.champion ?? null,
      timeline,
      candidateDataDigest: createHash('sha256')
        .update(hashes.join('\n'))
        .digest('hex'),
    },
    null,
    2,
  ) + '\n',
);
