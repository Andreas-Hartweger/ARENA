import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { replayReference } from './replay-evolution-audit.mjs';
import { sha } from './research/manifest.mjs';
import { NodeStore } from './research/store.mjs';
import {
  openCampaign,
  ActiveTime,
  publish,
  publishJSON,
  parseFlags,
} from './research/campaign.mjs';
import { environment } from './evolution-runtime.mjs';
const { createModel, readVersion } = await import('../src/storage/library.ts');
const { importPackage, previewPackage, exportPackage } =
  await import('../src/storage/transfer.ts');
const { defaultDraft } = await import('../src/runtime/runConfig.ts');
const { evaluate } = await import('../src/training/episode.ts');
const base = 'docs/intelligence-validation',
  prior = 'docs/first-evolution/evidence/reference-release';
const source = JSON.parse(
  readFileSync(join(base, 'PRE-D01_EVIDENCE.json'), 'utf8'),
);
const destination = resolve(process.argv[2], 'historical'),
  report = join(destination, 'roles.json');
if (existsSync(report)) throw Error('Historical role report already published');
const runtime = environment(),
  start = performance.now();
if (runtime.sourceDiff)
  throw Error('Historical reconstruction requires committed source');
const ledger = openCampaign(process.argv[2], parseFlags()),
  context = {
    experimentId: 'historical-reconstruction',
    session: ledger.token,
  };
const clock = new ActiveTime(ledger, context, 'research', 120000, start);
try {
  assert.equal(
    sha(readFileSync(join(prior, 'episodes.ndjson.gz'))),
    source.referenceArchiveSHA256,
  );
  const targets = new Map();
  for (const [role, record] of Object.entries(source.historicalNodeRoles)) {
    const id = record.generation + '/' + record.slot;
    if (!targets.has(id)) targets.set(id, { ...record, roles: [] });
    targets.get(id).roles.push(role);
  }
  const matched = new Map(),
    output = [];
  const replay = await replayReference(prior, {
    recordsOnly: true,
    onGeneration: () => clock.pulse(),
    onCandidate: (g, slot, scenario, genome, record, raw) => {
      const target = targets.get(g + '/' + slot);
      if (!target) return;
      assert.equal(target.id, record.id);
      assert.equal(target.fingerprint, genome.hash);
      matched.set(target, { genome, raw, scenario });
    },
  });
  assert.equal(matched.size, targets.size);
  mkdirSync(destination, { recursive: true });
  const src = new NodeStore(ledger, 'historical-' + ledger.token),
    restore = new NodeStore(ledger, 'verify-' + ledger.token);
  for (const [target, { genome, raw, scenario }] of matched) {
    clock.pulse();
    const profile = await createModel(
      src,
      target.roles.join(' + '),
      defaultDraft(),
      { genome, id: target.id, role: 'experiment' },
    );
    const pkg = await exportPackage(
      src,
      'model',
      [profile.id],
      process.version,
    );
    const bytes = Buffer.from(await pkg.arrayBuffer()),
      file = genome.hash + '.arena-model';
    const preview = await previewPackage(restore, pkg);
    await importPackage(restore, preview);
    const version = await readVersion(restore, profile.active);
    assert.equal(version.genome.hash, genome.hash);
    const jobId = randomUUID(),
      identity = {
        ...context,
        run: 'reference',
        segment: 0,
        generation: target.generation,
        slot: target.slot,
        jobId,
        attempt: 0,
        model: genome.hash,
      };
    ledger.reserve(jobId, 'research', identity, {
      ms: 0,
      episodes: 0,
      ticks: scenario.task.maxTicks,
    });
    const actual = evaluate(scenario, version.genome.brain());
    ledger.settle(
      jobId,
      { ms: 0, episodes: 0, ticks: actual.tick },
      actual.ok ? 'redrive' : 'failed',
    );
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), raw);
    assert.deepEqual(actual.lapTimes, target.lapTimes);
    publish(join(destination, file), bytes);
    output.push({
      ...target,
      package: file,
      packageSHA256: sha(bytes),
      packageBytes: bytes.byteLength,
      version: profile.active,
      source: 'verified-reconstruction',
      redrive: actual,
    });
  }
  clock.finish();
  ledger.release();
  publishJSON(report, {
    schema: 'arena.historical-roles.v1',
    sourceArchiveSHA256: source.referenceArchiveSHA256,
    runtime,
    originalSHA: replay.originalSha,
    replayed: replay.reconstructedCandidates,
    measured: output,
    usage: ledger.usage().charged,
  });
  process.stdout.write(report + '\n');
} finally {
  ledger.close();
}
