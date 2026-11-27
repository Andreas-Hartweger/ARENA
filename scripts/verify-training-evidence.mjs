import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

const root = process.argv[2] ?? 'docs/training-management/evidence';
const archive = join(root, 'browser-archive');
const reference = join(root, 'browser-reference');
const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
const readLines = (dir, file) =>
  read(dir, file)
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const tracks = [
  readLines(reference, 'serial.ndjson'),
  readLines(reference, 'parallel.ndjson'),
  readLines(archive, 'parallel.ndjson'),
];
const terminal = tracks.map((rows) => {
  assert.equal(rows.length, 101);
  const end = rows[100];
  assert.equal(end.type, 'end');
  assert.equal(end.generations, 100);
  assert.equal(end.evaluations, 12800);
  assert.equal(end.checkpoints, 3);
  assert.equal(rows[99].nextHashes, sha256(''));
  assert.equal(rows[99].champion, end.champion);
  return end;
});
const refEnd = JSON.parse(read(reference, 'end.json'));
const archiveEnd = JSON.parse(read(archive, 'end.json'));
assert.deepEqual(
  [refEnd.serial, refEnd.parallel, archiveEnd.parallel],
  terminal,
);
assert.deepEqual(archiveEnd.comparisonRun, refEnd.parallel);
assert.equal(refEnd.identicalGenerations, 100);
assert.equal(archiveEnd.identicalGenerations, 100);

const reasons = {};
let generation = 0,
  episodes = 0,
  totalTicks = 0,
  firstSuccessfulGeneration = null;
let validLaps = 0,
  fastestLapSeconds = Infinity;
const input = createReadStream(join(archive, 'browser-generations.ndjson.gz'));
for await (const line of createInterface({
  input: input.pipe(createGunzip()),
  crlfDelay: Infinity,
})) {
  const summary = JSON.parse(line),
    expected = tracks[0][generation];
  assert.equal(summary.generation, generation);
  assert.equal(summary.records.length, 128);
  assert.equal(sha256(line), expected.logicalHash);
  assert.deepEqual(
    [...summary.order].sort((a, b) => a - b),
    Array.from({ length: 128 }, (_, i) => i),
  );
  let ticks = 0,
    successes = 0;
  for (const [slot, candidate] of summary.records.entries()) {
    assert.equal(candidate.slot, slot);
    assert.ok(Number.isFinite(candidate.score));
    assert.equal(candidate.episodes.length, 1);
    const [episode] = candidate.episodes;
    assert.ok(episode.ok);
    assert.ok(Number.isSafeInteger(episode.tick) && episode.tick > 0);
    ticks += episode.tick;
    episodes++;
    reasons[episode.reason] = (reasons[episode.reason] ?? 0) + 1;
    if (episode.reason === 'completed') successes++;
    assert.equal(
      episode.lapTimes.length,
      Number(episode.reason === 'completed'),
    );
    for (const lap of episode.lapTimes) {
      assert.ok(Number.isFinite(lap) && lap > 0);
      validLaps++;
      fastestLapSeconds = Math.min(fastestLapSeconds, lap);
    }
  }
  totalTicks += ticks;
  if (successes && firstSuccessfulGeneration === null)
    firstSuccessfulGeneration = generation;
  assert.equal(summary.successes, successes);
  for (const track of tracks) {
    const row = track[generation];
    assert.equal(row.type, 'generation');
    assert.equal(row.generation, generation);
    assert.equal(row.evaluations, 128);
    assert.equal(row.ticks, ticks);
    assert.equal(row.successes, successes);
    assert.equal(row.best, summary.fitness.best);
    assert.equal(row.logicalHash, expected.logicalHash);
    assert.equal(row.nextHashes, expected.nextHashes);
    assert.equal(row.champion, expected.champion);
  }
  generation++;
}
assert.equal(generation, 100);
assert.equal(episodes, 12800);

const milestones = readLines(archive, 'milestones.ndjson');
assert.deepEqual(
  milestones.map((m) => m.generation),
  [0, 31, 99],
);
const championFiles = milestones.map((m) => {
  const raw = readFileSync(join(archive, 'G' + m.generation + '.f64le'));
  assert.equal(raw.length, 8547 * 8);
  assert.equal(m.bytes, raw.length);
  assert.equal(sha256(raw), m.rawSha256);
  const header = Buffer.from(m.header, 'utf8');
  const frame = Buffer.alloc(8);
  frame.writeUInt32LE(header.length, 0);
  frame.writeUInt32LE(raw.length / 8, 4);
  const fingerprint = sha256(Buffer.concat([frame, header, raw]));
  assert.equal(fingerprint, m.fingerprint);
  assert.equal(fingerprint, tracks[0][m.generation].champion);
  return {
    generation: m.generation,
    fingerprint,
    rawSha256: m.rawSha256,
    bytes: raw.length,
  };
});
process.stdout.write(
  JSON.stringify(
    {
      archiveSource: JSON.parse(read(archive, 'start.json')).sha,
      referenceSource: JSON.parse(read(reference, 'start.json')).sha,
      verifiedSummaryDigests: generation,
      episodes,
      simulationTicks: totalTicks,
      reasons,
      firstSuccessfulGeneration,
      validLaps,
      fastestLapSeconds,
      finalChampion: terminal[0].champion,
      championFiles,
    },
    null,
    2,
  ) + '\n',
);
