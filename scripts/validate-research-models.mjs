import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { environment } from './evolution-runtime.mjs';
import { sha, hashJSON } from './research/manifest.mjs';
import {
  openCampaign,
  ActiveTime,
  publishJSON,
  parseFlags,
} from './research/campaign.mjs';
import {
  loadCandidate,
  loadPanel,
  standardPanel,
  evaluatePanel,
} from './research/evaluate-panel.mjs';
const { validateCapability } = await import('../src/research/validation.ts');
const { evidenceHash } = await import('../src/storage/capabilities.ts');
const directory = process.argv[2],
  start = performance.now(),
  runtime = environment(),
  ledger = openCampaign(directory, parseFlags());
const clock = new ActiveTime(
  ledger,
  { experimentId: 'final-model-validation' },
  'validation',
  120000,
  start,
);
async function validate() {
  const folder = join(directory, 'validation');
  mkdirSync(folder, { recursive: true });
  const previous = ledger.readManifest('final-validation');
  if (previous) {
    for (const row of previous.results) {
      if (
        sha(readFileSync(join(folder, row.file))) !== row.sha256 ||
        sha(readFileSync(join(folder, row.traces))) !== row.traceSHA256
      )
        throw Error('Published validation evidence differs');
    }
    publishJSON(join(folder, 'results.json'), previous);
    return;
  }
  const row = ledger.db
    .prepare("SELECT data,hash FROM manifests WHERE id='final-candidates'")
    .get();
  if (!row || hashJSON(JSON.parse(row.data)) !== row.hash)
    throw Error('Missing or changed candidate freeze');
  const freeze = JSON.parse(row.data),
    unique = new Set(freeze.candidates.map((c) => c.genome));
  if (
    hashJSON(freeze.panels) !== hashJSON(ledger.readManifest('frozen-panels'))
  )
    throw Error('Candidate freeze differs from the committed panels');
  if (
    unique.size !== freeze.candidates.length ||
    !unique.size ||
    unique.size > 3
  )
    throw Error('Invalid frozen candidates');
  const workers = JSON.parse(
    readFileSync(join(directory, 'worker-scaling.json'), 'utf8'),
  ).workers;
  const panels = {
    standard: standardPanel(),
    holdout: loadPanel(directory, 'holdout', ledger),
    endurance: loadPanel(directory, 'endurance', ledger),
    standardEndurance: standardPanel(true),
  };
  const output = [];
  for (const f of freeze.candidates) {
    const candidate = loadCandidate(directory, f.experimentId, f.modelRole);
    if (
      candidate.genome.hash !== f.genome ||
      candidate.genome.model.key !== f.modelKey ||
      !f.version?.startsWith('version:') ||
      f.file !== f.genome + '.arena-model' ||
      sha(readFileSync(join(directory, 'selection', f.file))) !==
        f.packageSHA256
    )
      throw Error('Frozen model mismatch');
    const evidence = { genome: f.genome };
    for (const [name, panel] of Object.entries(panels))
      evidence[name] = await evaluatePanel(
        ledger,
        clock,
        panel,
        candidate,
        workers,
      );
    if (f.roles.includes('Spezialist'))
      evidence.recovery = await evaluatePanel(
        ledger,
        clock,
        loadPanel(directory, 'recovery', ledger),
        candidate,
        workers,
      );
    const gates = f.roles.map((role) => validateCapability(role, evidence));
    const actual = evidence.holdout.actual,
      driven = actual.filter((c) => c.result.ok);
    const ordered = driven
      .filter((c) => c.result.reason === 'completed')
      .sort((a, b) => a.result.lapTimes[0] - b.result.lapTimes[0]);
    const rough = [...driven].sort(
      (a, b) =>
        b.result.raw.peakApproach - a.result.raw.peakApproach ||
        b.result.raw.grassSeconds - a.result.raw.grassSeconds,
    );
    const ids = [
      ...new Set(
        [
          ordered[0]?.id,
          rough[0]?.id,
          driven.find((c) => c.result.reason !== 'completed')?.id,
        ].filter(Boolean),
      ),
    ];
    const replay = await evaluatePanel(
      ledger,
      clock,
      panels.holdout,
      candidate,
      workers,
      { traceCases: ids },
    );
    const traces = {};
    for (const c of replay.actual.filter((r) => ids.includes(r.id))) {
      const original = actual.find((r) => r.id === c.id);
      const { trace, ...rest } = c.result;
      if (!trace || hashJSON(rest) !== hashJSON(original.result))
        throw Error('Audit replay mismatch');
      traces[c.id] = {
        caseId: c.id,
        effective: c.effective,
        samples: trace.samples,
        truncated: trace.truncated,
      };
    }
    const evidenceName = f.genome + '.json',
      traceName = f.genome + '.traces.json';
    publishJSON(join(folder, evidenceName), evidence);
    publishJSON(join(folder, traceName), traces);
    output.push({
      candidate: f,
      freeze: {
        schema: 1,
        genome: f.genome,
        version: f.version,
        modelKey: f.modelKey,
        roles: f.roles,
        selection: row.hash,
        panelHashes: {
          holdout: evidenceHash(evidence.holdout.expected),
          endurance: evidenceHash(evidence.endurance.expected),
          ...(evidence.recovery
            ? { recovery: evidenceHash(evidence.recovery.expected) }
            : {}),
        },
      },
      gates,
      validationHash: evidenceHash(evidence),
      file: evidenceName,
      sha256: sha(readFileSync(join(folder, evidenceName))),
      auditCases: ids,
      traces: traceName,
      traceSHA256: sha(readFileSync(join(folder, traceName))),
      independentReview: 'pending',
    });
  }
  const report = {
    schema: 'arena.validation-report.v1',
    selectionHash: row.hash,
    runtime,
    results: output,
    usage: ledger.usage().charged,
  };
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('final-validation', report);
  });
  publishJSON(join(folder, 'results.json'), report);
}
try {
  await validate();
} finally {
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
