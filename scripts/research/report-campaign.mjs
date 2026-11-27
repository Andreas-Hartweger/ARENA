import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { slots, hashJSON, sha } from './manifest.mjs';
import { publishJSON } from './campaign.mjs';
import { campaignStatus } from './status.mjs';

const [directory, stage, output] = process.argv.slice(2);
if (
  !directory ||
  !output ||
  !['baseline', '12', '24', '48', 'final'].includes(stage)
)
  throw Error('Expected campaign, baseline/12/24/48/final and output file');
const db = new DatabaseSync(join(directory, 'research.sqlite'), {
  readOnly: true,
});
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
function manifest(id, required = true) {
  const r = db.prepare('SELECT hash,data FROM manifests WHERE id=?').get(id);
  if (!r && !required) return null;
  if (!r || hashJSON(JSON.parse(r.data)) !== r.hash)
    throw Error('Missing or damaged campaign manifest ' + id);
  return JSON.parse(r.data);
}
function summarize(id) {
  const folder = join(directory, 'experiments', id),
    report = read(join(folder, 'experiment.json'));
  const hashes = manifest(
    (id.startsWith('B-') ? 'baseline-audit:' : 'experiment-audit:') + id,
  );
  for (const [file, digest] of Object.entries(hashes))
    assert.equal(sha(readFileSync(join(folder, file))), digest);
  const history = readFileSync(join(folder, 'generations.ndjson'));
  assert.equal(sha(history), report.artifacts['generations.ndjson'].sha256);
  const generations = history
    .toString('utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(generations.length, report.completed);
  generations.forEach((g, i) => assert.equal(g.generation, i));
  const audits = Object.entries(hashes).map(([file]) => {
    const audit = read(join(folder, file));
    const included = generations.slice(0, audit.generations);
    assert.equal(included.length, audit.generations);
    const total = (field) => {
      const counts = {};
      for (const g of included)
        for (const [name, count] of Object.entries(g[field])) {
          assert(Number.isSafeInteger(count) && count >= 0);
          counts[name] = (counts[name] ?? 0) + count;
        }
      return counts;
    };
    const adaptation = {};
    for (const g of included) {
      const reason = g.adaptive.reason;
      adaptation[reason] = (adaptation[reason] ?? 0) + 1;
    }
    const snapshot = (g) => ({
      generation: g.generation,
      evaluated: g.evaluations,
      validLaps: g.laps,
      successfulEpisodes: g.successes,
      lapTimesSeconds: g.lapTimes,
      progressMetres: g.progress,
      diversity: g.diversity,
    });
    return {
      file,
      episodes: audit.regularEpisodes,
      generations: audit.generations,
      successes: audit.successes,
      successRate: audit.successes / audit.regularEpisodes,
      firstSuccessGeneration: audit.firstSuccess,
      firstSuccessCensored: audit.firstSuccessCensored,
      fastest: audit.fastest,
      champion: audit.champion,
      rawTicks: audit.ticks,
      saturated: audit.saturated,
      ...(audit.lapTimeBoundaries
        ? { lapTimeBoundaries: audit.lapTimeBoundaries }
        : {}),
      firstGeneration: snapshot(included[0]),
      lastGeneration: snapshot(included.at(-1)),
      origins: total('origins'),
      operators: total('operators'),
      mutation: total('mutation'),
      terminalReasons: total('reasons'),
      adaptation,
    };
  });
  return {
    id,
    seed: report.entry.definition.masterSeed,
    configId: report.entry.definition.configId,
    hypothesis: report.entry.definition.hypothesis,
    fitnessContract: report.entry.definition.fitnessVersion,
    source: report.runtime.sha ?? report.provenance?.original,
    status: report.state.toLowerCase(),
    outcome: report.outcome,
    models: report.models,
    regularEpisodes: report.regularEpisodes,
    chargedRegularEpisodes:
      report.chargedRegularEpisodes ?? report.regularEpisodes,
    auditHashes: hashes,
    artifacts: report.artifacts,
    metrics: audits,
    sourceManifest: sha(readFileSync(join(folder, 'experiment.json'))),
  };
}
try {
  db.exec('BEGIN');
  const header = read(join(directory, 'campaign.json')),
    base = {
      schema: 'arena.campaign-report.v1',
      stage,
      campaign: header.definition.id,
      matrix: header.definition.matrixHash,
      assignment: header.definition.machines,
      nominal: {
        variants: 47,
        slots: slots.length,
        episodes: slots.reduce((n, s) => n + Number(s.EpisodeBudget), 0),
      },
    };
  let report;
  if (['12', '24', '48'].includes(stage)) {
    const checkpoint = manifest('report-hour-' + stage),
      stamp = Date.parse(checkpoint.stamp);
    const rows = db
      .prepare(
        "SELECT json_extract(context,'$.experimentId') id,COUNT(*) generations,SUM(json_extract(delta,'$.episodes')) committedEpisodes FROM events WHERE state='generation-committed' AND stamp<=? GROUP BY id",
      )
      .all(stamp);
    report = {
      ...base,
      stamp: checkpoint.stamp,
      usage: checkpoint.usage,
      researchCursor: checkpoint.context,
      createdAtBoundary: checkpoint.experiments,
      generationsAtBoundary: rows.filter((r) => !r.id.startsWith('bench-')),
      reusedReference:
        manifest('historical-reference', false)?.entry.hash ?? null,
      benchmarkRows: rows.filter((r) => r.id.startsWith('bench-')).length,
    };
  } else {
    const status = campaignStatus(directory),
      ids =
        stage === 'baseline'
          ? slots
              .filter((s) => s.ExperimentID.startsWith('B-'))
              .map((s) => s.ExperimentID)
          : status.slots
              .filter(
                (s) =>
                  s.state === 'completed' || s.state === 'reused-historical',
              )
              .map((s) => s.id);
    if (stage === 'baseline') assert.equal(ids.length, 6);
    const experiments = ids.map(summarize);
    const pairs = [];
    for (const seed of [42, 43, 44]) {
      const a = experiments.find((s) => s.id === 'B-evolution-' + seed),
        b = experiments.find((s) => s.id === 'B-random-' + seed);
      if (!a || !b) throw Error('Missing paired baseline');
      for (const aa of a.metrics) {
        const bb = b.metrics.find((v) => v.file === aa.file);
        assert.equal(aa.episodes, bb.episodes);
        pairs.push({
          seed,
          episodesPerArm: aa.episodes,
          evolutionSuccess: aa.successes,
          randomSuccess: bb.successes,
          evolutionFirst: aa.firstSuccessGeneration,
          randomFirst: bb.firstSuccessGeneration,
          evolutionFastest: aa.fastest?.time ?? null,
          randomFastest: bb.fastest?.time ?? null,
          rawTickDifference: aa.rawTicks - bb.rawTicks,
        });
      }
    }
    report = {
      ...base,
      usage: status.charge,
      experiments,
      pairs,
      milestones: status.milestones,
      reportedStates: status.state,
    };
    if (stage === 'final') {
      const final = manifest('final-validation'),
        raw = manifest('final-raw-audit'),
        archive = manifest('verified-archive');
      assert.equal(raw.result.validation, hashJSON(final));
      Object.assign(report, {
        slots: status.slots,
        freeze: hashJSON(manifest('final-candidates')),
        validation: hashJSON(final),
        independentArithmetic: hashJSON(raw),
        comparisons: raw.result.pairs,
        archive,
        candidates: final.results.map((r) => ({
          genome: r.candidate.genome,
          version: r.candidate.version,
          roles: r.gates.map((g) => ({
            role: g.role,
            status: g.status,
            checks: g.checks,
          })),
        })),
        technicalReview: 'pending',
        modelReadiness: final.results.some((r) =>
          r.gates.some((g) => g.role === 'Starter' && g.status === 'passed'),
        )
          ? 'eligible-pending-independent-approval'
          : 'no-passing-starter',
        firstRelease: 'blocked-pending-approved-starter',
      });
    }
  }
  if (existsSync(output)) {
    const before = read(output);
    if (
      before.stage !== stage ||
      before.campaign !== base.campaign ||
      before.matrix !== base.matrix
    )
      throw Error('Different existing report');
    if (stage === 'baseline') {
      assert.equal(hashJSON(before.experiments), hashJSON(report.experiments));
      assert.deepEqual(before.pairs, report.pairs);
    } else assert.equal(hashJSON(before), hashJSON(report));
  } else publishJSON(output, report);
} finally {
  db.close();
}
