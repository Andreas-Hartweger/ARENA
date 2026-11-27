import { build, preview } from 'vite';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';
import { environment } from './evolution-runtime.mjs';
const [destination] = process.argv.slice(2);
if (!destination) throw Error('New directory required');
mkdirSync(destination);
const outDir = resolve(destination, 'build');
await build({
  build: {
    outDir,
    rollupOptions: { input: resolve('tests/runtime/reference.html') },
  },
  logLevel: 'error',
});
const server = await preview({
  build: { outDir },
  preview: { host: '127.0.0.1', port: 0, open: false },
  logLevel: 'error',
});
const { chromium } = await import(
  process.env.ARENA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ARENA_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.ARENA_CHROMIUM,
  }),
  url =
    'http://127.0.0.1:' +
    server.httpServer.address().port +
    '/tests/runtime/reference.html';
const save = (name, data) =>
  writeFileSync(
    join(destination, name + '.json'),
    JSON.stringify(data, null, 2) + '\n',
  );
const modes = [
  ...[0, 1, 2, 4].map((workers) => ({
    name: 'max-' + workers,
    workers,
    rate: 'max',
    trace: false,
  })),
  { name: 'trace', workers: 2, rate: 'max', trace: true },
  { name: 'observed', workers: 2, rate: 'max', trace: false, observe: true },
  { name: '10x', workers: 2, rate: 10, trace: false },
  { name: '1x', workers: 2, rate: 1, trace: false },
];
const results = [],
  errors = [],
  oracles = new Map();
try {
  save('start', {
    ...environment(),
    driver: browser.version(),
    modes,
    work: '8 individuals, 2 generations, real 60/30, explicit short 180-tick task, warm-up G0, measure only G1, mandatory initial/boundary/final IndexedDB saves. Alternating order. Three repeats.',
    backgroundLoad:
      'Other isolated project acceptance workloads may run concurrently',
  });
  for (let repeat = 0; repeat < 3; repeat++)
    for (const mode of repeat % 2 ? [...modes].reverse() : modes) {
      const ctx = await browser.newContext(),
        page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      try {
        await page.goto(url);
        await page.evaluate((mode) => {
          window.job = window.reference(mode.workers, true, mode);
        }, mode);
        let end;
        const gens = [];
        while (!end) {
          for (const row of await page.evaluate(() => window.job.poll())) {
            if (row.type === 'fault') throw Error(row.message);
            if (row.type === 'end') end = row;
            else gens.push(row);
          }
          if (!end) await wait(100);
        }
        if (
          gens.length !== 2 ||
          end.evaluations !== 16 ||
          end.checkpoints !== 3 ||
          gens[0].ticks < 600
        )
          throw Error('Invalid matched window or save retention');
        const r = gens[1],
          identity = JSON.stringify([
            r.outcome,
            r.champion,
            r.nextHashes,
            r.ticks,
          ]);
        if (oracles.has('common') && oracles.get('common') !== identity)
          throw Error('Comparison diverged: ' + mode.name);
        oracles.set('common', identity);
        const result = {
          repeat,
          mode: mode.name,
          ...r,
          restoreMs: end.restoreMs,
          checkpoints: end.checkpoints,
        };
        results.push(result);
        appendFileSync(
          join(destination, 'raw.ndjson'),
          JSON.stringify(result) + '\n',
        );
      } finally {
        await ctx.close();
      }
    }
  if (errors.length) throw Error(JSON.stringify(errors));
  const stats = (a) => {
    a = a.slice().sort((a, b) => a - b);
    return { min: a[0], median: a[1], max: a[2] };
  };
  save('end', {
    matched: true,
    errors,
    summary: modes.map((m) => {
      const rr = results.filter((r) => r.mode === m.name);
      return {
        mode: m.name,
        ms: stats(rr.map((r) => r.ms)),
        saveMs: stats(rr.map((r) => r.saveMs)),
        restoreMs: stats(rr.map((r) => r.restoreMs)),
        ticksPerSecond: stats(rr.map((r) => (1000 * r.ticks) / r.ms)),
      };
    }),
  });
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
/* global window */
