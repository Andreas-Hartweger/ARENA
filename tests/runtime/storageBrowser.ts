import { TrainingDatabase } from '../../src/storage/database';
import { decode, jsonObject, deletionPreview } from '../../src/storage/objects';
import {
  exportPackage,
  importPackage,
  previewPackage,
  type PackageType,
} from '../../src/storage/transfer';
import {
  createModel,
  editProfile,
  profiles,
  readVersion,
} from '../../src/storage/library';
import { prepareQueue, queue, writeQueue } from '../../src/runtime/queue';
import { defaultDraft, preflight } from '../../src/runtime/runConfig';
import {
  boundary,
  restore,
  type RunCounters,
} from '../../src/storage/checkpoint';
import { Evolution } from '../../src/training/evolution';
import {
  fingerprint,
  sha256,
  parameterBytes,
} from '../../src/runtime/fingerprint';
import { LabClient } from '../../src/app/labClient';
import type { RunState } from '../../src/runtime/controller';
import vectors from '../../docs/training-management/specification/reference_vectors.json';
const runtime = 'arena.02c.cpu.v1|' + navigator.userAgent;
type Package = { kind: PackageType; data: number[]; roots: string[] };
function check(test: unknown, message: string): asserts test {
  if (!test) throw Error(message);
}
async function rejects(action: () => Promise<unknown>, pattern: RegExp) {
  try {
    await action();
  } catch (e) {
    check(pattern.test(String(e)), String(e));
    return String(e);
  }
  throw Error('Expected rejection: ' + pattern.source);
}
function draft() {
  const d = defaultDraft();
  d.hidden = [4];
  d.options = { n: 8, generations: 4, master: 42 };
  d.scenarios = [
    { task: { maxTicks: 24, graceTicks: 0, noProgressTicks: 24 } },
  ];
  d.profile = 'Custom';
  d.custom.workers = 1;
  return d;
}
async function produce() {
  const db = await TrainingDatabase.open('transfer-source');
  await db.acquire('source');
  try {
    const d = draft(),
      p = await createModel(db, 'Probe', d, undefined, 8);
    d.sourceVersion = p.active;
    d.options.runId = 'source';
    await writeQueue(
      db,
      {
        enabled: true,
        entries: [{ id: 'entry-1', revision: 1, draft: d, autoStart: true }],
      },
      8,
    );
    const v = await readVersion(db, p.active),
      { m, scenarios } = preflight(d, fingerprint, 8),
      e = new Evolution(m, scenarios, fingerprint, d.options, v.genome);
    const counts: RunCounters = {
      globalGeneration: 0,
      logicalEpisodes: 0,
      activeMs: 0,
      goalStreak: 0,
      revision: 0,
      segment: 0,
      previousSegments: [],
    };
    const before = boundary(e, undefined, d, d, counts, runtime, null, []);
    await db.commit(before.objects);
    const stage = e.prepare(e.collect());
    counts.globalGeneration++;
    counts.logicalEpisodes += 8;
    const after = boundary(
      e,
      stage,
      d,
      d,
      counts,
      runtime,
      null,
      [],
      before.index,
    );
    await db.commit(after.objects, { replace: ['run:source'] });
    stage.publish();
    const packets: Package[] = [];
    for (const [kind, roots] of [
      ['model', [p.id]],
      ['checkpoint', [after.checkpoint.id]],
      ['backup', ['run:source', p.id, 'queue:main']],
    ] as const) {
      const blob = await exportPackage(db, kind, [...roots], runtime);
      packets.push({
        kind,
        roots: [...roots],
        data: Array.from(new Uint8Array(await blob.arrayBuffer())),
      });
    }
    return {
      packets,
      fingerprint: v.genome.hash,
      next: e.population.map((x) => x.genome.hash),
      model: p.id,
      version: p.active,
      latest: after.checkpoint.id,
      prior: before.checkpoint.id,
    };
  } finally {
    await db.release();
    db.close();
  }
}
async function consume(source: Awaited<ReturnType<typeof produce>>) {
  const db = await TrainingDatabase.open();
  await db.acquire('consumer');
  const seen = [];
  try {
    for (const packet of source.packets) {
      const blob = new Blob([Uint8Array.from(packet.data)]),
        p = await previewPackage(db, blob);
      check(!p.conflicts.length, 'Fresh compatible package conflicted');
      await importPackage(db, p);
      const again = await previewPackage(db, blob);
      check(!again.conflicts.length, 'Second import conflicts');
      const initial = (await db.list()).length;
      await importPackage(db, again);
      check(
        (await db.list()).length === initial,
        'Repeated import duplicated objects',
      );
      seen.push({ kind: packet.kind, bytes: blob.size, objects: initial });
    }
    const q = await queue(db);
    check(
      !q.enabled && q.entries.every((e) => !e.autoStart),
      'Imported automation armed',
    );
    const v = await readVersion(db, source.version);
    check(
      v.version.origin === 'import' && v.genome.hash === source.fingerprint,
      'Imported identity',
    );
    const restored = await restore(db, source.latest, runtime, 8);
    check(
      JSON.stringify(
        restored.evolution.population.map((m) => m.genome.hash),
      ) === JSON.stringify(source.next),
      'Restored population',
    );
    await editProfile(db, source.model, { name: 'Lokale Bearbeitung' });
    const model = new Blob([Uint8Array.from(source.packets[0].data)]),
      conflict = await previewPackage(db, model);
    check(conflict.conflicts.includes(source.model), 'Conflict not detected');
    await rejects(() => importPackage(db, conflict), /Konflikt/);
    const [variant] = await importPackage(db, conflict, true);
    check(
      variant !== source.model && (await profiles(db)).length === 2,
      'Variant identity',
    );
  } finally {
    await db.release();
    db.close();
  }
  const client = new LabClient();
  try {
    await rejects(
      () => client.call({ type: 'recover', id: source.prior }),
      /Ursprung/,
    );
    await client.call({
      type: 'recover',
      id: source.prior,
      sourceStopped: true,
    });
    const fork = await client.call<RunState>({ type: 'status' });
    check(
      fork.phase === 'Paused' && fork.runId !== 'source',
      'Fork overwrote source',
    );
    await client.call({ type: 'resume' });
    const end = performance.now() + 30000;
    for (;;) {
      const s = await client.call<RunState>({ type: 'status' });
      if (s.phase === 'Completed') {
        check(s.evaluations === 32, 'Fork budget');
        break;
      }
      check(performance.now() < end && !s.error, 'Fork failed: ' + s.error);
      await new Promise((r) => setTimeout(r, 25));
    }
    return {
      seen,
      fork: fork.runId,
      importedQueueDisabled: true,
      sourceGenome: source.fingerprint,
    };
  } finally {
    client.close();
  }
}
async function faults() {
  const db = await TrainingDatabase.open('fault-boundaries');
  await db.acquire('first');
  const a = jsonObject('settings', 'settings:a', { a: 1 }, [], true),
    b = jsonObject('settings', 'settings:b', { b: 1 }, [], true);
  await db.commit([a]);
  const baseline = await db.status();
  await rejects(
    () => db.commit([b], { expectedRevision: baseline.revision + 1 }),
    /Stale/,
  );
  await rejects(
    () => db.commit([b, jsonObject('settings', a.meta.id, { a: 2 })]),
    /conflict/i,
  );
  check(
    !(await db.get(b.meta.id)) &&
      (await db.status()).revision === baseline.revision,
    'Partial transaction',
  );
  await db.stage('discard', b);
  await db.discardStage('discard');
  check(!(await db.get(b.meta.id)), 'Visible stage');
  await db.stage('old', b);
  await db.release();
  await db.acquire('second');
  await rejects(
    () => db.commit([], {}, { id: 'old', keys: [b.meta.id] }),
    /missing/,
  );
  await db.stage('publish', b);
  await rejects(
    () =>
      db.commit(
        [],
        { budget: baseline.total },
        { id: 'publish', keys: [b.meta.id] },
      ),
    /budget/,
  );
  check(!(await db.get(b.meta.id)), 'Partial quota failure');
  await db.commit([], {}, { id: 'publish', keys: [b.meta.id] });
  check(!!(await db.get(b.meta.id)), 'Lost commit before cleanup');
  await db.release();
  db.close();
  const reopened = await TrainingDatabase.open('fault-boundaries');
  await reopened.acquire('third');
  const ok =
    !!(await reopened.get(a.meta.id)) && !!(await reopened.get(b.meta.id));
  check(ok, 'Incomplete dataset after reopen');
  await reopened.release();
  reopened.close();
  const bytes = parameterBytes(new Float64Array(vectors.parameters));
  check(
    sha256(bytes) === vectors.canonicalRawSha256 &&
      fingerprint(vectors.header, new Float64Array(vectors.parameters)) ===
        vectors.fingerprint,
    'Browser digest vector',
  );
  return {
    cases: [
      'stale-before-write',
      'rollback-mid-transaction',
      'discard-before-publication',
      'abandoned-staging',
      'quota-before-publication',
      'reopen-after-publication',
      'python-digest',
    ],
    canonical: sha256(bytes),
  };
}
async function migration() {
  const name = 'legacy-fixture',
    old = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => {
        for (const s of ['meta', 'state', 'data', 'stage'])
          r.result.createObjectStore(s);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  const marker = jsonObject(
      'settings',
      'settings:legacy',
      { preserved: 'v1' },
      [],
      true,
    ),
    tx = old.transaction(['meta', 'data'], 'readwrite');
  tx.objectStore('meta').put(marker.meta, marker.meta.id);
  tx.objectStore('data').put(marker.bytes, marker.meta.id);
  await new Promise<void>((r, j) => {
    tx.oncomplete = () => r();
    tx.onabort = () => j(tx.error);
  });
  await rejects(() => TrainingDatabase.open(name), /wartet/);
  old.close();
  const db = await TrainingDatabase.open(name);
  await db.acquire('migration');
  const rows = await db.list('settings');
  check(
    rows.length === 1 &&
      decode<{ preserved: string }>((await db.get(rows[0].id))!).preserved ===
        'v1',
    'Migration data loss',
  );
  const stale = await prepareQueue(db, { entries: [], enabled: false });
  await db.commit([stale]);
  await rejects(
    () => writeQueue(db, { entries: [], enabled: false }),
    /inzwischen/,
  );
  check(
    !deletionPreview(await db.list(), []).remove.length,
    'Migration orphan',
  );
  await db.release();
  db.close();
  return {
    schema: 2,
    legacyChecksum: marker.meta.checksum,
    blockedReported: true,
    staleQueueRejected: true,
  };
}
Object.assign(window, {
  storageCases: { produce, consume, faults, migration },
});
