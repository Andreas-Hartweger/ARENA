import {
  Evolution,
  type EvaluationRow,
  type GenerationSummary,
} from '../training/evolution';
import type { Genome } from '../training/genome';
import { type Draft, matchedGoal, preflight } from './runConfig';
import { fingerprint } from './fingerprint';
import { WorkerPool } from './workerPool';
import { type ComputePort, type WorkerEvent } from './compute';
import {
  boundary,
  restore,
  type RunCounters,
  type RunIndex,
} from '../storage/checkpoint';
import {
  decode,
  deletionPreview,
  jsonObject,
  type StorePort,
} from '../storage/objects';

export type Phase =
  | 'Draft'
  | 'Initializing'
  | 'Running'
  | 'Pausing'
  | 'Draining'
  | 'Paused'
  | 'Stopping'
  | 'Completed'
  | 'Cancelling'
  | 'Cancelled'
  | 'Recoverable'
  | 'Faulted';
type Stage = ReturnType<Evolution['prepare']>;
export type Learning = NonNullable<
  Parameters<Evolution['prepare']>[1]
>['learning'];
export interface RunState {
  phase: Phase;
  runId: string;
  sessionId: string;
  seq: number;
  segment: number;
  generation: number;
  evaluations: number;
  activeMs: number;
  durableGeneration: number | null;
  reason: string | null;
  error: string | null;
  unsaved: boolean;
  summary?: Omit<GenerationSummary, 'records' | 'order'>;
  monitor?: ReturnType<TrainingController['metrics']>;
}
export class TrainingController {
  #e?: Evolution;
  #draft?: Draft;
  #original?: Draft;
  #pool?: WorkerPool;
  #index?: RunIndex;
  #historyIds: string[] = [];
  #counts!: RunCounters;
  #phase: Phase = 'Draft';
  #reason: string | null = null;
  #error: string | null = null;
  #activeSince: number | null = null;
  #durable: number | null = null;
  #seq = 0;
  #session = '';
  #waitingRows?: EvaluationRow[];
  #pendingSave?: () => Promise<void>;
  #learning?: Learning;
  #newScenarios?: Draft['scenarios'];
  #saveRequested = false;
  #automaticCleanup = false;
  #hardTimer?: ReturnType<typeof setTimeout>;
  #tail: Promise<unknown> = Promise.resolve();
  readonly #db: StorePort;
  readonly #port: () => ComputePort;
  readonly #runtime: string;
  readonly #hardware?: number;
  changed?: (state: RunState) => void;
  observed?: (event: Extract<WorkerEvent, { type: 'progress' }>) => void;
  constructor(
    db: StorePort,
    port: () => ComputePort,
    runtime: string,
    hardware?: number,
  ) {
    this.#db = db;
    this.#port = port;
    this.#runtime = runtime;
    this.#hardware = hardware;
  }
  serialize<T>(fn: () => Promise<T> | T): Promise<T> {
    const result = this.#tail.then(fn);
    this.#tail = result.catch(() => {});
    return result;
  }
  get draft() {
    return this.#draft ? structuredClone(this.#draft) : undefined;
  }
  metrics() {
    return this.#pool?.monitor;
  }
  observe(visible: number, slot: number | null) {
    this.#pool?.observe(visible, slot);
  }
  selectedBrain(slot: number) {
    const member = this.#e?.population[slot];
    if (!member) return;
    const g = member.genome,
      m = g.model;
    return {
      id: member.id,
      hash: g.hash,
      signature: m.signature,
      hidden: m.hidden,
      activation: m.activation,
      parameters: g.parameters(),
    };
  }
  get snapshot(): RunState {
    const latest = this.#e?.history.at(-1);
    let summary: RunState['summary'];
    if (latest) {
      const { records, order, ...publicData } = latest;
      void records;
      void order;
      summary = publicData;
    }
    return {
      phase: this.#phase,
      runId: this.#draft?.options.runId ?? '',
      sessionId: this.#session,
      seq: this.#seq,
      segment: this.#counts?.segment ?? 0,
      generation: this.#counts?.globalGeneration ?? 0,
      evaluations: this.#counts?.logicalEpisodes ?? 0,
      activeMs: this.#active(),
      durableGeneration: this.#durable,
      reason: this.#reason,
      error: this.#error,
      unsaved: !!this.#pendingSave,
      summary,
      monitor: this.metrics(),
    };
  }
  population(offset = 0, limit = 100) {
    const rows = this.#e?.history.at(-1)?.records ?? [];
    return rows.slice(
      Math.max(0, offset),
      Math.max(0, offset) + Math.min(128, limit),
    );
  }
  history() {
    return (
      this.#e?.history.map((s) => ({
        generation: s.generation,
        fitness: s.fitness,
        successes: s.successes,
        lapTime: s.lapTimes?.worst ?? null,
        diversity: s.diversity.D,
        progress: s.progress.best,
      })) ?? []
    );
  }
  champion() {
    return this.#e?.champion;
  }
  #emit() {
    this.#seq++;
    this.changed?.(this.snapshot);
  }
  #active() {
    return (
      (this.#counts?.activeMs ?? 0) +
      (this.#activeSince === null ? 0 : performance.now() - this.#activeSince)
    );
  }
  #freezeClock() {
    if (this.#counts) this.#counts.activeMs = this.#active();
    this.#activeSince = null;
    clearTimeout(this.#hardTimer);
  }
  #startClock() {
    this.#activeSince = performance.now();
    clearTimeout(this.#hardTimer);
    const cap = this.#draft?.time;
    if (cap?.hard) {
      const session = this.#session;
      this.#hardTimer = setTimeout(
        () => {
          void this.serialize(async () => {
            if (session === this.#session && this.#activeSince !== null) {
              if (this.#active() >= cap.seconds * 1000)
                await this.cancel('hardTime');
              else {
                this.#freezeClock();
                this.#startClock();
              }
            }
          });
        },
        Math.max(0, Math.min(2147483647, cap.seconds * 1000 - this.#active())),
      );
    }
  }
  #init(draft: Draft) {
    if (!['Draft', 'Completed', 'Cancelled', 'Faulted'].includes(this.#phase))
      throw Error('Ein Trainingslauf ist aktiv.');
    this.#pool?.close();
    this.#waitingRows = undefined;
    this.#pendingSave = undefined;
    this.#e = undefined;
    this.#index = undefined;
    this.#historyIds = [];
    this.#session = crypto.randomUUID();
    this.#learning = undefined;
    this.#newScenarios = undefined;
    this.#reason = null;
    this.#error = null;
    this.#durable = null;
    this.#phase = 'Initializing';
    this.#original = structuredClone(draft);
    this.#draft = structuredClone(draft);
    this.#counts = {
      globalGeneration: 0,
      logicalEpisodes: 0,
      activeMs: 0,
      goalStreak: 0,
      revision: 0,
      segment: draft.options.segment ?? 0,
      previousSegments: [],
    };
  }
  #makePool(workers: number) {
    this.#pool = new WorkerPool(this.#port, workers, this.#session);
    this.#pool.setRate(this.#draft!.mode === 'live' ? 1 : this.#draft!.rate);
    this.#pool.onProgress = (m) => this.observed?.(m);
    this.#pool.onPause = () => {
      void this.serialize(() => {
        if (!['Pausing', 'Draining'].includes(this.#phase)) return;
        this.#freezeClock();
        this.#phase = 'Paused';
        this.#emit();
      });
    };
  }
  async start(input: Draft, source?: Genome) {
    if (!['Draft', 'Completed', 'Cancelled', 'Faulted'].includes(this.#phase))
      throw Error('Ein Trainingslauf ist aktiv.');
    for (const item of await this.#db.list())
      if (item.kind === 'run') {
        const record = await this.#db.get(item.id);
        if (record && !decode<RunIndex>(record).terminal)
          throw Error('Vorhandenen Lauf zuerst wiederherstellen oder beenden.');
      }
    const draft = structuredClone(input);
    draft.options.runId = crypto.randomUUID();
    const { m, scenarios, allocation } = preflight(
      draft,
      fingerprint,
      this.#hardware,
    );
    if (!!draft.sourceVersion !== !!source)
      throw Error('Source model missing or unexpected');
    const evolution = new Evolution(
      m,
      scenarios,
      fingerprint,
      draft.options,
      source,
      draft.weights,
    );
    this.#init(draft);
    this.#e = evolution;
    this.#makePool(allocation.workers);
    this.#startClock();
    this.#emit();
    await this.#saveThen(undefined, true, () => {
      this.#phase = 'Running';
      this.#emit();
      this.#dispatch();
    });
  }
  #dispatch() {
    if (this.#phase !== 'Running' && this.#phase !== 'Stopping') return;
    const session = this.#session,
      pool = this.#pool!;
    void pool
      .evaluate(this.#e!, this.#draft!.scenarios)
      .then((rows) =>
        this.serialize(async () => {
          if (
            session !== this.#session ||
            ['Cancelled', 'Faulted'].includes(this.#phase)
          )
            return;
          if (['Paused', 'Pausing', 'Draining'].includes(this.#phase)) {
            this.#waitingRows = rows;
            return;
          }
          await this.#finish(rows);
        }),
      )
      .catch((e) => {
        void this.serialize(() => {
          if (
            session === this.#session &&
            !['Cancelled', 'Completed'].includes(this.#phase)
          )
            this.#fault(e);
        });
      });
  }
  #fault(e: unknown) {
    this.#pool?.close();
    this.#freezeClock();
    this.#phase = 'Faulted';
    this.#error = String(e);
    this.#emit();
  }
  async #finish(rows: EvaluationRow[]) {
    const e = this.#e!,
      draft = this.#draft!,
      goal = draft.goal;
    let streak = this.#counts.goalStreak,
      reason: string | null = null;
    const moreSegments = !!this.#newScenarios;
    const stage = e.prepare(rows, {
      learning: this.#learning,
      stopAfter: (summary) => {
        streak = goal && matchedGoal(goal, summary) ? streak + 1 : 0;
        if (this.#phase === 'Stopping') reason = 'finish';
        else if (goal && streak >= goal.consecutive) reason = 'goal';
        else if (draft.time && this.#active() >= draft.time.seconds * 1000)
          reason = 'wallTime';
        else if (
          this.#counts.globalGeneration + 1 >=
            (draft.options.generations ?? 100) ||
          this.#counts.logicalEpisodes +
            summary.evaluations +
            e.config.n * (this.#newScenarios?.length ?? e.scenarios.length) >
            (draft.options.budget ?? Number.MAX_SAFE_INTEGER)
        )
          reason = 'budget';
        return !!reason || moreSegments;
      },
    });
    this.#counts.goalStreak = streak;
    this.#counts.globalGeneration++;
    this.#counts.logicalEpisodes += stage.snapshot.summary.evaluations;
    if (this.#learning) {
      draft.options = { ...draft.options, ...stage.config };
      this.#counts.revision++;
      this.#learning = undefined;
    }
    this.#reason =
      reason ??
      (stage.snapshot.nextPopulation.length || moreSegments ? null : 'budget');
    const held = e.population;
    const mustSave =
      !!this.#reason ||
      moreSegments ||
      this.#saveRequested ||
      this.#counts.globalGeneration % draft.autosave === 0;
    await this.#saveThen(stage, mustSave, async () => {
      if (this.#reason) {
        this.#freezeClock();
        this.#phase = 'Completed';
        this.#pool?.close();
        this.#emit();
        return;
      }
      if (this.#newScenarios) {
        if (this.#index) this.#counts.previousSegments.push(this.#index.latest);
        this.#counts.segment++;
        this.#counts.goalStreak = 0;
        this.#counts.revision++;
        this.#historyIds = [];
        draft.scenarios = this.#newScenarios;
        this.#newScenarios = undefined;
        draft.options.segment = this.#counts.segment;
        const { m, scenarios } = preflight(draft, fingerprint, this.#hardware);
        this.#e = new Evolution(
          m,
          scenarios,
          fingerprint,
          draft.options,
          undefined,
          draft.weights,
          {
            population: held,
            history: [],
            champion: null,
            generationBest: null,
            adaptive: null,
          },
        );
        await this.#saveThen(undefined, true, () => {
          this.#emit();
          this.#dispatch();
        });
        return;
      }
      this.#emit();
      this.#dispatch();
    });
  }
  async #saveThen(
    stage: Stage | undefined,
    save: boolean,
    after: () => void | Promise<void>,
  ) {
    const d = this.#draft!,
      manual = this.#saveRequested;
    this.#saveRequested = false;
    if (!save || d.volatile) {
      stage?.publish();
      await after();
      return;
    }
    const saved = boundary(
      this.#e!,
      stage,
      d,
      this.#original!,
      { ...this.#counts, activeMs: this.#active() },
      this.#runtime,
      this.#reason ?? (this.#newScenarios ? 'segment' : null),
      this.#historyIds,
      this.#index,
      manual,
    );
    const commit = async () => {
      await this.#db.commit(saved.objects, {
        replace: ['run:' + this.#e!.config.runId],
      });
      this.#index = saved.index;
      this.#durable = saved.checkpoint.counters.globalGeneration;
      this.#historyIds = saved.checkpoint.history;
      stage?.publish();
      this.#pendingSave = undefined;
      this.#error = null;
      // Old manifest roots are released only after the new generation is durable.
      this.#automaticCleanup = true;
    };
    try {
      await commit();
    } catch (error) {
      this.#freezeClock();
      this.#phase = 'Recoverable';
      this.#error = String(error);
      this.#pendingSave = async () => {
        await commit();
        this.#phase = 'Running';
        this.#startClock();
        await after();
      };
      this.#emit();
      return;
    }
    if (this.#automaticCleanup) {
      this.#automaticCleanup = false;
      try {
        const meta = await this.#db.list(),
          obsolete = deletionPreview(meta, []);
        if (obsolete.remove.length)
          await this.#db.commit([], { remove: obsolete.remove });
      } catch (error) {
        this.#error = 'Speicherbereinigung: ' + String(error);
      }
    }
    await after();
  }
  async retry() {
    if (!this.#pendingSave) throw Error('Keine ausstehende Speicherung.');
    await this.#pendingSave();
  }
  pause(drain = false) {
    if (this.#phase !== 'Running') throw Error('Pause aktuell nicht möglich.');
    this.#phase = drain ? 'Draining' : 'Pausing';
    this.#pool!.pause(drain);
    this.#emit();
  }
  async resume() {
    if (this.#phase !== 'Paused')
      throw Error('Pause zuerst bestätigen lassen.');
    this.#phase = 'Running';
    this.#startClock();
    const pool = this.#pool!;
    if (pool.paused) pool.resume();
    this.#emit();
    if (this.#waitingRows) {
      const r = this.#waitingRows;
      this.#waitingRows = undefined;
      await this.#finish(r);
    } else if (pool.monitor.busy === 0 && !this.#hasWork()) this.#dispatch();
  }
  #hasWork() {
    return this.#pool?.evaluating ?? false;
  }
  finish() {
    if (this.#phase !== 'Running')
      throw Error('Zum Abschließen zuerst ausdrücklich fortsetzen.');
    this.#phase = 'Stopping';
    this.#emit();
  }
  async cancel(reason = 'cancel') {
    if (
      ![
        'Running',
        'Paused',
        'Pausing',
        'Draining',
        'Stopping',
        'Recoverable',
      ].includes(this.#phase)
    )
      throw Error('Kein aktiver Lauf.');
    this.#phase = 'Cancelling';
    this.#pool?.close();
    this.#waitingRows = undefined;
    this.#pendingSave = undefined;
    this.#freezeClock();
    this.#reason = reason;
    if (this.#index) {
      const i = { ...this.#index, terminal: true };
      const row = jsonObject(
        'run',
        'run:' + i.id,
        i,
        [i.latest, ...i.automatic, ...i.milestones],
        true,
      );
      await this.#db.commit([row], { replace: [row.meta.id] });
      this.#index = i;
    }
    this.#phase = 'Cancelled';
    this.#emit();
  }
  display(pick: Pick<Draft, 'rate' | 'mode' | 'profile' | 'custom'>) {
    if (!this.#draft || !this.#pool) throw Error('Kein Lauf.');
    const next = { ...this.#draft, ...pick };
    const p = preflight(next, fingerprint, this.#hardware);
    this.#draft = next;
    this.#pool.setRate(next.mode === 'live' ? 1 : next.rate);
    this.#pool.resize(p.allocation.workers);
    this.#emit();
  }
  revise(learning: Learning, scenarios?: Draft['scenarios']) {
    if (!this.#draft || !['Running', 'Paused'].includes(this.#phase))
      throw Error('Kein bearbeitbarer Lauf.');
    const d = this.#draft,
      options = {
        ...d.options,
        ...learning,
        mutation: { ...d.options.mutation, ...learning?.mutation },
        adaptation: { ...d.options.adaptation, ...learning?.adaptation },
      };
    const proposed = preflight(
      { ...d, options, scenarios: scenarios ?? d.scenarios },
      fingerprint,
      this.#hardware,
    );
    if (proposed.m.key !== this.#e!.population[0].genome.model.key)
      throw Error('Andere Modellsignatur erfordert einen neuen Lauf.');
    this.#learning = structuredClone(learning);
    this.#newScenarios = scenarios ? structuredClone(scenarios) : undefined;
    this.#emit();
  }
  markSave() {
    if (!this.#e || this.#draft?.volatile)
      throw Error('Keine dauerhafte Speicherung verfügbar.');
    this.#saveRequested = true;
    this.#emit();
  }
  async recover(id: string) {
    const { cp, evolution } = await restore(
      this.#db,
      id,
      this.#runtime,
      this.#hardware,
    );
    if (cp.phase === 'terminal')
      throw Error('Terminaler Speicherstand ist abgeschlossen.');
    const record = await this.#db.get('run:' + cp.runId);
    if (!record) throw Error('Laufindex fehlt.');
    const index = decode<RunIndex>(record);
    if (index.latest !== id)
      throw Error('Älterer Stand erfordert neuen Laufzweig.');
    this.#init(cp.draft);
    this.#original = cp.original;
    this.#e = evolution;
    this.#counts = cp.counters;
    this.#durable = cp.counters.globalGeneration;
    this.#index = index;
    this.#historyIds = cp.history;
    this.#makePool(
      preflight(cp.draft, fingerprint, this.#hardware).allocation.workers,
    );
    this.#phase = 'Paused';
    this.#emit();
  }
}
