import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { slots, hashJSON, sha } from './manifest.mjs';
import { publish, publishJSON, parseFlags } from './campaign.mjs';
import { campaignStatus, combinedStatus } from './status.mjs';
import { peerInputs, combinedMilestone } from './peer-inputs.mjs';
import {
  reviewCases,
  casesCSV,
  investigateRegression,
} from './review-cases.mjs';

const [directory, stage, output] = process.argv.slice(2);
const screenConfig =
  /^S\d{2}$/.test(stage) && slots.some((s) => s.ConfigID === stage);
if (
  !directory ||
  !output ||
  (!screenConfig &&
    ![
      'baseline',
      'baseline-cases',
      'performance',
      '12',
      '24',
      '48',
      'final',
    ].includes(stage))
)
  throw Error(
    'Expected campaign, baseline/baseline-cases/performance/screen configuration/12/24/48/final and output file',
  );
const db = new DatabaseSync(join(directory, 'research.sqlite'), {
  readOnly: true,
});
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
let peers;
function manifest(id, required = true) {
  const r = db.prepare('SELECT hash,data FROM manifests WHERE id=?').get(id);
  if (!r && !required) return null;
  if (!r || hashJSON(JSON.parse(r.data)) !== r.hash)
    throw Error('Missing or damaged campaign manifest ' + id);
  return JSON.parse(r.data);
}
function summarize(id) {
  const root = peers ? peers.source(id) : directory;
  const folder = join(root, 'experiments', id),
    report = read(join(folder, 'experiment.json'));
  const key =
    (id.startsWith('B-') ? 'baseline-audit:' : 'experiment-audit:') + id;
  const hashes = peers ? peers.manifest(root, key) : manifest(key);
  assert(hashes, 'Missing audit for ' + id);
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
    const settings = report.entry.definition.draft.options.adaptation;
    const triggers = [];
    for (const g of included) {
      const reason = g.adaptive.reason;
      adaptation[reason] = (adaptation[reason] ?? 0) + 1;
      if (reason === 'probability' || reason === 'strength') {
        const previous = included[g.generation - 1];
        assert(previous);
        triggers.push({
          generation: g.generation,
          previous: previous.adaptive,
          current: g.adaptive,
        });
      }
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
      ...(settings?.probabilityEnabled || settings?.strengthEnabled
        ? {
            adaptationTriggers: {
              settings,
              reasons: adaptation,
              generationsSHA256: report.artifacts['generations.ndjson'].sha256,
              events: triggers,
            },
          }
        : {}),
      ...(stage !== 'baseline'
        ? {
            generationWallMs: included.reduce(
              (sum, g) => sum + (g.durationMs ?? g.ms),
              0,
            ),
            firstCommittedSuccess:
              audit.firstSuccess === null
                ? null
                : {
                    generation: audit.firstSuccess,
                    episodes:
                      (audit.firstSuccess + 1) * included[0].evaluations,
                    generationWallMs: included
                      .slice(0, audit.firstSuccess + 1)
                      .reduce((sum, g) => sum + (g.durationMs ?? g.ms), 0),
                  },
          }
        : {}),
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
function screenComparisons(experiments) {
  const view = (run, metric) => {
    const times = run.id.startsWith('B-')
      ? manifest('baseline-times:' + run.id).boundaries
      : metric.lapTimeBoundaries;
    const measured = times.find((row) => row.episodes === metric.episodes);
    assert.equal(measured.validLaps, metric.successes);
    return {
      id: run.id,
      source: run.source,
      manifestSHA256: run.sourceManifest,
      audit: run.auditHashes[metric.file],
      population: metric.firstGeneration.evaluated,
      generations: metric.generations,
      successes: metric.successes,
      validLapSeconds: measured.seconds,
      finalMedianProgressM: metric.lastGeneration.progressMetres.median,
      firstCommittedSuccess: metric.firstCommittedSuccess,
      censored: metric.firstSuccessCensored,
      generationWallMs: metric.generationWallMs,
      ticks: metric.rawTicks,
      ...(metric.adaptationTriggers
        ? { adaptationTriggers: metric.adaptationTriggers }
        : {}),
    };
  };
  const comparisons = [];
  for (const variant of experiments.filter((r) => /^S\d{2}-/.test(r.id))) {
    const reference = experiments.find(
      (r) => r.id === 'B-evolution-' + variant.seed,
    );
    assert(reference);
    const arm = variant.metrics.find((m) => m.file === 'audit.json');
    const baseline = reference.metrics.find((m) => m.episodes === arm.episodes);
    assert(baseline, 'Missing baseline at the same episode budget');
    comparisons.push({
      config: variant.configId,
      seed: variant.seed,
      episodesPerArm: arm.episodes,
      ...(reference.fitnessContract !== variant.fitnessContract
        ? {
            fitnessContracts: {
              reference: reference.fitnessContract,
              variant: variant.fitnessContract,
            },
          }
        : {}),
      reference: view(reference, baseline),
      variant: view(variant, arm),
    });
  }
  return comparisons;
}
function performanceVariation() {
  const bytes = readFileSync(join(directory, 'worker-scaling.json'));
  const scaling = JSON.parse(bytes);
  const generationRows = db.prepare(
    'SELECT generation,checksum,summary FROM chunks WHERE experiment=? ORDER BY generation',
  );
  const results = scaling.stats.map((stat) => {
    const runs = scaling.rows
      .filter((r) => r.workers === stat.workers)
      .map((r) => {
        assert.deepEqual(manifest('measurement:' + r.id), r);
        const chunks = generationRows.all(r.id);
        assert.deepEqual(
          chunks.map((g) => g.checksum),
          r.archives,
        );
        const generations = chunks.map((g) => {
          const s = JSON.parse(g.summary);
          return {
            generation: g.generation,
            ticks: s.actualOrConservativelyChargedTicks,
            ms: s.durationMs,
          };
        });
        assert.equal(
          generations.reduce((n, g) => n + g.ticks, 0),
          r.ticks,
        );
        return {
          id: r.id,
          ticks: r.ticks,
          result: r.equivalent,
          ms: r.ms,
          ticksPerS: r.ticksPerS,
          cpuMs: (r.cpu.user + r.cpu.system) / 1000,
          saveMs: r.saveMs,
          observedGcMs: r.gcMs,
          generations,
        };
      })
      .sort((a, b) => a.ticksPerS - b.ticksPerS);
    assert.equal(runs.length, 3);
    const [slow, median, fast] = runs;
    assert.deepEqual(
      runs.map((r) => r.ticksPerS),
      [stat.min, stat.median, stat.max],
    );
    assert(
      runs.every(
        (r) =>
          r.ticks === scaling.rows[0].ticks &&
          r.result === scaling.rows[0].equivalent,
      ),
    );
    return {
      workers: stat.workers,
      runs,
      slowAgainstMedian: slow.ticksPerS / median.ticksPerS - 1,
      slowAgainstFast: slow.ticksPerS / fast.ticksPerS - 1,
      slowMinusFastMs: slow.ms - fast.ms,
      generationDeltasMs: slow.generations.map(
        (g, i) => g.ms - fast.generations[i].ms,
      ),
      saveDeltaMs: slow.saveMs - fast.saveMs,
      observedGcDeltaMs: slow.observedGcMs - fast.observedGcMs,
    };
  });
  return {
    source: scaling.runtime,
    scalingSHA256: sha(bytes),
    selectedWorkers: scaling.workers,
    results,
  };
}
function baselineCaseComparisons() {
  const baseline = manifest('baseline-development');
  const results = baseline.pairs.map(
    ({ seed, role, evolutionAgainstRandom: paired }) => {
      const arms = ['evolution', 'random'].map((method) => {
        const arm = baseline.runs.find(
          (r) => r.method === method && r.seed === seed && r.role === role,
        );
        assert(arm?.casesValid);
        const bytes = readFileSync(join(directory, arm.file));
        assert.equal(sha(bytes), arm.sha256);
        const outcome = JSON.parse(bytes);
        assert.equal(outcome.expected.length, baseline.caseCount);
        const rows = reviewCases(
          { ...arm, roles: [role] },
          { genome: arm.genome, development: outcome },
          arm.sha256,
        );
        return { arm, rows };
      });
      const [a, b] = arms.map((x) => x.arm);
      const pair = {
        a: a.genome,
        b: b.genome,
        paired,
        deltaSuccess:
          (b.statistics.success - a.statistics.success) / baseline.caseCount,
      };
      return {
        seed,
        role,
        episodesPerArm: a.episodesPerArm,
        sources: [a, b].map(({ id, file, sha256, genome }) => ({
          id,
          file,
          sha256,
          genome,
        })),
        ...pair,
        investigation: investigateRegression(
          pair,
          arms.flatMap((x) => x.rows),
          'development',
        ),
      };
    },
  );
  return {
    panel: baseline.panel,
    caseCount: baseline.caseCount,
    evidenceDigest: baseline.evidenceDigest,
    pairs: results,
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
  const local = manifest('assignment');
  peers = peerInputs(
    directory,
    {
      definition: header.definition,
      machine: { id: local.machineId },
      readManifest: (key) => manifest(key, false),
    },
    parseFlags().peers,
  );
  let report;
  if (stage === 'performance') {
    report = { ...base, ...performanceVariation() };
  } else if (stage === 'baseline-cases') {
    report = { ...base, ...baselineCaseComparisons() };
  } else if (peers && ['12', '24', '48'].includes(stage)) {
    if (peers.hosts.size !== header.definition.machines.length)
      throw Error('Missing machine for combined milestone');
    report = { ...base, ...combinedMilestone(peers, Number(stage) * 3600000) };
  } else if (['12', '24', '48'].includes(stage)) {
    const checkpoint = manifest('report-hour-' + stage),
      stamp = Date.parse(checkpoint.stamp);
    const boundary = db
      .prepare(
        "SELECT seq FROM events WHERE stamp<=? AND state IN ('elapsed','clock-uncertain') ORDER BY seq DESC LIMIT 1",
      )
      .get(stamp);
    assert(boundary, 'Missing milestone time receipt');
    const byScope = db
      .prepare(
        "SELECT scope,SUM(json_extract(delta,'$.ms')) ms,SUM(json_extract(delta,'$.ticks')) ticks,SUM(json_extract(delta,'$.episodes')) episodes FROM events WHERE seq<=? GROUP BY scope",
      )
      .all(boundary.seq);
    for (const k of ['ms', 'ticks', 'episodes'])
      assert.equal(
        byScope.reduce((n, row) => n + row[k], 0),
        checkpoint.usage.charged[k],
        'Milestone ledger mismatch: ' + k,
      );
    const rows = db
      .prepare(
        "SELECT json_extract(context,'$.experimentId') id,COUNT(*) generations,SUM(json_extract(delta,'$.episodes')) committedEpisodes FROM events WHERE state='generation-committed' AND seq<=? GROUP BY id",
      )
      .all(boundary.seq);
    report = {
      ...base,
      stamp: checkpoint.stamp,
      usage: checkpoint.usage,
      eventSequence: boundary.seq,
      chargedByScope: byScope,
      researchCursor: checkpoint.context,
      createdAtBoundary: checkpoint.experiments,
      generationsAtBoundary: rows.filter((r) => !r.id.startsWith('bench-')),
      reusedReference:
        manifest('historical-reference', false)?.entry.hash ?? null,
      benchmarkRows: rows.filter((r) => r.id.startsWith('bench-')).length,
    };
  } else if (screenConfig) {
    const experiments = [42, 43].flatMap((seed) => [
      summarize('B-evolution-' + seed),
      summarize(stage + '-' + seed),
    ]);
    report = { ...base, comparisons: screenComparisons(experiments) };
  } else {
    const status = peers
        ? combinedStatus(peers.roots)
        : campaignStatus(directory),
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
      milestones: peers ? status.reachedHours : status.milestones,
      ...(peers
        ? {
            machineAccounting: status.machines.map(
              ({ machine, charge, active }) => ({ machine, charge, active }),
            ),
          }
        : {}),
      reportedStates: status.state,
    };
    if (stage === 'final') {
      if (status.active.some((r) => r.ms || r.ticks || r.episodes))
        throw Error('Active campaign reservations at final reporting');
      const final = manifest('final-validation'),
        raw = manifest('final-raw-audit'),
        archive = manifest('verified-archive');
      assert.equal(raw.result.validation, hashJSON(final));
      const caseRecords = final.results.flatMap((item) => {
        const bytes = readFileSync(join(directory, 'validation', item.file));
        assert.equal(sha(bytes), item.sha256);
        return reviewCases(item.candidate, JSON.parse(bytes), item.sha256);
      });
      let caseTable = null;
      if (caseRecords.length) {
        const file = basename(output, extname(output)) + '-cases.csv';
        const bytes = Buffer.from(casesCSV(caseRecords));
        publish(join(dirname(output), file), bytes);
        caseTable = {
          file,
          sha256: sha(bytes),
          size: bytes.length,
          rows: caseRecords.length,
        };
      }
      const phaseReports = (peers?.roots ?? [directory]).flatMap((dir) =>
        readdirSync(dir)
          .filter((file) => /^progress-[\w]+-[\dTZ.-]+\.json$/.test(file))
          .sort()
          .map((file) => {
            const bytes = readFileSync(join(dir, file)),
              { usage, digest, ...progress } = JSON.parse(bytes);
            assert.equal(sha(JSON.stringify(progress)), digest);
            return {
              file,
              ...(peers
                ? { machine: peers.manifest(dir, 'assignment').machineId }
                : {}),
              sha256: sha(bytes),
              phase: progress.phase,
              source: progress.source,
              completed: progress.completed,
              deferred: progress.deferred,
              stopped: progress.stopped,
              usage,
            };
          }),
      );
      const choices = ['confirmation', 'long', 'freeze'].map((target) => {
        const key =
          target === 'freeze' ? 'final-candidates' : 'selection:' + target;
        const choice = manifest(key),
          file = 'selection/' + target + '.json';
        const bytes = readFileSync(join(directory, file));
        assert.equal(hashJSON(JSON.parse(bytes)), hashJSON(choice));
        return {
          phase: target,
          file,
          sha256: sha(bytes),
          panel: choice.dev,
          evaluated: choice.data.length,
          excluded: choice.excluded,
          ...(choice.configs ? { configs: choice.configs } : {}),
          rules: choice.rules ?? choice.reasons,
          usage: choice.usage,
        };
      });
      const byPhase = {};
      for (const slot of status.slots) {
        const group = (byPhase[slot.phase] ??= {});
        group[slot.state] = (group[slot.state] ?? 0) + 1;
      }
      Object.assign(report, {
        slots: status.slots,
        caseTable,
        screeningAgainstPairedBaseline: screenComparisons(experiments),
        byPhase,
        phaseReports,
        choices,
        freeze: hashJSON(manifest('final-candidates')),
        validation: hashJSON(final),
        independentArithmetic: hashJSON(raw),
        comparisons: raw.result.pairs.map((pair) =>
          pair.investigate
            ? {
                ...pair,
                investigation: investigateRegression(pair, caseRecords),
              }
            : pair,
        ),
        archive,
        ...(peers
          ? {
              machineArchives: [...peers.hosts].map(([machine, root]) => {
                const receipt = peers.manifest(root, 'verified-archive');
                assert(receipt, 'Missing verified archive for ' + machine);
                return { machine, ...receipt };
              }),
            }
          : {}),
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
