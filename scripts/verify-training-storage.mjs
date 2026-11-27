import { build, preview } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { environment } from './evolution-runtime.mjs';
const [destination] = process.argv.slice(2);
if (!destination) throw Error('New evidence directory required');
mkdirSync(destination);
const outDir = resolve(destination, 'build');
await build({
  build: {
    outDir,
    rollupOptions: { input: resolve('tests/runtime/storage.html') },
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
    '/tests/runtime/storage.html';
const errors = [];
async function fresh() {
  const ctx = await browser.newContext(),
    page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  return { ctx, page };
}
try {
  const first = await fresh(),
    migration = await first.page.evaluate(() =>
      window.storageCases.migration(),
    ),
    faults = await first.page.evaluate(() => window.storageCases.faults()),
    fixture = await first.page.evaluate(() => window.storageCases.produce());
  await first.ctx.close();
  const target = await fresh(),
    transfer = await target.page.evaluate(
      (arg) => window.storageCases.consume(arg),
      fixture,
    );
  if (errors.length) throw Error(JSON.stringify(errors));
  writeFileSync(
    join(destination, 'verified.json'),
    JSON.stringify(
      {
        ...environment(),
        browser: browser.version(),
        migration,
        faults,
        transfer,
        errors,
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
