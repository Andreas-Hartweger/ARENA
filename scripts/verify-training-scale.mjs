import { build, preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { setTimeout as wait } from 'node:timers/promises';
import { digest, environment } from './evolution-runtime.mjs';
const [dest] = process.argv.slice(2);
if (!dest) throw Error('New directory required');
mkdirSync(dest);
const { runtimeProbe } = await import('../tests/training/runtimeProbe.ts'),
  node = runtimeProbe(digest),
  outDir = resolve(dest, 'build');
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
});
try {
  const page = await browser.newPage();
  await page.goto(
    'http://127.0.0.1:' +
      server.httpServer.address().port +
      '/tests/runtime/reference.html',
  );
  const actual = await page.evaluate(() => window.runtimeProbe()),
    tolerance = {};
  for (const k of Object.keys(node)) {
    if (Array.isArray(node[k])) {
      const v = actual[k],
        maxAbs =
          v.length === node[k].length
            ? Math.max(...v.map((x, i) => Math.abs(x - node[k][i])))
            : Infinity,
        limit = k === 'uniform' ? 0 : 1e-9;
      if (!(maxAbs <= limit))
        throw Error('Cross-runtime bound: ' + k + ' ' + maxAbs);
      tolerance[k] = { length: v.length, maxAbs, limit };
    } else {
      if (actual[k] !== node[k]) throw Error('Discrete divergence: ' + k);
      tolerance[k] = { node: node[k], browser: actual[k] };
    }
  }
  const stress = [];
  for (const params of [
    { n: 512, widths: [4], maxTicks: 6 },
    { n: 1024, widths: [4], maxTicks: 6 },
    { n: 8, widths: [128, 128, 128, 128], maxTicks: 6 },
  ]) {
    await page.evaluate((p) => {
      window.job = window.reference(2, true, {
        rate: 'max',
        trace: false,
        ...p,
      });
    }, params);
    let end;
    const rows = [];
    while (!end) {
      for (const row of await page.evaluate(() => window.job.poll())) {
        if (row.type === 'fault') throw Error(row.message);
        if (row.type === 'end') end = row;
        else rows.push(row);
      }
      if (!end) await wait(100);
    }
    if (
      end.evaluations !== 2 * params.n ||
      rows.some((r) => r.ticks !== params.n * params.maxTicks) ||
      end.checkpoints !== 3
    )
      throw Error('Scale count mismatch');
    stress.push({ params, rows, end });
  }
  writeFileSync(
    join(dest, 'verified.json'),
    JSON.stringify(
      {
        ...environment(),
        browser: browser.version(),
        tolerance,
        stress,
        scope:
          'Cross-runtime 600-tick fixture; deliberately short six-tick stress episodes with mandatory IndexedDB saves and restore, separate from full reference.',
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
/* global window */
