import { ChartHistory, type ChartMetric } from './history';
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
  type LapRecord,
} from '../storage/checkpoint';
import {
  decode,
  deletionPreview,
  type StorePort,
  type StoredObject,
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
  sessionActiveMs: number;
  managedEstimate: number;
  saveMs: number;
  commits: number;
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
  #plot = new ChartHistory();
  #laps: LapRecord[] = [];
  #counts!: RunCounters;
  #phase: Phase = 'Draft';
  #reason: string | null = null;
  #error: string | null = null;
  #activeSince: number | null = null;
  #durable: number | null = null;
  #seq = 0;
  #sessionBaseMs = 0;
  #managedEstimate = 0;
  #saveMs = 0;
  #commits = 0;
  #session = '';
  #waitingRows?: EvaluationRow[];
  #pendingSave?: () => Promise<void>;
  #learning?: Learning;
  #newScenarios?: Draft['scenarios'];
  #saveRequested = false;
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
      sessionActiveMs: Math.max(0, this.#active() - this.#sessionBaseMs),
      managedEstimate: this.#managedEstimate,
      saveMs: this.#saveMs,
      commits: this.#commits,
      durableGeneration: this.#durable,
      reason: this.#reason,
      error: this.#error,
      unsaved: !!this.#pendingSave,
      summary,
      monitor: this.metrics(),
    };
  }
  population(
    offset = 0,
    limit = 100,
    filter = '',
    sort: 'slot' | 'fitness' = 'slot',
  ) {
    const query = filter.toLowerCase().trim();
    const rows = (this.#e?.history.at(-1)?.records ?? []).filter(
      (r) =>
        !query ||
        [
          r.slot,
          r.id,
          r.hash,
          r.origin,
          r.operator,
          ...r.parents,
          ...r.episodes.map((e) => e.reason),
        ].some((v) => String(v).toLowerCase().includes(query)),
    );
    if (sort === 'fitness')
      rows.sort((a, b) => b.score - a.score || a.slot - b.slot);
    return rows.slice(
      Math.max(0, offset),
      Math.max(0, offset) + Math.min(128, limit),
    );
  }
  history(metric: ChartMetric = 'fitness') {
    return this.#plot.read(metric);
  }
  champion() {
    return this.#e?.champion;
  }
  archiveCandidate(
    role: 'champion' | 'generationBest' | 'lapRecord',
    scenario = 0,
  ) {
    const e = this.#e,
      s = e?.snapshot;
    if (!e || !s) throw Error('Noch keine bestätigte Generation.');
    if (role === 'lapRecord') {
      const lap = this.#laps.find((r) => r.scenario === scenario);
      if (!lap)
        throw Error(
          'Bisher keine bestätigte gültige Runde in diesem Szenario.',
        );
      return {
        id: lap.individual,
        genome: lap.genome,
        value: lap.seconds,
        metric: 'lapTime' as const,
        contract: lap.contract,
        scenarios: 1,
        scenario,
      };
    }
    const candidate =
      role === 'champion'
        ? s.champion
        : {
            id: s.summary.bestId,
            genome: s.generationBest,
            fitness: s.summary.fitness.best,
          };
    return {
      id: candidate.id,
      genome: candidate.genome,
      value: candidate.fitness,
      metric: 'fitness' as const,
      contract: e.scenarios.map((v) => v.key).join(','),
      scenarios: e.scenarios.length,
      scenario: 0,
    };
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
    this.#plot = new ChartHistory();
    this.#laps = [];
    this.#session = crypto.randomUUID();
    this.#learning = undefined;
    this.#newScenarios = undefined;
    this.#reason = null;
    this.#error = null;
    this.#durable = null;
    this.#phase = 'Initializing';
    this.#sessionBaseMs = 0;
    this.#saveMs = 0;
    this.#commits = 0;
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
  async start(input: Draft, source?: Genome, queueUpdate?: StoredObject) {
    if (!['Draft', 'Completed', 'Cancelled', 'Faulted'].includes(this.#phase))
      throw Error('Ein Trainingslauf ist aktiv.');
    for (const item of await this.#db.list())
      if (item.kind === 'run') {
        const record = await this.#db.get(item.id);
        if (record && !decode<RunIndex>(record).terminal)
          throw Error('Vorhandenen Lauf zuerst wiederherstellen oder beenden.');
      }
    const draft = structuredClone(input);
    if (queueUpdate && draft.volatile)
      throw Error(
        'Warteschlangenläufe benötigen einen dauerhaften Start-Checkpoint.',
      );
    draft.options.runId = crypto.randomUUID();
    const { m, scenarios, allocation, estimated } = preflight(
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
    this.#managedEstimate = estimated.total;
    this.#makePool(allocation.workers);
    this.#startClock();
    this.#emit();
    await this.#saveThen(
      undefined,
      true,
      () => {
        this.#phase = 'Running';
        this.#emit();
        this.#dispatch();
      },
      queueUpdate,
    );
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
    const counts = {
      ...this.#counts,
      goalStreak: streak,
      globalGeneration: this.#counts.globalGeneration + 1,
      logicalEpisodes:
        this.#counts.logicalEpisodes + stage.snapshot.summary.evaluations,
    };
    const revised = this.#learning
      ? { ...draft, options: { ...draft.options, ...stage.config } }
      : draft;
    if (this.#learning) counts.revision++;
    this.#learning = undefined;
    const stopped =
      reason ??
      (stage.snapshot.nextPopulation.length || moreSegments ? null : 'budget');
    const nextScenarios = stopped ? undefined : this.#newScenarios;
    this.#newScenarios = undefined;
    const mustSave =
      !!stopped ||
      !!nextScenarios ||
      this.#saveRequested ||
      counts.globalGeneration % draft.autosave === 0;
    await this.#saveThen(
      stage,
      mustSave,
      () => {
        if (stopped) {
          this.#freezeClock();
          this.#phase = 'Completed';
          this.#pool?.close();
        }
        this.#emit();
        if (!stopped) this.#dispatch();
      },
      undefined,
      { counts, draft: revised, stopped, nextScenarios },
    );
  }
  async #saveThen(
    stage: Stage | undefined,
    save: boolean,
    after: () => void | Promise<void>,
    queueUpdate?: StoredObject,
    proposed?: {
      counts: RunCounters;
      draft: Draft;
      stopped: string | null;
      nextScenarios?: Draft['scenarios'];
    },
  ) {
    const manual = this.#saveRequested;
    this.#saveRequested = false;
    let counts = proposed?.counts ?? this.#counts;
    let draft = proposed?.draft ?? this.#draft!;
    const reason = proposed?.stopped ?? null,
      write = save && !draft.volatile;
    let lapRecords = [...this.#laps];
    for (const row of stage?.snapshot.summary.records ?? []) {
      for (const ep of row.episodes)
        for (const seconds of ep.lapTimes) {
          const position = lapRecords.findIndex(
            (r) => r.contract === ep.contract,
          );
          if (position >= 0 && lapRecords[position].seconds <= seconds)
            continue;
          const record = {
            contract: ep.contract,
            scenario: ep.scenario,
            individual: row.id,
            seconds,
            genome: this.#e!.population[row.slot].genome,
          };
          if (position < 0) lapRecords.push(record);
          else lapRecords[position] = record;
        }
    }
    const makeBoundary = (
      e: Evolution,
      s: Stage | undefined,
      why: string | null,
      history: string[],
      index?: RunIndex,
    ) =>
      boundary(
        e,
        s,
        draft,
        this.#original!,
        { ...counts, activeMs: this.#active() },
        this.#runtime,
        why,
        history,
        index,
        manual,
        lapRecords,
      );
    let saved = write
      ? makeBoundary(
          this.#e!,
          stage,
          reason ?? (proposed?.nextScenarios ? 'segment' : null),
          this.#historyIds,
          this.#index,
        )
      : undefined;
    let objects = saved?.objects ?? [],
      successor: Evolution | undefined;
    if (proposed?.nextScenarios) {
      const old = saved;
      lapRecords = [];
      counts = {
        ...counts,
        segment: counts.segment + 1,
        revision: counts.revision + 1,
        goalStreak: 0,
        previousSegments: [
          ...counts.previousSegments,
          ...(old ? [old.checkpoint.id] : []),
        ],
      };
      draft = {
        ...draft,
        options: {
          ...draft.options,
          segment: counts.segment,
          segmentedIdentity: true,
        },
        scenarios: proposed.nextScenarios,
      };
      const { m, scenarios } = preflight(draft, fingerprint, this.#hardware);
      successor = new Evolution(
        m,
        scenarios,
        fingerprint,
        draft.options,
        undefined,
        draft.weights,
        {
          population: this.#e!.population,
          history: [],
          champion: null,
          generationBest: null,
          adaptive: null,
        },
      );
      if (old) {
        saved = makeBoundary(successor, undefined, null, [], old.index);
        // Both segment boundaries and the authoritative run pointer publish together.
        objects = [
          ...new Map(
            [...objects, ...saved.objects].map((o) => [o.meta.id, o]),
          ).values(),
        ];
      }
    }
    const publish = () => {
      stage?.publish();
      if (successor) this.#plot = new ChartHistory();
      else if (stage) this.#plot.add(stage.snapshot.summary);
      this.#e = successor ?? this.#e;
      this.#laps = lapRecords;
      this.#counts = { ...counts, activeMs: this.#counts.activeMs };
      this.#draft = draft;
      this.#reason = reason;
      if (saved) {
        this.#index = saved.index;
        this.#durable = saved.checkpoint.counters.globalGeneration;
        this.#historyIds = saved.checkpoint.history;
        this.#e!.releaseDurableHistory(this.#historyIds.length);
      }
      this.#pendingSave = undefined;
      this.#error = null;
    };
    if (!write) {
      publish();
      await after();
      return;
    }
    const commit = async () => {
      const started = performance.now();
      await this.#db.commit(queueUpdate ? [...objects, queueUpdate] : objects, {
        replace: [
          'run:' + draft.options.runId,
          ...(queueUpdate ? [queueUpdate.meta.id] : []),
        ],
      });
      publish();
      this.#commits++;
      this.#saveMs += performance.now() - started;
      try {
        const garbage = deletionPreview(await this.#db.list(), []);
        if (garbage.remove.length)
          await this.#db.commit([], { remove: garbage.remove });
      } catch (e) {
        this.#error = 'Speicherbereinigung: ' + String(e);
      }
    };
    try {
      await commit();
    } catch (e) {
      this.#freezeClock();
      this.#phase = 'Recoverable';
      this.#error = String(e);
      this.#pendingSave = async () => {
        this.#startClock();
        try {
          await commit();
        } catch (error) {
          this.#freezeClock();
          throw error;
        }
        this.#phase = 'Running';
        await after();
      };
      this.#emit();
      return;
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
    const end = () => {
      this.#phase = 'Cancelled';
      this.#pendingSave = undefined;
      this.#emit();
    };
    if (!this.#index) {
      end();
      return;
    }
    const saved = boundary(
      this.#e!,
      undefined,
      this.#draft!,
      this.#original!,
      this.#counts,
      this.#runtime,
      reason,
      this.#historyIds,
      this.#index,
      false,
      this.#laps,
      true,
    );
    const commit = async () => {
      await this.#db.commit(saved.objects, {
        replace: ['run:' + saved.index.id],
      });
      this.#index = saved.index;
      this.#historyIds = saved.checkpoint.history;
      this.#durable = this.#counts.globalGeneration;
      end();
    };
    try {
      await commit();
    } catch (error) {
      this.#phase = 'Recoverable';
      this.#error = String(error);
      this.#pendingSave = commit;
      this.#emit();
    }
  }
  display(pick: Pick<Draft, 'rate' | 'mode' | 'profile' | 'custom'>) {
    if (
      !this.#draft ||
      !this.#pool ||
      !['Running', 'Paused', 'Draining', 'Stopping'].includes(this.#phase)
    )
      throw Error('Kein bearbeitbarer Lauf.');
    if (
      Object.keys(pick).some(
        (k) => !['rate', 'mode', 'profile', 'custom'].includes(k),
      )
    )
      throw Error('Nur Anzeige und Rechenprofil sind hier änderbar.');
    const next = { ...this.#draft, ...pick };
    const p = preflight(next, fingerprint, this.#hardware);
    this.#managedEstimate = p.estimated.total;
    this.#draft = next;
    this.#pool.setRate(next.mode === 'live' ? 1 : next.rate);
    this.#pool.resize(p.allocation.workers);
    this.#emit();
  }
  revise(learning: Learning, scenarios?: Draft['scenarios']) {
    if (!this.#draft || !['Running', 'Paused'].includes(this.#phase))
      throw Error('Kein bearbeitbarer Lauf.');
    if (
      learning &&
      Object.keys(learning).some(
        (k) =>
          ![
            'mutation',
            'adaptation',
            'eliteRate',
            'poolFraction',
            'crossProbability',
            'operator',
            'tournament',
          ].includes(k),
      )
    )
      throw Error('Diese Einstellung erfordert einen neuen Lauf.');
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
    if (
      !this.#e ||
      this.#draft?.volatile ||
      !['Running', 'Paused', 'Draining', 'Stopping'].includes(this.#phase)
    )
      throw Error('Keine dauerhafte Speicherung verfügbar.');
    this.#saveRequested = true;
    this.#emit();
  }
  async recover(
    id: string,
    decision?: { sourceStopped?: boolean; additionalActiveMs?: number },
  ) {
    const source = await this.#db.get(id);
    if (!source || source.meta.kind !== 'checkpoint')
      throw Error('Speicherstand fehlt.');
    const header = decode<import('../storage/checkpoint').Checkpoint>(source);
    const row = await this.#db.get('run:' + header.runId);
    const index = row ? decode<RunIndex>(row) : undefined;
    const fork = !index || index.latest !== id || index.terminal;
    if (source.meta.imported && !decision?.sourceStopped)
      throw Error('Zuerst bestätigen, dass der Ursprungslauf angehalten ist.');
    const additional = decision?.additionalActiveMs ?? 0;
    if (
      (header.draft.time && decision?.additionalActiveMs === undefined) ||
      !Number.isFinite(additional) ||
      additional < 0
    )
      throw Error(
        'Für die unbekannte Aktivzeit seit der Sicherung eine konservative Anzahl Sekunden angeben.',
      );
    const plot = new ChartHistory();
    const { cp, evolution, lapRecords } = await restore(
      this.#db,
      id,
      this.#runtime,
      this.#hardware,
      fork ? crypto.randomUUID() : undefined,
      (s) => plot.add(s),
    );
    if (cp.phase === 'terminal')
      throw Error('Terminaler Speicherstand ist abgeschlossen.');
    if (!['Draft', 'Completed', 'Cancelled', 'Faulted'].includes(this.#phase))
      throw Error('Ein Trainingslauf ist aktiv.');
    cp.counters.activeMs += additional;
    let destination = index,
      history = cp.history;
    if (fork) {
      const b = boundary(
        evolution,
        undefined,
        cp.draft,
        cp.original,
        cp.counters,
        this.#runtime,
        null,
        [],
        undefined,
        false,
        lapRecords,
      );
      await this.#db.commit(b.objects);
      destination = b.index;
      history = b.checkpoint.history;
    }
    this.#init(cp.draft);
    this.#original = cp.original;
    this.#e = evolution;
    this.#counts = cp.counters;
    this.#sessionBaseMs = cp.counters.activeMs;
    this.#managedEstimate = preflight(
      cp.draft,
      fingerprint,
      this.#hardware,
    ).estimated.total;
    this.#durable = cp.counters.globalGeneration;
    this.#index = destination;
    this.#historyIds = history;
    this.#plot = plot;
    evolution.releaseDurableHistory(history.length);
    this.#laps = lapRecords;
    this.#learning = cp.counters.pendingLearning;
    this.#newScenarios = cp.counters.pendingScenario;
    this.#makePool(
      preflight(cp.draft, fingerprint, this.#hardware).allocation.workers,
    );
    this.#phase = 'Paused';
    this.#emit();
  }
}
