import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import process from 'node:process';
import { hashJSON, sha } from './manifest.mjs';
import { publishJSON } from './campaign.mjs';
import { loadPanel } from './evaluate-panel.mjs';
const { caseStatistics } = await import('../../src/research/validation.ts');

const [directory, phase, output] = process.argv.slice(2);
if (!output || !['confirmation', 'long', 'freeze'].includes(phase))
  throw Error('Expected campaign, selection phase and report file');
const db = new DatabaseSync(join(directory, 'research.sqlite'), {
  readOnly: true,
});
function readManifest(id) {
  const row = db.prepare('SELECT data,hash FROM manifests WHERE id=?').get(id);
  assert(row, 'Missing selection evidence: ' + id);
  const value = JSON.parse(row.data);
  assert.equal(hashJSON(value), row.hash);
  return value;
}
function order(a, b) {
  const keys = (r) => [
    -r.success,
    -r.weakest,
    r.success ? (r.time ?? Infinity) : Infinity,
    r.severe,
    r.grass ?? Infinity,
    -r.progress,
    r.msPerEpisode,
    r.configId,
    r.experimentId ?? '',
  ];
  const x = keys(a),
    y = keys(b);
  for (let i = 0; i < x.length; i++) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  return 0;
}
function groupedRanking(data, seeds) {
  const groups = new Map();
  for (const r of data) {
    if (!groups.has(r.configId)) groups.set(r.configId, []);
    groups.get(r.configId).push(r);
  }
  const ranked = [];
  for (const [configId, rows] of groups) {
    if (new Set(rows.map((r) => r.seed)).size < seeds) continue;
    const median = (key) => {
      const values = rows
        .map((r) => r[key])
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      if (!values.length) return null;
      const middle = (values.length - 1) / 2;
      const low = values[Math.floor(middle)],
        high = values[Math.ceil(middle)];
      return low + (high - low) * (middle % 1);
    };
    ranked.push({
      configId,
      success: median('success'),
      weakest: Math.min(...rows.map((r) => r.weakest)),
      time: median('time'),
      severe: Math.max(...rows.map((r) => r.severe)),
      grass: median('grass'),
      progress: median('progress'),
      msPerEpisode: median('msPerEpisode'),
      progressGain: median('progressGain'),
      firstSuccess: median('firstSuccessGeneration'),
    });
  }
  return ranked.sort(order);
}
try {
  db.exec('BEGIN');
  const name = phase === 'freeze' ? 'final-candidates' : 'selection:' + phase;
  const selection = readManifest(name),
    file = 'selection/' + phase + '.json';
  const original = readFileSync(join(directory, file));
  assert.equal(hashJSON(JSON.parse(original)), hashJSON(selection));
  const panel = loadPanel(directory, 'development', { readManifest });
  assert.equal(selection.dev, panel.hash);
  const expected = panel.cases.map(({ id, group, effective }) => ({
    id,
    group,
    effective,
  }));
  assert.equal(expected.length, 40);
  const runs = selection.data.map((item) => {
    assert.equal(basename(item.devFile), item.devFile);
    const bytes = readFileSync(join(directory, 'selection', item.devFile));
    const result = JSON.parse(bytes);
    assert.equal(result.panel, panel.hash);
    assert.equal(result.genome, item.genome);
    assert.equal(hashJSON(result.outcome), item.devHash);
    assert.deepEqual(result.outcome.expected, expected);
    const measured = new Map(result.outcome.actual.map((r) => [r.id, r]));
    assert.equal(measured.size, result.outcome.actual.length);
    assert.equal(measured.size, expected.length);
    for (const e of expected) {
      const m = measured.get(e.id);
      assert(
        m?.result.ok &&
          m.genome === item.genome &&
          m.group === e.group &&
          m.effective === e.effective,
      );
    }
    const stats = caseStatistics(result.outcome.actual);
    assert.deepEqual(stats, result.result);
    assert.equal(stats.success, item.success);
    assert.equal(Math.min(...stats.byGroup), item.weakest);
    assert.equal(stats.times?.median ?? null, item.time);
    assert.equal(stats.severe, item.severe);
    assert.equal(stats.grass?.median ?? null, item.grass);
    assert.equal(stats.lawfulProgress.median, item.progress);
    return {
      experiment: item.experimentId,
      config: item.configId,
      seed: item.seed,
      modelRole: item.role,
      genome: item.genome,
      trainingEpisodes: item.comparedEpisodes,
      firstTrainingSuccessGeneration: item.firstSuccessGeneration,
      trainingCensored: item.censored,
      successes: stats.success,
      successfulByGroup: stats.byGroup,
      medianSuccessfulLapS: item.time,
      severeContactsCases: stats.severe,
      collisionFreeSuccesses: stats.clean,
      medianSuccessfulGrassS: stats.grass?.median ?? null,
      medianLawfulProgressM: stats.lawfulProgress.median,
      source: 'selection/' + item.devFile,
      sourceSHA256: sha(bytes),
      outcomeHash: item.devHash,
    };
  });
  const ranked = selection.ranked ?? [];
  let chosen;
  if (phase === 'freeze') {
    assert.deepEqual(
      selection.data.map((r) => r.experimentId),
      [...selection.data].sort(order).map((r) => r.experimentId),
    );
    chosen = [];
    for (const r of runs) {
      if (!chosen.includes(r.genome)) chosen.push(r.genome);
      if (chosen.length === 3) break;
    }
    assert.deepEqual(
      chosen,
      selection.candidates.map((c) => c.genome),
    );
  } else {
    assert.deepEqual(
      ranked,
      groupedRanking(selection.data, phase === 'confirmation' ? 2 : 3),
    );
    const eligible = ranked.filter(
      (r) =>
        phase === 'long' || !['Baseline', 'evolution'].includes(r.configId),
    );
    const limit = phase === 'long' ? 2 : 5;
    chosen = eligible.slice(0, limit).map((r) => r.configId);
    if (phase === 'confirmation' && eligible.length > limit) {
      const later = eligible.slice(limit - 1).filter((r) => r.progressGain > 0);
      later.sort(
        (a, b) =>
          (b.firstSuccess ?? 0) - (a.firstSuccess ?? 0) ||
          b.progressGain - a.progressGain,
      );
      if (later.length) chosen[limit - 1] = later[0].configId;
    }
    assert.deepEqual(chosen, selection.configs);
  }
  publishJSON(output, {
    schema: 'arena.selection-review-data.v1',
    phase,
    file,
    sourceSHA256: sha(original),
    manifestHash: hashJSON(selection),
    developmentPanel: panel.hash,
    casesPerModel: expected.length,
    measuredRoleSlots: runs.length,
    uniqueGenomes: new Set(runs.map((r) => r.genome)).size,
    chosen,
    rules: selection.reasons ?? selection.rules,
    usage: selection.usage,
    excluded: selection.excluded,
    ranked,
    runs,
  });
} finally {
  db.close();
}
