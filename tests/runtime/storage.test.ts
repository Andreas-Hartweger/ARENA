import { expect, it } from 'vitest';
import { Evolution } from '../../src/training/evolution';
import {
  defaultDraft,
  preflight,
  matchedGoal,
} from '../../src/runtime/runConfig';
import { fingerprint } from '../../src/runtime/fingerprint';
import { boundary, restore } from '../../src/storage/checkpoint';
import {
  deletionPreview,
  jsonObject,
  type StorePort,
  type StoredObject,
} from '../../src/storage/objects';
import {
  writeArchive,
  scanArchive,
  strictJson,
} from '../../src/storage/archive';
import { seriesDrafts } from '../../src/runtime/queue';
import {
  createModel,
  readVersion,
  compareParameters,
} from '../../src/storage/library';
class MemoryStore implements StorePort {
  values = new Map<string, StoredObject>();
  async list() {
    return Array.from(this.values.values(), (x) => x.meta);
  }
  async get(id: string) {
    const x = this.values.get(id);
    return x ? structuredClone(x) : undefined;
  }
  async commit(rows: readonly StoredObject[]) {
    for (const r of rows) this.values.set(r.meta.id, structuredClone(r));
    return 1;
  }
}
it('prepares without publication, restores at G0/G1 and terminal, and matches every later real episode', async () => {
  const draft = defaultDraft();
  draft.hidden = [4];
  draft.options = { n: 8, generations: 3, runId: 'fixture' };
  draft.scenarios = [
    { task: { maxTicks: 12, graceTicks: 0, noProgressTicks: 12 } },
  ];
  const { m, scenarios } = preflight(draft, fingerprint, 8),
    e = new Evolution(m, scenarios, fingerprint, draft.options);
  const db = new MemoryStore(),
    counts = {
      segment: 0,
      globalGeneration: 0,
      logicalEpisodes: 0,
      activeMs: 0,
      goalStreak: 0,
      revision: 0,
      previousSegments: [],
    };
  let b = boundary(e, undefined, draft, draft, counts, 'test', null, []);
  await db.commit(b.objects);
  for (let i = 0; i < 3; i++) {
    const recovered = await restore(db, b.checkpoint.id, 'test', 8);
    const actual = recovered.evolution.commit(recovered.evolution.collect());
    const stage = e.prepare(e.collect());
    expect(e.nextGeneration).toBe(i);
    expect(e.history.length).toBe(Math.min(1, i));
    expect(stage.snapshot.summary).toEqual(actual);
    counts.globalGeneration++;
    counts.logicalEpisodes += 8;
    b = boundary(
      e,
      stage,
      draft,
      draft,
      counts,
      'test',
      i === 2 ? 'budget' : null,
      b.checkpoint.history,
      b.index,
    );
    await db.commit(b.objects);
    stage.publish();
    e.compactHistory(b.checkpoint.history.length);
    expect(() => stage.publish()).toThrow();
    expect(e.population.map((x) => x.genome.hash)).toEqual(
      recovered.evolution.population.map((x) => x.genome.hash),
    );
  }
  const saved = await restore(
    db,
    b.index.automatic[1],
    'test',
    8,
    'fork-identity',
  );
  expect(saved.evolution.nextGeneration).toBe(2);
  expect(
    saved.evolution.history.every((h) =>
      h.records.every((r) => JSON.parse(r.id)[0] === 'fork-identity'),
    ),
  ).toBe(true);
  expect(saved.evolution.commit(saved.evolution.collect()).fitness).toEqual(
    e.history.at(-1)!.fitness,
  );
  expect(b.index.automatic).toHaveLength(3);
  expect(b.checkpoint.nextGeneration).toBeNull();
  const original = db.values.get(b.checkpoint.id)!;
  await expect(
    restore(db, b.checkpoint.id, 'other-runtime', 8),
  ).rejects.toThrow();
  db.values.set(b.checkpoint.id, {
    ...original,
    meta: { ...original.meta, refs: [] },
  });
  await expect(restore(db, b.checkpoint.id, 'test', 8)).rejects.toThrow(
    /Referenzgraph/,
  );
  db.values.set(b.checkpoint.id, original);
  const terminal = await restore(db, b.checkpoint.id, 'test', 8);
  expect(terminal.evolution.population.length).toBe(0);
  expect(() => terminal.evolution.collect()).toThrow();
  expect(
    matchedGoal(
      {
        logic: 'and',
        consecutive: 1,
        leaves: [{ metric: 'lapTime', threshold: 90 }],
      },
      terminal.evolution.history[0],
    ),
  ).toBe(false);
  expect(deletionPreview(await db.list(), []).remove.length).toBeGreaterThan(0);
  const metadata = await db.list();
  expect(() => deletionPreview(metadata, [b.checkpoint.id])).toThrow();
}, 25000);
it('checks unopened goals, resource preflight, series cardinality and immutable clone bytes', async () => {
  const draft = defaultDraft();
  draft.options.n = 1024;
  draft.hidden = [128, 128, 128, 128];
  draft.profile = 'Eco';
  expect(() => preflight(draft, fingerprint, 16)).toThrow(/RAM/);
  const d = defaultDraft();
  expect(
    seriesDrafts(d, 'mutation.p', [0.01, 0.05, 0.1], [1, 2, 3], 115200).budget,
  ).toBe(115200);
  expect(() => seriesDrafts(d, 'mutation.p', [1, 2], [1, 2], 1)).toThrow();
  const db = new MemoryStore(),
    p = await createModel(db, 'A', d, undefined, 8),
    v = await readVersion(db, p.active),
    p2 = await createModel(
      db,
      'B',
      d,
      { id: v.version.id, genome: v.genome, origin: 'clone' },
      8,
    );
  const clone = await readVersion(db, p2.active);
  expect(clone.version.modelId).not.toBe(p.id);
  expect(clone.version.genome).toBe(v.version.genome);
  expect(
    compareParameters(v.genome, clone.genome).every((l) => l.changed === 0),
  ).toBe(true);
});
it('round-trips STORE entries and enforces manifest, checksum, JSON and byte bounds', async () => {
  const good = jsonObject('settings', 'settings:test', { level: 1 });
  const file = await writeArchive(
    (async function* () {
      yield { name: 'manifest.json', bytes: good.bytes };
      yield { name: 'genomes/0.bin', bytes: new Uint8Array([0, 1, 2]) };
    })(),
  );
  const scan = await scanArchive(file);
  expect(await scan.read(scan.records[1])).toEqual(new Uint8Array([0, 1, 2]));
  expect(strictJson(await scan.read(scan.records[0]))).toEqual({ level: 1 });
  for (const raw of [
    '{"v":1,"v":2}',
    '[1e999]',
    '['.repeat(34) + '0' + ']'.repeat(34),
  ])
    expect(() => strictJson(new TextEncoder().encode(raw))).toThrow();
  await expect(scanArchive(file.slice(0, file.size - 1))).rejects.toThrow();
  await expect(scanArchive(file, 1)).rejects.toThrow();
});
