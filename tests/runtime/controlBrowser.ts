import { analyzeVersions } from '../../src/app/analysisClient';
import { defaultDraft } from '../../src/runtime/runConfig';
import type { LabCommand, LabEvent } from '../../src/runtime/labProtocol';
import type { Profile } from '../../src/storage/library';
import type { RunIndex } from '../../src/storage/checkpoint';
import type { RunState } from '../../src/runtime/controller';
export async function controlCases() {
  const coordinator = new Worker(
    new URL('../../src/runtime/lab.worker.ts', import.meta.url),
    { type: 'module' },
  );
  const ready = new Promise<void>((resolve, reject) => {
    coordinator.onmessage = (e) => {
      if (e.data.type === 'ready') resolve();
    };
    coordinator.onerror = (e) => reject(Error(e.message));
  });
  let seq = 0,
    session = '';
  type Ack = Extract<LabEvent, { type: 'ack' }>;
  const packet = (command: LabCommand) => ({
    version: 1,
    id: crypto.randomUUID(),
    seq: ++seq,
    session,
    command,
  });
  async function send(input: unknown) {
    const answer = new Promise<Ack>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error('Command receipt timed out')),
        15000,
      );
      coordinator.onmessage = (e) => {
        if (e.data.type === 'ack') {
          clearTimeout(timer);
          resolve(e.data);
        }
      };
    });
    coordinator.postMessage(input);
    return answer;
  }
  async function call<T>(command: LabCommand) {
    const a = await send(packet(command));
    if (!a.ok) throw Error(String(a.error));
    session = a.session;
    return a.value as T;
  }
  function check(ok: unknown, message: string) {
    if (!ok) throw Error(message);
  }
  try {
    await ready;
    const malformed = await send(null);
    check(!malformed.ok, 'Malformed envelope accepted');
    const d = defaultDraft();
    d.hidden = [4];
    d.options = { n: 8, generations: 4 };
    d.mode = 'live';
    d.profile = 'Custom';
    d.custom.workers = 1;
    d.scenarios = [
      { task: { maxTicks: 120, graceTicks: 0, noProgressTicks: 120 } },
    ];
    const create = packet({
      type: 'create',
      name: 'Isolierte Abnahme',
      draft: d,
    });
    const original = await send(create),
      duplicate = await send(create);
    check(
      original.ok &&
        duplicate.ok &&
        JSON.stringify(original.value) === JSON.stringify(duplicate.value),
      'Duplicate create not idempotent',
    );
    const conflict = await send({
      ...create,
      command: { type: 'create', name: 'Andere Daten', draft: d },
    });
    check(!conflict.ok, 'Conflicting command ID accepted');
    const models = await call<Profile[]>({ type: 'library' });
    check(models.length === 1, 'Duplicated profile');
    d.sourceVersion = models[0].active;
    await call({ type: 'start', draft: d });
    const doubled = await send(packet({ type: 'start', draft: d }));
    check(!doubled.ok, 'Second run started');
    const late = await send({
      ...packet({ type: 'cancel' }),
      session: 'previous-session',
    });
    check(!late.ok, 'Stale cancellation accepted');
    await call({ type: 'pause' });
    const waitEnd = performance.now() + 10000;
    while ((await call<RunState>({ type: 'status' })).phase !== 'Paused') {
      check(performance.now() < waitEnd, 'No pause ACK');
      await new Promise((r) => setTimeout(r, 20));
    }
    const held = await call<RunState>({ type: 'status' });
    await call({ type: 'save' });
    const before = await call<RunState>({ type: 'status' });
    check(
      before.phase === 'Paused' &&
        before.commits === held.commits + 1 &&
        before.activeMs === held.activeMs,
      'Paused save changed execution or did not publish',
    );
    const dbBefore = await call<RunIndex[]>({ type: 'checkpoints' }),
      storeBefore = await call<{ status: { revision: number } }>({
        type: 'storage',
      });
    const analysis = await analyzeVersions({
      versions: [models[0].active],
      draft: d,
    });
    const after = await call<RunState>({ type: 'status' }),
      dbAfter = await call<RunIndex[]>({ type: 'checkpoints' }),
      storeAfter = await call<{ status: { revision: number } }>({
        type: 'storage',
      });
    check(
      analysis.purpose === 'test' && analysis.results.length === 1,
      'Read-only comparison missing',
    );
    check(
      before.runId === after.runId &&
        before.sessionId === after.sessionId &&
        before.generation === after.generation &&
        before.commits === after.commits &&
        before.activeMs === after.activeMs &&
        before.managedEstimate === after.managedEstimate &&
        before.monitor?.attempts === after.monitor?.attempts &&
        before.monitor?.workers === after.monitor?.workers &&
        JSON.stringify(dbBefore) === JSON.stringify(dbAfter) &&
        storeBefore.status.revision === storeAfter.status.revision,
      'Analysis altered primary run',
    );
    const invalid = await send(
      packet({ type: 'observe', visible: 17, slot: null }),
    );
    check(!invalid.ok, 'Observation limit exceeded');
    const cfg = await send(
      packet({
        type: 'display',
        settings: {
          mode: 'live',
          rate: NaN,
          profile: 'Custom',
          custom: d.custom,
        },
      }),
    );
    check(!cfg.ok, 'Invalid rate accepted');
    await call({ type: 'cancel' });
    const staleResume = await send(packet({ type: 'resume' }));
    check(!staleResume.ok, 'Terminal session resumed');
    const final = await call<RunState>({ type: 'status' });
    check(
      final.generation === 0 && !final.summary && final.phase === 'Cancelled',
      'Partial generation published',
    );
    const quick = {
      ...d,
      mode: 'headless' as const,
      options: { ...d.options, generations: 1 },
    };
    const entries = [31, 32].map((master) => ({
      id: 'scheduled-' + master,
      revision: 1,
      draft: { ...quick, options: { ...quick.options, master } },
      autoStart: true,
    }));
    await call({ type: 'writeQueue', value: { enabled: true, entries } });
    await call({ type: 'dispatchQueue' });
    const firstRun = (await call<RunState>({ type: 'status' })).runId;
    const deadline = performance.now() + 60000;
    let last = await call<RunState>({ type: 'status' });
    while (last.runId === firstRun || last.phase !== 'Completed') {
      check(
        performance.now() < deadline && !last.error,
        'FIFO did not finish: ' + last.error,
      );
      await new Promise((r) => setTimeout(r, 30));
      last = await call<RunState>({ type: 'status' });
    }
    const remaining = await call<{ entries: unknown[]; enabled: boolean }>({
        type: 'queue',
      }),
      indices = await call<RunIndex[]>({ type: 'checkpoints' }),
      secondDraft = await call<typeof quick>({ type: 'currentDraft' });
    check(
      remaining.entries.length === 0 &&
        secondDraft.options.master === 32 &&
        indices.some(
          (r) => r.id === firstRun && r.terminal && r.globalGeneration === 1,
        ) &&
        last.evaluations === 8,
      'FIFO order or totals changed',
    );
    const q = await call<import('../../src/runtime/queue').QueueState>({
      type: 'queue',
    });
    await call({
      type: 'writeQueue',
      value: {
        version: q.version,
        enabled: true,
        entries: entries.map((e, i) => ({
          ...e,
          id: 'fault-' + i,
          draft: { ...e.draft, mode: 'live' },
        })),
      },
    });
    await call({ type: 'dispatchQueue' });
    const space = await call<{ status: { total: number; budget: number } }>({
      type: 'storage',
    });
    await call({ type: 'diskBudget', bytes: space.status.total + 16 });
    await call({
      type: 'display',
      settings: {
        mode: 'headless',
        rate: 'max',
        profile: d.profile,
        custom: d.custom,
      },
    });
    const faultDeadline = performance.now() + 60000;
    let failed = await call<RunState>({ type: 'status' });
    while (failed.phase !== 'Recoverable') {
      check(
        performance.now() < faultDeadline && failed.phase !== 'Completed',
        'Quota barrier was skipped',
      );
      await new Promise((r) => setTimeout(r, 30));
      failed = await call<RunState>({ type: 'status' });
    }
    const waiting = await call<import('../../src/runtime/queue').QueueState>({
      type: 'queue',
    });
    check(
      !waiting.enabled &&
        waiting.entries.length === 1 &&
        failed.evaluations === 0,
      'Automation continued on storage fault',
    );
    await call({ type: 'diskBudget', bytes: space.status.budget });
    await call({ type: 'retry' });
    const recovered = await call<RunState>({ type: 'status' });
    check(
      recovered.phase === 'Completed' &&
        recovered.runId === failed.runId &&
        recovered.evaluations === 8,
      'Quota retry did not preserve run',
    );
    check(
      (
        await call<import('../../src/runtime/queue').QueueState>({
          type: 'queue',
        })
      ).entries.length === 1,
      'Retry rearmed queue without consent',
    );
    return {
      queueFault: {
        phase: failed.phase,
        committedBeforeRetry: failed.evaluations,
        committedAfterRetry: recovered.evaluations,
        remaining: waiting.entries.length,
        automatic: false,
      },
      fifo: {
        firstRun,
        lastRun: last.runId,
        lastSeed: secondDraft.options.master,
        completedRuns: 2,
      },
      duplicateSuppressed: true,
      conflictRejected: true,
      cancelledBeforeG0: true,
      pausedSave: true,
      isolatedAnalysis: {
        run: after.runId,
        session: after.sessionId,
        generation: after.generation,
        workers: after.monitor?.workers,
        cursor: after.monitor?.attempts,
        commit: after.commits,
        revision: storeAfter.status.revision,
        checkpoint: dbAfter[0].latest,
        genome: analysis.results[0].genome,
        ticks: analysis.results[0].ticks,
        unchanged: true,
      },
    };
  } finally {
    coordinator.terminate();
  }
}
