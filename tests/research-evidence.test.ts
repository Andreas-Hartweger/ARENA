import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
it('reuses a verified development drive, hydrates a D13 checkpoint from an online backup and rejects corrupted evidence', () => {
  const run = spawnSync(
    process.execPath,
    ['scripts/research/check-evidence.mjs'],
    { encoding: 'utf8', timeout: 45000 },
  );
  expect(run.status, run.stderr + run.stdout).toBe(0);
}, 60000);
