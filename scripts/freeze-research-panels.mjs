import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { digest } from './evolution-runtime.mjs';
import { openCampaign, ActiveTime, publishJSON } from './research/campaign.mjs';
import { sha } from './research/manifest.mjs';
const { buildPanels } = await import('../src/research/panels.ts');
const directory = process.argv[2],
  start = performance.now(),
  ledger = openCampaign(directory);
const timer = new ActiveTime(
  ledger,
  { experimentId: 'panel-freeze' },
  'research',
  120000,
  start,
);
try {
  const path = join(directory, 'panels');
  mkdirSync(path, { recursive: true });
  const saved = ledger.db
    .prepare("SELECT data FROM manifests WHERE id='panel-roots'")
    .get();
  const roots = saved
    ? JSON.parse(saved.data)
    : Object.fromEntries(
        ['development', 'holdout', 'endurance', 'recovery'].map((name) => [
          name,
          randomBytes(4).readUInt32LE(),
        ]),
      );
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('panel-roots', roots);
  });
  const panels = buildPanels(digest, roots);
  const commits = {};
  for (const [name, panel] of Object.entries(panels)) {
    const pathName = join(path, name + '.json');
    publishJSON(pathName, panel);
    commits[name] = {
      count: panel.cases.length,
      contentHash: panel.hash,
      sha256: sha(readFileSync(pathName)),
    };
  }
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest('frozen-panels', commits);
  });
  publishJSON(
    'docs/intelligence-validation/evidence/panel-commitments.json',
    commits,
  );
  timer.finish();
  ledger.release();
  process.stdout.write(JSON.stringify(commits) + '\n');
} finally {
  ledger.close();
}
