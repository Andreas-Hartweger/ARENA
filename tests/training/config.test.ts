import { expect, it } from 'vitest';
import plan from '../../docs/first-evolution/specification/foundation_config.json';
import { scenario, type Digest } from '../../src/training/episode';
import {
  config,
  initialPopulation,
  reproduce,
} from '../../src/training/population';
import { Genome, model } from '../../src/training/genome';
import { adapt } from '../../src/training/adaptation';
import { crossover } from '../../src/training/operators';
import { SeededRandom } from '../../src/core/random';
import { profiles } from '../../src/training/fitness';
const adapter = '../../scripts/evolution-runtime.mjs';
const { digest }: { digest: Digest } = await import(adapter);
it('REG-001 verifies the complete operational default against the separately supplied plan', () => {
  const s = scenario(digest),
    m = model(s.modelSignature),
    c = config(m);
  expect([c.master, c.n, c.generations]).toEqual([
    plan.masterSeed,
    plan.population,
    plan.evaluatedGenerations,
  ]);
  expect([s.track.def.id, s.sensor.hz, s.decisionHz]).toEqual([
    plan.track,
    plan.sensorHz,
    plan.decisionHz,
  ]);
  expect(s.task).toEqual(plan.task);
  expect([248, ...m.hidden, 3]).toEqual(plan.architecture);
  expect(m.activation).toBe(plan.activation);
  expect(profiles).toEqual(plan.fitness.weights);
  expect(s.weights).toEqual(plan.fitness.weights.Balanced);
  expect([
    c.tournament,
    c.eliteRate,
    c.poolFraction,
    c.crossProbability,
    c.operator,
  ]).toEqual([
    plan.selection.tournament,
    plan.selection.eliteRate,
    plan.selection.parentPool,
    plan.selection.crossoverProbability,
    plan.selection.crossoverOperator,
  ]);
  const mut = plan.mutation;
  expect([
    c.mutation.p,
    c.mutation.alpha,
    c.mutation.largeProbability,
    c.mutation.largeMultiplier,
    c.mutation.biasProbabilityFactor,
    c.mutation.biasStrengthFactor,
    m.weightLimit,
    m.biasLimit,
  ]).toEqual([
    mut.p,
    mut.alpha,
    mut.largeProbability,
    mut.largeMultiplier,
    mut.biasProbabilityFactor,
    mut.biasStrengthFactor,
    mut.weightLimit,
    mut.biasLimit,
  ]);
  expect(c.mutation.absoluteSigma).toBeUndefined();
  for (const key of [
    'layerProbabilityFactors',
    'layerStrengthFactors',
  ] as const)
    expect(c.mutation[key] ?? m.layers.map(() => 1)).toEqual(mut[key]);
  expect(c.randomFraction).toBe(plan.seededStartRandomFraction);
  expect(c.trace).toBeUndefined();
  for (const key of [
    'window',
    'epsilon',
    'probabilityEnabled',
    'strengthEnabled',
    'immigrantRate',
    'rescueEnabled',
  ] as const)
    expect(c.adaptation[key]).toBe(plan.adaptation[key]);
});
it('SEL-003 CRX-003 CRX-005 DIA-006 uses the restricted pool and records real, bounded crossover ancestry', () => {
  const m = model('fixture', [4]),
    c = config(m, {
      n: 8,
      master: 0,
      tournament: 8,
      poolFraction: 0.25,
      crossProbability: 1,
      operator: 'uniform',
      mutation: { p: 0 },
      trace: {
        generation: 1,
        slot: 7,
        maxChanges: 5,
        maxSamples: 0,
        everyTicks: 1,
      },
    });
  const pop = initialPopulation(m, c, digest),
    order = [7, 6, 5, 4, 3, 2, 1, 0],
    next = reproduce(
      pop,
      order,
      c,
      1,
      adapt(null, 5, c.adaptation, c.mutation),
      digest,
    );
  for (const child of next.slice(1))
    expect(child.parents).toEqual([pop[7].id, pop[6].id]);
  const child = next[7],
    parents = new Map(pop.map((m) => [m.id, m.genome.parameters()])),
    trace = child.inheritance!;
  expect(trace.parentByIndex).toHaveLength(5);
  expect(trace.truncated).toBe(true);
  for (const [i, parent] of trace.parentByIndex.entries())
    expect(child.genome.parameters()[i]).toBe(parents.get(parent)![i]);
  expect(next.slice(0, 7).every((m) => !m.inheritance)).toBe(true);
  const a = new Genome(m, new Float64Array(m.count).fill(-1), digest),
    b = new Genome(m, new Float64Array(m.count).fill(1), digest),
    mask = new Uint8Array(m.count);
  const values = crossover(
    a,
    b,
    'neuron-wise',
    new SeededRandom(42),
    [0],
    mask,
  );
  expect(values.every((v, i) => v === (mask[i] ? 1 : -1))).toBe(true);
  const fixed = config(m, {
    n: 8,
    globalProtection: true,
    randomFraction: 0,
    protectedLayers: [0],
  });
  expect(() =>
    reproduce(
      pop,
      order,
      fixed,
      1,
      adapt(null, 5, fixed.adaptation, fixed.mutation),
      digest,
    ),
  ).toThrow(/protected/);
});
