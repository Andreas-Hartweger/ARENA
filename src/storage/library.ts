import { Genome, model } from '../training/genome';
import { type Draft, preflight } from '../runtime/runConfig';
import { fingerprint } from '../runtime/fingerprint';
import {
  decode,
  jsonObject,
  type StorePort,
  type StoredObject,
} from './objects';
import { genomeObject, readGenome } from './checkpoint';
import type { ModelSpec } from '../runtime/compute';
import { scenario } from '../training/episode';
export interface Profile {
  id: string;
  name: string;
  description: string;
  tags: string[];
  favorite: boolean;
  collection: string;
  color?: string;
  icon?: string;
  archived: boolean;
  trashedAt: number | null;
  active: string;
  preferred: string;
  versions: string[];
  records?: string[];
}
export interface Version {
  id: string;
  modelId: string;
  parent: string | null;
  genome: string;
  manifest: string;
  origin: 'local' | 'clone' | 'import';
  role: 'experiment' | 'generationBest' | 'champion' | 'lapRecord' | 'starter';
  source: string | null;
  created: number;
}
interface Manifest {
  version: 1;
  model: ModelSpec;
  modelKey: string;
  layout: string;
  dtype: 'float64le';
  vehicle: 'GT-01';
  physics: 'first-drive.v1';
  initializer: string;
  draft: Draft;
}
export interface PerformanceRecord {
  purpose: 'training' | 'validation' | 'test' | 'analysis';
  contract: string;
  track: string;
  vehicle: string;
  seed: number;
  runtime: string;
  sampleCount: number;
  value: number;
  metric?: 'fitness' | 'lapTime';
  version: string;
  genome: string;
  verified: boolean;
}
async function entry(db: StorePort, id: string, kind: string) {
  const o = await db.get(id);
  if (!o || o.meta.kind !== kind) throw Error('Objekt fehlt: ' + id);
  return o;
}
export function validateProfile(
  p: Pick<
    Profile,
    'name' | 'description' | 'tags' | 'collection' | 'color' | 'icon'
  >,
) {
  const length = (s: string, max: number) =>
    typeof s === 'string' && [...s].length <= max;
  if (
    !length(p.name, 64) ||
    !p.name.trim() ||
    !length(p.description, 2000) ||
    !Array.isArray(p.tags) ||
    p.tags.length > 20 ||
    p.tags.some((s) => !length(s, 32)) ||
    !length(p.collection, 64) ||
    (p.color && !/^#[a-f0-9]{6}$/i.test(p.color)) ||
    (p.icon && !length(p.icon, 12))
  )
    throw Error('Ungültige Profildaten.');
}
export async function describeVersion(db: StorePort, id: string) {
  const stored = await entry(db, id, 'version');
  const version = decode<Version>(stored),
    manifest = decode<Manifest>(await entry(db, version.manifest, 'manifest'));
  if (
    version.id !== id ||
    manifest.version !== 1 ||
    manifest.physics !== 'first-drive.v1' ||
    manifest.vehicle !== 'GT-01' ||
    manifest.dtype !== 'float64le' ||
    typeof version.created !== 'number' ||
    !['local', 'clone', 'import'].includes(version.origin) ||
    ![
      'starter',
      'experiment',
      'champion',
      'generationBest',
      'lapRecord',
    ].includes(version.role)
  )
    throw Error('Unbekannter Modell- oder Versionsvertrag.');
  return {
    version: stored.meta.imported
      ? { ...version, origin: 'import' as const }
      : version,
    manifest,
  };
}
export async function readVersion(db: StorePort, id: string) {
  const { version, manifest } = await describeVersion(db, id);
  const s = manifest.model,
    m = model(s.signature, s.hidden, s.activation, s.weightLimit, s.biasLimit);
  if (
    manifest.version !== 1 ||
    manifest.physics !== 'first-drive.v1' ||
    manifest.vehicle !== 'GT-01' ||
    scenario(fingerprint, manifest.draft.scenarios[0]).modelSignature !==
      s.signature ||
    JSON.stringify(manifest.draft.hidden) !== JSON.stringify(s.hidden) ||
    manifest.draft.activation !== s.activation ||
    manifest.draft.weightLimit !== s.weightLimit ||
    manifest.draft.biasLimit !== s.biasLimit ||
    manifest.modelKey !== m.key ||
    manifest.layout !== m.layout ||
    manifest.dtype !== 'float64le'
  )
    throw Error('Modellvertrag passt nicht.');
  return {
    version,
    manifest,
    genome: readGenome(await entry(db, version.genome, 'genome'), m),
  };
}
function versionObjects(
  g: Genome,
  draft: Draft,
  modelId: string,
  role: Version['role'],
  parent: string | null,
  source: string | null,
  origin: Version['origin'],
  initializer: string,
) {
  const value = genomeObject(g),
    m = g.model;
  const manifest: Manifest = {
    version: 1,
    model: {
      signature: m.signature,
      hidden: [...m.hidden],
      activation: m.activation,
      weightLimit: m.weightLimit,
      biasLimit: m.biasLimit,
    },
    modelKey: m.key,
    layout: m.layout,
    dtype: 'float64le',
    vehicle: 'GT-01',
    physics: 'first-drive.v1',
    initializer,
    draft,
  };
  const manifestObject = jsonObject(
    'manifest',
    'manifest:' + crypto.randomUUID(),
    manifest,
  );
  const version: Version = {
    id: 'version:' + crypto.randomUUID(),
    modelId,
    parent,
    genome: value.meta.id,
    manifest: manifestObject.meta.id,
    origin,
    role,
    source,
    created: Date.now(),
  };
  return {
    version,
    objects: [
      value,
      manifestObject,
      jsonObject('version', version.id, version, [
        version.genome,
        version.manifest,
      ]),
    ],
  };
}
function profileObject(p: Profile) {
  validateProfile(p);
  if (
    typeof p.archived !== 'boolean' ||
    typeof p.favorite !== 'boolean' ||
    (p.trashedAt !== null &&
      (!Number.isSafeInteger(p.trashedAt) || p.trashedAt <= 0))
  )
    throw Error('Ungültiger Profilstatus.');
  if (!p.versions.includes(p.active) || !p.versions.includes(p.preferred))
    throw Error('Unknown profile version');
  return jsonObject(
    'profile',
    p.id,
    p,
    [...p.versions, ...(p.records ?? [])],
    true,
  );
}
export async function createModel(
  db: StorePort,
  name: string,
  draft: Draft,
  source?: {
    genome: Genome;
    id: string;
    role?: Version['role'];
    origin?: Version['origin'];
  },
  hardware?: number,
) {
  const { m } = preflight(draft, fingerprint, hardware),
    id = 'model:' + crypto.randomUUID();
  if (
    source &&
    (m.key !== source.genome.model.key ||
      m.weightLimit !== source.genome.model.weightLimit ||
      m.biasLimit !== source.genome.model.biasLimit)
  )
    throw Error('Inkompatibles Ausgangsmodell.');
  const genome = source
    ? new Genome(m, source.genome.parameters(), fingerprint)
    : Genome.initialize(m, draft.options.master ?? 42, fingerprint);
  const { version, objects } = versionObjects(
    genome,
    draft,
    id,
    source?.role ?? 'experiment',
    source?.id ?? null,
    source?.id ?? null,
    source?.origin ?? 'local',
    source ? 'supplied' : 'mulberry32-uniform-v1',
  );
  const profile: Profile = {
    id,
    name,
    description: '',
    tags: [],
    favorite: false,
    collection: '',
    archived: false,
    trashedAt: null,
    active: version.id,
    preferred: version.id,
    versions: [version.id],
  };
  await db.commit([...objects, profileObject(profile)]);
  return profile;
}
export async function saveVersion(
  db: StorePort,
  profileId: string,
  g: Genome,
  draft: Draft,
  role: Version['role'],
  source: string,
  record?: Omit<PerformanceRecord, 'version' | 'genome'>,
) {
  const p = decode<Profile>(await entry(db, profileId, 'profile'));
  const active = await readVersion(db, p.active);
  if (
    active.genome.model.key !== g.model.key ||
    active.genome.model.weightLimit !== g.model.weightLimit ||
    active.genome.model.biasLimit !== g.model.biasLimit
  )
    throw Error(
      'Architektur oder Parametergrenzen erfordern ein eigenes Modell.',
    );
  const v = versionObjects(
    g,
    draft,
    p.id,
    role,
    draft.sourceVersion ?? null,
    source,
    'local',
    'training',
  );
  p.versions.push(v.version.id);
  const writes: StoredObject[] = [...v.objects];
  if (record) {
    if (
      !Number.isSafeInteger(record.sampleCount) ||
      record.sampleCount < 1 ||
      !Number.isFinite(record.value) ||
      !record.contract
    )
      throw Error('Ungültiger Leistungsnachweis.');
    const recordId = 'record:' + crypto.randomUUID();
    p.records = [...(p.records ?? []), recordId];
    writes.push(
      jsonObject(
        'record',
        recordId,
        { ...record, version: v.version.id, genome: v.version.genome },
        [v.version.id],
        false,
      ),
    );
  }
  await db.commit([...writes, profileObject(p)], { replace: [p.id] });
  return v.version;
}
export async function editProfile(
  db: StorePort,
  id: string,
  changes: Partial<
    Pick<
      Profile,
      | 'name'
      | 'description'
      | 'tags'
      | 'favorite'
      | 'collection'
      | 'color'
      | 'icon'
      | 'archived'
      | 'trashedAt'
      | 'preferred'
      | 'active'
    >
  >,
) {
  const p = decode<Profile>(await entry(db, id, 'profile'));
  for (const k of Object.keys(changes))
    if (
      ![
        'name',
        'description',
        'tags',
        'favorite',
        'collection',
        'color',
        'icon',
        'archived',
        'trashedAt',
        'preferred',
        'active',
      ].includes(k)
    )
      throw Error('Technisches Feld ist schreibgeschützt.');
  const next = { ...p, ...changes };
  await db.commit([profileObject(next)], { replace: [id] });
  return next;
}
export async function profiles(db: StorePort) {
  const result: Profile[] = [];
  for (const m of await db.list())
    if (m.kind === 'profile')
      result.push(decode<Profile>(await entry(db, m.id, 'profile')));
  return result;
}
export function compareParameters(a: Genome, b: Genome) {
  if (a.model.key !== b.model.key)
    throw Error('Unterschiedliche Parameterzuordnung.');
  const left = a.parameters(),
    right = b.parameters();
  return a.model.layers.map((l) => {
    let changed = 0,
      sum = 0,
      max = 0;
    const bins = Array<number>(Math.min(48, l.end - l.offset)).fill(0);
    for (let i = l.offset; i < l.end; i++) {
      const delta = Math.abs(left[i] - right[i]);
      changed += Number(delta !== 0);
      sum += delta * delta;
      max = Math.max(delta, max);
      const bin = Math.floor(
        ((i - l.offset) * bins.length) / (l.end - l.offset),
      );
      bins[bin] = Math.max(bins[bin], delta);
    }
    return {
      layer: l.i,
      changed,
      max,
      rms: Math.sqrt(sum / (l.end - l.offset)),
      bins,
    };
  });
}
