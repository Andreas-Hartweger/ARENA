import assert from 'node:assert/strict';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import process from 'node:process';
import { digest, environment } from './evolution-runtime.mjs';

const { Evolution } = await import('../src/training/evolution.ts');
const { scenarioSet, evaluate } = await import('../src/training/episode.ts');
const { model } = await import('../src/training/genome.ts');
const directory = process.argv[2],
  partial = process.argv.includes('--partial');
if (!directory) throw Error('Expected a reference run directory');
const file = (name) => join(directory, name);
const meta = JSON.parse(readFileSync(file('run.json'), 'utf8'));
assert.equal(meta.mode, 'reference');
const summaries = readFileSync(file('generations.ndjson'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
if (!partial) assert.equal(summaries.length, 100);
const [s] = scenarioSet(digest);
assert.equal(s.key, meta.scenario);
const run = new Evolution(model(s.modelSignature), [s], digest);
assert.deepEqual(JSON.parse(JSON.stringify(run.config)), meta.config);
const archive = file('episodes.ndjson.gz');
const input = existsSync(archive)
  ? createReadStream(archive).pipe(createGunzip())
  : createReadStream(file('episodes.ndjson'));
let buffer = [],
  g = 0,
  drives = 0,
  records = 0;
for await (const line of createInterface({ input, crlfDelay: Infinity })) {
  if (partial && g === summaries.length) break;
  const record = JSON.parse(line);
  assert.equal(record.generation, g);
  assert.equal(record.slot, buffer.length);
  buffer.push(record);
  if (buffer.length !== run.config.n) continue;
  const expected = summaries[g];
  let slot = 0;
  // Re-drive the generation's best and one different rotating slot. The
  // other records replay actual published results through the coordinator.
  const best = expected.order[0],
    second = (best + 1 + (g % 127)) % 128;
  const rows = run.collect((current, genome) => {
    const r = buffer[slot];
    assert.equal(genome.hash, r.hash);
    assert.equal(run.population[slot].id, r.id);
    const [saved] = r.episodes;
    const { contract, seed, scenario, attempt, ...raw } = saved;
    assert.deepEqual(
      [contract, seed, scenario, attempt],
      [current.key, current.seed, 0, 0],
    );
    const reDrive = slot === best || slot === second;
    slot++;
    if (!reDrive) return raw;
    const actual = evaluate(current, genome.brain());
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), raw);
    drives++;
    return actual;
  });
  const summary = run.commit(rows);
  const { records: observedRecords, before, ...statistics } = summary;
  assert.deepEqual(before, { p: 0.05, alpha: 0.2 });
  const {
    ms,
    cpu,
    before: historicalBefore,
    after,
    memory,
    ...savedStatistics
  } = expected;
  assert.ok(ms > 0 && cpu.user >= 0 && (memory?.after ?? after).rss > 0);
  if (memory) assert.deepEqual(historicalBefore, before);
  assert.deepEqual(JSON.parse(JSON.stringify(statistics)), savedStatistics);
  assert.deepEqual(
    JSON.parse(JSON.stringify(observedRecords)),
    buffer.map(({ generation, ...rest }) => {
      assert.equal(generation, g);
      return rest;
    }),
  );
  records += buffer.length;
  buffer = [];
  g++;
}
assert.equal(buffer.length, 0);
assert.equal(g, summaries.length);
assert.equal(drives, g * 2);
if (!partial) {
  assert.equal(run.population.length, 0);
  assert.equal(records, 12800);
  assert.equal(
    run.champion.genome.hash,
    JSON.parse(readFileSync(file('end.json'), 'utf8')).champion,
  );
}
process.stdout.write(
  JSON.stringify(
    {
      ...environment(),
      originalSha: meta.sha,
      complete: !partial,
      generations: g,
      reconstructedCandidates: records,
      episodesDrivenAgain: drives,
      allPublishedCandidateAndGenerationValuesEqual: true,
      champion: run.champion.genome.hash,
    },
    null,
    2,
  ) + '\n',
);
