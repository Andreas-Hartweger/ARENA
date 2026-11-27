// Requires a separately provided Playwright installation and Chromium. The
// application and its package lock do not depend on the browser test driver.
import { build } from 'vite';
import { createServer } from 'node:http';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join, sep, extname } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { environment } from './evolution-runtime.mjs';
const [destination, mode = 'short'] = process.argv.slice(2);
if (
  !destination ||
  !['short', 'endurance'].includes(mode) ||
  existsSync(destination)
)
  throw Error('Use a new output directory and short or endurance');
const { chromium } = await import(
  process.env.ARENA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ARENA_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
mkdirSync(destination);
const out = resolve(destination, 'build'),
  record = (name, v) =>
    writeFileSync(
      join(destination, name + '.json'),
      JSON.stringify(v, null, 2) + '\n',
    );
await build({
  build: {
    outDir: out,
    rollupOptions: { input: resolve('tests/runtime/browser.html') },
  },
  logLevel: 'warn',
});
const server = createServer((req, res) => {
  try {
    const path = resolve(
      out,
      '.' + new URL(req.url, 'http://localhost').pathname,
    );
    if (!path.startsWith(out + sep)) throw Error('Invalid path');
    const content = readFileSync(path),
      type = extname(path) === '.html' ? 'text/html' : 'application/javascript';
    res.writeHead(200, { 'content-type': type });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
    executablePath: process.env.ARENA_CHROMIUM,
    headless: true,
  }),
  context = await browser.newContext();
const page = await context.newPage(),
  errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const url =
  'http://127.0.0.1:' + server.address().port + '/tests/runtime/browser.html';
try {
  await page.goto(url);
  await page.evaluate(async () => {
    window.testRun = await window.probe();
  });
  const start = performance.now(),
    initial = await page.evaluate(
      (long) => window.testRun.start(long),
      mode === 'endurance',
    );
  // Verify that a different tab cannot acquire the same origin's writer.
  const second = await context.newPage();
  await second.goto(url);
  const locked = await second.evaluate(async () => {
    try {
      const contender = await window.probe();
      await contender.start(false);
      return false;
    } catch (e) {
      return String(e).includes('another tab');
    }
  });
  await second.close();
  if (!locked) throw Error('Concurrent writer accepted');
  record('start', {
    ...environment(),
    driver: browser.version(),
    mode,
    initial,
    locked,
    started: new Date().toISOString(),
  });
  let stopping = false,
    last;
  let observedActiveMs = 0,
    previousTime = performance.now(),
    previousTicks = 0,
    gaps = 0;
  for (;;) {
    last = await page.evaluate(() => window.testRun.status());
    const currentTime = performance.now(),
      interval = currentTime - previousTime;
    const ticks = last.state.monitor?.ticks ?? 0;
    if (interval <= 30000 && ticks > previousTicks)
      observedActiveMs += interval;
    if (interval > 30000) gaps++;
    previousTime = currentTime;
    previousTicks = ticks;
    appendFileSync(
      join(destination, 'samples.ndjson'),
      JSON.stringify({
        ms: currentTime - start,
        observedActiveMs,
        gaps,
        ...last,
      }) + '\n',
    );
    if (last.state.phase === 'Completed') break;
    if (['Faulted', 'Recoverable', 'Cancelled'].includes(last.state.phase))
      throw Error(JSON.stringify(last.state));
    if (mode === 'endurance' && !stopping && observedActiveMs >= 7200000) {
      await page.evaluate(() => window.testRun.finish());
      stopping = true;
    }
    if (mode === 'short' && performance.now() - start > 120000)
      throw Error('Test exceeded time budget');
    await wait(mode === 'short' ? 150 : 10000);
  }
  const durable = await page.evaluate(() => window.testRun.verify());
  if (errors.length || (mode === 'endurance' && observedActiveMs < 7200000))
    throw Error('Incomplete browser evidence');
  record('end', {
    ended: new Date().toISOString(),
    elapsedMs: performance.now() - start,
    observedActiveMs,
    gaps,
    last,
    durable,
    errors,
  });
  await page.evaluate(() => window.testRun.close());
} finally {
  await browser.close();
  server.close();
}
/* global window */
