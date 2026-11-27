import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import vectors from '../../docs/first-evolution/specification/reference_vectors.json';
import { Brain } from '../../src/ai/network';
import { SeededRandom } from '../../src/core/random';
import {
  derivedSeed,
  integer,
  gaussian,
  stream,
  type Domain,
} from '../../src/training/random';
import { Genome, GenomeSet, model } from '../../src/training/genome';
import {
  crossover,
  mixedGaussian,
  eliteCount,
  elites,
  ranking,
  tournament,
  mutate,
  standardMutation,
} from '../../src/training/operators';
import {
  adapt,
  diversity,
  immigrantCount,
  standardAdaptation,
  type AdaptiveState,
} from '../../src/training/adaptation';
import {
  config,
  initialPopulation,
  reproduce,
} from '../../src/training/population';
import type { Digest } from '../../src/training/episode';
const adapterPath = '../../scripts/evolution-runtime.mjs';
const { digest }: { digest: Digest } = await import(adapterPath);
const m = model('fixture'),
  small = model('fixture', [4]);
const seeded = (n: number) => Genome.initialize(small, n, digest);
it('MUT-005 MUT-006 isolates the all-large kernel and rejects malformed source values even with mutation disabled', () => {
  const a = new SeededRandom(8),
    b = new SeededRandom(8);
  const normal = mixedGaussian(a, 0.25, 0, 5),
    large = mixedGaussian(b, 0.25, 1, 5);
  expect(normal.large).toBe(false);
  expect(large.large).toBe(true);
  expect(large.delta).toBeCloseTo(5 * normal.delta, 12);
  expect(a.getState()).toBe(b.getState());
  const input = new Float64Array(small.count);
  input[7] = NaN;
  expect(() =>
    mutate(small, input, { ...standardMutation, p: 0 }, a),
  ).toThrow();
});
it.each(vectors.rng)(
  'RNG-001 RNG-003 golden PRNG and Gaussian seed $seed',
  (v) => {
    const r = new SeededRandom(v.seed);
    expect(v.uniform.map(() => r.next())).toEqual(v.uniform);
    expect(r.getState()).toBe(v.finalState);
    r.restoreState(v.seed);
    for (const z of v.boxMuller)
      expect(Math.abs(gaussian(r) - z)).toBeLessThan(1e-12);
    expect(r.getState()).toBe(v.finalState);
    expect(Math.abs(gaussian({ next: () => 0 }))).toBe(0);
  },
);
it('RNG-002 RNG-004 RNG-005 validates all seed positions and isolates streams/rejections', () => {
  for (const v of vectors.derivedSeeds)
    expect(
      derivedSeed(
        v.master,
        v.domain as Domain,
        v.generation,
        v.slot,
        v.scenario,
      ),
    ).toBe(v.seed);
  for (const x of [-1, 0.5, NaN, 2 ** 32]) {
    expect(() => derivedSeed(x, 'tie')).toThrow();
    expect(() => derivedSeed(1, 'tie', 1, x)).toThrow();
  }
  const sequence = [1 - 2 ** -32, 8 / 2 ** 32],
    r = { next: () => sequence.shift()! };
  expect(integer(r, 1)).toBe(0);
  expect(integer(r, 3)).toBe(2);
  expect(sequence).toHaveLength(0);
  const x = stream(0, 'mutation', 1, 2),
    y = stream(0, 'mutation', 1, 2);
  for (const d of ['diagnostic', 'cross', 'init'] as const)
    for (let i = 0; i < 13; i++) stream(0, d).next();
  expect(x.next()).toBe(y.next());
});
it('GEN-001 GEN-002 GEN-003 GEN-004 GEN-006 validates model, byte order, collision and copy boundaries', () => {
  expect(m.count).toBe(8547);
  expect(m.layers.map((l) => [l.offset, l.bias, l.end])).toEqual([
    [0, 7936, 7968],
    [7968, 8480, 8496],
    [8496, 8544, 8547],
  ]);
  const input = new Float64Array(m.count);
  input[0] = -0;
  input[1] = 1.25;
  const a = new Genome(m, input, digest);
  expect(a.parameters().byteLength).toBe(68376);
  const header = Buffer.from(m.key),
    bytes = Buffer.alloc(8 + header.length + 68376);
  bytes.writeUInt32LE(header.length, 0);
  bytes.writeUInt32LE(8547, 4);
  header.copy(bytes, 8);
  bytes.writeDoubleLE(1.25, 8 + header.length + 8);
  expect(a.hash).toBe(createHash('sha256').update(bytes).digest('hex'));
  input[1] = 0;
  a.parameters()[1] = 2;
  a.brain().parameters()[1] = 3;
  expect(a.parameters()[1]).toBe(1.25);
  const g = new Genome(m, input, () => 'collision');
  input[0] = 1;
  const h = new Genome(m, input, () => 'collision');
  expect(g.equals(h)).toBe(false);
  const set = new GenomeSet();
  expect([set.add(g), set.add(h), set.add(g)]).toEqual([true, true, false]);
  for (const [idx, value] of [
    [0, 9],
    [7936, -5],
    [1, NaN],
    [2, Infinity],
  ]) {
    const x = g.parameters();
    x[idx] = value;
    expect(() => new Genome(m, x, digest)).toThrow();
  }
  for (const b of [
    new Brain('bad'),
    new Brain('fixture', 0, [8]),
    new Brain('fixture', 0, [32, 16], 'relu'),
  ])
    expect(() => Genome.fromBrain(m, b, digest)).toThrow();
  expect(() => new Genome(m, new Float64Array(3), digest)).toThrow();
  expect(() => model('fixture', [4], 'tanh', 0.01)).toThrow();
});
it('SEL-001 SEL-002 SEL-003 SEL-004 SEL-005 SEL-006 uses distinct elites and analytical tournament frequencies', () => {
  expect(eliteCount(128, 0.05)).toBe(6);
  expect(eliteCount(8, 0.01)).toBe(1);
  expect(eliteCount(10, 0.15)).toBe(2);
  const a = seeded(1),
    b = seeded(2);
  expect(elites([0, 1, 2, 3], [a, a, b, b], 3)).toEqual([0, 2, 1]);
  const pool = [11, 12, 13, 14, 15, 16, 17, 18],
    r = new SeededRandom(8237),
    counts = Array(8).fill(0);
  for (let i = 0; i < 100000; i++) counts[tournament(pool, 3, r) - 11]++;
  for (let i = 0; i < 8; i++) {
    const left = 7 - i,
      expected = (left * (left - 1)) / 112;
    expect(Math.abs(counts[i] / 100000 - expected)).toBeLessThan(0.01);
    if (left < 2) expect(counts[i]).toBe(0);
  }
  expect(tournament(pool, 8, r)).toBe(11);
  expect(tournament(pool.slice(3, 4), 8, r)).toBe(14);
  expect(() => ranking([1, NaN], r)).toThrow();
  expect(ranking([1, 1, 1, 1], new SeededRandom(42))).toEqual(
    ranking([1, 1, 1, 1], new SeededRandom(42)),
  );
});
it('CRX-001 CRX-002 CRX-004 CRX-005 selects from immutable parents, with noninterleaved bias and protected layers', () => {
  const a = new Genome(small, new Float64Array(small.count).fill(-1), digest),
    b = new Genome(small, new Float64Array(small.count).fill(1), digest);
  let calls = 0;
  const r = { next: () => (calls++ % 2 ? 0.9 : 0) };
  const u = crossover(a, b, 'uniform', r);
  expect(u.every((v, i) => v === (i % 2 ? 1 : -1))).toBe(true);
  calls = 0;
  const n = crossover(a, b, 'neuron-wise', r);
  let neuron = 0;
  for (const l of small.layers)
    for (let j = 0; j < l.width; j++, neuron++) {
      const value = neuron % 2 ? 1 : -1;
      expect(
        n
          .subarray(l.offset + j * l.inputs, l.offset + (j + 1) * l.inputs)
          .every((v) => v === value),
      ).toBe(true);
      expect(n[l.bias + j]).toBe(value);
    }
  const fixed = crossover(a, b, 'uniform', { next: () => 0.99 }, [0]);
  expect(fixed.subarray(0, small.layers[0].end).every((v) => v === -1)).toBe(
    true,
  );
  expect(a.parameters().every((v) => v === -1)).toBe(true);
  expect(() =>
    crossover(a, Genome.initialize(m, 1, digest), 'uniform', r),
  ).toThrow();
});
it('MUT-001 MUT-002 MUT-003 MUT-004 MUT-005 MUT-006 MUT-007 MUT-010 follows draw order, clamp and forced choice', () => {
  expect(m.layers.map((l) => l.scale * 0.2)).toEqual(vectors.mutationScales);
  const source = new Float64Array(small.count),
    none = {
      next: () => {
        throw Error('unexpected draw');
      },
    };
  expect(
    mutate(small, source, { ...standardMutation, p: 0 }, none).parameters,
  ).toEqual(source);
  expect(
    mutate(
      small,
      source,
      { ...standardMutation, layerStrengthFactors: [0, 0] },
      none,
    ).parameters,
  ).toEqual(source);
  const forced = mutate(
    small,
    source,
    {
      ...standardMutation,
      layerProbabilityFactors: [0, 1],
      biasStrengthFactor: 0,
    },
    { next: () => 0.999 },
    2,
  );
  expect(forced.details).toHaveLength(1);
  expect(forced.details[0].index).toBeGreaterThanOrEqual(
    small.layers[1].offset,
  );
  expect(forced.details[0].index).toBeLessThan(small.layers[1].bias);
  const all = mutate(
    small,
    source,
    { ...standardMutation, p: 1 },
    { next: () => 0 },
  );
  expect(all.layers[0].bias.selected).toBe(4);
  expect(all.layers[0].bias.changed).toBe(0);
  for (const activation of ['relu', 'leaky'] as const) {
    const alt = model('fixture', [4], activation);
    expect(alt.layers[0].scale).toBeCloseTo(
      Math.sqrt(2 / (248 * (activation === 'leaky' ? 1.0001 : 1))),
      12,
    );
    expect(alt.layers[1].scale).toBeCloseTo(Math.sqrt(2 / 7), 12);
  }
  const pick = Array(small.count).fill(0.99);
  pick[0] = 0;
  pick[small.layers[0].bias] = 0;
  function mixed(clipped: boolean) {
    const sequence = [
        ...pick,
        0,
        1 - Math.exp(-0.5),
        0,
        0.99,
        1 - Math.exp(-0.5),
        0,
      ],
      x = source.slice();
    if (clipped) {
      x[0] = 8;
      x[small.layers[0].bias] = 4;
    }
    return mutate(
      small,
      x,
      {
        ...standardMutation,
        absoluteSigma: 0.1,
        layerProbabilityFactors: [2, 1],
        biasProbabilityFactor: 2,
      },
      { next: () => sequence.shift()! },
      2,
    );
  }
  const mix = mixed(false);
  expect(mix.details.map((x) => x.value)).toEqual([0.5, 0.1]);
  expect(mix.layers[0].weight.large).toBe(1);
  expect(mix.layers[0].bias.normal).toBe(1);
  const clipped = mixed(true);
  expect(clipped.layers[0].weight.clipped).toBe(1);
  expect(clipped.layers[0].bias.changed).toBe(0);
  expect(clipped.details.map((x) => x.value)).toEqual([8, 4]);
  expect(source.every((x) => x === 0)).toBe(true);
  expect(() =>
    mutate(
      small,
      source,
      { ...standardMutation, largeProbability: 0.31 },
      none,
    ),
  ).toThrow();
  let draws = 0;
  expect(() =>
    mutate(
      small,
      source,
      { ...standardMutation, p: 1 },
      { next: () => (++draws <= small.count ? 0 : NaN) },
    ),
  ).toThrow();
});
it('MUT-008 MUT-009 matches fixed Gaussian and Bernoulli samples', () => {
  const z = stream(912, 'mutation'),
    p = stream(1337, 'mutation'),
    q = stream(235, 'mutation');
  let sum = 0,
    squares = 0,
    inside = 0,
    normal = 0,
    large = 0;
  for (let i = 0; i < 200000; i++) {
    const x = gaussian(z);
    sum += x;
    squares += x * x;
    inside += Number(Math.abs(x) <= 1);
    normal += Number(p.next() < 0.05);
    large += Number(q.next() < 0.05);
  }
  expect(Math.abs(sum / 200000)).toBeLessThan(0.015);
  expect(squares / 200000 - (sum / 200000) ** 2).toBeGreaterThan(0.97);
  expect(squares / 200000 - (sum / 200000) ** 2).toBeLessThan(1.03);
  expect(inside / 200000).toBeGreaterThan(0.67);
  expect(inside / 200000).toBeLessThan(0.7);
  for (const n of [normal, large]) {
    expect(n / 200000).toBeGreaterThan(0.047);
    expect(n / 200000).toBeLessThan(0.053);
  }
});
it('DIV-001 DIV-002 DIV-003 compares Welford with explicit normalized pair distances', () => {
  const gs = [seeded(0), seeded(0), seeded(9), seeded(23)],
    d = diversity(gs),
    values = gs.map((g) => g.parameters());
  expect(d.unique).toBe(3);
  expect(d.duplicates).toBe(1);
  expect(diversity([gs[0], gs[1]]).D2).toBe(0);
  let total = 0;
  for (const l of small.layers) {
    let sum = 0;
    for (let a = 0; a < 4; a++)
      for (let b = a + 1; b < 4; b++)
        for (let j = l.offset; j < l.end; j++)
          sum += ((values[a][j] - values[b][j]) / l.scale) ** 2;
    expect(
      Math.abs(d.layers[l.i] - sum / (6 * (l.end - l.offset))),
    ).toBeLessThan(1e-10);
    total += sum;
  }
  expect(Math.abs(d.D2 - total / (6 * small.count))).toBeLessThan(1e-10);
  expect(d.D ** 2).toBeCloseTo(d.D2, 12);
  const x = new Float64Array(small.count),
    y = x.slice();
  for (const l of small.layers)
    for (let i = l.offset; i < l.end; i++) y[i] = (i % 2 ? 4 : 2) * l.scale;
  // Embed the two-coordinate vector for an even-width subset, with explicit padding.
  if (small.count % 2) y[small.count - 1] = 0;
  expect(
    diversity([new Genome(small, x, digest), new Genome(small, y, digest)]).D2,
  ).toBeCloseTo(
    (vectors.diversity[0].D2 * (small.count - (small.count % 2))) / small.count,
    10,
  );
});
it('ADP-001 ADP-002 ADP-003 ADP-004 ADP-005 ADP-006 ADP-007 ADP-008 preserves reset, alternating triggers and rescue boundaries', () => {
  const c = {
    ...standardAdaptation,
    probabilityEnabled: true,
    strengthEnabled: true,
    immigrantRate: 0.05,
    rescueEnabled: true,
  };
  let s = adapt(null, 100, c, standardMutation);
  for (let i = 1; i <= 150; i++) {
    s = adapt(s, 100, c, standardMutation);
    if (i === 14) expect(s.p).toBe(0.05);
    if (i === 15 || i === 16) expect(s.p).toBeCloseTo(0.075);
    if (i === 30) expect(s.alpha).toBeCloseTo(0.3);
    if (i === 45) expect(s.p).toBeCloseTo(0.1125);
    if (i >= 120) expect([s.p, s.alpha]).toEqual([0.2, 0.8]);
  }
  s = adapt(s, 100.25, c, standardMutation);
  s = adapt(s, 100.5, c, standardMutation);
  expect(s.refBest).toBe(100);
  s = adapt(s, 101, c, standardMutation);
  expect([s.count, s.p, s.alpha, s.next]).toEqual([0, 0.05, 0.2, 'p']);
  expect([44, 45, 46, 90].map((n) => immigrantCount(128, 6, c, n))).toEqual([
    6, 19, 6, 19,
  ]);
  expect(immigrantCount(128, 6, { ...c, immigrantRate: 0.25 }, 0)).toBe(32);
  expect(immigrantCount(8, 6, c, 45)).toBe(1);
  let disabled: AdaptiveState | null = null;
  for (let i = 0; i <= 1000; i++)
    disabled = adapt(disabled, 0, standardAdaptation, standardMutation);
  expect(disabled).toMatchObject({ count: 1000, p: 0.05, alpha: 0.2 });
  expect(() => adapt(null, 0, c, { ...standardMutation, p: 0.21 })).toThrow();
  expect(() =>
    adapt(null, 0, c, { ...standardMutation, absoluteSigma: 0.5 }),
  ).toThrow();
  expect(
    adapt(
      { ...s, count: 14, p: 0 },
      101,
      { ...c, strengthEnabled: false },
      { ...standardMutation, p: 0 },
    ).p,
  ).toBe(0);
});
it('POP-001 POP-002 POP-003 GEN-005 CRX-003 CRX-004 CRX-005 checks seeded composition, origins and duplicate fallback', () => {
  for (const n of [7, 1025, 8.1]) expect(() => config(small, { n })).toThrow();
  for (const n of [8, 128, 1024]) expect(config(small, { n }).n).toBe(n);
  const c = config(small, { master: 0 }),
    seed = seeded(42),
    p = initialPopulation(small, c, digest, seed);
  expect(p[0].genome.equals(seed)).toBe(true);
  expect(p.filter((v) => v.origin === 'initial')).toHaveLength(32);
  expect(p.filter((v) => v.origin === 'offspring')).toHaveLength(95);
  const fresh = initialPopulation(small, c, digest);
  expect(fresh.map((x) => x.genome.hash)).toEqual(
    initialPopulation(small, c, digest).map((x) => x.genome.hash),
  );
  expect(new Set(fresh.map((x) => x.genome.hash)).size).toBe(128);
  for (const l of small.layers)
    expect(
      fresh[0].genome
        .parameters()
        .subarray(l.bias, l.end)
        .every((x) => x === 0),
    ).toBe(true);
  const fixed = config(small, {
    n: 8,
    randomFraction: 0,
    crossProbability: 1,
    mutation: { p: 0 },
    protectedLayers: [0],
    globalProtection: true,
  });
  const pop = initialPopulation(small, fixed, digest, seed);
  const next = reproduce(
    pop,
    [0, 1, 2, 3, 4, 5, 6, 7],
    fixed,
    1,
    adapt(null, 1, fixed.adaptation, fixed.mutation),
    digest,
  );
  expect(next[0].id).toBe(pop[0].id);
  expect(
    next
      .slice(1)
      .every(
        (m) =>
          m.operator === 'fallback' && m.birth === 1 && m.parents.length === 1,
      ),
  ).toBe(true);
  expect(() =>
    config(small, {
      globalProtection: true,
      protectedLayers: [0],
      randomFraction: 0,
      adaptation: { immigrantRate: 0.1 },
    }),
  ).toThrow();
  const different = reproduce(
    fresh,
    fresh.map((_, i) => i),
    config(small, { crossProbability: 1 }),
    1,
    adapt(null, 1, c.adaptation, c.mutation),
    digest,
  );
  expect(
    different.slice(6).every((m) => m.parents.length === 2 && m.mutation),
  ).toBe(true);
});
