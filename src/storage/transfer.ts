import {
  scanArchive,
  writeArchive,
  strictJson,
  archiveLimits,
} from './archive';
import {
  decode,
  jsonObject,
  kinds,
  reachable,
  validateObject,
  type ObjectKind,
  type ObjectMeta,
  type StoredObject,
} from './objects';
import { TrainingDatabase } from './database';
import { sha256 } from '../runtime/fingerprint';
import {
  readVersion,
  validateProfile,
  type Profile,
  type Version,
} from './library';
import { restore, type Checkpoint, type RunIndex } from './checkpoint';
import type { QueueState } from '../runtime/queue';
export type PackageType = 'model' | 'checkpoint' | 'backup';
interface Entry {
  path: string;
  byteLength: number;
  sha256: string;
  role: ObjectKind;
  id: string;
  refs: string[];
  root: boolean;
  protected: boolean;
  created: number;
}
interface Manifest {
  magic: 'arena.package';
  formatVersion: 1;
  type: PackageType;
  runtime: string;
  roots: string[];
  entries: Entry[];
}
const strictKeys = (o: object, keys: string[]) => {
  if (
    !o ||
    Array.isArray(o) ||
    typeof o !== 'object' ||
    Object.keys(o).length !== keys.length ||
    !Object.keys(o).every((k) => keys.includes(k))
  )
    throw Error('Ungültige Paketfelder.');
};
const allowedId = (s: unknown) =>
  typeof s === 'string' && /^[a-zA-Z0-9_.:-]{1,180}$/.test(s);
export async function exportPackage(
  db: TrainingDatabase,
  type: PackageType,
  roots: string[],
  runtime: string,
) {
  const all = new Map((await db.list()).map((m) => [m.id, m]));
  if (!roots.length) throw Error('Keine Exportauswahl.');
  const closure = Array.from(reachable(all, roots)).sort(),
    pin = 'pin:' + crypto.randomUUID(),
    manifest: Manifest = {
      magic: 'arena.package',
      formatVersion: 1,
      type,
      roots,
      runtime,
      entries: [],
    };
  await db.commit([jsonObject('pin', pin, {}, closure, true)]);
  try {
    for (const [i, id] of closure.entries()) {
      const m = all.get(id)!;
      if (m.kind === 'pin')
        throw Error('Interne Pins sind nicht exportierbar.');
      manifest.entries.push({
        path:
          m.kind === 'genome' ? 'genomes/' + i + '.bin' : 'data/' + i + '.json',
        byteLength: m.size,
        sha256: m.checksum,
        role: m.kind,
        id,
        refs: m.refs,
        root: m.root,
        protected: m.protected,
        created: m.created,
      });
    }
    return await writeArchive(
      (async function* () {
        yield {
          name: 'manifest.json',
          bytes: new TextEncoder().encode(JSON.stringify(manifest)),
        };
        for (const e of manifest.entries) {
          const o = await db.get(e.id);
          if (
            !o ||
            o.meta.checksum !== e.sha256 ||
            sha256(o.bytes) !== e.sha256
          )
            throw Error('Exportstand hat sich geändert.');
          yield { name: e.path, bytes: o.bytes };
        }
      })(),
    );
  } finally {
    await db.commit([], { remove: [pin] });
  }
}
export async function previewPackage(db: TrainingDatabase, file: Blob) {
  const status = await db.status(),
    source = await scanArchive(
      file,
      Math.min(archiveLimits.bytes, status.budget - status.total),
    );
  const dir = new Map(source.records.map((e) => [e.name, e]));
  const m = strictJson(
    await source.read(dir.get('manifest.json')!),
  ) as Manifest;
  strictKeys(m, [
    'magic',
    'formatVersion',
    'type',
    'runtime',
    'roots',
    'entries',
  ]);
  if (
    m.magic !== 'arena.package' ||
    m.formatVersion !== 1 ||
    !['model', 'checkpoint', 'backup'].includes(m.type) ||
    typeof m.runtime !== 'string' ||
    !Array.isArray(m.roots) ||
    !m.roots.length ||
    m.roots.some((id) => !allowedId(id)) ||
    !Array.isArray(m.entries) ||
    m.entries.length !== dir.size - 1
  )
    throw Error('Nicht unterstütztes Containerformat.');
  const metadata = new Map<string, ObjectMeta>(),
    paths = new Set<string>(),
    byId = new Map<string, Entry>(),
    conflicts: string[] = [];
  for (const e of m.entries) {
    strictKeys(e, [
      'path',
      'byteLength',
      'sha256',
      'role',
      'id',
      'refs',
      'root',
      'protected',
      'created',
    ]);
    if (
      !allowedId(e.id) ||
      metadata.has(e.id) ||
      paths.has(e.path) ||
      !dir.has(e.path) ||
      e.byteLength !== dir.get(e.path)!.size ||
      !/^[0-9a-f]{64}$/.test(e.sha256) ||
      !kinds.includes(e.role) ||
      e.role === 'pin' ||
      (e.role === 'genome') !== e.path.startsWith('genomes/') ||
      e.path === 'manifest.json' ||
      !Array.isArray(e.refs) ||
      e.refs.some((k) => !allowedId(k)) ||
      typeof e.root !== 'boolean' ||
      typeof e.protected !== 'boolean' ||
      !Number.isFinite(e.created)
    )
      throw Error('Ungültiges Manifestobjekt.');
    paths.add(e.path);
    byId.set(e.id, e);
    metadata.set(e.id, {
      id: e.id,
      kind: e.role,
      size: e.byteLength,
      checksum: e.sha256,
      refs: e.refs,
      root: e.root,
      protected: e.protected,
      created: e.created,
    });
  }
  if (reachable(metadata, m.roots).size !== metadata.size)
    throw Error('Unvollständiger oder überzähliger Referenzgraph.');
  if (
    (m.type === 'model' &&
      m.roots.some(
        (id) => !['profile', 'version'].includes(metadata.get(id)!.kind),
      )) ||
    (m.type === 'checkpoint' &&
      m.roots.some((id) => metadata.get(id)!.kind !== 'checkpoint'))
  )
    throw Error('Falscher Pakettyp.');
  async function item(id: string): Promise<StoredObject | undefined> {
    const e = byId.get(id);
    if (!e) return;
    const bytes = await source.read(dir.get(e.path)!);
    const value = { meta: metadata.get(id)!, bytes };
    validateObject(value);
    if (e.role !== 'genome') strictJson(bytes);
    return value;
  }
  const sandbox = {
    get: item,
    list: async () => [...metadata.values()],
    commit: async () => {
      throw Error('Read only');
    },
  };
  for (const e of m.entries) {
    const value = (await item(e.id))!;
    const old = await db.get(e.id);
    if (
      old &&
      (old.meta.kind !== e.role ||
        old.meta.checksum !== e.sha256 ||
        JSON.stringify(old.meta.refs) !== JSON.stringify(e.refs) ||
        !value.bytes.every((v, i) => old.bytes[i] === v))
    )
      conflicts.push(e.id);
    if (e.role === 'profile') {
      const p = decode<Profile>(value);
      validateProfile(p);
      if (
        !Array.isArray(p.versions) ||
        !p.versions.includes(p.active) ||
        !p.versions.includes(p.preferred) ||
        p.id !== e.id ||
        p.versions.some(
          (id) => metadata.get(id)?.kind !== 'version' || !e.refs.includes(id),
        )
      )
        throw Error('Ungültige Modellversion.');
    } else if (e.role === 'version') {
      const { version } = await readVersion(sandbox, e.id);
      if (
        version.id !== e.id ||
        !e.refs.includes(version.manifest) ||
        !e.refs.includes(version.genome)
      )
        throw Error('Ungültiger Versionsgraph.');
    } else if (e.role === 'checkpoint') {
      const cp = decode<Checkpoint>(value);
      await restore(sandbox, e.id, cp.runtime, 32);
    } else if (e.role === 'run') {
      const idx = decode<RunIndex>(value);
      if (!e.refs.includes(idx.latest) || !metadata.has(idx.latest))
        throw Error('Lauf ohne Checkpoint.');
    }
  }
  return {
    manifest: m,
    conflicts,
    size: file.size,
    item,
    revision: status.revision,
  };
}
export async function importPackage(
  db: TrainingDatabase,
  preview: Awaited<ReturnType<typeof previewPackage>>,
  variant = false,
) {
  if (preview.conflicts.length && !variant)
    throw Error('ID-Konflikt. Eigenständige Variante erforderlich.');
  const id = crypto.randomUUID(),
    mapping = new Map<string, string>(),
    m = preview.manifest;
  if (variant) {
    for (const e of m.entries)
      if (e.role !== 'genome' && e.role !== 'history')
        mapping.set(e.id, e.role + ':' + crypto.randomUUID());
    for (const e of m.entries)
      if (e.role === 'run') {
        const source = decode<RunIndex>((await preview.item(e.id))!);
        mapping.set(source.id, mapping.get(e.id)!.slice(4));
      }
    for (const e of m.entries)
      if (e.role === 'history')
        mapping.set(e.id, 'history:' + crypto.randomUUID());
  }
  const remap = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (mapping.has(v)) return mapping.get(v);
      if (v.startsWith('["')) {
        try {
          const a = JSON.parse(v);
          if (Array.isArray(a) && a.length === 3 && mapping.has(a[0]))
            return JSON.stringify([mapping.get(a[0]), a[1], a[2]]);
        } catch {
          /* Plain text. */
        }
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(remap);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, remap(x)]),
      );
    return v;
  };
  const staged: string[] = [];
  try {
    for (const e of m.entries) {
      let row = (await preview.item(e.id))!;
      const key = mapping.get(e.id) ?? e.id;
      const existing = await db.get(key);
      if (existing && key === e.id && existing.meta.checksum === e.sha256)
        continue;
      if (e.role !== 'genome') {
        let payload = decode<unknown>(row);
        if (variant) payload = remap(payload);
        if (e.role === 'queue') {
          const queue = payload as QueueState;
          queue.enabled = false;
          for (const q of queue.entries) q.autoStart = false;
        }
        if (e.role === 'version') {
          const v = payload as Version;
          v.origin = 'import';
        }
        if (e.role === 'record')
          Object.assign(payload as object, { verified: false });
        row = jsonObject(
          e.role,
          key,
          payload,
          e.refs.map((k) => mapping.get(k) ?? k),
          m.roots.includes(e.id) || e.root,
          e.role === 'checkpoint' && e.protected,
        );
      }
      await db.stage(id, row);
      staged.push(key);
    }
    await db.commit(
      [],
      { expectedRevision: preview.revision },
      { id, keys: staged },
    );
    return m.roots.map((k) => mapping.get(k) ?? k);
  } finally {
    await db.discardStage(id);
  }
}
