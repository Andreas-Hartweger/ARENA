import { availableParallelism, constants, setPriority } from 'node:os';
import { performance } from 'node:perf_hooks';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { digest, environment } from './evolution-runtime.mjs';
import { nodeComputePort } from './node-compute-port.mjs';
const [destination, baselinePath, investigation] = process.argv.slice(2);
if (
  !destination ||
  !baselinePath ||
  existsSync(destination) ||
  (investigation && investigation !== 'serial-review')
)
  throw Error('New output directory and merged 02B checkout required');
const base = resolve(baselinePath),
  baselineSha = execFileSync('git', ['-C', base, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
if (baselineSha !== 'c74ab27daf3159329d9049076ab3c30c5a4759ea')
  throw Error('Wrong 02B revision');
await import(pathToFileURL(join(base, 'scripts/evolution-runtime.mjs')).href);
async function runtime(root) {
  const read = (p) =>
    import(pathToFileURL(join(root, 'src/training', p + '.ts')).href);
  return {
    Evolution: (await read('evolution')).Evolution,
    scenarioSet: (await read('episode')).scenarioSet,
    model: (await read('genome')).model,
  };
}
const old = await runtime(base),
  current = await runtime(process.cwd()),
  { WorkerPool } = await import('../src/runtime/workerPool.ts'),
  { resources } = await import('../src/runtime/compute.ts');
const hardware = availableParallelism(),
  profiles = Object.fromEntries(
    ['Eco', 'Balanced', 'Performance'].map((k) => [
      k,
      resources(hardware, k).workers,
    ]),
  );
setPriority(process.pid, constants.priority.PRIORITY_BELOW_NORMAL);
mkdirSync(destination);
const config = (name, n, hz, maxTicks, trace = false) => ({
  name,
  n,
  hz,
  maxTicks,
  trace,
});
const workloads = [
  config('regular-30', 8, 30, 0),
  config('window-30', 32, 30, 600),
  config('window-30-trace', 32, 30, 600, true),
  ...[10, 15, 20, 60].map((hz) => config('window-' + hz, 8, hz, 600)),
].filter((w) => !investigation || ['window-10', 'window-30'].includes(w.name));
const repeats = investigation ? 7 : 3;
const methods = [
  { id: '02B', rt: old },
  { id: '02C', rt: current },
  ...Array.from(
    new Set([
      1,
      2,
      4,
      ...Object.values(profiles),
      resources(hardware, 'Performance').cap,
    ]),
  )
    .filter((n) => n <= resources(hardware, 'Performance').cap)
    .map((n) => ({ id: 'workers-' + n, n, rt: current })),
];
const poolByMethod = new Map(),
  rows = [],
  oracles = new Map(),
  median = (values) => {
    const a = values.slice().sort((a, b) => a - b);
    return (
      (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2
    );
  };
const header = {
  ...environment(),
  baselineSha,
  profiles,
  hardware,
  priority: 'below normal',
  autosave: false,
  backgroundLoad:
    'Isolated browser reference, UI stability and headless endurance may run concurrently',
  workloads,
  repeats,
  method:
    'Fixed identical populations, warm-up per runtime and workload, alternately ordered windows; times include evaluation, canonical commit and complete population setup is outside the timer.',
};
writeFileSync(
  join(destination, 'start.json'),
  JSON.stringify(header, null, 2) + '\n',
);
async function sample(method, work) {
  const { rt } = method,
    opts = {
      sensorHz: work.hz,
      decisionHz: work.hz,
      ...(work.maxTicks
        ? {
            task: {
              maxTicks: work.maxTicks,
              graceTicks: 0,
              noProgressTicks: work.maxTicks,
            },
          }
        : {}),
    };
  const s = rt.scenarioSet(digest, 42, 0, [opts]),
    m = rt.model(s[0].modelSignature),
    run = new rt.Evolution(m, s, digest, {
      runId: 'paired',
      master: 42,
      n: work.n,
      generations: 2,
      ...(work.trace
        ? {
            trace: {
              generation: 0,
              slot: 0,
              maxChanges: 32,
              maxSamples: 48,
              everyTicks: 12,
            },
          }
        : {}),
    });
  let pool;
  if (method.n) {
    pool = poolByMethod.get(method.id);
    if (!pool) {
      pool = new WorkerPool(nodeComputePort, method.n, 'paired');
      poolByMethod.set(method.id, pool);
    }
  }
  const before = process.memoryUsage(),
    compute = pool?.monitor.computeMs ?? 0,
    t = performance.now();
  const result = run.commit(
      pool ? await pool.evaluate(run, [opts]) : run.collect(),
    ),
    ms = performance.now() - t,
    ticks = result.records
      .flatMap((r) => r.episodes)
      .reduce((n, e) => n + e.tick, 0),
    hash = createHash('sha256')
      .update(
        JSON.stringify([result, run.population.map((m) => m.genome.hash)]),
      )
      .digest('hex');
  const canon = oracles.get(work.name);
  if (canon && canon !== hash)
    throw Error('Paired work diverged: ' + work.name + ' ' + method.id);
  oracles.set(work.name, hash);
  return {
    work: work.name,
    method: method.id,
    workers: method.n ?? 0,
    ms,
    ticks,
    hash,
    episodes: result.evaluations,
    ticksPerSecond: (ticks * 1000) / ms,
    simSecondsPerSecond: (ticks * 1000) / (60 * ms),
    episodesPerMinute: (result.evaluations * 60000) / ms,
    workerComputeMs: pool ? pool.monitor.computeMs - compute : null,
    heapBefore: before.heapUsed,
    heapAfter: process.memoryUsage().heapUsed,
    rss: process.memoryUsage().rss,
  };
}
try {
  for (const work of workloads) {
    const selected = investigation
      ? methods.filter((m) => !m.n)
      : work.name === 'window-30'
        ? methods
        : methods.filter((m) =>
            ['02B', '02C', 'workers-1', 'workers-4'].includes(m.id),
          );
    for (const m of selected) await sample(m, work);
    for (let repeat = 0; repeat < repeats; repeat++)
      for (const method of repeat % 2 ? [...selected].reverse() : selected) {
        const row = { repeat, ...(await sample(method, work)) };
        rows.push(row);
        appendFileSync(
          join(destination, 'raw.ndjson'),
          JSON.stringify(row) + '\n',
        );
      }
    for (const p of poolByMethod.values()) p.close();
    poolByMethod.clear();
  }
  const summary = workloads.flatMap((w) => {
    const data = rows.filter((r) => r.work === w.name),
      baseline = median(
        data.filter((r) => r.method === '02B').map((r) => r.ms),
      );
    return [...new Set(data.map((r) => r.method))].map((method) => {
      const a = data.filter((r) => r.method === method),
        times = a.map((r) => r.ms),
        ms = median(times),
        speedup = baseline / ms;
      return {
        work: w.name,
        method,
        ms,
        minMs: Math.min(...times),
        maxMs: Math.max(...times),
        ticks: a[0].ticks,
        ticksPerSecond: median(a.map((r) => r.ticksPerSecond)),
        speedup,
        efficiency: method.startsWith('workers')
          ? speedup / a[0].workers
          : null,
        hash: a[0].hash,
      };
    });
  });
  writeFileSync(
    join(destination, 'end.json'),
    JSON.stringify({ summary, repetitions: 3, matched: true }, null, 2) + '\n',
  );
} finally {
  for (const p of poolByMethod.values()) p.close();
}
