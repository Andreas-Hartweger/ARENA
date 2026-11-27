import type { EvaluationRow, Evolution } from '../training/evolution';
import type { ScenarioOptions } from '../training/episode';
import {
  sameAssignment,
  validRate,
  type ComputePort,
  type Job,
  type Rate,
  type WorkerEvent,
  type JobKey,
} from './compute';

interface Lane {
  port: ComputePort;
  ready: boolean;
  paused: boolean;
  job?: JobKey;
}
interface Work {
  evolution: Evolution;
  scenarios: readonly ScenarioOptions[];
  total: number;
  cursor: number;
  retries: number[];
  rows: Map<number, EvaluationRow>;
  receipts: Map<string, Extract<WorkerEvent, { type: 'result' }>>;
  resolve: (r: EvaluationRow[]) => void;
  reject: (e: Error) => void;
}
export interface PoolMonitor {
  transferredBytes: number;
  receivedMessages: number;
  evaluated: number;
  ticks: number;
  computeMs: number;
  attempts: number;
  busy: number;
  workers: number;
}
export class WorkerPool {
  readonly #factory: () => ComputePort;
  readonly #lanes = new Set<Lane>();
  readonly #session: string;
  #work?: Work;
  #serial = 0;
  #limit: number;
  #mode: 'running' | 'pausing' | 'draining' | 'paused' | 'closed' = 'running';
  #rate: Rate = 'max';
  #visible = 0;
  #selected: number | null = null;
  observe(visible: number, slot: number | null) {
    if (
      !Number.isInteger(visible) ||
      visible < 0 ||
      visible > 16 ||
      (slot !== null && (!Number.isInteger(slot) || slot < 0 || slot >= 1024))
    )
      throw Error('Invalid viewer subscription');
    this.#visible = visible;
    this.#selected = slot;
    for (const lane of this.#lanes)
      if (lane.job)
        lane.port.send({
          type: 'observe',
          key: lane.job,
          observation: this.#observation(lane, lane.job.slot),
        });
  }
  #observation(l: Lane, slot: number): Job['observation'] {
    if (!this.#visible) return undefined;
    if (slot === this.#selected) return 'detail';
    return [...this.#lanes].indexOf(l) < this.#visible ? 'pose' : undefined;
  }
  #monitor = {
    evaluated: 0,
    ticks: 0,
    computeMs: 0,
    attempts: 0,
    transferredBytes: 0,
    receivedMessages: 0,
  };
  onProgress?: (event: Extract<WorkerEvent, { type: 'progress' }>) => void;
  onPause?: () => void;
  constructor(factory: () => ComputePort, limit: number, session: string) {
    if (!session || !Number.isInteger(limit) || limit < 1 || limit > 16)
      throw Error('Invalid worker pool');
    this.#factory = factory;
    this.#limit = limit;
    this.#session = session;
  }
  get monitor(): PoolMonitor {
    return {
      ...this.#monitor,
      busy: [...this.#lanes].filter((x) => x.job).length,
      workers: this.#lanes.size,
    };
  }
  get paused() {
    return this.#mode === 'paused';
  }
  get evaluating() {
    return !!this.#work;
  }
  evaluate(evolution: Evolution, scenarios: readonly ScenarioOptions[]) {
    if (
      this.#mode === 'closed' ||
      this.#work ||
      !evolution.population.length ||
      scenarios.length !== evolution.scenarios.length
    )
      throw Error('No available generation');
    return new Promise<EvaluationRow[]>((resolve, reject) => {
      this.#work = {
        evolution,
        scenarios,
        total: evolution.population.length * scenarios.length,
        cursor: 0,
        retries: [],
        rows: new Map(),
        receipts: new Map(),
        resolve,
        reject,
      };
      try {
        this.#schedule();
      } catch (e) {
        this.#fail(e);
      }
    });
  }
  setRate(rate: Rate) {
    if (!validRate(rate)) throw Error('Invalid speed');
    this.#rate = rate;
    for (const l of this.#lanes)
      if (l.job) l.port.send({ type: 'rate', key: l.job, rate });
  }
  resize(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > 16)
      throw Error('Invalid worker count');
    this.#limit = n;
    this.#schedule();
  }
  pause(drain = false) {
    if (this.#mode !== 'running') return;
    this.#mode = drain ? 'draining' : 'pausing';
    if (!drain)
      for (const l of this.#lanes)
        if (l.job) l.port.send({ type: 'pause', key: l.job });
    this.#pauseBoundary();
  }
  #pauseBoundary() {
    if (
      (this.#mode === 'pausing' || this.#mode === 'draining') &&
      [...this.#lanes].every((l) => !l.job || l.paused)
    ) {
      this.#mode = 'paused';
      this.onPause?.();
    }
  }
  resume() {
    if (this.#mode !== 'paused') throw Error('Pause acknowledgement pending');
    this.#mode = 'running';
    for (const l of this.#lanes)
      if (l.job && l.paused) {
        l.paused = false;
        l.port.send({ type: 'resume', key: l.job });
      }
    this.#schedule();
  }
  close() {
    this.#mode = 'closed';
    this.#fail(Error('Pool closed'));
  }
  #fail(error: unknown) {
    const w = this.#work;
    this.#work = undefined;
    for (const l of this.#lanes) {
      this.#lanes.delete(l);
      l.port.close();
    }
    w?.reject(error instanceof Error ? error : Error(String(error)));
  }
  #lost(l: Lane, error: Error) {
    if (!this.#lanes.delete(l)) return;
    l.port.close();
    const key = l.job,
      w = this.#work;
    if (!w) return;
    if (key && (this.#mode === 'paused' || this.#mode === 'pausing')) {
      this.#fail(
        Error('Workerzustand während der Pause verloren: ' + error.message),
      );
      return;
    }
    if (!key || key.attempt === 1) {
      this.#fail(error);
      return;
    }
    w.retries.push(key.slot * w.scenarios.length + key.scenarioIndex);
    this.#pauseBoundary();
    this.#schedule();
  }
  #schedule() {
    const w = this.#work;
    for (const l of this.#lanes)
      if (this.#lanes.size > this.#limit && !l.job) {
        this.#lanes.delete(l);
        l.port.close();
      }
    if (!w || this.#mode !== 'running') return;
    const outstanding = w.total - w.rows.size;
    while (this.#lanes.size < Math.min(this.#limit, outstanding)) {
      const port = this.#factory(),
        l: Lane = { port, ready: false, paused: false };
      this.#lanes.add(l);
      port.listen(
        (msg) => {
          try {
            this.#event(l, msg);
          } catch (e) {
            this.#fail(e);
          }
        },
        (error) => this.#lost(l, error),
      );
    }
    for (const l of this.#lanes)
      if (!l.job && l.ready) {
        const retry = w.retries.shift();
        if (retry === undefined && w.cursor >= w.total) break;
        const index = retry ?? w.cursor++,
          count = w.scenarios.length,
          slot = Math.floor(index / count),
          scenarioIndex = index % count;
        const e = w.evolution,
          member = e.population[slot],
          spec = e.scenarios[scenarioIndex],
          m = member.genome.model;
        const key: JobKey = {
          protocolVersion: 1,
          runId: e.config.runId,
          sessionId: this.#session,
          segmentId: e.config.segment,
          generation: e.nextGeneration,
          slot,
          scenarioIndex,
          jobId: JSON.stringify([
            this.#session,
            e.config.segment,
            e.nextGeneration,
            slot,
            scenarioIndex,
          ]),
          attempt: retry === undefined ? 0 : 1,
          workerLease: String(++this.#serial),
          contractId: spec.key,
          modelKey: m.key,
          genomeHash: member.genome.hash,
          scenarioSeed: spec.seed,
        };
        const parameters = member.genome.parameters(),
          trace = e.config.trace;
        const job: Job = {
          key,
          model: {
            signature: m.signature,
            hidden: m.hidden,
            activation: m.activation,
            weightLimit: m.weightLimit,
            biasLimit: m.biasLimit,
          },
          parameters,
          scenario: { ...w.scenarios[scenarioIndex], seed: spec.seed },
          observation: this.#observation(l, slot),
          trace:
            trace?.generation === key.generation && trace.slot === slot
              ? trace
              : undefined,
        };
        l.job = key;
        l.paused = false;
        this.#monitor.attempts++;
        this.#monitor.transferredBytes += parameters.byteLength;
        l.port.send({ type: 'assign', job, rate: this.#rate }, [
          parameters.buffer as ArrayBuffer,
        ]);
      }
  }
  #event(l: Lane, msg: WorkerEvent) {
    if (!this.#lanes.has(l)) return;
    this.#monitor.receivedMessages++;
    if (msg.type === 'ready') {
      if (msg.protocolVersion !== 1 || l.ready)
        throw Error('Invalid worker handshake');
      l.ready = true;
      this.#schedule();
      return;
    }
    const w = this.#work;
    if (!w || msg.key?.sessionId !== this.#session) return;
    if (!sameAssignment(l.job!, msg.key)) {
      if (
        msg.key.generation < w.evolution.nextGeneration ||
        msg.key.segmentId < w.evolution.config.segment
      )
        return;
      const previous = w.receipts.get(msg.key.workerLease);
      if (
        previous &&
        msg.type === 'result' &&
        sameAssignment(previous.key, msg.key) &&
        JSON.stringify(previous.result) === JSON.stringify(msg.result)
      )
        return;
      throw Error('Unexpected or conflicting worker receipt');
    }
    const key = l.job!;
    switch (msg.type) {
      case 'progress':
        this.onProgress?.(msg);
        l.port.send({ type: 'sampleAck', key });
        return;
      case 'running':
        return;
      case 'paused':
        l.paused = true;
        this.#pauseBoundary();
        return;
      case 'cancelled':
        throw Error('Unexpected worker cancellation');
      case 'fault':
        if (msg.transient) {
          this.#lost(l, Error(msg.message));
          return;
        }
        throw Error(msg.message);
      case 'result': {
        if (!Number.isFinite(msg.elapsedMs) || msg.elapsedMs < 0 || !msg.result)
          throw Error('Invalid worker result');
        if (
          !msg.result.ok &&
          msg.result.reason === 'infrastructureFault' &&
          msg.result.transient
        ) {
          this.#lost(l, Error(msg.result.message));
          return;
        }
        const member = w.evolution.population[key.slot];
        const index = key.slot * w.scenarios.length + key.scenarioIndex;
        if (w.rows.has(index)) throw Error('Duplicate evaluation');
        w.rows.set(index, {
          runId: key.runId,
          segment: key.segmentId,
          generation: key.generation,
          slot: key.slot,
          scenario: key.scenarioIndex,
          contract: key.contractId,
          seed: key.scenarioSeed,
          individual: member.id,
          genome: member.genome,
          attempt: key.attempt,
          result: msg.result,
        });
        w.receipts.set(key.workerLease, msg);
        this.#monitor.ticks += msg.result.tick;
        this.#monitor.evaluated++;
        this.#monitor.computeMs += msg.elapsedMs;
        l.port.send({ type: 'ack', key });
        l.job = undefined;
        l.paused = false;
        this.#pauseBoundary();
        if (w.rows.size === w.total) {
          this.#work = undefined;
          w.resolve(
            Array.from(w.rows.entries())
              .sort(([a], [b]) => a - b)
              .map(([, r]) => r),
          );
        } else this.#schedule();
      }
    }
  }
}
