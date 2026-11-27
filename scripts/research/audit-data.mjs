import { createReadStream, readFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { fileHash } from './evidence.mjs';
const weights = {
  Balanced: [0.5, 0.25, 0.08, 0.07, 0.04, 0.06, 0],
  Speed: [0.8, 0.1, 0.02, 0.03, 0.02, 0.03, 0],
  Safety: [0.15, 0.45, 0.15, 0.05, 0.07, 0.1, 0.03],
};
const clamp = (x) => Math.max(0, Math.min(1, x));
function near(a, b) {
  assert(
    Number.isFinite(a) &&
      Number.isFinite(b) &&
      Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(b)),
    'Raw metric mismatch',
  );
}
export function auditEpisode(e, contract, lapCount = 1, deadline = 120) {
  assert(e.ok);
  const r = e.raw,
    p = e.fitness;
  const error = [
    r.impactSum + 0.01 * r.contactSeconds,
    r.grassSeconds / 20,
    r.idleSeconds / 10,
    r.wrongWaySeconds / 10,
    r.unstableSeconds / 10,
    r.steeringWindows / 10,
  ].map(clamp);
  error.forEach((v, i) => near(v, e.errors[i]));
  assert(
    e.lapTimes.every((t) => t > 0) &&
      e.duration > 0 &&
      e.duration <= deadline + 1e-7,
  );
  assert(
    e.tick >= 1 && e.tick <= deadline * 60 && e.duration <= e.tick / 60 + 1e-7,
  );
  const success = e.reason === 'completed',
    L = e.lapTimes.length;
  assert(success ? L === lapCount : L < lapCount);
  const w = weights[contract],
    norm = w.reduce((a, b) => a + b, 0),
    T = success ? clamp(1 - e.duration / deadline) : p.P;
  const Q = clamp(
      error.reduce(
        (a, v, i) => a + (w[i + 1] / norm) * (1 - v),
        (w[0] / norm) * T,
      ),
    ),
    R = 900 * p.P + 10 * p.A + 15 * p.K + 75 * p.P * Q;
  near(T, p.T);
  near(Q, p.Q);
  near(R, p.R);
  near(1100 * ((lapCount + 1) * Number(success) + L) + R, p.F);
  return e;
}
export async function auditExperiment(
  directory,
  id,
  { prefix = false, pulse = () => {} } = {},
) {
  const folder = join(directory, 'experiments', id),
    report = JSON.parse(readFileSync(join(folder, 'experiment.json'), 'utf8'));
  const draft = report.entry.definition.draft,
    n = draft.options.n,
    limit = prefix ? 8192 : report.regularEpisodes,
    contract = draft.scenarios[0].fitness ?? 'Balanced';
  for (const [file, ref] of Object.entries(report.artifacts)) {
    const observed = await fileHash(join(folder, file));
    assert.equal(observed.sha256, ref.sha256);
  }
  if (limit % n) throw Error('Incomplete generation in comparison');
  const summaries = readFileSync(join(folder, 'generations.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const input = createReadStream(join(folder, 'episodes.ndjson.gz')).pipe(
    createGunzip(),
  );
  let samples = 0,
    successes = 0,
    ticks = 0,
    firstSuccess = null,
    fastest = null,
    champion = null;
  const group = [],
    scoreAt = [],
    saturated = [0, 0, 0, 0, 0, 0],
    g0 = [];
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (samples === limit) break;
    const record = JSON.parse(line),
      g = Math.floor(samples / n);
    assert.equal(record.generation, g);
    assert.equal(record.slot, samples % n);
    assert.equal(record.episodes.length, 1);
    const e = auditEpisode(record.episodes[0], contract);
    near(record.score, e.fitness.F);
    if (g === 0) g0.push(record.hash);
    group.push(record);
    ticks += e.tick;
    samples++;
    if (!champion || record.score > champion.score)
      champion = {
        generation: g,
        slot: record.slot,
        genome: record.hash,
        score: record.score,
      };
    e.errors.forEach((x, i) => (saturated[i] += Number(x >= 1)));
    if (e.reason === 'completed') {
      successes++;
      firstSuccess ??= g;
      const t = e.lapTimes[0];
      if (!fastest || t < fastest.time)
        fastest = {
          generation: g,
          slot: record.slot,
          time: t,
          genome: record.hash,
        };
    }
    if (group.length === n) {
      pulse();
      const scores = group.map((r) => r.score).sort((a, b) => a - b),
        s = summaries[g];
      near(scores.at(-1), s.fitness.best);
      near(scores.reduce((a, b) => a + b, 0) / n, s.fitness.mean);
      assert.equal(
        group.filter((r) => r.episodes[0].reason === 'completed').length,
        s.successes,
      );
      scoreAt.push({
        generation: g,
        success: s.successes,
        medianProgress: s.progress.median,
        unique: s.diversity.unique,
      });
      group.length = 0;
    }
  }
  assert.equal(samples, limit);
  assert.equal(group.length, 0);
  return {
    id,
    regularEpisodes: samples,
    generations: samples / n,
    successes,
    ticks,
    firstSuccess,
    firstSuccessCensored: firstSuccess === null,
    fastest,
    champion,
    g0,
    saturated,
    scoreAt,
  };
}
