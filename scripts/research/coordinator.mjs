import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { setInterval, clearInterval } from 'node:timers';
import { nodeComputePort } from '../node-compute-port.mjs';
import { NodeStore } from './store.mjs';
import { hashJSON, sha } from './manifest.mjs';
const { TrainingController } = await import('../../src/runtime/controller.ts');
const { decode } = await import('../../src/storage/objects.ts');

const units = (ticks = 0, episodes = 0) => ({ ms: 0, ticks, episodes });
const idOf = (key) =>
  [
    key.sessionId,
    key.segmentId,
    key.generation,
    key.slot,
    key.scenarioIndex,
  ].join(':');

export async function runExperiment(
  ledger,
  entry,
  clock,
  {
    hardware,
    regular = true,
    portFactory = nodeComputePort,
    onState,
    control,
  } = {},
) {
  if (hashJSON(entry.definition) !== entry.hash)
    throw Error('Invalid experiment hash');
  const def = entry.definition,
    exp = def.experimentId,
    draft = def.draft,
    scope = 'research';
  const db = ledger.db,
    store = new NodeStore(ledger, exp);
  db.exec(
    `CREATE TABLE IF NOT EXISTS chunks (experiment TEXT NOT NULL,segment INTEGER NOT NULL,generation INTEGER NOT NULL,checksum TEXT NOT NULL,bytes BLOB NOT NULL,summary TEXT NOT NULL,checkpoint TEXT NOT NULL,PRIMARY KEY(experiment,segment,generation));`,
  );
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('experiment:' + exp, entry);
    const files = execFileSync(
      'git',
      [
        'ls-tree',
        '-r',
        'HEAD',
        '--',
        'src/ai',
        'src/core',
        'src/vehicles',
        'src/tracks',
        'src/collision',
        'src/input',
        'src/game',
        'src/physics',
        'src/training',
        'src/runtime/controller.ts',
        'src/runtime/workerPool.ts',
        'src/runtime/simulationWorker.ts',
        'src/runtime/compute.ts',
        'src/runtime/runConfig.ts',
        'src/storage/checkpoint.ts',
        'scripts/episode-worker.mjs',
        'scripts/research/coordinator.mjs',
      ],
      { encoding: 'utf8' },
    );
    ledger.manifest('engine:' + exp, {
      node: process.version,
      sources: hashJSON(files),
    });
  });
  const runId =
    def.masterSeed === 42 && exp === 'B-evolution-42' ? 'reference' : exp;
  const index = store.get('run:' + runId);
  if (index && decode(index).terminal) {
    const cp = decode(store.get(decode(index).latest));
    return {
      phase: cp.reason === 'budget' ? 'Completed' : 'Cancelled',
      reused: true,
      index: decode(index),
    };
  }
  const reservations = new Map(),
    attempts = new Map(),
    pending = new Map();
  const generationId = (key) =>
    [key.sessionId, key.segmentId, key.generation].join(':');
  let generationStart = performance.now(),
    generationCPU = process.cpuUsage();
  const port = () => {
    const worker = portFactory();
    let active;
    function closeAttempt(ticks, state) {
      if (!active) return;
      const { key, limit } = active,
        item = attempts.get(idOf(key));
      if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > limit)
        throw Error('Invalid tick receipt');
      item.spent += ticks;
      item.receipts.push({
        slot: key.slot,
        scenario: key.scenarioIndex,
        attempt: key.attempt,
        jobId: key.jobId,
        lease: key.workerLease,
        ticks,
        state,
        elapsedMs: performance.now() - active.start,
      });
      active = undefined;
      if (state !== 'result' || key.attempt > 0)
        ledger.transaction(() => {
          ledger.assertLease();
          ledger.event(
            ledger.token,
            'attempt-' + state,
            scope,
            {
              experimentId: exp,
              runId: key.runId,
              sessionId: key.sessionId,
              segment: key.segmentId,
              generation: key.generation,
              ...item.receipts.at(-1),
            },
            units(),
            units(),
          );
        });
      if (state === 'lost' && key.attempt === 0) return;
      ledger.settle(item.id, units(item.spent), state);
      attempts.delete(idOf(key));
      pending.get(generationId(key)).push(...item.receipts);
    }
    return {
      send(message, transfers) {
        if (message.type === 'assign') {
          clock.pulse();
          ledger.assertLease();
          const { job } = message,
            k = job.key,
            gid = generationId(k),
            jid = idOf(k);
          if (k.runId !== runId || active)
            throw Error('Unexpected research assignment');
          const context = {
            experimentId: exp,
            runId,
            sessionId: k.sessionId,
            segment: k.segmentId,
            generation: k.generation,
          };
          if (!reservations.has(gid)) {
            const id = 'generation:' + gid;
            ledger.reserve(
              id,
              scope,
              context,
              units(0, regular ? draft.options.n * draft.scenarios.length : 0),
            );
            reservations.set(gid, id);
            pending.set(gid, []);
            generationStart = performance.now();
            generationCPU = process.cpuUsage();
          }
          const limit = job.scenario.task?.maxTicks ?? 7200;
          if (k.attempt === 0) {
            const id = 'job:' + jid;
            ledger.reserve(
              id,
              scope,
              {
                ...context,
                slot: k.slot,
                scenario: k.scenarioIndex,
                jobId: k.jobId,
                attempt: 0,
                lease: k.workerLease,
              },
              units(2 * limit),
            );
            attempts.set(jid, { id, spent: 0, receipts: [] });
          } else if (
            !attempts.has(jid) ||
            attempts.get(jid).receipts.length !== 1
          )
            throw Error('Retry without durable reservation');
          active = { key: k, limit, start: performance.now() };
        }
        worker.send(message, transfers);
      },
      listen(event, fault) {
        worker.listen((msg) => {
          try {
            if (
              active &&
              msg.key?.sessionId === active.key.sessionId &&
              msg.key.workerLease === active.key.workerLease
            ) {
              if (msg.type === 'result') {
                const transient = !msg.result.ok && msg.result.transient;
                closeAttempt(msg.result.tick, transient ? 'lost' : 'result');
              } else if (msg.type === 'cancelled')
                closeAttempt(msg.tick, 'cancelled');
              else if (msg.type === 'fault')
                closeAttempt(
                  active.limit,
                  msg.transient ? 'lost' : 'fault-uncertain',
                );
            }
            event(msg);
          } catch (error) {
            fault(error);
          }
        }, fault);
      },
      close() {
        try {
          if (active) closeAttempt(active.limit, 'lost');
        } finally {
          worker.close();
        }
      },
    };
  };
  if (def.phase === 'Baseline')
    store.prepareObjects = (values) =>
      values.map((o) => {
        if (o.meta.kind !== 'checkpoint') return o;
        const cp = decode(o);
        if (cp.counters.logicalEpisodes !== 8192 || !cp.champion) return o;
        ledger.manifest('prefix:' + exp, {
          checkpoint: cp.id,
          champion: cp.champion.genome,
          logicalEpisodes: 8192,
        });
        return { ...o, meta: { ...o.meta, protected: true, root: true } };
      });
  store.onCommit = (objects) => {
    const cpObject = objects.find((o) => o.meta.kind === 'checkpoint');
    for (const obj of objects.filter((o) => o.meta.kind === 'history')) {
      if (!cpObject) throw Error('Generation without checkpoint');
      const cp = decode(cpObject),
        generation = cp.counters.globalGeneration - 1;
      const pair = [...reservations].find(([gid]) =>
        gid.endsWith(':' + cp.counters.segment + ':' + generation),
      );
      if (!pair) throw Error('Generation without budget reservation');
      const [gid, rid] = pair,
        s = decode(obj),
        { records, ...stats } = s,
        receipts = pending.get(gid);
      const count = records.reduce((n, r) => n + r.episodes.length, 0);
      if (
        count !== draft.options.n * draft.scenarios.length ||
        receipts.filter((r) => r.state === 'result').length !== count
      )
        throw Error('Partial generation');
      const raw = Buffer.from(
        records
          .map((r) =>
            JSON.stringify({
              generation,
              ...r,
              attempts: receipts.filter((t) => t.slot === r.slot),
            }),
          )
          .join('\n') + '\n',
      );
      const bytes = gzipSync(raw, { level: 1 }),
        durationMs = performance.now() - generationStart;
      const summary = {
        ...stats,
        generation,
        checkpoint: cp.id,
        regularEpisodes: regular ? count : 0,
        evaluations: count,
        durationMs,
        cpu: process.cpuUsage(generationCPU),
        memory: process.memoryUsage(),
        actualOrConservativelyChargedTicks: receipts.reduce(
          (n, r) => n + r.ticks,
          0,
        ),
        attempts: receipts.length,
      };
      db.prepare('INSERT INTO chunks VALUES (?,?,?,?,?,?,?)').run(
        exp,
        cp.counters.segment,
        generation,
        sha(bytes),
        bytes,
        JSON.stringify(summary),
        cp.id,
      );
      ledger.closeReservation(
        ledger.token,
        rid,
        units(0, regular ? count : 0),
        'generation-committed',
      );
      // Clear only after COMMIT succeeds, so a storage fault can retry the same boundary.
      store.afterCommit = () => {
        reservations.delete(gid);
        pending.delete(gid);
      };
    }
  };
  const runtime = 'node:' + process.version,
    controller = new TrainingController(store, port, runtime, hardware);
  let finish;
  const done = new Promise((resolve) => {
    finish = resolve;
  });
  controller.changed = (state) => {
    onState?.(state);
    if (
      ['Completed', 'Cancelled', 'Faulted', 'Recoverable'].includes(state.phase)
    )
      finish(state);
  };
  const watch = setInterval(() => {
    try {
      clock.pulse();
    } catch (error) {
      finish({ phase: 'Faulted', error: String(error) });
    }
  }, 1000);
  try {
    if (index) {
      const cp = decode(index);
      await controller.recover(cp.latest);
      await controller.resume();
    } else await controller.start(draft, undefined, undefined, runId);
    await control?.(controller);
    const state = await done;
    if (
      state.phase === 'Recoverable' ||
      (state.phase === 'Faulted' && controller.snapshot.phase === 'Running')
    )
      await controller.serialize(() =>
        controller.detach(state.error ?? 'budget or storage fault'),
      );
    return state;
  } finally {
    clearInterval(watch);
    for (const item of attempts.values())
      ledger.settle(item.id, units(item.spent), 'discarded-attempt');
    for (const rid of reservations.values())
      ledger.settle(rid, units(), 'discarded-generation');
  }
}
