import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { scenarioSet, stepEpisode, evaluate } from '../../src/training/episode';
import { Evolution } from '../../src/training/evolution';
import { model } from '../../src/training/genome';
import { resources } from '../../src/runtime/compute';
import {
  fingerprint,
  parameterBytes,
  sha256,
} from '../../src/runtime/fingerprint';
import { WorkerPool } from '../../src/runtime/workerPool';
import vectors from '../../docs/training-management/specification/reference_vectors.json';
const portModule = '../../scripts/node-compute-port.mjs';
const { nodeComputePort } = await import(portModule);

it('reproduces all resource profiles and independent SHA vectors and block boundaries', () => {
  for (const v of vectors.workerProfiles) {
    expect(
      ['Eco', 'Balanced', 'Performance'].map(
        (p) => resources(v.h, p as 'Eco').workers,
      ),
    ).toEqual(v.counts);
    expect(resources(v.h, 'Eco').cap).toBe(v.cap);
  }
  expect(resources(undefined, 'Balanced').workers).toBe(1);
  expect(() =>
    resources(12, 'Custom', { workers: 11, managedMiB: 100 }),
  ).toThrow();
  const genes = new Float64Array(vectors.parameters);
  expect(sha256(parameterBytes(genes))).toBe(vectors.canonicalRawSha256);
  expect(fingerprint(vectors.header, genes)).toBe(vectors.fingerprint);
  for (const size of [0, 1, 55, 56, 63, 64, 65, 119, 120, 128, 68500]) {
    const bytes = Uint8Array.from({ length: size }, (_, i) => i % 253);
    expect(sha256(bytes)).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
  }
});
it('preserves real tick, observation, and decision state across suspension', () => {
  const [s] = scenarioSet(fingerprint, 42, 0, [
    { task: { maxTicks: 72, graceTicks: 0, noProgressTicks: 72 } },
  ]);
  const run = new Evolution(model(s.modelSignature, [4]), [s], fingerprint, {
    n: 8,
  });
  const brain = run.population[0].genome.brain(),
    trace = { maxSamples: 100, everyTicks: 1 };
  const steps = stepEpisode(s, brain, trace);
  for (let i = 1; i <= 39; i++) {
    const n = steps.next();
    expect(n.done).toBe(false);
    if (!n.done) expect(n.value.index).toBe(i);
  }
  let r = steps.next();
  while (!r.done) r = steps.next();
  expect(r.value).toEqual(evaluate(s, brain, trace));
});
it('executes the same complete generations in two real worker threads and the serial reference', async () => {
  const options = [
    { task: { maxTicks: 180, graceTicks: 20, noProgressTicks: 160 } },
  ];
  const scenarios = scenarioSet(fingerprint, 42, 0, options),
    m = model(scenarios[0].modelSignature, [8]);
  const create = () =>
    new Evolution(m, scenarios, fingerprint, {
      n: 8,
      generations: 2,
      runId: 'parity',
    });
  const serial = create(),
    parallel = create(),
    pool = new WorkerPool(nodeComputePort, 2, 'parallel-test');
  try {
    for (let g = 0; g < 2; g++) {
      const rows = await pool.evaluate(parallel, options);
      expect(parallel.commit(rows)).toEqual(serial.commit(serial.collect()));
      expect(parallel.population.map((x) => x.genome.hash)).toEqual(
        serial.population.map((x) => x.genome.hash),
      );
    }
    expect(pool.monitor.evaluated).toBe(16);
  } finally {
    pool.close();
  }
}, 30000);
