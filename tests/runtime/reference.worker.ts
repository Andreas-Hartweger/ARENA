import { Evolution } from '../../src/training/evolution';
import { defaultDraft, preflight } from '../../src/runtime/runConfig';
import { fingerprint } from '../../src/runtime/fingerprint';
import { WorkerPool } from '../../src/runtime/workerPool';
import { browserPort } from '../../src/runtime/browserPort';
import { TrainingDatabase } from '../../src/storage/database';
import { boundary, type RunIndex } from '../../src/storage/checkpoint';
import { deletionPreview } from '../../src/storage/objects';
self.onmessage = async (
  event: MessageEvent<{ workers: number; small: boolean }>,
) => {
  const { workers, small } = event.data,
    db = await TrainingDatabase.open('arena-reference-' + workers);
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
    const { m, scenarios } = preflight(
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
    async function save(stage?: ReturnType<Evolution['prepare']>) {
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
      index = b.index;
      const gc = deletionPreview(await db.list(), []);
      if (gc.remove.length) await db.commit([], { remove: gc.remove });
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
      const start = performance.now(),
        rows = pool ? await pool.evaluate(e, draft.scenarios) : e.collect(),
        stage = e.prepare(rows);
      const summary = stage.snapshot.summary;
      counters.globalGeneration++;
      counters.logicalEpisodes += rows.length;
      counters.activeMs = performance.now() - started;
      await save(stage);
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
        diskBytes: (await db.status()).total,
      });
    }
    postMessage({
      type: 'end',
      generations: e.history.length,
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
