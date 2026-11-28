import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { publish, publishJSON } from './campaign.mjs';
import { evaluatePanel } from './evaluate-panel.mjs';
import { hashJSON, sha } from './manifest.mjs';
const { traceDiagnostics, drivingDiagnostics } =
  await import('../../src/research/traceDiagnostics.ts');
const { createTrack } = await import('../../src/tracks/track.ts');

// At the same 8,192-episode boundary, compare one predeclared development case per activation.
export async function inspectDevelopment(
  directory,
  ledger,
  clock,
  panel,
  model,
  plain,
) {
  assert.equal(panel.name, 'development');
  const c = panel.cases[0];
  const expected = plain.actual.find((r) => r.id === c.id);
  if (!expected?.result.ok) return;
  const observed = await evaluatePanel(
    ledger,
    clock,
    { ...panel, cases: [c] },
    model,
    1,
    { traceCases: [c.id] },
  );
  const { trace, ...result } = observed.actual[0].result;
  assert(trace?.samples.length && !trace.truncated);
  assert.equal(hashJSON(result), hashJSON(expected.result));
  const samples = gzipSync(JSON.stringify(trace.samples));
  const name = 'development-' + model.role + '-trace.json.gz';
  const folder = join(directory, 'experiments', model.experimentId);
  mkdirSync(folder, { recursive: true });
  publish(join(folder, name), samples);
  const report = {
    experiment: model.experimentId,
    genome: model.genome.hash,
    role: model.role,
    caseId: c.id,
    panel: panel.hash,
    effective: c.effective,
    result: hashJSON(result),
    physicsTicks: result.tick,
    strideTicks: 12,
    sampleCount: trace.samples.length,
    samples: { file: name, size: samples.length, sha256: sha(samples) },
    diagnostics: traceDiagnostics(trace.samples, model.genome.model),
    driving: drivingDiagnostics(
      trace.samples,
      createTrack(model.draft.scenarios[0].track),
    ),
  };
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest(
      'development-trace:' + model.experimentId + ':' + model.role,
      report,
    );
  });
  publishJSON(
    join(folder, 'development-' + model.role + '-diagnostics.json'),
    report,
  );
}
