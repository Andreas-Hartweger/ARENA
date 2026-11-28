import { gunzipSync } from 'node:zlib';
import { availableParallelism } from 'node:os';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import process from 'node:process';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { experiment, hashJSON, sha } from './manifest.mjs';
import { runExperiment } from './coordinator.mjs';
import {
  openCampaign,
  ActiveTime,
  publishJSON,
  parseFlags,
} from './campaign.mjs';
import { spaceCheck } from './evidence.mjs';
import { environment } from '../evolution-runtime.mjs';
const { resources } = await import('../../src/runtime/compute.ts');
const directory = process.argv[2],
  hardware = availableParallelism(),
  cap = resources(hardware, 'Performance').cap;
const output = join(directory, 'worker-scaling.json');
const runtime = environment();
if (runtime.sourceDiff) throw Error('Benchmark requires committed code');
const start = performance.now(),
  ledger = openCampaign(directory, parseFlags()),
  clock = new ActiveTime(
    ledger,
    { experimentId: 'paired-worker-benchmark' },
    'research',
    120000,
    start,
  );
const results = [],
  counts = [...new Set([1, 2, 4, 6, 8, 12, 16, cap].filter((n) => n <= cap))];
try {
  const previous = existsSync(output)
    ? JSON.parse(readFileSync(output, 'utf8'))
    : null;
  const recordedRuntime = ledger.readManifest('benchmark-runtime');
  const source = recordedRuntime ?? previous?.runtime ?? runtime;
  if (
    previous &&
    (previous.hardware !== hardware ||
      hashJSON(previous.runtime) !== hashJSON(source))
  )
    throw Error('Recorded benchmark runtime differs');
  if (!previous && hashJSON(source) !== hashJSON(runtime))
    throw Error('Resume the unfinished benchmark on its recorded runtime');
  ledger.transaction(() => ledger.manifest('benchmark-runtime', source));
  spaceCheck(directory, 512 * 1024 ** 2);
  for (const repeat of [-1, 0, 1, 2]) {
    const order = repeat % 2 === 1 ? [...counts].reverse() : counts;
    for (const workers of order) {
      const id = 'bench-' + repeat + '-' + workers;
      const measured = ledger.readManifest('measurement:' + id);
      if (measured) {
        if (repeat >= 0) results.push(measured);
        continue;
      }
      if (previous)
        throw Error('Published benchmark is missing a measurement: ' + id);
      const def = globalThis.structuredClone(
        experiment('B-evolution-42', ledger.definition.id, workers, hardware)
          .definition,
      );
      def.phase = 'benchmark';
      def.experimentId = id;
      def.hypothesis = 'Same seeded first generation, complete real episodes';
      def.episodeBudget = 384;
      Object.assign(def.draft.options, { n: 128, generations: 3, budget: 384 });
      def.configHash = hashJSON(def.draft.options);
      const entry = { definition: def, hash: hashJSON(def) },
        gc = [];
      const observer = new PerformanceObserver((list) =>
        gc.push(...list.getEntries().map((e) => e.duration)),
      );
      observer.observe({ entryTypes: ['gc'] });
      let state;
      const before = performance.now(),
        cpu = process.cpuUsage();
      try {
        state = await runExperiment(ledger, entry, clock, {
          hardware,
          regular: false,
        });
      } finally {
        gc.push(...observer.takeRecords().map((e) => e.duration));
        observer.disconnect();
      }
      if (state.phase !== 'Completed' || state.reused)
        throw Error(
          'Incomplete benchmark measurement ' + JSON.stringify(state),
        );
      const ms = performance.now() - before;
      const chunks = ledger.db
        .prepare(
          'SELECT summary,bytes FROM chunks WHERE experiment=? ORDER BY generation',
        )
        .all(id);
      if (chunks.length !== 3) throw Error('Missing benchmark generation');
      const stats = chunks.map((r) => JSON.parse(r.summary)),
        ticks = stats.reduce(
          (sum, r) => sum + r.actualOrConservativelyChargedTicks,
          0,
        );
      const equivalent = hashJSON(
        chunks.map((r) =>
          gunzipSync(r.bytes)
            .toString()
            .trim()
            .split('\n')
            .map((line) => {
              const row = JSON.parse(line);
              return [row.slot, row.hash, row.score, row.episodes];
            }),
        ),
      );
      const row = {
        id,
        repeat,
        workers,
        ms,
        episodes: stats.reduce((sum, r) => sum + r.evaluations, 0),
        ticks,
        ticksPerS: (ticks * 1000) / ms,
        cpu: process.cpuUsage(cpu),
        rss: process.memoryUsage.rss(),
        managedBytes: state.managedEstimate,
        gcMs: gc.reduce((a, b) => a + b, 0),
        saveMs: state.saveMs,
        renderer: null,
        equivalent,
        fitness: stats.map((r) => r.fitness),
        archives: chunks.map((r) => sha(r.bytes)),
      };
      ledger.transaction(() => ledger.manifest('measurement:' + id, row));
      if (repeat >= 0) results.push(row);
    }
  }
  const stats = counts.map((workers) => {
    const runs = results.filter((r) => r.workers === workers),
      rates = runs.map((r) => r.ticksPerS).sort((a, b) => a - b);
    if (
      rates.length !== 3 ||
      runs.some(
        (r) =>
          r.equivalent !== results[0].equivalent ||
          r.ticks !== results[0].ticks ||
          hashJSON(r.fitness) !== hashJSON(results[0].fitness),
      )
    )
      throw Error('Unequal measured work');
    return { workers, min: rates[0], median: rates[1], max: rates[2] };
  });
  const report = {
    schema: 'arena.scaling.v1',
    runtime: source,
    work: '128 same-seed Standard Academy drivers across G0..2 per repetition, including startup, persistence and GC',
    hardware,
    rows: results,
    stats,
    workers: stats.reduce((a, b) => (a.median >= b.median ? a : b)).workers,
  };
  publishJSON(output, report);
  process.stdout.write(JSON.stringify(stats) + '\n');
} finally {
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
