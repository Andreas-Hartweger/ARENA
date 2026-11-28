import { backup, DatabaseSync } from 'node:sqlite';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  readFileSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { TextDecoder } from 'node:util';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import {
  ActiveTime,
  openCampaign,
  publishJSON,
  parseFlags,
} from './campaign.mjs';
import { peerInputs } from './peer-inputs.mjs';
import { fileHash, spaceCheck } from './evidence.mjs';
import { hashJSON, sha } from './manifest.mjs';
const { restore } = await import('../../src/storage/checkpoint.ts');

const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg)
  throw Error('Expected campaign directory and separate backup directory');
const source = resolve(sourceArg),
  target = resolve(destinationArg);
function contains(parent, child) {
  const part = relative(parent, child);
  return !part || (!part.startsWith('..') && !isAbsolute(part));
}
if (contains(source, target) || contains(target, source))
  throw Error('Backup must be outside the campaign');
const start = performance.now(),
  ledger = openCampaign(source);
const clock = new ActiveTime(
  ledger,
  { experimentId: 'research-evidence-archive' },
  'validation',
  120000,
  start,
);
const files = {};
async function mirror(name) {
  const src = join(source, name),
    dst = join(target, name);
  const info = await fileHash(src);
  clock.pulse();
  mkdirSync(dirname(dst), { recursive: true });
  if (!existsSync(dst)) {
    const tmp = dst + '.' + randomUUID() + '.tmp';
    try {
      await pipeline(
        createReadStream(src),
        new Transform({
          transform(chunk, encoding, cb) {
            try {
              clock.pulse();
              cb(null, chunk);
            } catch (e) {
              cb(e);
            }
          },
        }),
        createWriteStream(tmp, { flags: 'wx', flush: true }),
      );
      const actual = await fileHash(tmp);
      if (actual.sha256 !== info.sha256 || actual.size !== info.size)
        throw Error('Copy integrity failure: ' + name);
      linkSync(tmp, dst);
    } finally {
      rmSync(tmp, { force: true });
    }
  }
  const verified = await fileHash(dst);
  if (verified.sha256 !== info.sha256 || verified.size !== info.size)
    throw Error('Backup differs: ' + name);
  files[name] = verified;
}
async function walk(name) {
  for (const f of readdirSync(join(source, name), { withFileTypes: true }).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (f.name.endsWith('.tmp')) continue;
    const item = name ? name + '/' + f.name : f.name;
    if (f.isDirectory()) await walk(item);
    else if (f.isFile()) await mirror(item);
    else throw Error('Unsupported archive item: ' + item);
  }
}
async function archive() {
  const peers = peerInputs(source, ledger, parseFlags().peers);
  if (peers) {
    if (
      peers.roots.some(
        (root) =>
          contains(resolve(root), target) || contains(target, resolve(root)),
      )
    )
      throw Error('Backup must be outside every source campaign');
    const receipts = Object.fromEntries(
      [
        'historical-reference',
        'final-candidates',
        'final-validation',
        'final-raw-audit',
      ].map((key) => [key, peers.common(key)]),
    );
    const freeze = receipts['final-candidates'],
      validation = receipts['final-validation'],
      raw = receipts['final-raw-audit'];
    if (
      !receipts['historical-reference'] ||
      !freeze ||
      !validation ||
      !raw ||
      validation.selectionHash !== hashJSON(freeze) ||
      raw.result.validation !== hashJSON(validation)
    )
      throw Error(
        'Verified frozen validation and raw audit required across assigned machines',
      );
    ledger.transaction(() => {
      ledger.assertLease();
      for (const [key, value] of Object.entries(receipts))
        ledger.manifest(key, value);
    });
  }
  if (!ledger.readManifest('final-raw-audit'))
    throw Error(
      'Final raw-data audit required before archiving private panels',
    );
  const old = ledger.readManifest('verified-archive');
  if (old && resolve(old.destination) !== target)
    throw Error('Backup already published at a different destination');
  mkdirSync(target, { recursive: true });
  const dbName = 'research.sqlite',
    dbFile = join(source, dbName),
    snapshot = join(target, dbName);
  const prior = join(target, 'archive-manifest.json');
  if (existsSync(prior)) {
    const index = JSON.parse(readFileSync(prior, 'utf8'));
    for (const [name, v] of Object.entries(index.files)) {
      if (!contains(target, resolve(target, name)))
        throw Error('Invalid archive path');
      clock.pulse();
      const check = await fileHash(join(target, name), () => clock.pulse());
      if (check.sha256 !== v.sha256 || check.size !== v.size)
        throw Error('Damaged archive: ' + name);
    }
    if (old && old.manifest !== hashJSON(index))
      throw Error('Published archive index changed');
    if (!old)
      ledger.transaction(() => {
        ledger.assertLease();
        ledger.manifest('verified-archive', {
          destination: target,
          manifest: hashJSON(index),
        });
      });
    return;
  }
  spaceCheck(target, statSync(dbFile).size + 2 * 1024 ** 3);
  for (const name of readdirSync(source, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      name.isDirectory() &&
      [
        'experiments',
        'historical',
        'panels',
        'selection',
        'validation',
      ].includes(name.name)
    )
      await walk(name.name);
    else if (name.isFile() && name.name.endsWith('.json'))
      await mirror(name.name);
  }
  const db = new DatabaseSync(dbFile, { readOnly: true });
  const checkpoints = [];
  try {
    db.exec('BEGIN');
    db.prepare('SELECT count(*) FROM charges').get();
    if (!existsSync(snapshot)) {
      const tmp = snapshot + '.' + randomUUID() + '.tmp';
      try {
        await backup(db, tmp, {
          rate: 512,
          progress() {
            clock.pulse();
          },
        });
        linkSync(tmp, snapshot);
      } finally {
        rmSync(tmp, { force: true });
      }
    }
    const restored = new DatabaseSync(snapshot, { readOnly: true });
    try {
      for (const key of [
        'historical-reference',
        'final-candidates',
        'final-validation',
        'final-raw-audit',
      ]) {
        const row = restored
          .prepare('SELECT data,hash FROM manifests WHERE id=?')
          .get(key);
        if (
          !row ||
          hashJSON(JSON.parse(row.data)) !== row.hash ||
          row.hash !== hashJSON(ledger.readManifest(key))
        )
          throw Error('Restored campaign manifest mismatch: ' + key);
      }
      // Replay every stored generation boundary from the actual backup in bounded rows.
      const expected = db.prepare('SELECT count(*) n FROM chunks').get().n;
      const originalChunk = db.prepare(
        'SELECT checksum FROM chunks WHERE experiment=? AND segment=? AND generation=?',
      );
      let count = 0;
      for (const row of restored
        .prepare(
          'SELECT experiment,segment,generation,checksum,bytes FROM chunks ORDER BY experiment,segment,generation',
        )
        .iterate()) {
        clock.pulse();
        const original = originalChunk.get(
          row.experiment,
          row.segment,
          row.generation,
        );
        if (
          original?.checksum !== row.checksum ||
          sha(row.bytes) !== row.checksum
        )
          throw Error('Backup generation index differs');
        count++;
      }
      if (count !== expected) throw Error('Backup boundary count differs');
      const object = restored.prepare(
        'SELECT meta,bytes FROM objects WHERE space=? AND id=?',
      );
      for (const name of Object.keys(files).filter((n) =>
        n.endsWith('/experiment.json'),
      )) {
        const report = JSON.parse(readFileSync(join(target, name), 'utf8'));
        if (!report.checkpoint) continue;
        const space = report.entry.definition.experimentId;
        const header = object.get(space, report.checkpoint);
        if (!header) throw Error('Archived run is missing its checkpoint');
        const runtime = JSON.parse(
          new TextDecoder().decode(header.bytes),
        ).runtime;
        await restore(
          {
            get(id) {
              const value = object.get(space, id);
              return (
                value && { meta: JSON.parse(value.meta), bytes: value.bytes }
              );
            },
          },
          report.checkpoint,
          runtime,
          availableParallelism(),
          undefined,
          () => clock.pulse(),
        );
        checkpoints.push({
          experiment: space,
          checkpoint: report.checkpoint,
          generations: report.completed,
          regularEpisodes: report.regularEpisodes,
        });
      }
    } finally {
      restored.close();
    }
    db.exec('ROLLBACK');
  } finally {
    db.close();
  }
  files[dbName] = await fileHash(snapshot, () => clock.pulse());
  const index = {
    schema: 'arena.archive.v1',
    campaign: ledger.definition.id,
    matrixHash: ledger.definition.matrixHash,
    source,
    destination: target,
    fileCount: Object.keys(files).length,
    checkpoints,
    files,
  };
  publishJSON(prior, index);
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('verified-archive', {
      destination: target,
      manifest: hashJSON(index),
    });
  });
}
try {
  await archive();
} finally {
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
