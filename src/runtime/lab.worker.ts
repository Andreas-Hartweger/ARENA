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
  type PerformanceRecord,
} from '../storage/library';
import {
  decode,
  profileDeletion,
  jsonObject,
  reachable,
} from '../storage/objects';
import { queue, prepareQueue, writeQueue, type QueueState } from './queue';
import { preflight } from './runConfig';
import { fingerprint } from './fingerprint';
import {
  exportPackage,
  importPackage,
  previewPackage,
} from '../storage/transfer';
import { evaluate } from '../training/episode';
import { type Envelope, type LabCommand, type LabEvent } from './labProtocol';
import { restore, type RunIndex } from '../storage/checkpoint';
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
async function start(
  d: Parameters<typeof controller.start>[0],
  waiting?: QueueState,
) {
  await acquire();
  const { estimated } = preflight(d, fingerprint, hardware);
  if (!d.volatile) {
    const s = await db.status(),
      quota = await navigator.storage.estimate();
    const available = Math.min(
      s.budget - s.total,
      (quota.quota ?? Infinity) - (quota.usage ?? 0),
    );
    if (4 * estimated.population > available)
      throw Error(
        'Festplattenbudget reicht für drei Checkpoints und den neuen Schreibstand nicht aus. Population verkleinern oder das Budget im Speicher anpassen.',
      );
  }
  const source = d.sourceVersion
    ? await readVersion(db, d.sourceVersion)
    : undefined;
  const queueUpdate = waiting
    ? await prepareQueue(
        db,
        { ...waiting, entries: waiting.entries.slice(1) },
        hardware,
      )
    : undefined;
  await controller.start(d, source?.genome, queueUpdate);
}
async function terminal() {
  if (active()) return;
  try {
    if (auto && controller.snapshot.phase === 'Completed') {
      const q = await queue(db),
        next = q.entries[0];
      if (q.enabled && next?.autoStart) {
        preflight(next.draft, fingerprint, hardware);
        await start(next.draft, q);
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
type Sample = Extract<LabEvent, { type: 'observation' }>['sample'];
const samples = new Map<string, Sample>();
let visibleLimit = 0,
  selectedSlot: number | null = null;
controller.observed = (sample) => {
  if (!generationSubscription) return;
  const lease = sample.key.jobId;
  for (const [key, old] of samples)
    if (
      old.key.generation !== sample.key.generation ||
      old.key.segmentId !== sample.key.segmentId ||
      old.key.sessionId !== sample.key.sessionId ||
      old.key.slot === sample.key.slot
    )
      samples.delete(key);
  samples.set(lease, sample);
  if (samples.size > visibleLimit)
    for (const [key, old] of samples)
      if (old.key.slot !== selectedSlot) {
        samples.delete(key);
        break;
      }
};
let preview: Awaited<ReturnType<typeof previewPackage>> | undefined,
  previewId = '';
async function handle(c: LabCommand) {
  switch (c.type) {
    case 'status':
      return controller.snapshot;
    case 'currentDraft':
      return controller.draft;
    case 'version': {
      const { version, manifest } = await readVersion(db, c.id);
      const records = [];
      for (const m of await db.list())
        if (m.kind === 'record' && m.refs.includes(c.id)) {
          const r = decode<PerformanceRecord>((await db.get(m.id))!);
          records.push(m.imported ? { ...r, verified: false } : r);
        }
      const all = await db.list(),
        map = new Map(all.map((m) => [m.id, m]));
      const size = [...reachable(map, [c.id])].reduce(
        (n, id) => n + map.get(id)!.size,
        0,
      );
      return { version, manifest, records, logicalBytes: size };
    }
    case 'compatibility': {
      const a = await readVersion(db, c.version),
        other = c.other ? await readVersion(db, c.other) : undefined;
      const manifest = a.manifest,
        flags: {
          dimension: string;
          status: 'Ja' | 'Nein' | 'Offen';
          reason: string;
        }[] = [];
      try {
        const p = preflight(c.draft, fingerprint, hardware);
        const signature = p.m.signature === manifest.model.signature;
        flags.push({
          dimension: 'Ausführung',
          status: signature ? 'Ja' : 'Nein',
          reason: signature
            ? 'Fahrzeug, Sensorik und Controller stimmen überein.'
            : 'Sensor- oder Controllervertrag weicht ab.',
        });
        const train =
          signature &&
          p.m.key === manifest.modelKey &&
          p.m.weightLimit === manifest.model.weightLimit &&
          p.m.biasLimit === manifest.model.biasLimit;
        flags.push({
          dimension: 'Training mit Laufentwurf',
          status: train ? 'Ja' : 'Nein',
          reason: train
            ? 'Topologie, Grenzen und Rechenbudget sind kompatibel.'
            : 'Der Laufentwurf benötigt eine andere Architektur oder andere Parametergrenzen.',
        });
      } catch (e) {
        flags.push({
          dimension: 'Training mit Laufentwurf',
          status: 'Nein',
          reason: String(e),
        });
      }
      flags.push({
        dimension: 'Exakte Fortsetzung',
        status: 'Nein',
        reason: 'Dafür wird ein vollständiger Checkpoint benötigt.',
      });
      if (other) {
        const match = manifest.modelKey === other.manifest.modelKey;
        flags.push({
          dimension: 'Parametervergleich',
          status: match ? 'Ja' : 'Nein',
          reason: match
            ? 'Identische Parameterzuordnung.'
            : 'Schichtlayout oder Eingabevertrag weicht ab.',
        });
        const records: (PerformanceRecord & { imported: boolean })[] = [];
        for (const meta of await db.list('record'))
          if (meta.refs.includes(c.version) || meta.refs.includes(c.other!))
            records.push({
              ...decode<PerformanceRecord>((await db.get(meta.id))!),
              imported: !!meta.imported,
            });
        const shared = records.some(
          (r) =>
            r.version === c.version &&
            r.verified &&
            !r.imported &&
            records.some(
              (o) =>
                o.version === other.version.id &&
                o.verified &&
                !o.imported &&
                o.contract === r.contract &&
                o.purpose === r.purpose &&
                o.runtime === r.runtime &&
                o.seed === r.seed,
            ),
        );
        flags.push({
          dimension: 'Gespeicherte Leistungswerte',
          status: shared ? 'Ja' : 'Offen',
          reason: shared
            ? 'Lokale Nachweise mit gleichem Bewertungsvertrag liegen vor.'
            : 'Gemeinsamer Fahrvergleich für diesen Vertrag erforderlich.',
        });
      }
      return flags;
    }
    case 'observe':
      generationSubscription = c.visible > 0;
      visibleLimit = c.visible;
      selectedSlot = c.slot;
      samples.clear();
      controller.observe(c.visible, c.slot);
      return;
    case 'samples': {
      const result = [...samples.values()];
      samples.clear();
      return result;
    }
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
      return controller.population(c.offset, c.limit, c.filter, c.sort);
    case 'brain':
      return controller.selectedBrain(c.slot);
    case 'history':
      return controller.history(c.metric);
    case 'recover':
      await acquire();
      auto = false;
      await controller.recover(c.id, c);
      return;
    case 'checkpointInfo': {
      const stored = await db.get(c.id);
      if (stored?.meta.kind !== 'checkpoint')
        throw Error('Speicherstand fehlt.');
      const cp = decode<import('../storage/checkpoint').Checkpoint>(stored);
      return {
        phase: cp.phase,
        reason: cp.reason,
        generation: cp.counters.globalGeneration,
        activeMs: cp.counters.activeMs,
        time: cp.draft.time,
        imported: !!stored.meta.imported,
        sameRuntime: cp.runtime === runtime,
        runId: cp.runId,
        parent: cp.counters.parentCheckpoint,
      };
    }
    case 'findRecovery': {
      const row = await db.get('run:' + c.run);
      if (row?.meta.kind !== 'run') throw Error('Laufindex fehlt.');
      const index = decode<RunIndex>(row),
        failures: { id: string; reason: string }[] = [];
      const all = new Map((await db.list('checkpoint')).map((m) => [m.id, m]));
      const ids = [
        ...new Set([
          index.latest,
          ...[...index.milestones, ...index.automatic].sort(
            (a, b) => (all.get(b)?.created ?? 0) - (all.get(a)?.created ?? 0),
          ),
        ]),
      ];
      for (const id of ids) {
        try {
          const { cp } = await restore(
            db,
            id,
            runtime,
            hardware,
            undefined,
            () => {},
          );
          return { id, phase: cp.phase, failures };
        } catch (e) {
          failures.push({ id, reason: String(e) });
        }
      }
      throw Error(
        'Kein lesbarer Speicherstand: ' +
          failures.map((f) => f.id + ' ' + f.reason).join(', '),
      );
    }
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
      const role = c.role ?? 'champion',
        best = controller.archiveCandidate(role, c.scenario),
        d = controller.draft;
      if (!best || !d) throw Error('Noch kein bestätigter Champion.');
      const { scenarios } = preflight(d, fingerprint, hardware);
      return saveVersion(db, c.profile, best.genome, d, role, best.id, {
        purpose: 'training',
        value: best.value,
        metric: best.metric,
        contract: best.contract,
        sampleCount: best.scenarios,
        seed: d.options.master ?? 42,
        track: scenarios[best.scenario].track.def.name,
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
      return { ...profileDeletion(all, c.ids), revision: status.revision };
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
      const checked = profileDeletion(all, c.ids);
      return db.commit([], {
        remove: checked.remove,
        expectedRevision: c.revision,
      });
    }
    case 'queue': {
      const q = await queue(db);
      return { ...q, enabled: auto && q.enabled };
    }
    case 'dispatchQueue': {
      if (active()) throw Error('Ein Lauf ist bereits aktiv.');
      await acquire();
      const q = await queue(db),
        entry = q.entries[0];
      if (!entry) throw Error('Warteschlange ist leer.');
      await start(entry.draft, q);
      return;
    }
    case 'writeQueue':
      if (controller.snapshot.phase === 'Recoverable')
        throw Error('Zuerst die ausstehende Speicherung auflösen.');
      await acquire();
      await writeQueue(db, c.value, hardware);
      auto = c.value.enabled;
      return;
    case 'template': {
      await acquire();
      preflight(c.draft, fingerprint, hardware);
      if (!c.name.trim() || [...c.name].length > 64)
        throw Error('Name fehlt oder ist zu lang.');
      let revision = 1;
      let parent: string | null = null;
      for (const m of await db.list('template')) {
        const previous = decode<{ name: string; revision?: number }>(
          (await db.get(m.id))!,
        );
        if (previous.name === c.name && (previous.revision ?? 1) >= revision) {
          revision = (previous.revision ?? 1) + 1;
          parent = m.id;
        }
      }
      return db.commit([
        jsonObject(
          'template',
          'template:' + crypto.randomUUID(),
          { name: c.name, revision, parent, draft: c.draft },
          [
            ...(c.draft.sourceVersion ? [c.draft.sourceVersion] : []),
            ...(parent ? [parent] : []),
          ],
          true,
        ),
      ]);
    }
    case 'templates': {
      const rows = [];
      for (const m of await db.list())
        if (m.kind === 'template') {
          const o = (await db.get(m.id))!;
          const t = decode<{ name: string; revision?: number }>(o);
          rows.push({ id: m.id, name: t.name, revision: t.revision ?? 1 });
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
      const all = await db.list(),
        map = new Map(all.map((m) => [m.id, m]));
      reachable(map, map.keys());
      for (const m of all) {
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
  { seq: number; signature: string; receipt: LabEvent }
>();
self.onmessage = (event: MessageEvent<Envelope>) => {
  const input = event.data;
  void controller.serialize(async () => {
    let receipt: LabEvent;
    let signature = '';
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
      signature = JSON.stringify([input.session, input.command]);
      if (previous) {
        if (previous.seq !== input.seq || previous.signature !== signature)
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
      !receipts.has(input.id) &&
      signature &&
      signature.length <= 32768 &&
      (receipt.value === undefined ||
        ![
          'export',
          'previewImport',
          'history',
          'population',
          'brain',
          'samples',
          'storage',
          'status',
          'currentDraft',
          'library',
          'version',
          'checkpoints',
          'drive',
          'compare',
        ].includes(input.command.type))
    ) {
      receipts.set(input.id, {
        seq: input.seq,
        signature,
        receipt,
      });
      if (receipts.size > 128) receipts.delete(receipts.keys().next().value!);
    }
    send(receipt);
  });
};
send({ type: 'ready' });
