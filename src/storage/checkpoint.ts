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
  parentCheckpoint?: string;
}
type SavedMember = Omit<Member, 'genome'> & { genome: string };
export interface LapRecord<G = Genome> {
  contract: string;
  scenario: number;
  individual: string;
  seconds: number;
  genome: G;
}
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
  lapRecords?: LapRecord<string>[];
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
  lapRecords: readonly LapRecord[] = [],
  terminal = false,
) {
  const snap: CommittedSnapshot | null = stage?.snapshot ?? evolution.snapshot;
  const population = terminal
    ? []
    : (stage?.snapshot.nextPopulation ?? evolution.population);
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
  const nextGeneration = evolution.historyOffset + history.length;
  if (ids.length < evolution.historyOffset || ids.length > nextGeneration)
    throw Error('Unvollständiger dauerhafter Verlaufsindex.');
  for (let i = ids.length; i < nextGeneration; i++) {
    const summary = history[i - evolution.historyOffset],
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
    nextGeneration: population.length ? nextGeneration : null,
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
    ...(lapRecords.length
      ? { lapRecords: lapRecords.map((r) => ({ ...r, genome: ref(r.genome) })) }
      : {}),
  };
  const checkpoint = jsonObject(
    'checkpoint',
    id,
    cp,
    [
      ...genomes.values(),
      ...ids,
      ...counters.previousSegments,
      ...(counters.parentCheckpoint ? [counters.parentCheckpoint] : []),
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
  branchRun?: string,
  archive?: (row: GenerationSummary) => void,
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
    !['terminal', 'readyToEvaluate'].includes(cp.phase) ||
    (cp.phase === 'terminal') !== (cp.nextGeneration === null) ||
    (cp.phase === 'readyToEvaluate' &&
      (cp.nextGeneration !== cp.history.length ||
        cp.population.length !== c.n)) ||
    (cp.phase === 'terminal' && cp.population.length) ||
    !Number.isSafeInteger(cp.counters.globalGeneration) ||
    cp.counters.globalGeneration < cp.history.length ||
    ![
      cp.counters.logicalEpisodes,
      cp.counters.goalStreak,
      cp.counters.segment,
      cp.counters.revision,
    ].every((v) => Number.isSafeInteger(v) && v >= 0) ||
    !Number.isFinite(cp.counters.activeMs) ||
    cp.counters.activeMs < 0 ||
    cp.counters.segment !== (cp.draft.options.segment ?? 0) ||
    new Set(cp.history).size !== cp.history.length
  )
    throw Error('Invalid checkpoint counters or graph');
  const expected = new Set([
    ...cp.population.map((p) => p.genome),
    ...cp.history,
    ...(cp.lapRecords ?? []).map((r) => r.genome),
    ...cp.counters.previousSegments,
    ...[
      cp.counters.parentCheckpoint,
      cp.draft.sourceVersion,
      cp.generationBest,
      cp.champion?.genome,
    ].filter((v): v is string => !!v),
  ]);
  if (
    expected.size !== stored.meta.refs.length ||
    stored.meta.refs.some((ref) => !expected.has(ref))
  )
    throw Error('Checkpoint enthält einen unvollständigen Referenzgraphen.');
  if (
    cp.counters.globalGeneration > c.generations ||
    cp.counters.logicalEpisodes > c.budget ||
    cp.counters.logicalEpisodes < cp.history.length * c.n * scenarios.length
  )
    throw Error('Ungültiges Checkpointbudget.');
  for (const parent of [
    ...cp.counters.previousSegments,
    ...(cp.counters.parentCheckpoint ? [cp.counters.parentCheckpoint] : []),
  ]) {
    if (parent === cp.id || (await get(parent)).meta.kind !== 'checkpoint')
      throw Error('Ungültiger Eltern-Checkpoint.');
  }
  const loaded = new Map<string, Genome>();
  async function genome(key: string) {
    let g = loaded.get(key);
    if (!g) {
      g = readGenome(await get(key), m);
      loaded.set(key, g);
    }
    return g;
  }
  const fromRun = cp.runId;
  const identity = (id: string) => {
    if (!branchRun) return id;
    const parts: unknown = JSON.parse(id);
    if (
      !Array.isArray(parts) ||
      ![3, 4].includes(parts.length) ||
      parts[0] !== fromRun
    )
      return id;
    return JSON.stringify([branchRun, ...parts.slice(1)]);
  };
  function lineage<T extends Pick<Member, 'id' | 'parents' | 'inheritance'>>(
    m: T,
  ): T {
    if (!branchRun) return m;
    return {
      ...m,
      id: identity(m.id),
      parents: m.parents.map(identity),
      ...(m.inheritance
        ? {
            inheritance: {
              ...m.inheritance,
              parentByIndex: m.inheritance.parentByIndex.map(identity),
            },
          }
        : {}),
    };
  }
  const population: Member[] = [];
  for (const { genome: key, ...fields } of cp.population)
    population.push(
      Object.freeze({ ...lineage(fields), genome: await genome(key) }),
    );
  const history: GenerationSummary[] = [];
  for (const [i, key] of cp.history.entries()) {
    const row = await get(key);
    if (row.meta.kind !== 'history')
      throw Error('Ungültige Generationsreferenz.');
    const summary = decode<GenerationSummary>(row);
    if (
      summary.version !== 'arena.generation.v1' ||
      summary.generation !== i ||
      summary.records.length !== c.n ||
      summary.evaluations !== c.n * scenarios.length
    )
      throw Error('Ungültige Generationsdaten.');
    archive?.(summary);
    if (archive && !branchRun && i < cp.history.length - 1) continue;
    history.push(
      branchRun
        ? {
            ...summary,
            champion: {
              ...summary.champion,
              id: identity(summary.champion.id),
            },
            bestId: identity(summary.bestId),
            records: summary.records.map(lineage),
          }
        : summary,
    );
  }
  const champion = cp.champion
    ? Object.freeze({
        ...cp.champion,
        id: identity(cp.champion.id),
        genome: await genome(cp.champion.genome),
      })
    : null;
  if (branchRun) {
    cp.runId = branchRun;
    cp.draft.options.runId = branchRun;
    cp.counters.parentCheckpoint = id;
  }
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
      historyOffset: cp.history.length - history.length,
      champion,
      generationBest: cp.generationBest
        ? await genome(cp.generationBest)
        : null,
      adaptive: cp.adaptive,
    },
  );
  const lapRecords: LapRecord[] = [];
  for (const r of cp.lapRecords ?? []) {
    if (
      scenarios[r.scenario]?.key !== r.contract ||
      !Number.isFinite(r.seconds) ||
      r.seconds <= 0 ||
      lapRecords.some((v) => v.contract === r.contract)
    )
      throw Error('Ungültige Rundenreferenz.');
    lapRecords.push({
      ...r,
      individual: identity(r.individual),
      genome: await genome(r.genome),
    });
  }
  return { cp, evolution, lapRecords };
}
