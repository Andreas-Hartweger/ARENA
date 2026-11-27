import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { environment } from '../evolution-runtime.mjs';
import { loadCandidate, loadPanel, standardPanel } from './evaluate-panel.mjs';
import { ActiveTime, openCampaign, publishJSON } from './campaign.mjs';
import { hashJSON, sha } from './manifest.mjs';
import { auditEpisode } from './audit-data.mjs';
const { createTrack } = await import('../../src/tracks/track.ts');
const { distribution } = await import('../../src/training/evolution.ts');
const { traceDiagnostics } =
  await import('../../src/research/traceDiagnostics.ts');
const { validateCapability, comparePaired } =
  await import('../../src/research/validation.ts');

const directory = process.argv[2],
  start = performance.now();
const ledger = openCampaign(directory),
  clock = new ActiveTime(
    ledger,
    { experimentId: 'final-raw-audit' },
    'validation',
    120000,
    start,
  );
function readVerified(root, file, expected) {
  const bytes = readFileSync(join(root, file));
  assert.equal(sha(bytes), expected);
  return JSON.parse(bytes);
}
function near(a, b) {
  assert(
    Number.isFinite(a) &&
      Number.isFinite(b) &&
      Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)),
    'Physical metric mismatch',
  );
}
async function review() {
  const outputDir = join(directory, 'validation'),
    dest = join(outputDir, 'audit.json');
  const frozen = ledger.readManifest('final-candidates'),
    final = ledger.readManifest('final-validation');
  if (!frozen || !final || final.selectionHash !== hashJSON(frozen))
    throw Error('Completed frozen validation required');
  const panels = {
    standard: standardPanel(),
    holdout: loadPanel(directory, 'holdout'),
    endurance: loadPanel(directory, 'endurance'),
    standardEndurance: standardPanel(true),
  };
  const checked = [],
    physical = new Map(),
    track = createTrack();
  for (const item of final.results) {
    const f = item.candidate,
      candidate = loadCandidate(directory, f.experimentId, f.modelRole);
    assert(frozen.candidates.some((row) => hashJSON(row) === hashJSON(f)));
    assert.equal(f.genome, candidate.genome.hash);
    const data = readVerified(outputDir, item.file, item.sha256),
      traces = readVerified(outputDir, item.traces, item.traceSHA256);
    const cfg = candidate.draft.scenarios[0],
      stored = {};
    if (data.recovery && !panels.recovery)
      panels.recovery = loadPanel(directory, 'recovery');
    for (const [name, p] of Object.entries(data)) {
      if (name === 'genome') continue;
      clock.pulse();
      const panel = panels[name];
      assert.deepEqual(
        p.expected,
        panel.cases.map(({ id, group, effective }) => ({
          id,
          group,
          effective,
        })),
      );
      const rows = [];
      for (const c of p.actual) {
        const e = c.result,
          initial = panel.cases.find((s) => s.id === c.id);
        assert(
          initial &&
            c.genome === f.genome &&
            c.effective === initial.effective &&
            c.group === initial.group,
        );
        if (!e.ok) continue;
        const laps = initial.scenario.task?.laps ?? 1;
        const deadline = (initial.scenario.task?.maxTicks ?? 7200) / 60;
        auditEpisode(e, cfg.fitness ?? 'Balanced', laps, deadline);
        const r = e.raw,
          complete = e.lapTimes.length;
        near(r.progress, r.approach + complete * track.length + r.partial);
        near(
          e.fitness.P,
          Math.min(1, (complete + r.partial / track.length) / laps),
        );
        near(
          e.fitness.A,
          r.approach / Math.abs(initial.scenario.start?.stationM ?? -8),
        );
        const credited =
          (e.fitness.K * laps - complete) * (track.gates.length - 1);
        near(credited, Math.round(credited));
        assert(credited >= -1e-8 && credited <= track.gates.length - 1 + 1e-8);
        assert(e.lapTimes.reduce((a, b) => a + b, 0) <= e.duration + 1e-7);
        rows.push(e);
      }
      const success = rows.filter((e) => e.reason === 'completed');
      stored[name] = {
        scheduled: panel.cases.length,
        scored: rows.length,
        complete: success.length,
        reasons: Object.fromEntries(
          [...new Set(p.actual.map((c) => c.result.reason))].map((reason) => [
            reason,
            p.actual.filter((c) => c.result.reason === reason).length,
          ]),
        ),
        lapTimeSeconds: success.length
          ? distribution(success.flatMap((e) => e.lapTimes))
          : null,
        taskSeconds: rows.length
          ? distribution(rows.map((e) => e.duration))
          : null,
        contactClusters: rows.reduce((sum, e) => sum + e.raw.clusters, 0),
        grassSeconds: rows.reduce((sum, e) => sum + e.raw.grassSeconds, 0),
        severeIncludingFailures: rows.filter((e) => e.raw.peakApproach >= 10)
          .length,
        byGroup: [...new Set(p.expected.map((c) => c.group))].map((group) => ({
          group,
          scheduled: p.expected.filter((c) => c.group === group).length,
          completed: p.actual.filter(
            (c) =>
              c.group === group &&
              c.result.ok &&
              c.result.reason === 'completed',
          ).length,
        })),
      };
    }
    assert.deepEqual(
      item.gates,
      f.roles.map((role) => validateCapability(role, data)),
    );
    assert.deepEqual(Object.keys(traces).sort(), [...item.auditCases].sort());
    const audits = [];
    for (const t of Object.values(traces)) {
      clock.pulse();
      const c = data.holdout.actual.find((c) => c.id === t.caseId);
      assert(
        c &&
          c.effective === t.effective &&
          c.result.ok &&
          t.samples.length &&
          !t.truncated,
      );
      let prior = 0,
        moves = 0,
        contacts = 0;
      for (const s of t.samples) {
        assert(s.tick > prior && s.tick <= c.result.tick);
        prior = s.tick;
        assert.equal(s.values.length, 248);
        assert(s.values.every(Number.isFinite));
        for (const [tick, hz] of [
          [s.observationTick, cfg.sensorHz ?? 30],
          [s.decisionTick, cfg.decisionHz ?? 30],
        ]) {
          assert(
            tick >= 0 &&
              tick < s.tick &&
              tick % (60 / hz) === 0 &&
              s.tick - 1 - tick < 60 / hz,
          );
        }
        assert(Number.isFinite(s.position.x) && Number.isFinite(s.position.y));
        for (const travel of s.travel.filter((e) => e.kind === 'move')) {
          near(travel.delta, travel.toS - travel.fromS);
          moves++;
        }
        contacts += s.contacts.length;
      }
      audits.push({
        id: t.caseId,
        sampledTicks: t.samples.length,
        travelIntervals: moves,
        contactIntervals: contacts,
        diagnostics: traceDiagnostics(t.samples, candidate.genome.model),
      });
    }
    checked.push({
      genome: f.genome,
      roles: f.roles,
      source: item.sha256,
      panels: stored,
      traces: audits,
    });
    physical.set(f.genome, data.holdout.actual);
  }
  const pairs = [];
  for (const [i, a] of checked.entries())
    for (const b of checked.slice(i + 1)) {
      const roles = a.roles.filter((role) => b.roles.includes(role));
      if (!roles.length) continue;
      const paired = comparePaired(
        physical.get(a.genome),
        physical.get(b.genome),
      );
      const first = a.panels.holdout,
        next = b.panels.holdout;
      const deltaSuccess = (next.complete - first.complete) / 60;
      const medianChange =
        first.lapTimeSeconds && next.lapTimeSeconds
          ? next.lapTimeSeconds.median / first.lapTimeSeconds.median - 1
          : null;
      pairs.push({
        a: a.genome,
        b: b.genome,
        roles,
        paired,
        deltaSuccess,
        medianChange,
        investigate:
          deltaSuccess < -0.05 ||
          (medianChange !== null && medianChange > 0.05),
      });
    }
  const previous = ledger.readManifest('final-raw-audit');
  const result = {
    schema: 'arena.raw-validation-audit.v1',
    selection: final.selectionHash,
    validation: hashJSON(final),
    checked,
    pairs,
  };
  if (previous) assert.deepEqual(previous.result, result);
  const receipt = previous ?? {
    result,
    runtime: environment(),
    independentReview: 'pending',
  };
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('final-raw-audit', receipt);
  });
  publishJSON(dest, receipt);
}
try {
  await review();
} finally {
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
