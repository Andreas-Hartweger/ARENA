import { digest, environment } from './evolution-runtime.mjs';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
const { Evolution } = await import('../src/training/evolution.ts');
const { model } = await import('../src/training/genome.ts');
const { scenario } = await import('../src/training/episode.ts');
const { derivedSeed } = await import('../src/training/random.ts');
const [destination, mode = 'reference', count, generations] =
  process.argv.slice(2);
if (!destination || !['reference', 'random', 'short'].includes(mode))
  throw Error(
    'Usage: node scripts/run-evolution.mjs NEW_DIRECTORY [reference|random|short] [population] [generations]',
  );
const n = Number(count ?? 128),
  g = Number(generations ?? 100);
if (mode === 'reference' && (n !== 128 || g !== 100))
  throw Error('Reference requires 128 x 100');
const s = scenario(digest, { seed: derivedSeed(42, 'scenario') }),
  m = model(s.modelSignature);
const run = new Evolution(m, [s], digest, {
  runId: mode,
  n,
  generations: g,
  randomSearch: mode === 'random',
});
mkdirSync(destination);
const started = performance.now(),
  meta = {
    ...environment(),
    mode,
    scenario: s.key,
    scenarioSeed: s.seed,
    model: digest(m.key),
    config: run.config,
    started: new Date().toISOString(),
  };
writeFileSync(
  join(destination, 'run.json'),
  JSON.stringify(meta, null, 2) + '\n',
);
while (run.population.length) {
  const start = performance.now(),
    cpu = process.cpuUsage(),
    before = process.memoryUsage();
  const summary = run.commit(run.collect());
  const { records, ...statistics } = summary;
  const row = {
    ...statistics,
    ms: performance.now() - start,
    cpu: process.cpuUsage(cpu),
    before,
    after: process.memoryUsage(),
  };
  appendFileSync(
    join(destination, 'generations.ndjson'),
    JSON.stringify(row) + '\n',
  );
  // Per-candidate raw telemetry is written once. No world or historical parameter array is serialized.
  appendFileSync(
    join(destination, 'episodes.ndjson'),
    records
      .map((record) =>
        JSON.stringify({ generation: summary.generation, ...record }),
      )
      .join('\n') + '\n',
  );
  process.stdout.write(
    JSON.stringify({
      g: summary.generation,
      n: records.length,
      best: summary.fitness.best,
      success: summary.successes,
      ms: Math.round(row.ms),
    }) + '\n',
  );
}
writeFileSync(
  join(destination, 'end.json'),
  JSON.stringify(
    {
      generations: run.history.length,
      evaluations: run.history.reduce((n, g) => n + g.evaluations, 0),
      elapsedMs: performance.now() - started,
      champion: run.champion?.genome.hash,
    },
    null,
    2,
  ) + '\n',
);
