import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('restores a real durable research checkpoint, fences a crashed process and charges an uncertain lost attempt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arena-rs-restore-'));
  try {
    for (const [mode, expected] of [
      ['serial', 0],
      ['crash', 73],
      ['resume', 0],
    ] as const) {
      const r = spawnSync(
        process.execPath,
        ['scripts/research/check-resume.mjs', dir, mode],
        { encoding: 'utf8', timeout: 25000 },
      );
      expect(r.status, r.stderr + r.stdout).toBe(expected);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 90000);
