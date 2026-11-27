import { freezeTree } from '../physics/vehicleTick';
import { adapt, diversity, type AdaptiveState } from './adaptation';
import {
  evaluate,
  type Digest,
  type EpisodeResult,
  type Scenario,
  type ScoredEpisode,
  type TraceOptions,
} from './episode';
import { normalized } from './fitness';
import { Genome, type Model } from './genome';
import {
  config,
  initialPopulation,
  reproduce,
  type EvolutionOptions,
  type Member,
} from './population';
import { ranking } from './operators';
import { stream } from './random';

export function distribution(values: readonly number[]) {
  if (!values.length || !Array.from(values).every(Number.isFinite))
    throw Error('Invalid sample');
  const sorted = [...values].sort((a, b) => a - b),
    quantile = (q: number) => {
      const k = (sorted.length - 1) * q,
        i = Math.floor(k);
      return sorted[i] + (sorted[Math.ceil(k)] - sorted[i]) * (k - i);
    };
  return {
    best: sorted.at(-1)!,
    worst: sorted[0],
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: quantile(0.5),
    q1: quantile(0.25),
    q3: quantile(0.75),
  };
}
export interface EvaluationRow {
  runId: string;
  segment: number;
  generation: number;
  slot: number;
  scenario: number;
  contract: string;
  seed: number;
  individual: string;
  genome: Genome;
  attempt: 0 | 1;
  result: EpisodeResult;
}
export type Evaluator = (
  s: Scenario,
  b: Genome,
  trace?: TraceOptions,
) => EpisodeResult;
const drive: Evaluator = (s, g, t) => evaluate(s, g.brain(), t);
function compact(
  m: Member,
  slot: number,
  score: number,
  rows: readonly EvaluationRow[],
) {
  return {
    slot,
    id: m.id,
    hash: m.genome.hash,
    birth: m.birth,
    parents: m.parents,
    origin: m.origin,
    operator: m.operator,
    mutation: m.mutation,
    score,
    episodes: rows.map((row) => {
      if (!row.result.ok) throw Error('Unscored episode');
      return {
        scenario: row.scenario,
        contract: row.contract,
        seed: row.seed,
        attempt: row.attempt,
        ...row.result,
      };
    }),
  };
}
type Record = ReturnType<typeof compact>;
function summarize(
  records: Record[],
  population: readonly Member[],
  generation: number,
  champion: { id: string; fitness: number },
  adaptive: AdaptiveState,
  before: { p: number; alpha: number },
  order: number[],
) {
  const episodes = records.flatMap((r) => r.episodes),
    times = episodes.flatMap((e) => e.lapTimes),
    reasons: { [key: string]: number } = {},
    origins: { [key: string]: number } = {},
    operators: { [key: string]: number } = {};
  for (const e of episodes) reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
  for (const r of records) {
    origins[r.origin] = (origins[r.origin] ?? 0) + 1;
    operators[r.operator] = (operators[r.operator] ?? 0) + 1;
  }
  const means = (
    keys: readonly string[],
    read: (e: ScoredEpisode, k: string) => number | null,
  ) =>
    Object.fromEntries(
      keys.map((k) => {
        const vals = episodes
          .map((e) => read(e, k))
          .filter((v): v is number => v !== null);
        return [
          k,
          vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
        ];
      }),
    );
  return freezeTree({
    version: 'arena.generation.v1',
    generation,
    champion,
    adaptive,
    before,
    order,
    records,
    fitness: distribution(records.map((r) => r.score)),
    bestId: records[order[0]].id,
    diversity: diversity(population.map((m) => m.genome)),
    origins,
    operators,
    reasons,
    successes: reasons.completed ?? 0,
    successRate: (reasons.completed ?? 0) / episodes.length,
    laps: times.length,
    lapTimes: times.length ? distribution(times) : null,
    progress: distribution(episodes.map((e) => e.raw.progress)),
    components: means(
      Object.keys(episodes[0].fitness),
      (e, k) => e.fitness[k as keyof typeof e.fitness],
    ),
    rawMeans: means(
      Object.keys(episodes[0].raw),
      (e, k) => e.raw[k as keyof typeof e.raw],
    ),
    penaltyMeans: episodes[0].errors.map(
      (_, i) => episodes.reduce((s, e) => s + e.errors[i], 0) / episodes.length,
    ),
    attempts: episodes.reduce((n, e) => n + 1 + e.attempt, 0),
    evaluations: episodes.length,
    simulatedSeconds: episodes.reduce((n, e) => n + e.duration, 0),
  });
}
type Summary = ReturnType<typeof summarize>;
export class Evolution {
  readonly config;
  readonly scenarios: readonly Scenario[];
  readonly weights: readonly number[];
  readonly #digest: Digest;
  #population: readonly Member[];
  #history: readonly Summary[] = [];
  #champion: { id: string; fitness: number; genome: Genome } | null = null;
  #lastError: string | null = null;
  #busy = false;
  constructor(
    m: Model,
    scenarios: readonly Scenario[],
    digest: Digest,
    opts: EvolutionOptions = {},
    seed?: Genome,
    weights?: readonly number[],
  ) {
    this.config = config(m, opts);
    this.#digest = digest;
    if (
      !scenarios.length ||
      new Set(scenarios.map((s) => s.key)).size !== scenarios.length ||
      scenarios.some(
        (s) =>
          s.purpose !== 'training' ||
          s.modelSignature !== m.signature ||
          s.structure !== scenarios[0].structure,
      )
    )
      throw Error('Incompatible training scenarios');
    this.scenarios = Object.freeze([...scenarios]);
    this.weights = normalized(weights ?? scenarios.map(() => 1));
    if (this.weights.length !== scenarios.length)
      throw Error('Missing scenario weight');
    this.#population =
      this.config.budget < this.config.n * scenarios.length
        ? Object.freeze([])
        : initialPopulation(m, this.config, digest, seed);
  }
  get population() {
    return this.#population;
  }
  get history() {
    return this.#history;
  }
  get champion() {
    return this.#champion;
  }
  get lastError() {
    return this.#lastError;
  }
  collect(evaluator: Evaluator = drive): EvaluationRow[] {
    if (this.#busy || !this.population.length)
      throw Error('No open generation');
    const rows: EvaluationRow[] = [],
      generation = this.history.length,
      c = this.config;
    this.#busy = true;
    try {
      for (const [slot, individual] of this.population.entries())
        for (const [index, s] of this.scenarios.entries()) {
          let attempt: 0 | 1 = 0,
            result: EpisodeResult;
          const trace =
            c.trace?.generation === generation && c.trace.slot === slot
              ? c.trace
              : undefined;
          const run = (): EpisodeResult => {
            try {
              return evaluator(s, individual.genome, trace);
            } catch (error) {
              return {
                ok: false,
                reason: 'simulationFault',
                tick: 0,
                message: String(error),
              };
            }
          };
          result = run();
          if (
            !result.ok &&
            result.reason === 'infrastructureFault' &&
            result.transient === true
          ) {
            attempt = 1;
            result = run();
          }
          rows.push({
            runId: c.runId,
            segment: c.segment,
            generation,
            slot,
            scenario: index,
            contract: s.key,
            seed: s.seed,
            individual: individual.id,
            genome: individual.genome,
            attempt,
            result,
          });
        }
      return rows;
    } finally {
      this.#busy = false;
    }
  }
  commit(rows: readonly EvaluationRow[]) {
    if (this.#busy || !this.population.length)
      throw Error('No open generation');
    this.#busy = true;
    try {
      const c = this.config,
        g = this.history.length,
        n = c.n,
        sc = this.scenarios.length,
        slots = new Map<number, EvaluationRow>();
      if (rows.length !== n * sc) throw Error('Incomplete generation');
      for (const row of rows) {
        const m = this.#population[row.slot],
          s = this.scenarios[row.scenario],
          key = row.slot * sc + row.scenario;
        if (
          !Number.isInteger(row.slot) ||
          !Number.isInteger(row.scenario) ||
          !s ||
          !m ||
          slots.has(key) ||
          row.generation !== g ||
          row.runId !== c.runId ||
          row.segment !== c.segment ||
          row.contract !== s.key ||
          row.seed !== s.seed ||
          row.individual !== m.id ||
          !m.genome.equals(row.genome) ||
          ![0, 1].includes(row.attempt)
        )
          throw Error('Invalid staged identity');
        if (!row.result.ok)
          throw Error(
            JSON.stringify({
              generation: g,
              slot: row.slot,
              scenario: s.id,
              contract: s.key,
              seed: s.seed,
              genome: m.genome.hash,
              attempt: row.attempt,
              ...row.result,
            }),
          );
        slots.set(key, row);
      }
      const records = this.#population.map((m, i) => {
        const group = this.scenarios.map((_, j) => slots.get(i * sc + j)!);
        const score = group.reduce(
          (sum, row, j) =>
            sum + this.weights[j] * (row.result as ScoredEpisode).fitness.F,
          0,
        );
        return compact(m, i, score, group);
      });
      const order = ranking(
          records.map((r) => r.score),
          stream(c.master, 'tie', g),
        ),
        best = order[0];
      const champion =
        !this.#champion || records[best].score > this.#champion.fitness
          ? Object.freeze({
              id: records[best].id,
              fitness: records[best].score,
              genome: this.#population[best].genome,
            })
          : this.#champion;
      const prev = this.history.at(-1)?.adaptive ?? null,
        adaptive = adapt(prev, champion.fitness, c.adaptation, c.mutation);
      const summary = summarize(
        records,
        this.#population,
        g,
        { id: champion.id, fitness: champion.fitness },
        adaptive,
        { p: prev?.p ?? c.mutation.p, alpha: prev?.alpha ?? c.mutation.alpha },
        order,
      );
      const next =
        g + 1 < c.generations && (g + 2) * n * sc <= c.budget
          ? reproduce(this.#population, order, c, g + 1, adaptive, this.#digest)
          : Object.freeze([]);
      const history = Object.freeze([...this.history, summary]);
      this.#history = history;
      this.#champion = champion;
      this.#population = next;
      this.#lastError = null;
      return summary;
    } catch (error) {
      this.#lastError = String(error);
      throw error;
    } finally {
      this.#busy = false;
    }
  }
}
