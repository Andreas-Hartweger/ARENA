import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { gunzipSync } from 'node:zlib';
import { digest } from '../evolution-runtime.mjs';
import { hashJSON, sha } from './manifest.mjs';
import { publishJSON } from './campaign.mjs';
const { preflight } = await import('../../src/runtime/runConfig.ts');
const { initialPopulation, reproduce } =
  await import('../../src/training/population.ts');
const { ranking } = await import('../../src/training/operators.ts');
const { adapt } = await import('../../src/training/adaptation.ts');
const { stream } = await import('../../src/training/random.ts');
const { distribution } = await import('../../src/training/evolution.ts');

const [directory, output, ...configs] = process.argv.slice(2);
if (
  !configs.length ||
  new Set(configs).size !== configs.length ||
  configs.some((id) => !/^S(0[1-9]|[1-3]\d|4[0-7])$/.test(id))
)
  throw Error(
    'Expected campaign, output and distinct paired screening configurations',
  );
const db = new DatabaseSync(join(directory, 'research.sqlite'), {
  readOnly: true,
});
const manifest = db.prepare('SELECT data,hash FROM manifests WHERE id=?');
const boundary = db.prepare(
  'SELECT checksum,bytes,summary FROM chunks WHERE experiment=? AND segment=0 AND generation=?',
);
function sealed(key) {
  const row = manifest.get(key);
  assert(row, 'Missing manifest ' + key);
  const data = JSON.parse(row.data);
  assert.equal(hashJSON(data), row.hash);
  return data;
}
function generation(id, g) {
  const row = boundary.get(id, g);
  assert(row);
  assert.equal(sha(row.bytes), row.checksum);
  return {
    sha256: row.checksum,
    summary: JSON.parse(row.summary),
    records: gunzipSync(row.bytes)
      .toString('utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
  };
}
function verifyMembers(members, records, g) {
  assert.equal(members.length, records.length);
  for (const [i, member] of members.entries()) {
    const record = records[i];
    assert.equal(record.generation, g);
    assert.equal(record.slot, i);
    assert.equal(record.hash, member.genome.hash);
    for (const field of [
      'id',
      'birth',
      'origin',
      'operator',
      'parents',
      'mutation',
    ])
      assert.deepEqual(record[field], member[field]);
  }
}
function audit(id) {
  const folder = join(directory, 'experiments', id);
  const entry = sealed('experiment:' + id);
  const report = JSON.parse(
    readFileSync(join(folder, 'experiment.json'), 'utf8'),
  );
  const bytes = readFileSync(join(folder, 'audit.json'));
  assert.equal(sha(bytes), sealed('experiment-audit:' + id)['audit.json']);
  const result = JSON.parse(bytes);
  assert.equal(result.id, id);
  assert.equal(result.regularEpisodes, entry.definition.episodeBudget);
  assert.equal(hashJSON(report.entry), hashJSON(entry));
  assert.equal(entry.hash, hashJSON(entry.definition));
  const saved = entry.definition.draft;
  const draft = { ...saved, options: { ...saved.options, runId: id } };
  const { m, c } = preflight(draft, digest, report.runtime.logicalCpus);
  const first = generation(id, 0),
    second = generation(id, 1);
  const initial = initialPopulation(m, c, digest);
  verifyMembers(initial, first.records, 0);
  assert.deepEqual(
    result.g0,
    initial.map((a) => a.genome.hash),
  );
  const layers = m.layers.map((l) => ({
    weights: 0,
    biases: 0,
    zeroBiases: 0,
    min: Infinity,
    max: -Infinity,
    bound: Math.sqrt(3) * l.scale,
  }));
  for (const member of initial) {
    const v = member.genome.parameters();
    assert(v instanceof Float64Array);
    for (const l of m.layers) {
      const observed = layers[l.i];
      for (let j = l.offset; j < l.bias; j++) {
        observed.min = Math.min(observed.min, v[j]);
        observed.max = Math.max(observed.max, v[j]);
      }
      observed.weights += l.bias - l.offset;
      observed.biases += l.end - l.bias;
      for (let j = l.bias; j < l.end; j++)
        observed.zeroBiases += Number(v[j] === 0);
    }
  }
  for (const layer of layers) {
    assert.equal(layer.biases, layer.zeroBiases);
    assert(
      layer.min >= -layer.bound - Number.EPSILON &&
        layer.max <= layer.bound + Number.EPSILON,
    );
  }
  const scores = first.records.map((r) => r.score);
  const order = ranking(scores, stream(c.master, 'tie', 0));
  const state = adapt(null, scores[order[0]], c.adaptation, c.mutation);
  assert.deepEqual(order, first.summary.order);
  assert.deepEqual(state, first.summary.adaptive);
  const offspring = reproduce(initial, order, c, 1, state, digest);
  verifyMembers(offspring, second.records, 1);
  const ranks = new Map(order.map((slot, i) => [initial[slot].id, i + 1]));
  const selected = [],
    pool = Math.max(1, Math.round(c.n * c.poolFraction));
  let twoParents = 0,
    mutatedCrossovers = 0;
  for (const member of offspring.filter((a) => a.origin === 'offspring')) {
    const parentRanks = member.parents.map((p) => ranks.get(p));
    assert(parentRanks.every((rank) => rank >= 1 && rank <= pool));
    selected.push(...parentRanks);
    if (parentRanks.length !== 2) continue;
    assert.notEqual(
      initial[order[parentRanks[0] - 1]].genome.hash,
      initial[order[parentRanks[1] - 1]].genome.hash,
    );
    assert.equal(member.operator, c.operator);
    twoParents++;
    if (
      member.mutation.layers.some((l) => l.weight.changed + l.bias.changed > 0)
    )
      mutatedCrossovers++;
  }
  return {
    id,
    seed: c.master,
    definition: entry.hash,
    audit: sha(bytes),
    implementation: report.runtime.sha,
    g0Chunk: first.sha256,
    g1Chunk: second.sha256,
    orderedInitialGenomes: hashJSON(result.g0),
    activation: m.activation,
    hidden: m.hidden,
    population: c.n,
    parameters: m.count,
    initialLayers: layers,
    g0Score: first.summary.fitness,
    g0DistinctGenomes: new Set(result.g0).size,
    tournament: c.tournament,
    parentPoolSize: pool,
    distinctChosenParents: new Set(selected).size,
    parentRankOneBased: selected.length ? distribution(selected) : null,
    crossover: c.operator,
    crossoverProbability: c.crossProbability,
    twoParents,
    mutatedCrossovers,
    verifiedMembers: first.records.length + second.records.length,
    completeTrainingEpisodes: result.regularEpisodes,
    successfulTrainingEpisodes: result.successes,
    firstSuccessfulGeneration: result.firstSuccess,
  };
}
try {
  db.exec('BEGIN');
  const experiments = configs.flatMap((cfg) =>
    [42, 43].map((seed) => audit(cfg + '-' + seed)),
  );
  publishJSON(output, {
    schema: 'arena.inheritance-audit.v1',
    simulatedTicks: 0,
    experiments,
  });
} finally {
  db.close();
}
