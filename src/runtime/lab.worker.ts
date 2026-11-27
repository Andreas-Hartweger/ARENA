import { TrainingController } from './controller';
import { TrainingDatabase } from '../storage/database';
import { browserPort } from './browserPort';
import {
  compareParameters,
  createModel,
  editProfile,
  profiles,
  readVersion,
  saveVersion,
} from '../storage/library';
import { decode, deletionPreview, jsonObject } from '../storage/objects';
import { queue, writeQueue } from './queue';
import { preflight } from './runConfig';
import { fingerprint } from './fingerprint';
import {
  exportPackage,
  importPackage,
  previewPackage,
} from '../storage/transfer';
import { evaluate } from '../training/episode';
import { type Envelope, type LabCommand, type LabEvent } from './labProtocol';
import type { RunIndex } from '../storage/checkpoint';
const runtime = 'arena.02c.cpu.v1|' + navigator.userAgent,
  hardware = navigator.hardwareConcurrency;
const db = await TrainingDatabase.open(),
  owner = crypto.randomUUID(),
  controller = new TrainingController(db, browserPort, runtime, hardware);
const send = (event: LabEvent) => postMessage(event);
let writer = false,
  auto = false,
  generationSubscription = false;
async function acquire() {
  if (!writer) {
    await db.acquire(owner);
    writer = true;
  }
}
async function release() {
  if (writer) {
    await db.release();
    writer = false;
  }
}
const active = () =>
  !['Draft', 'Completed', 'Cancelled', 'Faulted'].includes(
    controller.snapshot.phase,
  );
async function start(d: Parameters<typeof controller.start>[0]) {
  await acquire();
  const source = d.sourceVersion
    ? await readVersion(db, d.sourceVersion)
    : undefined;
  await controller.start(d, source?.genome);
}
async function terminal() {
  if (active()) return;
  try {
    if (auto && controller.snapshot.phase === 'Completed') {
      const q = await queue(db),
        next = q.entries[0];
      if (q.enabled && next?.autoStart) {
        preflight(next.draft, fingerprint, hardware);
        await start(next.draft);
        q.entries.shift();
        await writeQueue(db, q, hardware);
        return;
      }
    } else auto = false;
  } finally {
    if (!active()) await release();
  }
}
controller.changed = (state) => {
  send({ type: 'state', state });
  if (['Completed', 'Cancelled', 'Faulted'].includes(state.phase))
    void controller.serialize(terminal).catch((e) =>
      send({
        type: 'state',
        state: { ...controller.snapshot, error: String(e) },
      }),
    );
};
controller.observed = (sample) => {
  if (generationSubscription) send({ type: 'observation', sample });
};
let preview: Awaited<ReturnType<typeof previewPackage>> | undefined,
  previewId = '';
async function handle(c: LabCommand) {
  switch (c.type) {
    case 'status':
      return controller.snapshot;
    case 'observe':
      generationSubscription = c.visible > 0;
      controller.observe(c.visible, c.slot);
      return;
    case 'start':
      await start(c.draft);
      return;
    case 'pause':
      return controller.pause();
    case 'drain':
      return controller.pause(true);
    case 'resume':
      return controller.resume();
    case 'finish':
      return controller.finish();
    case 'cancel':
      return controller.cancel();
    case 'retry':
      return controller.retry();
    case 'save':
      return controller.markSave();
    case 'display':
      return controller.display(c.settings);
    case 'revise':
      return controller.revise(c.learning, c.scenarios);
    case 'population':
      return controller.population(c.offset, c.limit);
    case 'brain':
      return controller.selectedBrain(c.slot);
    case 'history':
      return controller.history();
    case 'recover':
      await acquire();
      auto = false;
      await controller.recover(c.id);
      return;
    case 'library':
      return profiles(db);
    case 'create': {
      await acquire();
      const v = c.source ? await readVersion(db, c.source) : undefined;
      return createModel(
        db,
        c.name,
        c.draft,
        v ? { genome: v.genome, id: v.version.id, origin: 'clone' } : undefined,
        hardware,
      );
    }
    case 'profile':
      await acquire();
      return editProfile(db, c.id, c.changes);
    case 'champion': {
      await acquire();
      const best = controller.champion(),
        d = controller.draft;
      if (!best || !d) throw Error('Noch kein bestätigter Champion.');
      const { scenarios } = preflight(d, fingerprint, hardware);
      return saveVersion(db, c.profile, best.genome, d, 'champion', best.id, {
        purpose: 'training',
        value: best.fitness,
        contract: scenarios.map((s) => s.key).join(','),
        sampleCount: scenarios.length,
        seed: d.options.master ?? 42,
        track: scenarios[0].track.def.name,
        vehicle: 'GT-01',
        runtime,
        verified: true,
      });
    }
    case 'compare': {
      const a = await readVersion(db, c.a),
        b = await readVersion(db, c.b);
      return compareParameters(a.genome, b.genome);
    }
    case 'drive': {
      if (active())
        throw Error('Vergleichsfahrt nach dem aktiven Lauf verfügbar.');
      const v = await readVersion(db, c.version),
        { scenarios } = preflight(c.draft, fingerprint, hardware);
      return evaluate(scenarios[0], v.genome.brain(), {
        maxSamples: 600,
        everyTicks: 12,
      });
    }
    case 'storage':
      return {
        status: await db.status(),
        meta: await db.list(),
        quota: await navigator.storage.estimate(),
        persistent: await navigator.storage.persisted(),
      };
    case 'diskBudget':
      await acquire();
      return db.commit([], { budget: c.bytes });
    case 'previewDelete': {
      const status = await db.status(),
        all = await db.list();
      return { ...deletionPreview(all, c.ids), revision: status.revision };
    }
    case 'purge': {
      await acquire();
      const all = await db.list();
      for (const id of c.ids) {
        const item = await db.get(id);
        if (
          !item ||
          item.meta.kind !== 'profile' ||
          !decode<{ trashedAt: number | null }>(item).trashedAt
        )
          throw Error('Zuerst in den Papierkorb verschieben.');
      }
      const checked = deletionPreview(all, c.ids);
      return db.commit([], {
        remove: checked.remove,
        expectedRevision: c.revision,
      });
    }
    case 'queue':
      return queue(db);
    case 'writeQueue':
      await acquire();
      await writeQueue(db, c.value, hardware);
      auto = c.value.enabled;
      return;
    case 'template': {
      await acquire();
      preflight(c.draft, fingerprint, hardware);
      if (!c.name.trim() || [...c.name].length > 64)
        throw Error('Name fehlt oder ist zu lang.');
      return db.commit([
        jsonObject(
          'template',
          'template:' + crypto.randomUUID(),
          { name: c.name, draft: c.draft },
          c.draft.sourceVersion ? [c.draft.sourceVersion] : [],
          true,
        ),
      ]);
    }
    case 'templates': {
      const rows = [];
      for (const m of await db.list())
        if (m.kind === 'template') {
          const o = (await db.get(m.id))!;
          rows.push({ id: m.id, name: decode<{ name: string }>(o).name });
        }
      return rows;
    }
    case 'loadTemplate': {
      const o = await db.get(c.id);
      if (o?.meta.kind !== 'template') throw Error('Vorlage fehlt.');
      return decode(o);
    }
    case 'export':
      await acquire();
      return exportPackage(db, c.kind, c.roots, runtime);
    case 'previewImport': {
      preview = await previewPackage(db, c.file);
      previewId = crypto.randomUUID();
      return {
        id: previewId,
        type: preview.manifest.type,
        objects: preview.manifest.entries.length,
        roots: preview.manifest.roots,
        conflicts: preview.conflicts,
        size: preview.size,
      };
    }
    case 'import': {
      if (!preview || c.previewId !== previewId)
        throw Error('Vorschau erneuern.');
      await acquire();
      const result = await importPackage(db, preview, c.variant);
      preview = undefined;
      return result;
    }
    case 'checkpoints': {
      const rows = [];
      for (const m of await db.list())
        if (m.kind === 'run') {
          const o = await db.get(m.id);
          if (o) rows.push(decode<RunIndex>(o));
        }
      return rows;
    }
    case 'integrity': {
      for (const m of await db.list()) {
        const o = await db.get(m.id);
        if (!o) throw Error('Objekt fehlt.');
        if (m.kind === 'genome') {
          const { sha256 } = await import('./fingerprint');
          if (sha256(o.bytes) !== m.checksum)
            throw Error('Genom-Prüfsumme falsch.');
        } else decode(o);
      }
      return true;
    }
    default:
      throw Error('Unbekannter Befehl.');
  }
}
let sequence = 0;
const receipts = new Map<
  string,
  { seq: number; type: string; receipt: LabEvent }
>();
self.onmessage = (event: MessageEvent<Envelope>) => {
  const input = event.data;
  void controller.serialize(async () => {
    let receipt: LabEvent;
    try {
      if (
        input?.version !== 1 ||
        typeof input.id !== 'string' ||
        input.id.length > 100 ||
        !Number.isSafeInteger(input.seq) ||
        !input.command
      )
        throw Error('Ungültiger Befehl.');
      const previous = receipts.get(input.id);
      if (previous) {
        if (previous.seq !== input.seq || previous.type !== input.command.type)
          throw Error('Widersprüchliche Befehls-ID.');
        send(previous.receipt);
        return;
      }
      if (input.seq <= sequence) throw Error('Veraltete Befehlsfolge.');
      sequence = input.seq;
      if (
        [
          'pause',
          'drain',
          'resume',
          'finish',
          'cancel',
          'retry',
          'save',
          'display',
          'revise',
          'champion',
        ].includes(input.command.type) &&
        input.session !== controller.snapshot.sessionId
      )
        throw Error('Veraltete Sitzung.');
      const value = await handle(input.command);
      receipt = {
        type: 'ack',
        id: input.id,
        seq: input.seq,
        session: controller.snapshot.sessionId,
        ok: true,
        value,
      };
    } catch (e) {
      receipt = {
        type: 'ack',
        id: input?.id ?? '',
        seq: input?.seq ?? 0,
        session: controller.snapshot.sessionId,
        ok: false,
        error: String(e),
      };
    } finally {
      if (!active()) await release();
    }
    if (
      receipt.type === 'ack' &&
      (receipt.value === undefined ||
        typeof receipt.value === 'number' ||
        typeof receipt.value === 'boolean')
    ) {
      receipts.set(input.id, {
        seq: input.seq,
        type: input.command?.type,
        receipt,
      });
      if (receipts.size > 128) receipts.delete(receipts.keys().next().value!);
    }
    send(receipt);
  });
};
send({ type: 'ready' });
