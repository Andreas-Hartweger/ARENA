import type { AdaptiveState } from '../training/adaptation';
import {
  Evolution,
  type GenerationSummary,
  type CommittedSnapshot,
} from '../training/evolution';
import { Genome, type Model } from '../training/genome';
import type { Member, EvolutionOptions } from '../training/population';
import { type Draft, preflight } from '../runtime/runConfig';
import { fingerprint, parameterBytes, sha256 } from '../runtime/fingerprint';
import {
  decode,
  jsonObject,
  object,
  type StoredObject,
  type StorePort,
} from './objects';

export interface RunCounters {
  globalGeneration: number;
  logicalEpisodes: number;
  activeMs: number;
  goalStreak: number;
  revision: number;
  segment: number;
  pendingLearning?: EvolutionOptions;
  pendingScenario?: Draft['scenarios'];
  previousSegments: string[];
}
type SavedMember = Omit<Member, 'genome'> & { genome: string };
export interface Checkpoint {
  version: 'arena.checkpoint.v1';
  runtime: string;
  contracts: string[];
  runId: string;
  id: string;
  phase: 'readyToEvaluate' | 'terminal';
  reason: string | null;
  nextGeneration: number | null;
  draft: Draft;
  original: Draft;
  counters: RunCounters;
  population: SavedMember[];
  history: string[];
  adaptive: AdaptiveState | null;
  champion: { id: string; fitness: number; genome: string } | null;
  generationBest: string | null;
}
export interface RunIndex {
  id: string;
  latest: string;
  automatic: string[];
  milestones: string[];
  terminal: boolean;
  globalGeneration: number;
}
type Stage = ReturnType<Evolution['prepare']>;
export function genomeObject(g: Genome) {
  const bytes = parameterBytes(g.parameters()),
    raw = sha256(bytes);
  // Content fingerprint and raw checksum are different identities.
  return object('genome', 'genome:' + g.hash + ':' + raw, bytes);
}
export function readGenome(entry: StoredObject, m: Model) {
  if (
    entry.meta.kind !== 'genome' ||
    entry.bytes.length !== 8 * m.count ||
    sha256(entry.bytes) !== entry.meta.checksum
  )
    throw Error('Genome bytes invalid');
  const view = new DataView(
      entry.bytes.buffer,
      entry.bytes.byteOffset,
      entry.bytes.byteLength,
    ),
    values = new Float64Array(m.count);
  for (let i = 0; i < values.length; i++) {
    values[i] = view.getFloat64(i * 8, true);
    if (Object.is(values[i], -0)) throw Error('Noncanonical negative zero');
  }
  const g = new Genome(m, values, fingerprint);
  if (entry.meta.id !== 'genome:' + g.hash + ':' + entry.meta.checksum)
    throw Error('Genome identity mismatch');
  return g;
}
export function boundary(
  evolution: Evolution,
  stage: Stage | undefined,
  draft: Draft,
  original: Draft,
  counters: RunCounters,
  runtime: string,
  reason: string | null,
  historyIds: readonly string[],
  prior?: RunIndex,
  manual = false,
) {
  const snap: CommittedSnapshot | null = stage?.snapshot ?? evolution.snapshot;
  const population = stage?.snapshot.nextPopulation ?? evolution.population;
  const history = stage?.history ?? evolution.history;
  const objects = new Map<string, StoredObject>(),
    genomes = new Map<Genome, string>();
  const ref = (g: Genome) => {
    const known = genomes.get(g);
    if (known) return known;
    const value = genomeObject(g);
    objects.set(value.meta.id, value);
    genomes.set(g, value.meta.id);
    return value.meta.id;
  };
  const packed = population.map(({ genome, ...other }) => ({
    ...other,
    genome: ref(genome),
  }));
  const ids = [...historyIds];
  for (let i = ids.length; i < history.length; i++) {
    const summary = history[i],
      key = 'history:' + draft.options.runId + ':' + counters.segment + ':' + i;
    const record = jsonObject('history', key, summary);
    objects.set(key, record);
    ids.push(key);
  }
  const id = 'checkpoint:' + crypto.randomUUID(),
    runId = evolution.config.runId;
  const cp: Checkpoint = {
    version: 'arena.checkpoint.v1',
    runtime,
    contracts: evolution.scenarios.map((s) => s.key),
    id,
    runId,
    phase: population.length ? 'readyToEvaluate' : 'terminal',
    reason,
    nextGeneration: population.length ? history.length : null,
    draft,
    original,
    counters,
    population: packed,
    history: ids,
    adaptive: stage?.nextAdaptive ?? evolution.adaptive,
    champion: snap
      ? {
          id: snap.champion.id,
          fitness: snap.champion.fitness,
          genome: ref(snap.champion.genome),
        }
      : null,
    generationBest: snap ? ref(snap.generationBest) : null,
  };
  const checkpoint = jsonObject(
    'checkpoint',
    id,
    cp,
    [
      ...genomes.values(),
      ...ids,
      ...counters.previousSegments,
      ...(draft.sourceVersion ? [draft.sourceVersion] : []),
    ],
    false,
    manual,
  );
  objects.set(id, checkpoint);
  const automatic = manual
    ? (prior?.automatic ?? [])
    : [...(prior?.automatic ?? []), id].slice(-3);
  const index: RunIndex = {
    id: runId,
    latest: id,
    automatic,
    milestones: manual
      ? [...(prior?.milestones ?? []), id]
      : (prior?.milestones ?? []),
    terminal: !population.length,
    globalGeneration: counters.globalGeneration,
  };
  const indexObject = jsonObject(
    'run',
    'run:' + runId,
    index,
    [id, ...index.automatic, ...index.milestones],
    true,
  );
  objects.set(indexObject.meta.id, indexObject);
  return { objects: [...objects.values()], checkpoint: cp, index };
}
export async function restore(
  db: StorePort,
  id: string,
  runtime: string,
  hardware?: number,
) {
  async function get(key: string) {
    const o = await db.get(key);
    if (!o) throw Error('Missing checkpoint dependency ' + key);
    return o;
  }
  const stored = await get(id),
    cp = decode<Checkpoint>(stored);
  if (
    stored.meta.kind !== 'checkpoint' ||
    cp.version !== 'arena.checkpoint.v1' ||
    cp.id !== id ||
    cp.runtime !== runtime ||
    cp.runId !== cp.draft.options.runId
  )
    throw Error('Incompatible checkpoint');
  const { m, scenarios, c } = preflight(cp.draft, fingerprint, hardware);
  if (
    cp.contracts.length !== scenarios.length ||
    cp.contracts.some((k, i) => k !== scenarios[i].key) ||
    (cp.phase === 'terminal') !== (cp.nextGeneration === null) ||
    (cp.phase === 'readyToEvaluate' &&
      (cp.nextGeneration !== cp.history.length ||
        cp.population.length !== c.n)) ||
    (cp.phase === 'terminal' && cp.population.length) ||
    !Number.isSafeInteger(cp.counters.globalGeneration) ||
    cp.counters.globalGeneration < cp.history.length
  )
    throw Error('Invalid checkpoint counters or graph');
  const loaded = new Map<string, Genome>();
  async function genome(key: string) {
    let g = loaded.get(key);
    if (!g) {
      g = readGenome(await get(key), m);
      loaded.set(key, g);
    }
    return g;
  }
  const population: Member[] = [];
  for (const { genome: key, ...fields } of cp.population)
    population.push(Object.freeze({ ...fields, genome: await genome(key) }));
  const history: GenerationSummary[] = [];
  for (const key of cp.history)
    history.push(decode<GenerationSummary>(await get(key)));
  const champion = cp.champion
    ? Object.freeze({
        ...cp.champion,
        genome: await genome(cp.champion.genome),
      })
    : null;
  const evolution = new Evolution(
    m,
    scenarios,
    fingerprint,
    cp.draft.options,
    undefined,
    cp.draft.weights,
    {
      population,
      history,
      champion,
      generationBest: cp.generationBest
        ? await genome(cp.generationBest)
        : null,
      adaptive: cp.adaptive,
    },
  );
  return { cp, evolution };
}
