import type { Capability, ValidationEvidence } from '../research/validation';
import { sha256 } from '../runtime/fingerprint';
import {
  currentOfficial,
  promote,
  validatePromotionReview,
} from './capabilities';
import { importPackage, previewPackage } from './transfer';
import { releaseCatalog, type ReleasedModel } from './releaseCatalog';

type ReleaseStore = Parameters<typeof previewPackage>[0];
type FetchBytes = (url: string) => Promise<Uint8Array<ArrayBuffer>>;
const fetchBytes: FetchBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok)
    throw Error('Freigegebene Modelldatei konnte nicht geladen werden.');
  return new Uint8Array(await response.arrayBuffer());
};

export async function installedOfficial(db: ReleaseStore, role: Capability) {
  if (
    releaseCatalog[role] &&
    (await db.get('settings:official-' + role))?.meta.imported
  )
    return null;
  return currentOfficial(db, role);
}
export async function availableOfficial(db: ReleaseStore, role: Capability) {
  const installed = await installedOfficial(db, role);
  return (
    installed?.freeze.version ?? releaseCatalog[role]?.freeze.version ?? null
  );
}

// The application passes only the compiled release catalog. Importing a local package is a separate action.
export async function installReleasedModel(
  db: ReleaseStore,
  role: Capability,
  release: ReleasedModel,
  read: FetchBytes = fetchBytes,
) {
  const [pkg, evidenceBytes] = await Promise.all([
    read(release.packageUrl),
    read(release.evidenceUrl),
  ]);
  if (
    sha256(pkg) !== release.packageSHA256 ||
    sha256(evidenceBytes) !== release.evidenceSHA256
  )
    throw Error('Prüfsumme der Modellfreigabe stimmt nicht.');
  const evidence = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(evidenceBytes),
  ) as ValidationEvidence;
  validatePromotionReview(role, release.freeze, evidence, release.review);
  const preview = await previewPackage(db, new Blob([pkg]));
  if (
    preview.manifest.type !== 'model' ||
    !preview.manifest.entries.some(
      (e) => e.id === release.freeze.version && e.role === 'version',
    )
  )
    throw Error('Eingefrorene Modellversion fehlt im Paket.');
  await importPackage(db, preview);
  return promote(db, role, release.freeze, evidence, release.review);
}
