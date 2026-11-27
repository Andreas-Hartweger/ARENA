import { mkdirSync, statfsSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { linkSync, rmSync } from 'node:fs';
import { publish, publishJSON } from './campaign.mjs';
import { sha } from './manifest.mjs';

export function spaceCheck(directory, minimumBytes) {
  const info = statfsSync(directory, { bigint: true });
  if (info.bavail * info.bsize < BigInt(Math.ceil(minimumBytes)))
    throw Error('Insufficient evidence storage');
}
export async function fileHash(path) {
  const h = createHash('sha256');
  let size = 0;
  for await (const b of createReadStream(path)) {
    h.update(b);
    size += b.length;
  }
  return { size, sha256: h.digest('hex') };
}
async function streamArchive(path, stream) {
  const tmp = path + '.' + randomUUID() + '.tmp';
  try {
    await pipeline(
      stream,
      createWriteStream(tmp, { flags: 'wx', flush: true }),
    );
    const expected = await fileHash(tmp);
    try {
      linkSync(tmp, path);
    } catch (e) {
      if (
        e.code !== 'EEXIST' ||
        (await fileHash(path)).sha256 !== expected.sha256
      )
        throw e;
    }
    return expected;
  } finally {
    rmSync(tmp, { force: true });
  }
}
export async function exportExperiment(
  ledger,
  directory,
  entry,
  state,
  runtime,
) {
  const id = entry.definition.experimentId,
    folder = join(directory, 'experiments', id);
  mkdirSync(folder, { recursive: true });
  const db = ledger.db;
  const query = db.prepare(
    'SELECT bytes,checksum,summary,checkpoint FROM chunks WHERE experiment=? ORDER BY segment,generation',
  );
  function* chunks() {
    for (const row of query.iterate(id)) {
      if (sha(row.bytes) !== row.checksum)
        throw Error('Changed generation chunk');
      yield Buffer.from(row.bytes);
    }
  }
  const summaries = () =>
    db
      .prepare(
        'SELECT summary FROM chunks WHERE experiment=? ORDER BY segment,generation',
      )
      .iterate(id);
  function* lines() {
    for (const row of summaries()) yield row.summary + '\n';
  }
  const archive = await streamArchive(
    join(folder, 'episodes.ndjson.gz'),
    Readable.from(chunks()),
  );
  const generations = await streamArchive(
    join(folder, 'generations.ndjson'),
    Readable.from(lines()),
  );
  const source = ledger.db.prepare(
    'SELECT meta,bytes FROM objects WHERE space=? AND id=?',
  );
  const runId =
    entry.definition.masterSeed === 42 && id === 'B-evolution-42'
      ? 'reference'
      : id;
  const get = (key) => {
    const v = source.get(id, key);
    if (!v || sha(v.bytes) !== JSON.parse(v.meta).checksum)
      throw Error('Missing or damaged research object');
    return v.bytes;
  };
  const index = JSON.parse(Buffer.from(get('run:' + runId)).toString()),
    cp = JSON.parse(Buffer.from(get(index.latest)).toString());
  const prefix = ledger.db
    .prepare('SELECT data FROM manifests WHERE id=?')
    .get('prefix:' + id);
  const exports = {};
  for (const [role, key] of [
    ['champion', cp.champion?.genome],
    ['generationBest', cp.generationBest],
    ['fastest', cp.lapRecords?.[0]?.genome],
    ['prefixChampion', prefix ? JSON.parse(prefix.data).champion : undefined],
  ]) {
    if (!key) continue;
    const bytes = get(key),
      path = key.split(':')[1] + '.f64le';
    publish(join(folder, path), bytes);
    exports[role] = {
      id: key,
      file: path,
      size: bytes.length,
      sha256: sha(bytes),
    };
  }
  const result = {
    schema: 'arena.experiment.v1',
    entry,
    runtime,
    state: state.phase,
    outcome: cp.lapRecords?.length ? 'success' : 'no-success',
    completed: cp.counters.globalGeneration,
    regularEpisodes: cp.counters.logicalEpisodes,
    checkpoint: index.latest,
    models: exports,
    artifacts: {
      'episodes.ndjson.gz': archive,
      'generations.ndjson': generations,
    },
  };
  publishJSON(join(folder, 'experiment.json'), result);
  return result;
}
