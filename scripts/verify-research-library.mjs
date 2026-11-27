import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import { preview } from 'vite';
import { environment } from './evolution-runtime.mjs';
import { publishJSON } from './research/campaign.mjs';
import { sha } from './research/manifest.mjs';
const { chromium } = await import(
  process.env.ARENA_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ARENA_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const root = 'docs/intelligence-validation/evidence/historical';
const destination =
  process.argv[2] ??
  'docs/intelligence-validation/evidence/browser-model-restore.json';
const original = JSON.parse(
  readFileSync(root + '/roles.json', 'utf8'),
).measured.find((row) => row.roles.includes('Finaler Champion'));
const file = resolve(root, original.package);
assert.equal(sha(readFileSync(file)), original.packageSHA256);
const server = await preview({
    preview: { host: '127.0.0.1', port: 0, open: false },
  }),
  url = server.resolvedUrls.local[0];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.ARENA_CHROMIUM,
  });
  const page = await browser.newPage(),
    errors = [],
    assets = new Map();
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/assets/') && /\.(?:css|js)$/.test(path))
      assets.set(path, response);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + '#/models');
  const source = page.getByLabel('Modellquelle'),
    starter = source.locator('option[value="starter"]');
  assert(await starter.evaluate((option) => option.matches(':disabled')));
  await source.selectOption('file');
  await page
    .getByRole('link', { name: 'Modellpaket im Speicher öffnen' })
    .click();
  await page.getByLabel('Paket zur Prüfung öffnen').setInputFiles(file);
  await page
    .getByRole('button', { name: 'Geprüftes Paket importieren' })
    .click();
  await page.getByText('Import abgeschlossen.').waitFor();
  await page.goto(url + '#/models');
  await source.selectOption('clone');
  await page.getByLabel('Version für die Kopie').selectOption(original.version);
  const name = 'Historischer G99-Klon · Browserprüfung';
  await page.getByLabel('Modellname', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Gewählte Version klonen' }).click();
  await page.getByRole('button', { name: new RegExp(name) }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: new RegExp(name) }).waitFor();
  assert(await starter.evaluate((option) => option.matches(':disabled')));
  const owned = await page
    .getByRole('button', { name: /Finaler Champion/ })
    .count();
  assert(owned >= 1);
  assert.deepEqual(errors, []);
  const bundle = {};
  for (const [path, response] of [...assets].sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    bundle[path] = sha(await response.body());
  assert(Object.keys(bundle).length > 0);
  publishJSON(destination, {
    schema: 1,
    runtime: environment(),
    browser: browser.version(),
    headless: true,
    bundle,
    artifact: original.packageSHA256,
    fingerprint: original.fingerprint,
    version: original.version,
    imported: true,
    cloneSurvivedReload: true,
    officialStarterAvailable: false,
    pageErrors: errors,
  });
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
