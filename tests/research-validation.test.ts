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
import { defaultDraft, preflight } from '../src/runtime/runConfig';
import { fingerprint, sha256 } from '../src/runtime/fingerprint';
import {
  availableOfficial,
  installReleasedModel,
} from '../src/storage/releasedModels';
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
  it('loads only a reviewed D13 release into an empty store and installs the same receipt idempotently', async () => {
    const ledgerModule = '../scripts/research/ledger.mjs',
      storeModule = '../scripts/research/store.mjs';
    const { ResearchLedger, campaign } = await import(ledgerModule);
    const { NodeStore } = await import(storeModule);
    const cap = { ms: 1000, ticks: 1000, episodes: 100 };
    const ledger = new ResearchLedger(
      ':memory:',
      campaign('fixture', 'f'.repeat(64), '1'.repeat(40), [
        { id: 'test', total: cap, training: cap },
      ]),
      'test',
    );
    ledger.claim();
    try {
      const db = new NodeStore(ledger, 'synthetic-technical-release');
      const folder = 'docs/intelligence-validation/evidence/historical/';
      const item = JSON.parse(readFileSync(folder + 'roles.json', 'utf8'))
        .measured[2];
      const data = passing(item.fingerprint);
      const model = new Uint8Array(readFileSync(folder + item.package)),
        evidence = new TextEncoder().encode(JSON.stringify(data));
      const read = async (url: string) =>
        url === 'fixture/model' ? model : evidence;
      const release = {
        packageUrl: 'fixture/model',
        packageSHA256: item.packageSHA256,
        evidenceUrl: 'fixture/validation',
        evidenceSHA256: sha256(evidence),
        freeze: {
          schema: 1 as const,
          version: item.version,
          genome: item.fingerprint,
          roles: ['Starter' as const],
          modelKey: preflight(defaultDraft(), fingerprint, 16).m.key,
          selection: 'b'.repeat(64),
          panelHashes: {
            holdout: evidenceHash(data.holdout.expected),
            endurance: evidenceHash(data.endurance.expected),
          },
        },
        review: {
          approved: true,
          reviewer: 'technical-fixture-A',
          implementer: 'technical-fixture-B',
          validationHash: evidenceHash(data),
          implementationSHA: 'c'.repeat(40),
          evidence: 'synthetic software test fixture',
        },
      };
      expect(await availableOfficial(db, 'Starter')).toBeNull();
      await expect(
        installReleasedModel(
          db,
          'Starter',
          { ...release, packageSHA256: '0'.repeat(64) },
          read,
        ),
      ).rejects.toThrow();
      await expect(
        installReleasedModel(
          db,
          'Starter',
          { ...release, review: { ...release.review, approved: false } },
          read,
        ),
      ).rejects.toThrow();
      expect(await db.list()).toEqual([]);
      const id = await installReleasedModel(db, 'Starter', release, read);
      expect(await availableOfficial(db, 'Starter')).toBe(item.version);
      expect(await installReleasedModel(db, 'Starter', release, read)).toBe(id);
      expect(
        (await cloneOfficial(db, 'Starter', 'Technical test copy', 16)).active,
      ).not.toBe(item.version);
    } finally {
      ledger.release();
      ledger.close();
    }
  });
  it('applies the exact group, speed, contact and multi-lap thresholds to complete evidence', () => {
    const data = passing('a'.repeat(64));
    expect(validateCapability('Starter', data).status).toBe('passed');
    expect(validateCapability('Performance', data).status).toBe('failed');
    for (const scores of [
      [14, 20, 20],
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
  it('includes the time, contact-free and grass boundaries for both roles', () => {
    for (const [role, standard, median] of [
      ['Starter', 75, 75],
      ['Performance', 50, 60],
    ] as const) {
      const data = passing('a'.repeat(64));
      const single = data.standard.actual[0].result as ScoredEpisode;
      single.lapTimes = [standard];
      single.duration = standard + 4;
      single.tick = single.duration * 60;
      const wins = data.holdout.actual
        .map((c) => c.result as ScoredEpisode)
        .filter((r) => r.reason === 'completed');
      for (const [index, r] of wins.entries()) {
        r.lapTimes = [median];
        r.duration = median + 4;
        r.tick = r.duration * 60;
        r.raw.grassSeconds = index === 0 ? 10 : 2;
        r.raw.clusters = index < 5 ? 1 : 0;
      }
      expect(validateCapability(role, data).status).toBe('passed');
      single.lapTimes = [standard + 0.001];
      expect(validateCapability(role, data).checks.standard).toBe(false);
      for (const r of wins) r.lapTimes = [median + 0.001];
      expect(validateCapability(role, data).checks.pace).toBe(false);
      wins[5].raw.clusters = 1;
      expect(validateCapability(role, data).checks.contacts).toBe(false);
      wins[0].raw.grassSeconds = 10.001;
      expect(validateCapability(role, data).checks.grass).toBe(false);
    }
  });
  it('audits recovery distance and both deadlines independently of the success flag', () => {
    const data = passing('a'.repeat(64));
    data.recovery = panel(data.genome, [6, 6, 6], [6, 6, 6]);
    const results = data.recovery.actual.map((c) => c.result as ScoredEpisode);
    for (const r of results)
      r.recovery = {
        success: true,
        returnedAtTick: 1200,
        verifiedAtTick: 1500,
        progressM: 20,
      };
    expect(validateCapability('Spezialist', data).status).toBe('passed');
    for (const invalid of [
      { returnedAtTick: 1201, verifiedAtTick: 1500, progressM: 20 },
      { returnedAtTick: 1199, verifiedAtTick: 1500, progressM: 20 },
      { returnedAtTick: 1200, verifiedAtTick: 1500, progressM: 19.99 },
    ]) {
      for (const r of results.slice(0, 4))
        r.recovery = { ...invalid, success: true };
      expect(validateCapability('Spezialist', data).status).toBe('failed');
    }
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
