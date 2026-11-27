import { canonical } from '../ai/schema';
import { sha256 } from '../runtime/fingerprint';
import {
  validateCapability,
  type Capability,
  type ValidationEvidence,
} from '../research/validation';
import { jsonObject, decode, type StorePort } from './objects';
import { readVersion, createModel } from './library';

export interface ModelFreeze {
  schema: 1;
  genome: string;
  version: string;
  modelKey: string;
  roles: Capability[];
  panelHashes: { holdout: string; endurance: string; recovery?: string };
  selection: string;
}
export interface PromotionReview {
  implementationSHA: string;
  validationHash: string;
  reviewer: string;
  implementer: string;
  evidence: string;
  approved: boolean;
}
interface OfficialModel {
  schema: 'arena.official-model.v1';
  issuance: string;
  freeze: ModelFreeze;
  role: Capability;
  review: PromotionReview;
  validationHash: string;
  previous: string | null;
}
const roles: readonly Capability[] = ['Starter', 'Performance', 'Spezialist'];
const hex = (s: string, n = 64) =>
  typeof s === 'string' && new RegExp('^[a-f0-9]{' + n + '}$').test(s);
export const evidenceHash = (x: unknown) =>
  sha256(new TextEncoder().encode(canonical(x)));
export function freezeCandidates(candidates: readonly ModelFreeze[]) {
  if (
    candidates.length > 3 ||
    new Set(candidates.map((c) => c.genome)).size !== candidates.length
  )
    throw Error('Invalid candidate count');
  for (const c of candidates)
    if (
      c.schema !== 1 ||
      !c.version ||
      !c.modelKey ||
      !hex(c.genome) ||
      !hex(c.selection) ||
      !hex(c.panelHashes.holdout) ||
      !hex(c.panelHashes.endurance) ||
      !c.roles.length ||
      c.roles.some((r) => !roles.includes(r)) ||
      new Set(c.roles).size !== c.roles.length ||
      (c.roles.includes('Spezialist') && !hex(c.panelHashes.recovery ?? ''))
    )
      throw Error('Invalid frozen model manifest');
  return candidates.map((c) => structuredClone(c));
}
// Only an independently approved release record should be installed by the release process.
// Imported settings can never promote a model simply by sharing an ID.
export async function promote(
  db: StorePort,
  role: Capability,
  freeze: ModelFreeze,
  evidence: ValidationEvidence,
  review: PromotionReview,
) {
  freezeCandidates([freeze]);
  const hash = evidenceHash(evidence);
  if (
    !freeze.roles.includes(role) ||
    evidence.genome !== freeze.genome ||
    review.validationHash !== hash ||
    !hex(review.implementationSHA, 40) ||
    !review.approved ||
    !review.reviewer.trim() ||
    !review.implementer.trim() ||
    review.reviewer.trim().toLowerCase() ===
      review.implementer.trim().toLowerCase() ||
    !review.evidence.trim() ||
    evidenceHash(evidence.holdout.expected) !== freeze.panelHashes.holdout ||
    evidenceHash(evidence.endurance.expected) !==
      freeze.panelHashes.endurance ||
    (role === 'Spezialist' &&
      (!evidence.recovery ||
        evidenceHash(evidence.recovery.expected) !==
          freeze.panelHashes.recovery)) ||
    validateCapability(role, evidence).status !== 'passed'
  )
    throw Error('Independent validation and approval required');
  const m = await readVersion(db, freeze.version);
  if (
    m.genome.hash !== freeze.genome ||
    m.manifest.modelKey !== freeze.modelKey
  )
    throw Error('Frozen genome or contract differs');
  const previousPointer = await db.get('settings:official-' + role);
  const current = previousPointer?.meta.imported
    ? null
    : await currentOfficial(db, role);
  const row: OfficialModel = {
    schema: 'arena.official-model.v1',
    issuance: crypto.randomUUID(),
    freeze,
    role,
    review,
    validationHash: hash,
    previous: current?.id ?? null,
  };
  const id = 'manifest:official-' + evidenceHash(row),
    pointer = 'settings:official-' + role;
  const saved = jsonObject(
    'manifest',
    id,
    row,
    [freeze.version, ...(current ? [current.id] : [])],
    true,
    true,
  );
  await db.commit(
    [saved, jsonObject('settings', pointer, { id }, [id], true)],
    { replace: [pointer] },
  );
  return id;
}
export async function verifyOfficialManifest(
  db: StorePort,
  entry: import('./objects').StoredObject,
) {
  const row = decode<OfficialModel>(entry);
  freezeCandidates([row.freeze]);
  if (
    row.schema !== 'arena.official-model.v1' ||
    typeof row.issuance !== 'string' ||
    !row.issuance ||
    !roles.includes(row.role) ||
    !row.freeze.roles.includes(row.role) ||
    !row.review.approved ||
    !row.review.reviewer.trim() ||
    !row.review.implementer.trim() ||
    row.review.reviewer.trim().toLowerCase() ===
      row.review.implementer.trim().toLowerCase() ||
    !row.review.evidence.trim() ||
    !hex(row.review.implementationSHA, 40) ||
    !hex(row.validationHash) ||
    row.validationHash !== row.review.validationHash ||
    entry.meta.id !== 'manifest:official-' + evidenceHash(row) ||
    !entry.meta.refs.includes(row.freeze.version) ||
    (row.previous !== null && !entry.meta.refs.includes(row.previous))
  )
    throw Error('Ungültiger offizieller Modellnachweis.');
  const v = await readVersion(db, row.freeze.version);
  if (
    v.genome.hash !== row.freeze.genome ||
    v.manifest.modelKey !== row.freeze.modelKey
  )
    throw Error('Modellintegrität verletzt.');
  return row;
}
export async function currentOfficial(db: StorePort, role: Capability) {
  if (!roles.includes(role)) throw Error('Unknown capability');
  const pointer = await db.get('settings:official-' + role);
  if (!pointer) return null;
  if (pointer.meta.imported)
    throw Error('Imported official pointer requires release verification');
  const { id } = decode<{ id: string }>(pointer);
  const entry = await db.get(id);
  if (
    !entry ||
    entry.meta.kind !== 'manifest' ||
    entry.meta.imported ||
    !entry.meta.protected
  )
    throw Error('Offizieller Modellnachweis fehlt.');
  const row = await verifyOfficialManifest(db, entry);
  if (row.role !== role) throw Error('Incompatible capability');
  return { id, ...row };
}
export async function cloneOfficial(
  db: StorePort,
  role: Capability,
  name: string,
  hardware?: number,
) {
  const row = await currentOfficial(db, role);
  if (!row) throw Error('Kein freigegebenes Modell für diese Rolle.');
  const v = await readVersion(db, row.freeze.version);
  return createModel(
    db,
    name,
    v.manifest.draft,
    { genome: v.genome, id: v.version.id, origin: 'clone' },
    hardware,
  );
}
export async function rollbackOfficial(db: StorePort, role: Capability) {
  const current = await currentOfficial(db, role);
  if (!current?.previous) throw Error('Keine frühere offizielle Version.');
  const entry = await db.get(current.previous);
  if (!entry || entry.meta.imported || !entry.meta.protected)
    throw Error('Rollback-Nachweis fehlt.');
  const previous = await verifyOfficialManifest(db, entry);
  if (
    previous.role !== role ||
    previous.freeze.modelKey !== current.freeze.modelKey
  )
    throw Error('Incompatible rollback');
  const pointer = 'settings:official-' + role;
  await db.commit(
    [
      jsonObject(
        'settings',
        pointer,
        { id: current.previous },
        [current.previous],
        true,
      ),
    ],
    { replace: [pointer] },
  );
}
