import { freezeTree } from '../physics/vehicleTick';
import {
  adapt,
  immigrantCount,
  standardAdaptation,
  type AdaptationOptions,
  type AdaptiveState,
} from './adaptation';
import { bounded } from './fitness';
import type { Digest } from './episode';
import { Genome, type Model } from './genome';
import {
  crossover,
  eliteCount,
  elites,
  mutate,
  standardMutation,
  tournament,
  validateMutation,
  type MutationOptions,
  type Operator,
} from './operators';
import { derivedSeed, stream } from './random';

export interface EvolutionOptions {
  runId?: string;
  master?: number;
  n?: number;
  generations?: number;
  budget?: number;
  segment?: number;
  tournament?: number;
  eliteRate?: number;
  poolFraction?: number;
  crossProbability?: number;
  operator?: Operator;
  mutation?: Partial<MutationOptions>;
  adaptation?: Partial<AdaptationOptions>;
  randomFraction?: number;
  protectedLayers?: readonly number[];
  globalProtection?: boolean;
  trace?: {
    generation: number;
    slot: number;
    maxChanges: number;
    maxSamples: number;
    everyTicks: number;
  };
  randomSearch?: boolean;
}
export function config(m: Model, opts: EvolutionOptions = {}) {
  const c = {
    runId: opts.runId ?? 'reference',
    master: opts.master ?? 42,
    n: opts.n ?? 128,
    generations: opts.generations ?? 100,
    budget: opts.budget ?? Number.MAX_SAFE_INTEGER,
    segment: opts.segment ?? 0,
    tournament: opts.tournament ?? 3,
    eliteRate: opts.eliteRate ?? 0.05,
    poolFraction: opts.poolFraction ?? 1,
    crossProbability: opts.crossProbability ?? 0,
    operator: opts.operator ?? 'neuron-wise',
    mutation: { ...standardMutation, ...opts.mutation },
    adaptation: { ...standardAdaptation, ...opts.adaptation },
    randomFraction: opts.randomFraction ?? 0.25,
    protectedLayers: [...(opts.protectedLayers ?? [])],
    globalProtection: opts.globalProtection ?? false,
    trace: opts.trace ? { ...opts.trace } : undefined,
    randomSearch: opts.randomSearch ?? false,
  };
  if (!c.runId || !['uniform', 'neuron-wise'].includes(c.operator))
    throw Error('Invalid run/operator');
  for (const f of ['layerProbabilityFactors', 'layerStrengthFactors'] as const)
    if (c.mutation[f]) c.mutation[f] = [...c.mutation[f]!];
  bounded(c.n, 8, 1024, 'population size', true);
  bounded(c.master, 0, 0xffffffff, 'master seed', true);
  bounded(c.generations, 1, 0xffffffff, 'generations', true);
  bounded(c.budget, 0, Number.MAX_SAFE_INTEGER, 'budget', true);
  bounded(c.segment, 0, 0xffffffff, 'segment', true);
  bounded(c.tournament, 2, 8, 'tournament', true);
  eliteCount(c.n, c.eliteRate);
  bounded(c.poolFraction, 0.25, 1, 'parent pool');
  bounded(c.crossProbability, 0, 1, 'cross probability');
  bounded(c.randomFraction, 0, 1, 'seeded random fraction');
  validateMutation(m, c.mutation);
  adapt(null, 0, c.adaptation, c.mutation);
  immigrantCount(c.n, 1, c.adaptation, 0);
  for (const i of c.protectedLayers)
    bounded(i, 0, m.layers.length - 1, 'protected layer', true);
  if (
    c.globalProtection &&
    (!c.protectedLayers.length ||
      c.randomFraction ||
      c.adaptation.immigrantRate ||
      c.adaptation.rescueEnabled ||
      c.randomSearch)
  )
    throw Error('Incompatible global protection');
  if (c.trace) {
    bounded(c.trace.generation, 0, c.generations - 1, 'trace generation', true);
    bounded(c.trace.slot, 0, c.n - 1, 'trace slot', true);
    bounded(c.trace.maxChanges, 0, 100000, 'change budget', true);
    bounded(c.trace.maxSamples, 0, 100000, 'sample budget', true);
    bounded(
      c.trace.everyTicks,
      1,
      Number.MAX_SAFE_INTEGER,
      'trace stride',
      true,
    );
  }
  return freezeTree(c);
}
export type Config = ReturnType<typeof config>;
export interface Member {
  id: string;
  genome: Genome;
  birth: number;
  parents: readonly string[];
  origin: 'initial' | 'seed' | 'offspring' | 'immigrant' | 'elite' | 'random';
  operator: Operator | 'copy' | 'fallback';
  mutation?: Omit<ReturnType<typeof mutate>, 'parameters'>;
}
const identity = (c: Config, g: number, i: number) =>
  JSON.stringify([c.runId, g, i]);
function initialized(
  m: Model,
  c: Config,
  g: number,
  i: number,
  digest: Digest,
  origin: 'initial' | 'immigrant' | 'random',
): Member {
  return {
    id: identity(c, g, i),
    genome: Genome.initialize(
      m,
      derivedSeed(
        c.master,
        origin === 'immigrant' ? 'immigrant' : 'init',
        g,
        i,
      ),
      digest,
    ),
    birth: g,
    parents: [],
    origin,
    operator: 'copy',
  };
}
function child(
  a: Member,
  b: Member | undefined,
  c: Config,
  g: number,
  i: number,
  digest: Digest,
  mutation: MutationOptions,
  attempted: boolean,
): Member {
  const m = a.genome.model,
    values = b
      ? crossover(
          a.genome,
          b.genome,
          c.operator,
          stream(c.master, 'cross', g, i),
          c.protectedLayers,
        )
      : a.genome.parameters();
  const detailed = c.trace?.generation === g && c.trace.slot === i;
  const { parameters, ...summary } = mutate(
    m,
    values,
    mutation,
    stream(c.master, 'mutation', g, i),
    detailed ? c.trace!.maxChanges : 0,
    c.protectedLayers,
  );
  return {
    id: identity(c, g, i),
    genome: new Genome(m, parameters, digest),
    birth: g,
    parents: b ? [a.id, b.id] : [a.id],
    origin: 'offspring',
    operator: b ? c.operator : attempted ? 'fallback' : 'copy',
    mutation: summary,
  };
}
export function initialPopulation(
  m: Model,
  c: Config,
  digest: Digest,
  seed?: Genome,
) {
  if (!seed && c.globalProtection)
    throw Error('Global protection requires a seed model');
  if (seed && seed.model.key !== m.key) throw Error('Incompatible seed genome');
  const first: Member | undefined = seed
    ? {
        id: identity(c, 0, 0),
        genome: new Genome(m, seed.parameters(), digest),
        birth: 0,
        parents: [],
        origin: 'seed',
        operator: 'copy',
      }
    : undefined;
  const q = Math.min(c.n - 1, Math.round(c.n * c.randomFraction));
  return freezeTree(
    Array.from({ length: c.n }, (_, i) => {
      if (first && i === 0) return first;
      if (first && i > q)
        return child(first, undefined, c, 0, i, digest, c.mutation, false);
      return initialized(m, c, 0, i, digest, 'initial');
    }),
  );
}
export function reproduce(
  previous: readonly Member[],
  order: readonly number[],
  c: Config,
  generation: number,
  state: AdaptiveState,
  digest: Digest,
) {
  const m = previous[0].genome.model;
  if (c.randomSearch)
    return freezeTree(
      Array.from({ length: c.n }, (_, i) =>
        initialized(m, c, generation, i, digest, 'random'),
      ),
    );
  const count = eliteCount(c.n, c.eliteRate),
    immigrants = immigrantCount(c.n, count, c.adaptation, state.count),
    genes = previous.map((x) => x.genome);
  const next: Member[] = elites(order, genes, count).map((i) => ({
    ...previous[i],
    origin: 'elite',
    mutation: undefined,
  }));
  const pool = order.slice(0, Math.max(1, Math.round(c.n * c.poolFraction))),
    mutation = { ...c.mutation, p: state.p, alpha: state.alpha };
  for (let i = next.length; i < c.n - immigrants; i++) {
    const a =
      previous[
        tournament(
          pool,
          c.tournament,
          stream(c.master, 'selection-a', generation, i),
        )
      ];
    const attempted =
      c.crossProbability > 0 &&
      stream(c.master, 'cross-choice', generation, i).next() <
        c.crossProbability;
    const candidates = attempted
      ? pool.filter((j) => !a.genome.equals(genes[j]))
      : [];
    const b = candidates.length
      ? previous[
          tournament(
            candidates,
            c.tournament,
            stream(c.master, 'selection-b', generation, i),
          )
        ]
      : undefined;
    next.push(child(a, b, c, generation, i, digest, mutation, attempted));
  }
  while (next.length < c.n)
    next.push(initialized(m, c, generation, next.length, digest, 'immigrant'));
  return freezeTree(next);
}
