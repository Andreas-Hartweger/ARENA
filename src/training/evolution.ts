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
import { bounded, normalized } from './fitness';
import { Genome, type Model } from './genome';
import {
  config,
  initialPopulation,
  reproduce,
  type EvolutionOptions,
  type Member,
} from './population';
import { ranking } from './operators';
import { derivedSeed, stream } from './random';

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
// External evaluators may supply shallow-frozen or mutable plain records.
// Copy their published values at the transaction boundary, including trace data.
function copyData<T>(value: T): T {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw Error('Nonfinite evaluation data');
  if (Array.isArray(value))
    return Array.from(value, (item) => copyData(item)) as T;
  if (value !== null && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype)
      throw Error('Expected plain evaluation data');
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, copyData(v)]),
    ) as T;
  }
  if (
    value !== null &&
    !['number', 'string', 'boolean', 'undefined'].includes(typeof value)
  )
    throw Error('Invalid evaluation data');
  return value;
}
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
    inheritance: m.inheritance,
    score,
    episodes: rows.map((row) => {
      if (!row.result.ok) throw Error('Unscored episode');
      return {
        scenario: row.scenario,
        contract: row.contract,
        seed: row.seed,
        attempt: row.attempt,
        ...copyData(row.result),
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
    if (r.origin === 'offspring')
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
    mutation: records.reduce(
      (totals, r) => {
        for (const layer of r.mutation?.layers ?? [])
          for (const group of [layer.weight, layer.bias]) {
            for (const key of [
              'eligible',
              'selected',
              'changed',
              'large',
              'normal',
              'clipped',
            ] as const)
              totals[key] += group[key];
          }
        return totals;
      },
      { eligible: 0, selected: 0, changed: 0, large: 0, normal: 0, clipped: 0 },
    ),
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
export type GenerationSummary = ReturnType<typeof summarize>;
type Summary = GenerationSummary;
type Phase =
  | 'initialized'
  | 'evaluating'
  | 'staged'
  | 'committed'
  | 'blocked'
  | 'cancelled';
export type CommittedSnapshot = Readonly<{
  historyIndex: number;
  summary: Summary;
  generationBest: Genome;
  champion: Readonly<{ id: string; fitness: number; genome: Genome }>;
  nextPopulation: readonly Member[];
}>;
export interface EvolutionBoundary {
  population: readonly Member[];
  history: readonly GenerationSummary[];
  champion: CommittedSnapshot['champion'] | null;
  generationBest: Genome | null;
  adaptive: AdaptiveState | null;
}
export class Evolution {
  #config: ReturnType<typeof config>;
  get config() {
    return this.#config;
  }
  readonly scenarios: readonly Scenario[];
  readonly weights: readonly number[];
  readonly #digest: Digest;
  #population: readonly Member[];
  #history: readonly Summary[] = Object.freeze([]);
  #champion: { id: string; fitness: number; genome: Genome } | null = null;
  #lastError: string | null = null;
  #phase: Phase = 'initialized';
  #adaptive: AdaptiveState | null = null;
  get adaptive() {
    return this.#adaptive;
  }
  #committed: CommittedSnapshot | null = null;
  #busy = false;
  constructor(
    m: Model,
    scenarios: readonly Scenario[],
    digest: Digest,
    opts: EvolutionOptions = {},
    seed?: Genome,
    weights?: readonly number[],
    boundary?: EvolutionBoundary,
  ) {
    this.#config = config(m, opts);
    this.#digest = digest;
    if (
      !scenarios.length ||
      new Set(scenarios.map((s) => s.key)).size !== scenarios.length ||
      scenarios.some(
        (s, i) =>
          s.purpose !== 'training' ||
          s.seed !==
            derivedSeed(
              this.config.master,
              'scenario',
              0,
              this.config.segment,
              i,
            ) ||
          s.modelSignature !== m.signature ||
          s.structure !== scenarios[0].structure,
      )
    )
      throw Error('Incompatible training scenarios');
    this.scenarios = Object.freeze([...scenarios]);
    this.weights = normalized(weights ?? scenarios.map(() => 1));
    if (this.weights.length !== scenarios.length)
      throw Error('Missing scenario weight');
    this.#population = boundary
      ? Object.freeze([...boundary.population])
      : this.config.budget < this.config.n * scenarios.length
        ? Object.freeze([])
        : initialPopulation(m, this.config, digest, seed);
    if (boundary) {
      const { history, champion, generationBest, adaptive } = boundary,
        g = history.length;
      if (
        g > this.config.generations ||
        g > 0 !== !!champion ||
        g > 0 !== !!generationBest ||
        g > 0 !== !!adaptive ||
        (this.#population.length !== 0 &&
          this.#population.length !== this.config.n) ||
        (g === this.config.generations && this.#population.length) ||
        new Set(this.#population.map((x) => x.id)).size !==
          this.#population.length ||
        this.#population.some(
          (x) =>
            x.genome.model.key !== m.key ||
            x.genome.model.weightLimit !== m.weightLimit ||
            x.genome.model.biasLimit !== m.biasLimit,
        ) ||
        history.some(
          (h, i) =>
            h.version !== 'arena.generation.v1' ||
            h.generation !== i ||
            h.records.length !== this.config.n ||
            h.evaluations !== this.config.n * scenarios.length,
        )
      )
        throw Error('Invalid evolution boundary');
      const last = history.at(-1);
      if (
        last &&
        (!champion ||
          champion.fitness !== last.champion.fitness ||
          champion.id !== last.champion.id ||
          champion.genome.model.key !== m.key ||
          generationBest?.hash !== last.records[last.order[0]].hash)
      )
        throw Error('Checkpoint best model mismatch');
      this.#history = Object.freeze([...history]);
      this.#champion = champion;
      this.#adaptive = adaptive;
      if (last && champion && generationBest) {
        this.#committed = Object.freeze({
          historyIndex: g - 1,
          summary: last,
          generationBest,
          champion,
          nextPopulation: this.#population,
        });
        this.#phase = 'committed';
      }
    }
    Object.freeze(this);
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
  get phase() {
    return this.#phase;
  }
  get snapshot() {
    return this.#committed;
  }
  collect(evaluator: Evaluator = drive): EvaluationRow[] {
    if (this.#busy || !this.population.length)
      throw Error('No open generation');
    const rows: EvaluationRow[] = [],
      generation = this.history.length,
      c = this.config;
    this.#busy = true;
    this.#phase = 'evaluating';
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
      this.#phase = 'staged';
      return rows;
    } finally {
      this.#busy = false;
    }
  }
  commit(rows: readonly EvaluationRow[]) {
    const staged = this.prepare(rows);
    staged.publish();
    return staged.snapshot.summary;
  }
  prepare(
    rows: readonly EvaluationRow[],
    options: {
      stopAfter?: (summary: GenerationSummary) => boolean;
      learning?: Pick<
        EvolutionOptions,
        | 'tournament'
        | 'eliteRate'
        | 'poolFraction'
        | 'crossProbability'
        | 'operator'
        | 'mutation'
        | 'adaptation'
      >;
    } = {},
  ) {
    if (this.#busy || !this.population.length)
      throw Error('No open generation');
    this.#busy = true;
    let interrupted = false;
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
        const result = row.result;
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
          ![0, 1].includes(row.attempt) ||
          ('contract' in result && result.contract !== row.contract) ||
          ('seed' in result && result.seed !== row.seed) ||
          ('scenario' in result && result.scenario !== row.scenario) ||
          ('attempt' in result && result.attempt !== row.attempt)
        )
          throw Error('Invalid staged identity');
        if (!result.ok) {
          if (
            result.reason === 'cancelled' ||
            result.reason === 'externalReset'
          )
            interrupted = true;
          throw Error(
            JSON.stringify({
              ...result,
              generation: g,
              slot: row.slot,
              scenario: s.id,
              contract: s.key,
              seed: s.seed,
              genome: m.genome.hash,
              attempt: row.attempt,
            }),
          );
        }
        if (
          !['timeout', 'noProgress', 'completed'].includes(result.reason) ||
          result.errors.length !== 6 ||
          result.lapTimes.length > s.task.laps ||
          (result.reason === 'completed') !==
            (result.lapTimes.length === s.task.laps)
        )
          throw Error('Invalid episode outcome');
        bounded(result.tick, 1, s.task.maxTicks, 'result tick', true);
        bounded(
          result.duration,
          0,
          result.tick / 60 + 1e-10,
          'simulated duration',
        );
        for (const v of [
          ...result.errors,
          result.fitness.P,
          result.fitness.A,
          result.fitness.K,
          result.fitness.T,
          result.fitness.Q,
        ])
          bounded(v, 0, 1, 'fitness component');
        bounded(result.fitness.R, 0, 1000, 'detail fitness');
        bounded(
          result.fitness.F,
          0,
          1100 * (2 * s.task.laps + 1) + 1000,
          'score',
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
      const prev = this.#adaptive,
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
      const stop = options.stopAfter?.(summary) ?? false;
      const revised = options.learning
        ? config(this.#population[0].genome.model, {
            ...c,
            ...options.learning,
            mutation: { ...c.mutation, ...options.learning.mutation },
            adaptation: { ...c.adaptation, ...options.learning.adaptation },
          })
        : c;
      const nextAdaptive =
        options.learning?.mutation || options.learning?.adaptation
          ? adapt(null, champion.fitness, revised.adaptation, revised.mutation)
          : adaptive;
      const next =
        !stop && g + 1 < c.generations && (g + 2) * n * sc <= c.budget
          ? reproduce(
              this.#population,
              order,
              revised,
              g + 1,
              nextAdaptive,
              this.#digest,
            )
          : Object.freeze([]);
      const history = Object.freeze([...this.history, summary]);
      const snapshot = Object.freeze({
        historyIndex: g,
        summary,
        generationBest: this.#population[best].genome,
        champion,
        nextPopulation: next,
      });
      const source = this.#population;
      this.#phase = 'staged';
      return Object.freeze({
        snapshot,
        history,
        config: revised,
        nextAdaptive,
        publish: () => {
          if (this.#busy || this.#population !== source)
            throw Error('Stale generation stage');
          this.#history = history;
          this.#champion = champion;
          this.#population = next;
          this.#lastError = null;
          this.#committed = snapshot;
          this.#config = revised;
          this.#adaptive = nextAdaptive;
          this.#phase = 'committed';
        },
      });
    } catch (error) {
      this.#lastError = String(error);
      this.#phase = interrupted ? 'cancelled' : 'blocked';
      throw error;
    } finally {
      this.#busy = false;
    }
  }
}
