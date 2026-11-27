import type { LabCommand, LabEvent, Envelope } from '../runtime/labProtocol';
import type { RunState } from '../runtime/controller';
export class LabClient {
  readonly #worker: Worker;
  #seq = 0;
  #ready = false;
  #outbox: Envelope[] = [];
  #state?: RunState;
  #failure?: Error;
  #pending = new Map<
    string,
    { resolve: (x: unknown) => void; reject: (e: Error) => void }
  >();
  readonly #listeners = new Set<(e: LabEvent) => void>();
  constructor() {
    this.#worker = new Worker(
      new URL('../runtime/lab.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.#worker.onerror = (e) => {
      this.#failure = Error(
        e.message || 'Coordinator Worker konnte nicht gestartet werden.',
      );
      for (const p of this.#pending.values()) p.reject(this.#failure);
      this.#pending.clear();
    };
    this.#worker.onmessage = (message: MessageEvent<LabEvent>) => {
      const e = message.data;
      if (e.type === 'ready') {
        this.#ready = true;
        for (const msg of this.#outbox) this.#worker.postMessage(msg);
        this.#outbox = [];
        return;
      }
      if (e.type === 'ack') {
        const p = this.#pending.get(e.id);
        if (!p) return;
        this.#pending.delete(e.id);
        if (e.ok) p.resolve(e.value);
        else p.reject(Error(e.error));
        return;
      }
      if (e.type === 'state') this.#state = e.state;
      for (const fn of this.#listeners) fn(e);
    };
  }
  get state() {
    return this.#state;
  }
  listen(fn: (e: LabEvent) => void) {
    this.#listeners.add(fn);
    return () => {
      this.#listeners.delete(fn);
    };
  }
  call<T = void>(command: LabCommand): Promise<T> {
    if (this.#failure) return Promise.reject(this.#failure);
    const id = crypto.randomUUID(),
      msg: Envelope = {
        version: 1,
        id,
        seq: ++this.#seq,
        session: this.#state?.sessionId ?? '',
        command,
      };
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve: (x) => resolve(x as T), reject });
      try {
        if (this.#ready) this.#worker.postMessage(msg);
        else this.#outbox.push(msg);
      } catch (e) {
        this.#pending.delete(id);
        reject(e);
      }
    });
  }
  close() {
    this.#worker.terminate();
    this.#failure = Error('Coordinator closed');
    for (const p of this.#pending.values()) p.reject(this.#failure);
    this.#pending.clear();
  }
}
let shared: LabClient | undefined;
export function trainingLab() {
  return (shared ??= new LabClient());
}
