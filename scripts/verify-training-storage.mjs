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
let server = await preview({
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
    control = await first.page.evaluate(() =>
      window.storageCases.controlCases(),
    ),
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
  const transferWindows = [transfer.seen];
  for (let i = 1; i < 3; i++) {
    const extraSource = await fresh();
    const next = await extraSource.page.evaluate(() =>
      window.storageCases.produce(),
    );
    await extraSource.ctx.close();
    const extraTarget = await fresh();
    const result = await extraTarget.page.evaluate(
      (arg) => window.storageCases.consume(arg),
      next,
    );
    transferWindows.push(result.seen);
    await extraTarget.ctx.close();
  }
  const port = server.httpServer.address().port;
  let conflict = false;
  try {
    const second = await preview({
      build: { outDir },
      preview: { host: '127.0.0.1', port, open: false },
      logLevel: 'silent',
    });
    await new Promise((r) => second.httpServer.close(r));
  } catch (e) {
    conflict = /already in use|EADDRINUSE/i.test(String(e));
  }
  if (!conflict) throw Error('Port conflict did not fail closed');
  await target.page.goto('about:blank');
  const nextDir = resolve(destination, 'update');
  await build({
    build: {
      outDir: nextDir,
      rollupOptions: {
        input: resolve('tests/runtime/storage.html'),
        output: { entryFileNames: 'assets/update-[hash].js' },
      },
    },
    logLevel: 'error',
  });
  await new Promise((r) => server.httpServer.close(r));
  server = await preview({
    build: { outDir: nextDir },
    preview: { host: '127.0.0.1', port, open: false },
    logLevel: 'error',
  });
  await target.page.goto(url);
  const update = await target.page.evaluate(
    (hash) => window.storageCases.updateCheck(hash),
    fixture.fingerprint,
  );
  if (
    !url.startsWith(update.origin + '/') ||
    update.models !== 2 ||
    errors.length
  )
    throw Error(
      'Stable origin, model count or browser error: ' + JSON.stringify(errors),
    );
  const fallback = await target.page.evaluate(
    ({ latest, prior }) => window.storageCases.fallback(latest, prior),
    { latest: fixture.latest, prior: fixture.prior },
  );
  writeFileSync(
    join(destination, 'verified.json'),
    JSON.stringify(
      {
        ...environment(),
        browser: browser.version(),
        migration,
        control,
        faults,
        transfer,
        transferWindows,
        update,
        conflict,
        fallback,
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
