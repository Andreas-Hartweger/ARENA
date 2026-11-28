import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import process from 'node:process';
import { hashJSON, sha } from './manifest.mjs';
import { publish, publishJSON } from './campaign.mjs';
const { validatePromotionReview } =
  await import('../../src/storage/capabilities.ts');

const [directory, reviewPath, destination] = process.argv.slice(2);
if (!directory || !reviewPath || !destination)
  throw Error(
    'Expected campaign, independent approval file and release staging directory',
  );
const review = JSON.parse(readFileSync(reviewPath, 'utf8')),
  db = new DatabaseSync(join(directory, 'research.sqlite'), { readOnly: true });
function verified(id) {
  const row = db.prepare('SELECT data,hash FROM manifests WHERE id=?').get(id);
  if (!row || hashJSON(JSON.parse(row.data)) !== row.hash)
    throw Error('Missing or corrupt manifest ' + id);
  return { hash: row.hash, value: JSON.parse(row.data) };
}
try {
  const validation = verified('final-validation'),
    freeze = verified('final-candidates'),
    audit = verified('final-raw-audit');
  if (
    validation.value.selectionHash !== freeze.hash ||
    audit.value.result.validation !== validation.hash ||
    review.auditHash !== audit.hash ||
    review.auditDisposition !== 'approved' ||
    !review.approved
  )
    throw Error(
      'Verified validation and independent audit disposition required',
    );
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (review.implementationSHA !== head)
    throw Error('Approval does not reference this implementation');
  const item = validation.value.results.find(
    (r) =>
      r.candidate.genome === review.genome &&
      r.candidate.roles.includes(review.role),
  );
  if (
    !item ||
    !item.gates.some((g) => g.role === review.role && g.status === 'passed') ||
    !audit.value.result.checked.some(
      (c) => c.genome === review.genome && c.roles.includes(review.role),
    )
  )
    throw Error(
      'Candidate has no successful gate and physical audit for the requested role',
    );
  const model = readFileSync(join(directory, 'selection', item.candidate.file));
  const evidence = readFileSync(join(directory, 'validation', item.file));
  if (
    sha(model) !== item.candidate.packageSHA256 ||
    sha(evidence) !== item.sha256
  )
    throw Error('Release inputs differ');
  validatePromotionReview(
    review.role,
    item.freeze,
    JSON.parse(evidence),
    review,
  );
  const prefix = item.candidate.genome,
    pkg = prefix + '.arena-model',
    data = prefix + '.validation.json';
  const out = resolve(destination);
  mkdirSync(out, { recursive: true });
  publish(join(out, pkg), model);
  publish(join(out, data), evidence);
  publishJSON(join(out, review.role + '-' + prefix + '.json'), {
    schema: 'arena.reviewed-release.v1',
    role: review.role,
    genome: prefix,
    source: head,
    auditHash: audit.hash,
    release: {
      freeze: item.freeze,
      review,
      packageUrl: './' + pkg,
      packageSHA256: sha(model),
      evidenceUrl: './' + data,
      evidenceSHA256: sha(evidence),
    },
  });
} finally {
  db.close();
}
