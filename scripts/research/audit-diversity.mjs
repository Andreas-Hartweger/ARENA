import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { environment, digest } from '../evolution-runtime.mjs';
import { hashJSON } from './manifest.mjs';
import { publishJSON, ActiveTime, openCampaign } from './campaign.mjs';
const { readGenome } = await import('../../src/storage/checkpoint.ts');
const { decode } = await import('../../src/storage/objects.ts');
const { preflight } = await import('../../src/runtime/runConfig.ts');
const [directory, experiment = 'B-evolution-43'] = process.argv.slice(2);
if (!/^B-(evolution|random)-(42|43|44)$/.test(experiment))
  throw Error('Expected a baseline with a retained prefix');
const start = performance.now(),
  db = new DatabaseSync(join(directory, 'research.sqlite'), { readOnly: true });
const overlapping = db
  .prepare(
    "SELECT lease FROM reservations WHERE id LIKE 'time:%' AND scope='research' LIMIT 1",
  )
  .get();
const ledger = overlapping ? null : openCampaign(directory);
const clock = ledger
  ? new ActiveTime(
      ledger,
      { experimentId: 'arithmetic-diversity' },
      'research',
      120000,
      start,
    )
  : null;
try {
  db.exec('BEGIN');
  const prefix = db
    .prepare('SELECT data,hash FROM manifests WHERE id=?')
    .get('prefix:' + experiment);
  const manifest = JSON.parse(prefix.data);
  assert.equal(hashJSON(manifest), prefix.hash);
  const getObject = db.prepare(
    'SELECT meta,bytes FROM objects WHERE space=? AND id=?',
  );
  const get = (id) => {
    const o = getObject.get(experiment, id);
    return { meta: JSON.parse(o.meta), bytes: o.bytes };
  };
  const cp = decode(get(manifest.checkpoint)),
    { m } = preflight(cp.draft, digest, 64);
  const genomeIds = cp.population.map((member) => member.genome);
  assert.equal(cp.nextGeneration, 64);
  assert.equal(manifest.logicalEpisodes, 8192);
  const n = genomeIds.length,
    mean = new Float64Array(m.count),
    sum = new Float64Array(m.count);
  // Two passes over canonical Float64LE genomes, independent from the online Welford calculation.
  for (let pass = 0; pass < 2; pass++)
    for (const id of genomeIds) {
      clock?.pulse();
      const parameters = readGenome(get(id), m).parameters();
      for (const layer of m.layers)
        for (let j = layer.offset; j < layer.end; j++) {
          const x = parameters[j] / layer.scale;
          if (pass === 0) mean[j] += x / n;
          else sum[j] += (x - mean[j]) ** 2;
        }
    }
  const layers = m.layers.map((l) => {
    let total = 0;
    for (let j = l.offset; j < l.end; j++) total += sum[j];
    return (2 * total) / ((n - 1) * (l.end - l.offset));
  });
  const d2 =
    layers.reduce(
      (acc, x, i) => acc + x * (m.layers[i].end - m.layers[i].offset),
      0,
    ) / m.count;
  const raw = JSON.parse(
    db
      .prepare(
        'SELECT summary FROM chunks WHERE experiment=? AND segment=0 AND generation=64',
      )
      .get(experiment).summary,
  ).diversity;
  const near = (a, b) =>
    assert(Math.abs(a - b) <= 1e-11 * Math.max(1, Math.abs(b)));
  const unique = new Set(genomeIds).size;
  assert.equal(unique, raw.unique);
  assert.equal(n - unique, raw.duplicates);
  near(raw.uniqueFraction, unique / n);
  near(d2, raw.D2);
  near(Math.sqrt(d2), raw.D);
  layers.forEach((v, i) => near(v, raw.layers[i]));
  db.exec('ROLLBACK');
  if (overlapping)
    assert(
      db
        .prepare('SELECT 1 FROM ownership WHERE token=?')
        .get(overlapping.lease),
      'Overlapping campaign session changed',
    );
  const output = {
    schema: 'arena.diversity-audit.v1',
    runtime: environment(),
    experiment,
    generation: 64,
    sourcePrefix: prefix.hash,
    checkpoint: cp.id,
    population: n,
    parameters: m.count,
    unique,
    duplicates: n - unique,
    layers,
    D2: d2,
    D: Math.sqrt(d2),
    reported: raw,
    comparedRealGenomes: genomeIds.length,
    ticksComputed: 0,
    elapsedMs: performance.now() - start,
    accountedBy: overlapping
      ? 'overlapping active research lease'
      : 'separate research interval',
  };
  const path = join(directory, 'diversity-' + experiment + '.json');
  publishJSON(path, output);
  assert.equal(
    hashJSON(JSON.parse(readFileSync(path, 'utf8'))),
    hashJSON(output),
  );
} finally {
  db.close();
  if (ledger) {
    try {
      clock.finish();
      ledger.release();
    } finally {
      ledger.close();
    }
  }
}
