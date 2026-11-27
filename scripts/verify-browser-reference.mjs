/* global window */
import { build } from 'vite';
import { createServer } from 'node:http';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep, extname } from 'node:path';
import { URL, pathToFileURL } from 'node:url';
import process from 'node:process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { setTimeout as wait } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { environment } from './evolution-runtime.mjs';
const [destination, mode = 'full', referenceFile] = process.argv.slice(2);
if (
  !destination ||
  !['short', 'full', 'capture'].includes(mode) ||
  (mode === 'capture' && !referenceFile)
)
  throw Error('Expected NEW_DIRECTORY [short|full|capture BASELINE_NDJSON]');
mkdirSync(destination);
const out = resolve(destination, 'build');
await build({
  build: {
    outDir: out,
    rollupOptions: { input: resolve('tests/runtime/reference.html') },
  },
  logLevel: 'warn',
});
const server = createServer((req, res) => {
  try {
    const path = resolve(
      out,
      '.' + new URL(req.url, 'http://localhost').pathname,
    );
    if (!path.startsWith(out + sep)) throw Error();
    const bytes = readFileSync(path);
    res.writeHead(200, {
      'content-type':
        extname(path) === '.html' ? 'text/html' : 'application/javascript',
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { chromium } = await import(
  process.env.ARENA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ARENA_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const browser = await chromium.launch({
    executablePath: process.env.ARENA_CHROMIUM,
    headless: true,
  }),
  url =
    'http://127.0.0.1:' +
    server.address().port +
    '/tests/runtime/reference.html';
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.goto(url);
  const workers = await page.evaluate(() =>
    Math.max(1, Math.min(4, window.navigator.hardwareConcurrency - 2)),
  );
  writeFileSync(
    join(destination, 'start.json'),
    JSON.stringify({
      ...environment(),
      started: new Date().toISOString(),
      browser: browser.version(),
      workers,
      mode,
    }),
  );
  await page.evaluate(
    ({ workers, small, capture }) => {
      if (!capture) window.serial = window.reference(0, small);
      window.parallel = window.reference(workers, small, undefined, capture);
    },
    { workers, small: mode === 'short', capture: mode === 'capture' },
  );
  const logical = [[], []],
    ends = [];
  const archives = new Map();
  if (mode === 'capture') {
    const baseline = readFileSync(referenceFile, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((s) => JSON.parse(s));
    for (const r of baseline) {
      if (r.type === 'generation')
        logical[0][r.generation] = [r.logicalHash, r.nextHashes];
      if (r.type === 'end') ends[0] = r;
    }
    assert.equal(logical[0].length, 100);
    assert.equal(ends[0]?.evaluations, 12800);
  }
  while (!ends[0] || !ends[1]) {
    const batch = await page.evaluate(() => [
      window.serial?.poll() ?? [],
      window.parallel.poll(),
    ]);
    for (const [index, rows] of batch.entries())
      for (const row of rows) {
        if (row.type === 'archive') {
          const h = row.summary,
            serialized = JSON.stringify(h);
          assert.equal(h.records.length, 128);
          assert.equal(h.generation, archives.size);
          const hash = createHash('sha256').update(serialized).digest('hex');
          archives.set(h.generation, hash);
          assert.equal(hash, logical[0][h.generation][0]);
          appendFileSync(
            join(destination, 'browser-generations.ndjson.gz'),
            gzipSync(serialized + '\n'),
          );
          if (row.genome) {
            const bytes = Buffer.from(row.genome.bytes);
            assert.equal(bytes.length, 8547 * 8);
            writeFileSync(
              join(destination, 'G' + h.generation + '.f64le'),
              bytes,
            );
            appendFileSync(
              join(destination, 'milestones.ndjson'),
              JSON.stringify({
                generation: h.generation,
                fingerprint: row.genome.hash,
                header: row.genome.header,
                bytes: bytes.length,
                rawSha256: createHash('sha256').update(bytes).digest('hex'),
              }) + '\n',
            );
          }
          continue;
        }
        appendFileSync(
          join(destination, index ? 'parallel.ndjson' : 'serial.ndjson'),
          JSON.stringify(row) + '\n',
        );
        if (row.type === 'fault') throw Error(row.message);
        if (row.type === 'end') ends[index] = row;
        else if (row.type === 'generation') {
          logical[index][row.generation] = [row.logicalHash, row.nextHashes];
          if (logical[1 - index][row.generation])
            assert.deepEqual(
              logical[0][row.generation],
              logical[1][row.generation],
            );
        }
      }
    if (!ends[0] || !ends[1]) await wait(mode === 'short' ? 150 : 3000);
  }
  if (mode === 'capture') assert.equal(archives.size, 100);
  assert.equal(ends[0].champion, ends[1].champion);
  assert.deepEqual(logical[0], logical[1]);
  assert.equal(logical[0].length, mode === 'short' ? 3 : 100);
  writeFileSync(
    join(destination, 'end.json'),
    JSON.stringify(
      {
        [mode === 'capture' ? 'comparisonRun' : 'serial']: ends[0],
        parallel: ends[1],
        identicalGenerations: logical[0].length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  server.close();
}
