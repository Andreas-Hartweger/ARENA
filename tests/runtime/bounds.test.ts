import { expect, it } from 'vitest';
import { ChartHistory } from '../../src/runtime/history';
import type { GenerationSummary } from '../../src/training/evolution';
import {
  scanArchive,
  writeArchive,
  archiveLimits,
} from '../../src/storage/archive';
import {
  expiredProfiles,
  profileDeletion,
  jsonObject,
} from '../../src/storage/objects';

it('preserves chart bounds, gaps and extrema across repeated compaction', () => {
  const history = new ChartHistory();
  for (let generation = 0; generation < 5500; generation++) {
    const value = generation === 332 ? 99 : Math.sin(generation / 100);
    history.add({
      generation,
      fitness: {
        best: value,
        mean: value,
        median: value,
        q1: value,
        q3: value,
      },
      successes: 0,
      lapTimes: generation >= 300 && generation < 800 ? null : { worst: 80 },
      diversity: { D: 0.5 },
      progress: { best: 0.3 },
    } as GenerationSummary);
  }
  const fitness = history.read(),
    laps = history.read('laps');
  expect(fitness.length).toBeLessThanOrEqual(600);
  expect(fitness[0].generation).toBe(0);
  expect(fitness.at(-1)?.generation).toBe(5499);
  expect(Math.max(...fitness.map((p) => p.fitness.best))).toBe(99);
  expect(laps.some((p) => p.lapTime === null)).toBe(true);
});

it('retains queued versions and shared genomes and previews the exact removable size after 30 days', () => {
  const now = 35 * 86400000;
  const rows = [
    jsonObject('genome', 'genome:a', {}),
    jsonObject('version', 'version:a', {}, ['genome:a']),
    jsonObject('version', 'version:b', {}, ['genome:a']),
    jsonObject('profile', 'profile:a', {}, ['version:a'], true),
    jsonObject('profile', 'profile:b', {}, ['version:b'], true),
    jsonObject('profile', 'profile:new', {}, [], true),
    jsonObject('queue', 'queue:main', {}, ['version:b'], true),
  ].map((o) => o.meta);
  const eligible = expiredProfiles(
    rows,
    [
      { id: 'profile:a', trashedAt: 1 },
      { id: 'profile:b', trashedAt: 1 },
      { id: 'profile:new', trashedAt: now - 86400000 },
    ],
    now,
  );
  expect(eligible).toEqual(['profile:a']);
  const preview = profileDeletion(rows, eligible);
  expect(new Set(preview.remove)).toEqual(new Set(['profile:a', 'version:a']));
  expect(preview.bytes).toBe(
    rows
      .filter((r) => preview.remove.includes(r.id))
      .reduce((s, r) => s + r.size, 0),
  );
  expect(() => profileDeletion(rows, ['profile:b'])).toThrow();
});

it('rejects malformed local fixture envelopes before exposing archive content', async () => {
  const one = await writeArchive(
    (async function* () {
      yield { name: 'manifest.json', bytes: new TextEncoder().encode('{}') };
      yield { name: 'data/a.json', bytes: new Uint8Array([1]) };
      yield { name: 'data/b.json', bytes: new Uint8Array([2]) };
    })(),
  );
  const good = new Uint8Array(await one.arrayBuffer());
  const directory = new DataView(good.buffer).getUint32(good.length - 6, true);
  const second = directory + 46 + 'manifest.json'.length,
    third = second + 46 + 'data/a.json'.length;
  const corrupt = (change: (view: DataView, bytes: Uint8Array) => void) => {
    const data = good.slice();
    change(new DataView(data.buffer), data);
    return new Blob([data]);
  };
  const cases = [
    corrupt((v) => v.setUint16(directory + 8, 1, true)),
    corrupt((v) => v.setUint32(directory + 38, 1, true)),
    corrupt((v) => v.setUint16(8, 1, true)),
    corrupt((v) => v.setUint32(directory + 24, archiveLimits.entry + 1, true)),
    corrupt((v) => v.setUint32(14, 1, true)),
    corrupt((v) => v.setUint32(second + 42, 0xffffffff, true)),
    corrupt((_, b) => {
      b[third + 46 + 5] = 'a'.charCodeAt(0);
    }),
    corrupt((_, b) => {
      b.set(new TextEncoder().encode('../bad.json'), second + 46);
    }),
    corrupt((_, b) => {
      b.set(new TextEncoder().encode('data/a.zip '), second + 46);
    }),
    one.slice(0, one.size - 1),
  ];
  let seed = 42;
  for (let i = 0; i < 12; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    cases.push(corrupt((v) => v.setUint32(directory + 20, seed || 1, true)));
  }
  for (const bad of cases) await expect(scanArchive(bad)).rejects.toThrow();
  const digestError = await scanArchive(
    corrupt((_, b) => {
      b[30 + 'manifest.json'.length] ^= 1;
    }),
  );
  await expect(digestError.read(digestError.records[0])).rejects.toThrow(/CRC/);
});
