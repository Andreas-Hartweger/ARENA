import {
  defaultDiskBudget,
  validateObject,
  type ObjectMeta,
  type StoredObject,
  type StorePort,
  type WriteOptions,
} from './objects';

type Lease = {
  owner: string | null;
  epoch: number;
  revision: number;
  total: number;
  budget: number;
};
const initial: Lease = {
  owner: null,
  epoch: 0,
  revision: 0,
  total: 0,
  budget: defaultDiskBudget,
};
function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? Error('Transaction aborted'));
    tx.onerror = () => {};
  });
}
export class TrainingDatabase implements StorePort {
  readonly #db: IDBDatabase;
  readonly #name: string;
  #lease?: { owner: string; epoch: number };
  #unlock?: () => void;
  private constructor(db: IDBDatabase) {
    this.#db = db;
    this.#name = db.name;
    db.onversionchange = () => this.close();
  }
  static async open(name = 'arena-training') {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      for (const store of ['state', 'meta', 'data', 'stage'])
        req.result.createObjectStore(store);
    };
    const db = await request(req);
    return new TrainingDatabase(db);
  }
  async status() {
    const t = this.#db.transaction('state', 'readonly');
    return (
      ((await request(t.objectStore('state').get('writer'))) as
        Lease | undefined) ?? { ...initial }
    );
  }
  async acquire(owner: string) {
    if (!owner || this.#lease)
      throw Error('Writer already acquired or invalid');
    let ownsLock = false;
    if (globalThis.navigator?.locks) {
      let release!: () => void;
      const hold = new Promise<void>((r) => {
        release = r;
      });
      await new Promise<void>((resolve, reject) => {
        void navigator.locks
          .request(
            this.#name + ':writer',
            { mode: 'exclusive', ifAvailable: true },
            async (lock) => {
              if (!lock) {
                reject(Error('Training belongs to another tab'));
                return;
              }
              this.#unlock = release;
              ownsLock = true;
              resolve();
              await hold;
            },
          )
          .catch(reject);
      });
    }
    try {
      const tx = this.#db.transaction('state', 'readwrite'),
        s = tx.objectStore('state'),
        committed = done(tx);
      const current = ((await request(s.get('writer'))) ?? initial) as Lease;
      if (current.owner && !ownsLock)
        throw Error('Previous writer requires coordinated release');
      const next = { ...current, owner, epoch: current.epoch + 1 };
      s.put(next, 'writer');
      await committed;
      this.#lease = { owner, epoch: next.epoch };
      return next;
    } catch (error) {
      this.#unlock?.();
      this.#unlock = undefined;
      throw error;
    }
  }
  async release() {
    const lease = this.#lease;
    if (!lease) return;
    try {
      const tx = this.#db.transaction('state', 'readwrite'),
        s = tx.objectStore('state'),
        committed = done(tx);
      const current = (await request(s.get('writer'))) as Lease;
      if (current?.epoch === lease.epoch && current.owner === lease.owner)
        s.put({ ...current, owner: null }, 'writer');
      await committed;
    } finally {
      this.#lease = undefined;
      this.#unlock?.();
      this.#unlock = undefined;
    }
  }
  close() {
    this.#db.close();
    this.#lease = undefined;
    this.#unlock?.();
    this.#unlock = undefined;
  }
  async list() {
    return (await request(
      this.#db.transaction('meta').objectStore('meta').getAll(),
    )) as ObjectMeta[];
  }
  async get(id: string) {
    const t = this.#db.transaction(['meta', 'data']);
    const [meta, bytes] = await Promise.all([
      request(t.objectStore('meta').get(id)),
      request(t.objectStore('data').get(id)),
    ]);
    if (!meta) return;
    if (!(bytes instanceof Uint8Array)) throw Error('Missing stored payload');
    return { meta: meta as ObjectMeta, bytes };
  }
  async stage(batch: string, value: StoredObject) {
    validateObject(value);
    if (!this.#lease) throw Error('Writer lease required');
    const tx = this.#db.transaction(['stage', 'state'], 'readwrite'),
      complete = done(tx);
    const current = (await request(
      tx.objectStore('state').get('writer'),
    )) as Lease;
    if (
      current.owner !== this.#lease.owner ||
      current.epoch !== this.#lease.epoch
    )
      throw Error('Stale writer');
    tx.objectStore('stage').put(value, [
      this.#lease.epoch,
      batch,
      value.meta.id,
    ]);
    await complete;
  }
  async discardStage(batch: string) {
    if (!this.#lease) return;
    const tx = this.#db.transaction('stage', 'readwrite'),
      complete = done(tx);
    tx.objectStore('stage').delete(
      IDBKeyRange.bound(
        [this.#lease.epoch, batch, ''],
        [this.#lease.epoch, batch, '\uffff'],
      ),
    );
    await complete;
  }
  async commit(
    values: readonly StoredObject[],
    options: WriteOptions = {},
    batch?: { id: string; keys: string[] },
  ) {
    const lease = this.#lease;
    if (!lease) throw Error('Writer lease required');
    const ids = new Set<string>();
    for (const value of values) {
      validateObject(value);
      if (ids.has(value.meta.id)) throw Error('Duplicate staged object');
      ids.add(value.meta.id);
    }
    const remove = new Set(options.remove),
      replace = new Set(options.replace);
    if ([...remove].some((id) => ids.has(id)))
      throw Error('Conflicting operations');
    const tx = this.#db.transaction(
      ['state', 'meta', 'data', 'stage'],
      'readwrite',
      {
        durability: 'strict',
      },
    );
    const complete = done(tx);
    void complete.catch(() => {});
    try {
      const state = tx.objectStore('state'),
        meta = tx.objectStore('meta'),
        data = tx.objectStore('data');
      const current = (await request(state.get('writer'))) as Lease;
      if (
        !current ||
        current.owner !== lease.owner ||
        current.epoch !== lease.epoch ||
        (options.expectedRevision !== undefined &&
          current.revision !== options.expectedRevision)
      )
        throw Error('Stale writer or revision');
      const all = new Map(
        ((await request(meta.getAll())) as ObjectMeta[]).map((r) => [r.id, r]),
      );
      let total = current.total;
      for (let i = 0; i < values.length + (batch?.keys.length ?? 0); i++) {
        const value =
          i < values.length
            ? values[i]
            : ((await request(
                tx
                  .objectStore('stage')
                  .get([
                    lease.epoch,
                    batch!.id,
                    batch!.keys[i - values.length],
                  ]),
              )) as StoredObject | undefined);
        if (!value) throw Error('Staged object missing');
        const { meta: m, bytes } = value;
        const before = all.get(m.id);
        if (before && !replace.has(m.id)) {
          const prior = (await request(data.get(m.id))) as Uint8Array;
          if (
            m.checksum !== before.checksum ||
            m.kind !== before.kind ||
            JSON.stringify(m.refs) !== JSON.stringify(before.refs) ||
            m.size !== before.size ||
            !prior.every((v, i) => v === bytes[i])
          )
            throw Error('Immutable ID conflict ' + m.id);
          continue;
        }
        if (
          before &&
          (before.protected ||
            ![
              'run',
              'profile',
              'queue',
              'template',
              'settings',
              'pin',
              'series',
            ].includes(before.kind) ||
            before.kind !== m.kind)
        )
          throw Error('Immutable object');
        total += m.size - (before?.size ?? 0);
        all.set(m.id, m);
        meta.put(m, m.id);
        data.put(bytes, m.id);
      }
      for (const id of remove) {
        const before = all.get(id);
        if (!before || before.protected)
          throw Error('Protected or missing deletion');
        total -= before.size;
        all.delete(id);
        meta.delete(id);
        data.delete(id);
      }
      for (const row of all.values())
        if (row.refs.some((id) => !all.has(id)))
          throw Error('Referenced object missing');
      const budget = options.budget ?? current.budget;
      if (!Number.isSafeInteger(budget) || budget < 1 || total > budget)
        throw Error('Managed storage budget exceeded');
      const revision = current.revision + 1;
      state.put({ ...current, total, budget, revision }, 'writer');
      await complete;
      return revision;
    } catch (error) {
      try {
        tx.abort();
      } catch {
        /* Transaction already aborted. */
      }
      await complete.catch(() => {});
      throw error;
    }
  }
}
