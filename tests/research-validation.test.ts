import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  validateCapability,
  caseStatistics,
  type PanelResult,
  type ValidationEvidence,
} from '../src/research/validation';
import {
  cloneOfficial,
  currentOfficial,
  evidenceHash,
  freezeCandidates,
  promote,
  rollbackOfficial,
  type ModelFreeze,
} from '../src/storage/capabilities';
import { defaultDraft } from '../src/runtime/runConfig';
import { createModel, readVersion } from '../src/storage/library';
import type { StorePort, StoredObject } from '../src/storage/objects';
import type { ScoredEpisode } from '../src/training/episode';

const original = JSON.parse(
  readFileSync(
    'docs/intelligence-validation/evidence/historical/roles.json',
    'utf8',
  ),
).measured[2].redrive as ScoredEpisode;
function panel(
  genome: string,
  counts: number[],
  wins: number[],
  multi = false,
): PanelResult {
  const actual = counts.flatMap((n, group) =>
    Array.from({ length: n }, (_, i) => {
      const id = group + '-' + i,
        win = i < wins[group],
        result = structuredClone(original);
      result.reason = win ? 'completed' : 'timeout';
      result.lapTimes = win ? (multi ? [60, 60, 60] : [60]) : [];
      result.duration = win ? (multi ? 184 : 64) : 120;
      result.tick = result.duration * 60;
      result.raw = {
        ...result.raw,
        grassSeconds: 1,
        clusters: 0,
        peakApproach: 0,
      };
      return { id, group, effective: evidenceHash(id), genome, result };
    }),
  );
  return {
    expected: actual.map(({ id, group, effective }) => ({
      id,
      group,
      effective,
    })),
    actual,
  };
}
function passing(genome: string): ValidationEvidence {
  return {
    genome,
    standard: panel(genome, [1], [1]),
    standardEndurance: panel(genome, [1], [1], true),
    holdout: panel(genome, [20, 20, 20], [16, 18, 20]),
    endurance: panel(genome, [4, 4, 4], [3, 3, 4], true),
  };
}
describe('D14 capability contract (synthetic boundary cases)', () => {
  it('applies the exact group, speed, contact and multi-lap thresholds to complete evidence', () => {
    const data = passing('a'.repeat(64));
    expect(validateCapability('Starter', data).status).toBe('passed');
    expect(validateCapability('Performance', data).status).toBe('failed');
    for (const scores of [
      [15, 19, 20],
      [16, 18, 19],
    ]) {
      data.holdout = panel(data.genome, [20, 20, 20], scores);
      expect(validateCapability('Starter', data).status).toBe('failed');
    }
    data.holdout = panel(data.genome, [20, 20, 20], [16, 18, 20]);
    const rows = [...data.holdout.actual];
    const failed = rows.find((c) => c.result.reason === 'timeout')!;
    if (failed.result.ok) failed.result.raw.peakApproach = 10;
    expect(validateCapability('Starter', data).status).toBe('failed');
    data.holdout = { ...data.holdout, actual: rows.slice(1) };
    expect(validateCapability('Starter', data).status).toBe('pending');
    expect(caseStatistics([]).times).toBeNull();
  });
  it('protects official versions, checks independent approval, clones by identity and rolls back compatible versions', async () => {
    const objects = new Map<string, StoredObject>(),
      db: StorePort = {
        async list() {
          return [...objects.values()].map((o) => o.meta);
        },
        async get(id) {
          return objects.get(id);
        },
        async commit(values) {
          for (const o of values) objects.set(o.meta.id, o);
          return 1;
        },
      };
    expect(await currentOfficial(db, 'Starter')).toBeNull();
    await expect(cloneOfficial(db, 'Starter', 'test')).rejects.toThrow();
    const ids = [];
    for (const master of [42, 43]) {
      const draft = defaultDraft();
      draft.options.master = master;
      const p = await createModel(db, 'Model ' + master, draft),
        v = await readVersion(db, p.active),
        data = passing(v.genome.hash);
      const freeze: ModelFreeze = {
        schema: 1,
        genome: v.genome.hash,
        version: p.active,
        modelKey: v.genome.model.key,
        roles: ['Starter'],
        selection: 'b'.repeat(64),
        panelHashes: {
          holdout: evidenceHash(data.holdout.expected),
          endurance: evidenceHash(data.endurance.expected),
        },
      };
      expect(() => freezeCandidates([freeze, freeze])).toThrow();
      const review = {
        implementationSHA: 'c'.repeat(40),
        validationHash: evidenceHash(data),
        reviewer: 'A',
        implementer: 'B',
        approved: true,
        evidence: 'synthetic-test-fixture',
      };
      await expect(
        promote(db, 'Starter', freeze, data, { ...review, reviewer: 'B' }),
      ).rejects.toThrow();
      ids.push(await promote(db, 'Starter', freeze, data, review));
      const clone = await cloneOfficial(db, 'Starter', 'Clone');
      expect(clone.active).not.toBe(p.active);
      expect((await readVersion(db, clone.active)).genome.hash).toBe(
        v.genome.hash,
      );
    }
    expect((await currentOfficial(db, 'Starter'))?.id).toBe(ids[1]);
    await rollbackOfficial(db, 'Starter');
    expect((await currentOfficial(db, 'Starter'))?.id).toBe(ids[0]);
    await expect(rollbackOfficial(db, 'Starter')).rejects.toThrow();
  });
});
