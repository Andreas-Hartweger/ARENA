import { expect, it } from 'vitest';
import { TrainingController } from '../../src/runtime/controller';
import { defaultDraft } from '../../src/runtime/runConfig';
import {
  decode,
  type StorePort,
  type StoredObject,
  type WriteOptions,
} from '../../src/storage/objects';
import {
  restore,
  type Checkpoint,
  type RunIndex,
} from '../../src/storage/checkpoint';
import { prepareQueue, writeQueue, queue } from '../../src/runtime/queue';
const nodePorts = '../../scripts/node-compute-port.mjs';
const { nodeComputePort } = await import(nodePorts);
class TestStore implements StorePort {
  readonly rows = new Map<string, StoredObject>();
  rejectGeneration: number | null = null;
  revision = 0;
  async get(id: string) {
    return structuredClone(this.rows.get(id));
  }
  async list() {
    return Array.from(this.rows.values(), (v) => v.meta);
  }
  async commit(rows: readonly StoredObject[], opts: WriteOptions = {}) {
    if (
      rows.some(
        (r) =>
          r.meta.kind === 'checkpoint' &&
          decode<Checkpoint>(r).counters.globalGeneration ===
            this.rejectGeneration,
      )
    )
      throw Error('Quota for fixture');
    const next = new Map(this.rows);
    for (const o of rows) next.set(o.meta.id, structuredClone(o));
    for (const id of opts.remove ?? []) next.delete(id);
    for (const row of next.values())
      if (row.meta.refs.some((k) => !next.has(k)))
        throw Error('Incomplete write');
    this.rows.clear();
    for (const [k, v] of next) this.rows.set(k, v);
    return ++this.revision;
  }
}
const small = () => {
  const d = defaultDraft();
  d.options = { n: 8, generations: 3 };
  d.hidden = [4];
  d.profile = 'Custom';
  d.custom.workers = 1;
  d.scenarios = [
    { task: { maxTicks: 30, graceTicks: 0, noProgressTicks: 30 } },
  ];
  return d;
};
async function until(fn: () => boolean) {
  await expect.poll(fn, { timeout: 15000, interval: 20 }).toBe(true);
}
it('holds initial queue dispatch and later generations at failed save barriers, retries once and keeps confirmed counters', async () => {
  const db = new TestStore(),
    d = small(),
    control = new TrainingController(db, nodeComputePort, 'fixture', 8);
  await writeQueue(
    db,
    {
      enabled: true,
      entries: [{ id: 'job', revision: 1, draft: d, autoStart: true }],
    },
    8,
  );
  const queued = await prepareQueue(
    db,
    { ...(await queue(db)), entries: [] },
    8,
  );
  db.rejectGeneration = 0;
  await control.start(d, undefined, queued);
  expect(control.snapshot).toMatchObject({
    phase: 'Recoverable',
    generation: 0,
    evaluations: 0,
    durableGeneration: null,
  });
  expect((await queue(db)).entries).toHaveLength(1);
  db.rejectGeneration = 1;
  await control.retry();
  await until(() => control.snapshot.phase === 'Recoverable');
  expect((await queue(db)).entries).toHaveLength(0);
  expect(control.snapshot).toMatchObject({
    generation: 0,
    evaluations: 0,
    durableGeneration: 0,
  });
  db.rejectGeneration = null;
  await control.retry();
  await until(() => control.snapshot.phase === 'Completed');
  expect(control.snapshot).toMatchObject({
    generation: 3,
    evaluations: 24,
    durableGeneration: 3,
  });
  const index = decode<RunIndex>(
    (await db.get('run:' + control.snapshot.runId))!,
  );
  expect(index.automatic).toHaveLength(3);
  const { evolution } = await restore(db, index.latest, 'fixture', 8);
  expect(evolution.history).toHaveLength(3);
  expect(evolution.population).toHaveLength(0);
}, 25000);
it('publishes a changed scenario and evaluated old population atomically with separate histories', async () => {
  const db = new TestStore(),
    d = small(),
    control = new TrainingController(db, nodeComputePort, 'fixture', 8);
  d.time = { hard: false, seconds: 100 };
  await control.start(d);
  const run = control.snapshot.runId,
    initial = decode<RunIndex>((await db.get('run:' + run))!);
  const old = (
    await restore(db, initial.latest, 'fixture', 8)
  ).evolution.population.map((m) => m.genome.hash);
  control.revise({ mutation: { p: 0.22 } }, [
    { ...d.scenarios[0], fitness: 'Safety' },
  ]);
  db.rejectGeneration = 1;
  await until(() => control.snapshot.phase === 'Recoverable');
  expect(decode<RunIndex>((await db.get('run:' + run))!).latest).toBe(
    initial.latest,
  );
  db.rejectGeneration = null;
  await control.retry();
  const transition = decode<RunIndex>((await db.get('run:' + run))!);
  const { cp, evolution } = await restore(db, transition.latest, 'fixture', 8);
  expect(cp.counters).toMatchObject({
    segment: 1,
    globalGeneration: 1,
    logicalEpisodes: 8,
    goalStreak: 0,
  });
  expect(cp.history).toHaveLength(0);
  expect(evolution.champion).toBeNull();
  expect(evolution.population.map((m) => m.genome.hash)).toEqual(old);
  const ancestor = await restore(
    db,
    cp.counters.previousSegments[0],
    'fixture',
    8,
  );
  expect(ancestor.cp.reason).toBe('segment');
  expect(ancestor.evolution.history).toHaveLength(1);
  await until(() => control.snapshot.phase === 'Completed');
  expect(control.snapshot.evaluations).toBe(24);
  const branch = new TrainingController(db, nodeComputePort, 'fixture', 8);
  await expect(branch.recover(transition.latest)).rejects.toThrow(/Aktivzeit/);
  await branch.recover(transition.latest, { additionalActiveMs: 1000 });
  expect(branch.snapshot.phase).toBe('Paused');
  expect(branch.snapshot.runId).not.toBe(run);
  await branch.cancel();
}, 25000);
it('holds the wall-time clock while paused and aborts incomplete work only under the hard policy', async () => {
  const d = small();
  d.mode = 'live';
  d.time = { seconds: 0.5, hard: true };
  const control = new TrainingController(
    new TestStore(),
    nodeComputePort,
    'time-fixture',
    8,
  );
  await control.start(d);
  control.pause();
  await until(() => control.snapshot.phase === 'Paused');
  const before = control.snapshot;
  await new Promise((r) => setTimeout(r, 550));
  expect(control.snapshot.activeMs).toBe(before.activeMs);
  await control.markSave();
  expect(control.snapshot.phase).toBe('Paused');
  await control.resume();
  await until(() => control.snapshot.phase === 'Cancelled');
  expect(control.snapshot).toMatchObject({
    reason: 'hardTime',
    generation: 0,
    evaluations: 0,
  });
  await expect(control.resume()).rejects.toThrow();
  const soft = new TrainingController(
    new TestStore(),
    nodeComputePort,
    'soft-fixture',
    8,
  );
  d.mode = 'headless';
  d.time = { seconds: 0.001, hard: false };
  await soft.start(d);
  await until(() => soft.snapshot.phase === 'Completed');
  expect(soft.snapshot).toMatchObject({
    reason: 'wallTime',
    generation: 1,
    evaluations: 8,
  });
}, 25000);
it('evaluates flat goals after full results and stops exactly at the consecutive generation or logical budget', async () => {
  for (const goal of [true, false]) {
    const d = small();
    d.options.generations = 7;
    d.options.budget = 17;
    if (goal)
      d.goal = {
        logic: 'or',
        leaves: [
          { metric: 'successes', threshold: 0 },
          { metric: 'lapTime', threshold: 1 },
        ],
        consecutive: 2,
      };
    const db = new TestStore(),
      control = new TrainingController(
        db,
        nodeComputePort,
        'budget-fixture',
        8,
      );
    await control.start(d);
    await until(() => control.snapshot.phase === 'Completed');
    expect(control.snapshot).toMatchObject({
      reason: goal ? 'goal' : 'budget',
      generation: 2,
      evaluations: 16,
    });
    const index = decode<RunIndex>(
      (await db.get('run:' + control.snapshot.runId))!,
    );
    const { cp, evolution } = await restore(
      db,
      index.latest,
      'budget-fixture',
      8,
    );
    expect(cp.nextGeneration).toBeNull();
    expect(evolution.population).toHaveLength(0);
  }
}, 25000);
it('preserves a recoverable terminal write if an in-flight worker is deliberately cancelled', async () => {
  const db = new TestStore(),
    control = new TrainingController(db, nodeComputePort, 'cancel-fixture', 8),
    d = small();
  d.mode = 'live';
  await control.start(d);
  const id = 'run:' + control.snapshot.runId,
    prior = decode<RunIndex>((await db.get(id))!);
  db.rejectGeneration = 0;
  await control.serialize(() => control.cancel());
  await new Promise((r) => setTimeout(r, 50));
  await control.serialize(() => {});
  expect(control.snapshot).toMatchObject({
    phase: 'Recoverable',
    generation: 0,
    evaluations: 0,
  });
  expect(decode<RunIndex>((await db.get(id))!).latest).toBe(prior.latest);
  db.rejectGeneration = null;
  await control.retry();
  expect(control.snapshot.phase).toBe('Cancelled');
  expect(decode<RunIndex>((await db.get(id))!).terminal).toBe(true);
}, 15000);
