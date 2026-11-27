import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { hostname, tmpdir } from 'node:os';
import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { campaign, ResearchLedger } from './ledger.mjs';
import {
  caps,
  trainingCaps,
  matrixHash,
  experiment,
  hashJSON,
} from './manifest.mjs';
import { ActiveTime, publishJSON } from './campaign.mjs';
import { nodeComputePort } from '../node-compute-port.mjs';
import { exportExperiment } from './evidence.mjs';
import { inspectDevelopment } from './inspect-development.mjs';
import { runExperiment } from './coordinator.mjs';
import {
  evaluatePanel,
  loadCandidate,
  standardPanel,
} from './evaluate-panel.mjs';
const base = mkdtempSync(join(tmpdir(), 'arena-technical-evidence-')),
  src = join(base, 'source'),
  out = join(base, 'copy');
try {
  mkdirSync(src);
  const spec = campaign('qa', matrixHash, 'a'.repeat(40), [
    { id: hostname(), total: caps, training: trainingCaps },
  ]);
  publishJSON(join(src, 'campaign.json'), {
    definition: spec,
    testFixture: true,
  });
  const ledger = new ResearchLedger(
    join(src, 'research.sqlite'),
    spec,
    hostname(),
  );
  ledger.claim();
  const clock = new ActiveTime(ledger, { experimentId: 'qa' });
  try {
    const def = globalThis.structuredClone(
      experiment('B-evolution-43', 'qa', 1, 8).definition,
    );
    def.experimentId = 'qa-technical';
    def.episodeBudget = 8;
    Object.assign(def.draft.options, { n: 8, generations: 1, budget: 8 });
    def.draft.scenarios = [{ task: { maxTicks: 65, graceTicks: 0 } }];
    const entry = { definition: def, hash: hashJSON(def) };
    const state = await runExperiment(ledger, entry, clock, { hardware: 8 });
    assert.equal(state.phase, 'Completed');
    await exportExperiment(ledger, src, entry, state, {
      node: process.version,
      sha: spec.sha,
      testFixture: true,
    });
    const candidate = loadCandidate(src, def.experimentId);
    const expFile = join(
      src,
      'experiments',
      def.experimentId,
      'experiment.json',
    );
    const original = readFileSync(expFile);
    const altered = JSON.parse(original);
    delete altered.runtime.sha;
    writeFileSync(expFile, JSON.stringify(altered));
    assert.throws(() => loadCandidate(src, def.experimentId), /provenance/);
    writeFileSync(expFile, original);
    const paramFile = join(
      src,
      'experiments',
      def.experimentId,
      candidate.report.models.champion.file,
    );
    const parameters = readFileSync(paramFile);
    const modified = parameters.slice(1);
    writeFileSync(paramFile, modified);
    assert.throws(() => loadCandidate(src, def.experimentId), /damaged/);
    writeFileSync(paramFile, parameters);
    const panel = {
      name: 'development',
      hash: hashJSON('qa-development'),
      cases: [
        {
          id: 'qa-dev',
          group: 0,
          effective: 'qa-state',
          scenario: {
            purpose: 'validation',
            id: 'qa-dev',
            task: { maxTicks: 65, graceTicks: 0 },
          },
        },
      ],
    };
    const before = ledger.usage().charged;
    const first = await evaluatePanel(ledger, clock, panel, candidate, 1);
    assert(first.actual[0].result.ok);
    assert.equal(ledger.usage().charged.ticks - before.ticks, 65);
    assert.deepEqual(
      await evaluatePanel(ledger, clock, panel, candidate, 1, {
        portFactory() {
          throw Error('A cached case must not start any worker');
        },
      }),
      first,
    );
    assert.equal(ledger.usage().charged.ticks - before.ticks, 65);
    const retry = globalThis.structuredClone(panel);
    retry.cases[0].id = retry.cases[0].scenario.id = 'qa-receipt-loss';
    let lost = false;
    const measured = await evaluatePanel(ledger, clock, retry, candidate, 1, {
      portFactory() {
        const port = nodeComputePort();
        return {
          ...port,
          listen(event, fault) {
            port.listen((message) => {
              if (!lost && message.type === 'result') {
                lost = true;
                fault(Error('Lost measured receipt'));
              } else event(message);
            }, fault);
          },
        };
      },
    });
    assert(lost && measured.actual[0].result.ok);
    assert.equal(ledger.usage().charged.ticks - before.ticks, 195);
    const lostEvent = ledger.db
      .prepare(
        "SELECT context FROM events WHERE state='measurement-attempt' AND json_extract(context,'$.uncertain')=1",
      )
      .get();
    const receipt = JSON.parse(lostEvent.context);
    assert.equal(receipt.ticks, null);
    assert.equal(receipt.chargedTicks, 65);
    await inspectDevelopment(src, ledger, clock, panel, candidate, first);
    const diagnostics = ledger.readManifest(
      'development-trace:qa-technical:champion',
    );
    assert.equal(diagnostics.sampleCount, 6);
    assert.equal(diagnostics.diagnostics.observations, 6);
    assert.equal(diagnostics.diagnostics.measuredDecisions, 6);
    assert.equal(ledger.usage().charged.ticks - before.ticks, 260);
    await inspectDevelopment(src, ledger, clock, panel, candidate, first);
    assert.equal(ledger.usage().charged.ticks - before.ticks, 260);
    await assert.rejects(
      evaluatePanel(ledger, clock, standardPanel(), candidate, 1),
      /frozen/i,
    );
    // Minimal typed fixtures for the backup preconditions, never part of campaign results.
    for (const id of [
      'historical-reference',
      'final-candidates',
      'final-validation',
      'final-raw-audit',
    ])
      ledger.manifest(id, { testOnly: id });
  } finally {
    clock.finish();
    ledger.release();
    ledger.close();
  }
  const command = ['scripts/research/archive-campaign.mjs', src, out];
  execFileSync(process.execPath, command);
  const index = JSON.parse(
    readFileSync(join(out, 'archive-manifest.json'), 'utf8'),
  );
  assert.equal(index.checkpoints[0].regularEpisodes, 8);
  execFileSync(process.execPath, command);
  const damaged = join(
    out,
    'experiments',
    'qa-technical',
    'generations.ndjson',
  );
  writeFileSync(damaged, 'corrupt test copy');
  const result = spawnSync(process.execPath, command, { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Damaged archive/);
} finally {
  rmSync(base, { recursive: true, force: true });
}
