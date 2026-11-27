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
import { setTimeout as wait } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { environment } from './evolution-runtime.mjs';
const [destination, mode = 'full'] = process.argv.slice(2);
if (!destination || !['short', 'full'].includes(mode))
  throw Error('Expected NEW_DIRECTORY [short|full]');
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
    ({ workers, small }) => {
      window.serial = window.reference(0, small);
      window.parallel = window.reference(workers, small);
    },
    { workers, small: mode === 'short' },
  );
  const logical = [[], []],
    ends = [];
  while (!ends[0] || !ends[1]) {
    const batch = await page.evaluate(() => [
      window.serial.poll(),
      window.parallel.poll(),
    ]);
    for (const [index, rows] of batch.entries())
      for (const row of rows) {
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
  assert.equal(ends[0].champion, ends[1].champion);
  assert.deepEqual(logical[0], logical[1]);
  assert.equal(logical[0].length, mode === 'short' ? 3 : 100);
  writeFileSync(
    join(destination, 'end.json'),
    JSON.stringify(
      {
        serial: ends[0],
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
