import { Evolution } from '../../src/training/evolution';
import { defaultDraft, preflight } from '../../src/runtime/runConfig';
import { fingerprint, parameterBytes } from '../../src/runtime/fingerprint';
import { WorkerPool } from '../../src/runtime/workerPool';
import { browserPort } from '../../src/runtime/browserPort';
import { TrainingDatabase } from '../../src/storage/database';
import { boundary, restore, type RunIndex } from '../../src/storage/checkpoint';
import { deletionPreview } from '../../src/storage/objects';
self.onmessage = async (
  event: MessageEvent<{
    workers: number;
    capture?: boolean;
    small: boolean;
    benchmark?: {
      rate: number | 'max';
      trace: boolean;
      n?: number;
      maxTicks?: number;
      widths?: number[];
      observe?: boolean;
    };
  }>,
) => {
  const { workers, small, benchmark } = event.data,
    db = await TrainingDatabase.open(
      'arena-reference-' + workers + (benchmark ? crypto.randomUUID() : ''),
    );
  let pool: WorkerPool | undefined;
  try {
    await db.acquire(crypto.randomUUID());
    const draft = defaultDraft();
    draft.options.runId = 'reference';
    if (small) {
      draft.options.n = 8;
      draft.options.generations = 3;
      draft.scenarios = [
        { task: { maxTicks: 180, graceTicks: 20, noProgressTicks: 180 } },
      ];
    }
    if (benchmark) {
      draft.options.generations = 2;
      draft.options.n = benchmark.n ?? 8;
      draft.hidden = benchmark.widths ?? [32, 16];
      draft.profile = 'Custom';
      draft.custom = { workers: Math.max(1, workers), managedMiB: 1024 };
      const maxTicks = benchmark.maxTicks ?? 180;
      draft.scenarios = [
        { task: { maxTicks, graceTicks: 0, noProgressTicks: maxTicks } },
      ];
      if (benchmark.trace)
        draft.options.trace = {
          generation: 1,
          slot: 0,
          maxChanges: 32,
          maxSamples: 16,
          everyTicks: 12,
        };
    }
    const { m, scenarios, estimated } = preflight(
        draft,
        fingerprint,
        navigator.hardwareConcurrency,
      ),
      e = new Evolution(m, scenarios, fingerprint, draft.options);
    const counters = {
      globalGeneration: 0,
      logicalEpisodes: 0,
      activeMs: 0,
      goalStreak: 0,
      revision: 0,
      segment: 0,
      previousSegments: [],
    };
    const started = performance.now();
    let ids: string[] = [],
      index: RunIndex | undefined;
    let saveMs = 0,
      gcMs = 0;
    async function save(stage?: ReturnType<Evolution['prepare']>) {
      const begin = performance.now();
      const b = boundary(
        e,
        stage,
        draft,
        draft,
        counters,
        navigator.userAgent,
        stage && !stage.snapshot.nextPopulation.length ? 'budget' : null,
        ids,
        index,
      );
      await db.commit(b.objects, { replace: ['run:reference'] });
      stage?.publish();
      ids = b.checkpoint.history;
      e.compactHistory(ids.length);
      index = b.index;
      saveMs = performance.now() - begin;
      const committed = performance.now();
      const gc = deletionPreview(await db.list(), []);
      if (gc.remove.length) await db.commit([], { remove: gc.remove });
      gcMs = performance.now() - committed;
    }
    await save();
    if (workers)
      pool = new WorkerPool(browserPort, workers, 'browser-reference');
    const hex = async (data: string) =>
      Array.from(
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)),
        ),
        (v) => v.toString(16).padStart(2, '0'),
      ).join('');
    while (e.population.length) {
      if (benchmark && e.nextGeneration === 1 && pool) {
        pool.setRate(benchmark.rate);
        if (benchmark.observe) pool.observe(1, 0);
      }
      const start = performance.now(),
        rows = pool ? await pool.evaluate(e, draft.scenarios) : e.collect(),
        stage = e.prepare(rows);
      const summary = stage.snapshot.summary;
      counters.globalGeneration++;
      counters.logicalEpisodes += rows.length;
      counters.activeMs = performance.now() - started;
      await save(stage);
      if (event.data.capture) {
        const genome = e.champion!.genome;
        const milestone = [0, 31, 99].includes(summary.generation);
        postMessage({
          type: 'archive',
          summary,
          genome: milestone
            ? {
                hash: genome.hash,
                header: genome.model.key,
                bytes: Array.from(parameterBytes(genome.parameters())),
              }
            : undefined,
        });
      }
      postMessage({
        type: 'generation',
        generation: summary.generation,
        evaluations: rows.length,
        logicalHash: await hex(JSON.stringify(summary)),
        nextHashes: await hex(
          e.population.map((m) => m.genome.hash).join('\n'),
        ),
        champion: e.champion!.genome.hash,
        best: summary.fitness.best,
        successes: summary.successes,
        ticks: rows.reduce((n, r) => n + r.result.tick, 0),
        ms: performance.now() - start,
        ...(benchmark
          ? {
              saveMs,
              gcMs,
              estimated: estimated.total,
              monitor: pool?.monitor,
              outcome: await hex(
                JSON.stringify(
                  summary.records.map((r) => [
                    r.id,
                    r.parents,
                    r.hash,
                    r.score,
                    r.episodes.map((ep) => [
                      ep.tick,
                      ep.reason,
                      ep.fitness,
                      ep.raw,
                    ]),
                  ]),
                ),
              ),
            }
          : {}),
        diskBytes: (await db.status()).total,
      });
    }
    let restoreMs: number | undefined;
    if (benchmark && index) {
      const begin = performance.now(),
        saved = await restore(
          db,
          index.latest,
          navigator.userAgent,
          navigator.hardwareConcurrency,
        );
      if (
        saved.evolution.champion?.genome.hash !== e.champion?.genome.hash ||
        saved.evolution.population.length
      )
        throw Error('Terminaler Restore weicht ab.');
      restoreMs = performance.now() - begin;
    }
    postMessage({
      type: 'end',
      restoreMs,
      generations: e.nextGeneration,
      evaluations: counters.logicalEpisodes,
      ms: performance.now() - started,
      champion: e.champion?.genome.hash,
      checkpoints: (await db.list()).filter((x) => x.kind === 'checkpoint')
        .length,
    });
  } catch (error) {
    postMessage({ type: 'fault', message: String(error) });
  } finally {
    pool?.close();
    await db.release();
    db.close();
  }
};
