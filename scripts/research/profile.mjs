import { Session } from 'node:inspector/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { openCampaign, ActiveTime, publishJSON } from './campaign.mjs';
import { digest, environment } from '../evolution-runtime.mjs';
import { loadCandidate } from './evaluate-panel.mjs';
const { scenarioSet, evaluate } = await import('../../src/training/episode.ts');
const directory = process.argv[2],
  start = performance.now(),
  ledger = openCampaign(directory);
const context = {
    experimentId: 'cpu-profile',
    machine: ledger.machine.id,
    sessionId: ledger.token,
  },
  clock = new ActiveTime(ledger, context, 'research', 120000, start);
const profiler = new Session();
profiler.connect();
try {
  const reference = loadCandidate(directory, 'B-evolution-42'),
    [s] = scenarioSet(digest);
  const expected = JSON.parse(
    readFileSync(
      'docs/intelligence-validation/evidence/historical/roles.json',
      'utf8',
    ),
  ).measured.find((d) => d.fingerprint === reference.genome.hash).redrive;
  await profiler.post('Profiler.enable');
  await profiler.post('Profiler.setSamplingInterval', { interval: 1000 });
  await profiler.post('Profiler.start');
  let ticks = 0;
  for (let i = 0; i < 3; i++) {
    clock.pulse();
    const id = randomUUID();
    ledger.reserve(
      id,
      'research',
      { ...context, jobId: id, attempt: 0 },
      { ms: 0, ticks: s.task.maxTicks, episodes: 0 },
    );
    const actual = evaluate(s, reference.genome.brain());
    ledger.settle(id, { ms: 0, ticks: actual.tick, episodes: 0 });
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw Error('Profile drive differs from verified reference');
    ticks += actual.tick;
  }
  const { profile } = await profiler.post('Profiler.stop');
  const hot = profile.nodes
    .filter((n) => n.hitCount)
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 32)
    .map((n) => ({
      function: n.callFrame.functionName || '(anonymous)',
      module: n.callFrame.url.split('/src/').at(-1).split('/scripts/').at(-1),
      line: n.callFrame.lineNumber + 1,
      selfSamples: n.hitCount,
    }));
  const report = {
    schema: 'arena.cpu-profile.v1',
    runtime: environment(),
    genome: reference.genome.hash,
    repetitions: 3,
    ticks,
    samplingIntervalUs: 1000,
    samples: profile.samples.length,
    hot,
  };
  publishJSON(join(directory, 'physics-profile.json'), report);
  publishJSON(
    'docs/intelligence-validation/evidence/physics-profile.json',
    report,
  );
} finally {
  profiler.disconnect();
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
