import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { createGunzip } from 'node:zlib';
const [reference, actual] = process.argv.slice(2);
const read = (dir, name) =>
  JSON.parse(readFileSync(join(dir, name + '.json'), 'utf8'));
async function hash(dir) {
  const path = join(dir, 'episodes.ndjson'),
    stream = existsSync(path)
      ? createReadStream(path)
      : createReadStream(path + '.gz').pipe(createGunzip());
  const digest = createHash('sha256');
  for await (const bytes of stream) digest.update(bytes);
  return digest.digest('hex');
}
const old = read(reference, 'run'),
  run = read(actual, 'run'),
  end = read(actual, 'end');
const rows = (dir) =>
  readFileSync(join(dir, 'generations.ndjson'), 'utf8')
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
const a = rows(reference),
  b = rows(actual);
assert.equal(a.length, 100);
assert.equal(b.length, a.length);
function logical(row, previous) {
  const { ms, cpu, memory, after, before, ...stats } = row;
  void ms;
  void cpu;
  void memory;
  void after;
  // The original 02B writer used "before" for process memory over the
  // adaptation record. The effective incoming policy is in the prior commit.
  return {
    ...stats,
    before:
      'rss' in before
        ? {
            p: previous?.adaptive.p ?? old.config.mutation.p,
            alpha: previous?.adaptive.alpha ?? old.config.mutation.alpha,
          }
        : before,
  };
}
for (let i = 0; i < a.length; i++)
  assert.deepEqual(logical(b[i], b[i - 1]), logical(a[i], a[i - 1]));
const digest = await hash(actual);
assert.equal(digest, await hash(reference));
assert.equal(end.champion, read(reference, 'end').champion);
assert.equal(end.evaluations, 12800);
process.stdout.write(
  JSON.stringify(
    {
      source: run.sha,
      reference: old.sha,
      node: run.node,
      cpu: run.cpu,
      workers: run.workers,
      started: run.started,
      ...end,
      matchingLogicalGenerations: b.length,
      matchingCandidateRows: end.evaluations,
      candidateBytesSha256: digest,
      timing:
        'Complete CLI run including output; browser checkpoint I/O excluded. Power and background load uncontrolled.',
    },
    null,
    2,
  ) + '\n',
);
