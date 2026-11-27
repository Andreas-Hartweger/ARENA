import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { Blob } from 'node:buffer';
import process from 'node:process';
import assert from 'node:assert/strict';
import { publish, publishJSON } from './campaign.mjs';
import { fileHash } from './evidence.mjs';
import { gunzipSync } from 'node:zlib';
import { replayReference } from '../replay-evolution-audit.mjs';
import { sha } from './manifest.mjs';
const { scanArchive } = await import('../../src/storage/archive.ts');
const { preflight } = await import('../../src/runtime/runConfig.ts');
const { digest } = await import('../evolution-runtime.mjs');
export async function reuseReference(ledger, directory, entry) {
  const def = entry.definition;
  assert.equal(def.experimentId, 'B-evolution-42');
  const old = 'docs/first-evolution/evidence/reference-release',
    proof = 'docs/intelligence-validation/evidence/historical';
  const meta = JSON.parse(readFileSync(join(old, 'run.json'), 'utf8')),
    source = JSON.parse(readFileSync(join(proof, 'roles.json'), 'utf8'));
  const { scenarios } = preflight(def.draft, digest, 16);
  assert.equal(scenarios[0].key, meta.scenario);
  assert.equal(meta.node, process.version);
  const folder = join(directory, 'experiments', def.experimentId);
  mkdirSync(folder, { recursive: true });
  const artifacts = {};
  for (const file of ['episodes.ndjson.gz', 'generations.ndjson']) {
    const bytes = readFileSync(join(old, file));
    if (file.startsWith('episodes'))
      assert.equal(sha(bytes), source.sourceArchiveSHA256);
    publish(join(folder, file), bytes);
    artifacts[file] = await fileHash(join(folder, file));
  }
  const rehearsal = ledger.db
    .prepare(
      'SELECT generation,bytes FROM chunks WHERE experiment=? ORDER BY generation',
    )
    .all('bench-0-1');
  assert.equal(rehearsal.length, 3);
  const prefix = rehearsal.map((row) =>
    gunzipSync(row.bytes)
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
  );
  const verification = await replayReference(old, {
    recordsOnly: true,
    onCandidate: (generation, slot, _s, genome, ref) => {
      if (generation >= prefix.length) return;
      const candidate = prefix[generation][slot];
      assert.equal(candidate.hash, genome.hash);
      assert.equal(candidate.score, ref.score);
      assert.deepEqual(candidate.episodes, ref.episodes);
    },
  });
  assert.equal(verification.reconstructedCandidates, 12800);
  const models = {};
  for (const driver of source.measured.filter(
    (d) =>
      d.roles.includes('Finaler Champion') ||
      d.roles.includes('Schnellste gültige Runde'),
  )) {
    const archive = readFileSync(join(proof, driver.package));
    assert.equal(sha(archive), driver.packageSHA256);
    const reader = await scanArchive(new Blob([archive])),
      record = reader.records.filter((r) => r.name.startsWith('genomes/'));
    assert.equal(record.length, 1);
    const bytes = Buffer.from(await reader.read(record[0])),
      path = driver.fingerprint + '.f64le';
    publish(join(folder, path), bytes);
    const model = {
      id: 'genome:' + driver.fingerprint + ':' + sha(bytes),
      file: path,
      size: bytes.length,
      sha256: sha(bytes),
    };
    if (driver.roles.includes('Finaler Champion')) models.champion = model;
    if (driver.roles.includes('Schnellste gültige Runde'))
      models.fastest = model;
  }
  const end = JSON.parse(readFileSync(join(old, 'end.json'), 'utf8'));
  assert.equal(end.generations, 100);
  assert.equal(source.replayed, 12800);
  const report = {
    schema: 'arena.experiment.v1',
    entry,
    runtime: meta,
    state: 'reused-historical',
    outcome: 'success',
    completed: 100,
    regularEpisodes: 12800,
    chargedRegularEpisodes: 0,
    models,
    artifacts,
    provenance: {
      original: source.originalSHA,
      boundaryReplay: verification,
      realMatchingCurrentPrefixEpisodes: 384,
      matching02C: JSON.parse(
        readFileSync(
          'docs/training-management/evidence/node-pool-reference.json',
          'utf8',
        ),
      ),
      protectedEvidence: 'docs/first-evolution/evidence/reference-release',
    },
  };
  publishJSON(join(folder, 'experiment.json'), report);
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('experiment:' + def.experimentId, entry);
    ledger.manifest('historical-reference', report);
  });
  return report;
}
