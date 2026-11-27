import { build, preview } from 'vite';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { environment } from './evolution-runtime.mjs';
const [destination, mode = 'short'] = process.argv.slice(2);
if (!destination || !['short', 'stability'].includes(mode))
  throw Error('New output directory and short or stability required');
mkdirSync(destination);
const outDir = resolve(destination, 'build');
await build({ build: { outDir }, logLevel: 'error' });
const server = await preview({
  build: { outDir },
  preview: { host: '127.0.0.1', port: 0, open: false },
  logLevel: 'error',
});
const url = 'http://127.0.0.1:' + server.httpServer.address().port;
const { chromium } = await import(
  process.env.ARENA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ARENA_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.ARENA_CHROMIUM,
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage(),
  errors = [],
  timings = [];
const save = (file, data) =>
  writeFileSync(
    join(destination, file + '.json'),
    JSON.stringify(data, null, 2) + '\n',
  );
page.on('pageerror', (e) => errors.push(String(e)));
const button = (label) =>
  (['Pause', 'Fortsetzen'].includes(label)
    ? page.locator('.run-actions')
    : page
  ).getByRole('button', { name: label, exact: true });
const field = (label) => page.getByLabel(new RegExp('^' + label));
const nav = async (name) => {
  await page
    .getByRole('navigation', { name: 'Trainingslabor' })
    .getByRole('link', { name, exact: true })
    .click();
  await page.getByRole('heading', { name, level: 1, exact: true }).waitFor();
};
const phase = async (text) =>
  page.locator('.phase').filter({ hasText: text }).waitFor({ timeout: 60000 });
const gen = async () =>
  Number(
    (
      await page
        .locator('dt')
        .filter({ hasText: /^Bestätigte Generationen$/ })
        .locator('..')
        .locator('dd')
        .innerText()
    )
      .split('/')[0]
      .replace(/\D/g, ''),
  );
const checkErrors = async () => {
  const alerts = await page.getByRole('alert').allTextContents();
  if (alerts.length || errors.length)
    throw Error(JSON.stringify({ alerts, errors }));
};
try {
  await page.goto(url + '/#/training');
  await phase('Bereit');
  await button('Lauf konfigurieren').click();
  await field('Population').fill('8');
  await field('Generationen').fill('100000');
  await field('Rechenprofil').selectOption('Custom');
  await field('Worker').fill('1');
  await button('Konfiguration schließen').click();
  await nav('Modelle');
  await field('Modellname').fill('UI-Abnahme');
  await button('Neu initialisieren').click();
  await page
    .getByRole('heading', { name: 'UI-Abnahme', exact: true })
    .waitFor();
  await nav('Training');
  await button('Training starten').click();
  await phase('Läuft');
  await field('Erweitert').check();
  await button('Beobachten').click();
  await field('Sensoren und Brain beobachten').check();
  await page.screenshot({
    path: join(destination, 'training.png'),
    fullPage: true,
  });
  save('start', {
    ...environment(),
    browser: browser.version(),
    mode,
    viewport: page.viewportSize(),
    started: new Date().toISOString(),
  });
  let activeMs = 0,
    prevGen = await gen(),
    prev = performance.now(),
    cycle = 0,
    gaps = 0;
  while (activeMs < (mode === 'stability' ? 1200000 : 10000)) {
    await wait(8000);
    const current = performance.now(),
      g = await gen(),
      dt = current - prev;
    if (dt < 30000 && g > prevGen) activeMs += dt;
    else if (dt >= 30000) gaps++;
    prev = current;
    prevGen = g;
    appendFileSync(
      join(destination, 'samples.ndjson'),
      JSON.stringify({ cycle, g, activeMs, dt, gaps }) + '\n',
    );
    if (cycle % 5 === 0) {
      await button('Meilenstein speichern').click();
      await nav('Speicher');
      await page.getByRole('heading', { name: 'Checkpoints' }).waitFor();
      await checkErrors();
      await nav('Warteschlange');
      await button('Laufentwurf einreihen').click();
      await button('Entfernen').first().click();
      await nav('Training');
    }
    if (cycle % 5 === 1) {
      await nav('Modelle');
      await page
        .getByRole('heading', { name: 'UI-Abnahme', exact: true })
        .waitFor();
      await nav('Training');
    }
    if (cycle % 5 === 2) {
      await page.setViewportSize({
        width: cycle % 2 ? 1280 : 700,
        height: 800,
      });
      if (await button('Beobachten').isVisible())
        await button('Beobachten').click();
      await button('Follow').click();
      await button('Frei').click();
      await button('Zoom +').click();
      await button('Übersicht').click();
      await field('Sensoren und Brain beobachten').check();
    }
    if (cycle % 8 === 3) {
      const start = performance.now();
      await button('Pause').click();
      await phase('Pausiert');
      timings.push({ command: 'pause', ms: performance.now() - start });
      const resume = performance.now();
      await button('Fortsetzen').click();
      await phase('Läuft');
      timings.push({ command: 'resume', ms: performance.now() - resume });
    }
    await checkErrors();
    cycle++;
  }
  await button('Generation abschließen').click();
  await phase('Abgeschlossen');
  const finalGeneration = await gen();
  await nav('Speicher');
  await button('Integrität prüfen').click();
  await page.getByText('Integritätsprüfung abgeschlossen.').waitFor();
  await checkErrors();
  save('end', {
    ended: new Date().toISOString(),
    activeMs,
    cycle,
    gaps,
    finalGeneration,
    timings,
    errors,
  });
} catch (error) {
  save('failure', {
    error: String(error),
    page: await page.locator('body').ariaSnapshot(),
    errors,
  });
  throw error;
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
