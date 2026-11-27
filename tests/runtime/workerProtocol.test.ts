import { describe, expect, it } from 'vitest';
import { simulationWorker } from '../../src/runtime/simulationWorker';
import { WorkerPool } from '../../src/runtime/workerPool';
import type {
  ComputePort,
  WorkerCommand,
  WorkerEvent,
} from '../../src/runtime/compute';
import { fingerprint } from '../../src/runtime/fingerprint';
import { Evolution } from '../../src/training/evolution';
import { model } from '../../src/training/genome';
import { scenarioSet } from '../../src/training/episode';
type Delivery = (
  message: WorkerEvent,
  deliver: (m: WorkerEvent) => void,
  fail: (e: Error) => void,
) => void;
const options = [
  { task: { maxTicks: 90, graceTicks: 0, noProgressTicks: 90 } },
];
function run() {
  const scenarios = scenarioSet(fingerprint, 42, 0, options);
  return new Evolution(
    model(scenarios[0].modelSignature, [4]),
    scenarios,
    fingerprint,
    { runId: 'protocol', n: 8, generations: 2 },
  );
}
// A deterministic transport shim changes delivery order and transport faults only.
// Each result still comes from the real EpisodeStepper and the production worker code.
function factory(
  delivery: Delivery,
  observe?: (c: WorkerCommand) => void,
): () => ComputePort {
  return () => {
    let receive: (m: WorkerCommand) => void,
      closed = false;
    return {
      listen(post, fail) {
        receive = simulationWorker(
          fingerprint,
          (m) => {
            queueMicrotask(() => {
              if (!closed) delivery(m, post, fail);
            });
          },
          (f, ms) =>
            setTimeout(() => {
              if (!closed) f();
            }, ms),
          () => {
            closed = true;
          },
        );
      },
      send(c) {
        observe?.(c);
        queueMicrotask(() => {
          if (!closed) receive(c);
        });
      },
      close() {
        closed = true;
      },
    };
  };
}
describe('Pool receipts, pause and monitoring', { timeout: 25000 }, () => {
  it('reduces delayed and duplicate results in canonical order with untouched transferred genome data', async () => {
    const serial = run(),
      concurrent = run(),
      before = concurrent.population.map((m) => m.genome.parameters()),
      cache = new Map<string, WorkerEvent>();
    const delivered: number[] = [];
    let first: (() => void) | undefined;
    const pool = new WorkerPool(
      factory((m, emit) => {
        if (m.type === 'result') {
          cache.set(m.key.jobId, m);
          const send = () => {
            delivered.push(m.key.slot);
            emit(m);
            emit(m);
          };
          if (m.key.slot === 0 && !delivered.length) first = send;
          else {
            send();
            first?.();
            first = undefined;
          }
        } else emit(m);
      }),
      4,
      'session',
    );
    try {
      const rows = await pool.evaluate(concurrent, options);
      expect(delivered[0]).not.toBe(0);
      expect(cache.size).toBe(8);
      expect(concurrent.population.map((m) => m.genome.parameters())).toEqual(
        before,
      );
      expect(concurrent.commit(rows)).toEqual(serial.commit(serial.collect()));
      expect(pool.monitor.transferredBytes).toBe(8 * before[0].byteLength);
    } finally {
      pool.close();
    }
  });
  it('retries one lost infrastructure assignment against the same seed and records attempts separately', async () => {
    const e = run(),
      oracle = run();
    let failed = false;
    const assignments: Extract<WorkerCommand, { type: 'assign' }>[] = [];
    const pool = new WorkerPool(
      factory(
        (m, emit, lost) => {
          if (!failed && m.type === 'result' && m.key.slot === 0) {
            failed = true;
            lost(Error('Synthetic transport loss'));
          } else emit(m);
        },
        (c) => {
          if (c.type === 'assign') assignments.push(c);
        },
      ),
      2,
      'session',
    );
    try {
      const rows = await pool.evaluate(e, options),
        ref = oracle.collect();
      expect(rows.map((r) => r.result)).toEqual(ref.map((r) => r.result));
      expect(rows.map((r) => r.attempt)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
      const retries = assignments.filter((c) => c.job.key.slot === 0);
      expect(retries.map((c) => c.job.key.scenarioSeed)).toEqual([
        ref[0].seed,
        ref[0].seed,
      ]);
      expect(new Set(retries.map((c) => c.job.key.workerLease)).size).toBe(2);
      expect(pool.monitor.attempts).toBe(9);
      expect(pool.monitor.evaluated).toBe(8);
    } finally {
      pool.close();
    }
  });
  it('rejects an unassigned receipt and a conflicting duplicate before selection', async () => {
    for (const mode of ['unassigned', 'conflict']) {
      const e = run(),
        pool = new WorkerPool(
          factory((m, emit) => {
            if (m.type === 'result' && m.key.slot === 0) {
              if (mode === 'conflict') emit(m);
              emit(
                mode === 'unassigned'
                  ? { ...m, key: { ...m.key, scenarioIndex: 77 } }
                  : {
                      ...m,
                      result: {
                        ok: false,
                        reason: 'simulationFault',
                        message: 'changed',
                        tick: 0,
                      },
                    },
              );
            } else emit(m);
          }),
          1,
          'session',
        );
      try {
        await expect(pool.evaluate(e, options)).rejects.toThrow(/conflicting/);
        expect(e.history).toHaveLength(0);
        expect(e.champion).toBeNull();
      } finally {
        pool.close();
      }
    }
  });
  it('reports loss during a pending pause and never acknowledges an unavailable state', async () => {
    let started!: () => void;
    const begin = new Promise<void>((r) => {
      started = r;
    });
    let pauseCount = 0;
    const pool = new WorkerPool(
      factory((m, emit, fail) => {
        if (m.type === 'paused') fail(Error('Pause transport lost'));
        else {
          emit(m);
          if (m.type === 'running') started();
        }
      }),
      1,
      'lost-pause',
    );
    try {
      pool.setRate(1);
      pool.onPause = () => {
        pauseCount++;
      };
      const job = pool.evaluate(run(), options);
      await begin;
      pool.pause();
      await expect(job).rejects.toThrow(/Pause/);
      expect(pauseCount).toBe(0);
      expect(pool.paused).toBe(false);
    } finally {
      pool.close();
    }
  });
  it('acknowledges pause only after the worker stops, preserves the tick state and changes rate without catch-up', async () => {
    const e = run(),
      oracle = run(),
      pulses: Extract<WorkerEvent, { type: 'progress' }>[] = [];
    let notify!: () => void, hold!: () => void;
    const started = new Promise<void>((r) => {
        notify = r;
      }),
      paused = new Promise<void>((r) => {
        hold = r;
      });
    const pool = new WorkerPool(
      factory((m, emit) => {
        emit(m);
        if (m.type === 'running') notify();
      }),
      1,
      'session',
    );
    try {
      pool.setRate(1);
      pool.observe(1, 0);
      pool.onProgress = (m) => pulses.push(m);
      pool.onPause = hold;
      const future = pool.evaluate(e, options);
      await started;
      await new Promise((r) => setTimeout(r, 45));
      pool.pause();
      await paused;
      expect(pool.paused).toBe(true);
      expect(pulses.at(-1)?.tick).toBeGreaterThan(0);
      const tick = pulses.at(-1)!.tick;
      await new Promise((r) => setTimeout(r, 25));
      expect(pulses.at(-1)?.tick).toBe(tick);
      pool.resize(2);
      pool.setRate('max');
      pool.observe(0, null);
      pool.resume();
      expect(e.commit(await future)).toEqual(oracle.commit(oracle.collect()));
    } finally {
      pool.close();
    }
  });
});
