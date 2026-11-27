import '../evolution-runtime.mjs';
import { Buffer } from 'node:buffer';
const { validateObject, defaultDiskBudget } =
  await import('../../src/storage/objects.ts');

export class NodeStore {
  constructor(ledger, namespace) {
    if (!namespace) throw Error('Missing store namespace');
    this.ledger = ledger;
    this.namespace = namespace;
    this.db = ledger.db;
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS objects (space TEXT NOT NULL,id TEXT NOT NULL,meta TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(space,id));
      CREATE TABLE IF NOT EXISTS store_state (space TEXT PRIMARY KEY,revision INTEGER NOT NULL,total INTEGER NOT NULL,budget INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS object_stage (space TEXT NOT NULL,lease TEXT NOT NULL,batch TEXT NOT NULL,id TEXT NOT NULL,meta TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(space,lease,batch,id));`);
    ledger.transaction(() => {
      ledger.assertLease();
      this.db
        .prepare('INSERT OR IGNORE INTO store_state VALUES (?,0,0,?)')
        .run(namespace, defaultDiskBudget);
      this.db
        .prepare('DELETE FROM object_stage WHERE space=? AND lease<>?')
        .run(namespace, ledger.token);
    });
  }
  status() {
    return this.db
      .prepare('SELECT revision,total,budget FROM store_state WHERE space=?')
      .get(this.namespace);
  }
  list() {
    return this.db
      .prepare('SELECT meta FROM objects WHERE space=?')
      .all(this.namespace)
      .map((x) => JSON.parse(x.meta));
  }
  get(id) {
    const row = this.db
      .prepare('SELECT meta,bytes FROM objects WHERE space=? AND id=?')
      .get(this.namespace, id);
    if (row) return { meta: JSON.parse(row.meta), bytes: row.bytes };
  }
  stage(batch, value) {
    validateObject(value);
    this.ledger.transaction(() => {
      this.ledger.assertLease();
      this.db
        .prepare('INSERT INTO object_stage VALUES (?,?,?,?,?,?)')
        .run(
          this.namespace,
          this.ledger.token,
          batch,
          value.meta.id,
          JSON.stringify(value.meta),
          value.bytes,
        );
    });
  }
  discardStage(batch) {
    this.ledger.transaction(() => {
      this.ledger.assertLease();
      this.db
        .prepare(
          'DELETE FROM object_stage WHERE space=? AND lease=? AND batch=?',
        )
        .run(this.namespace, this.ledger.token, batch);
    });
  }
  commit(values, options = {}, batch) {
    this.afterCommit = undefined;
    const revision = this.ledger.transaction(() => {
      this.ledger.assertLease();
      const state = this.status(),
        budget = options.budget ?? state.budget;
      if (
        options.expectedRevision !== undefined &&
        state.revision !== options.expectedRevision
      )
        throw Error('Stale revision');
      const all = new Map(this.list().map((meta) => [meta.id, meta]));
      const ids = new Set(),
        mutable = new Set(options.replace),
        remove = new Set(options.remove);
      const save = this.db.prepare(
        'INSERT OR REPLACE INTO objects VALUES (?,?,?,?)',
      );
      let total = state.total;
      const put = (value) => {
        validateObject(value);
        const { meta: m, bytes } = value;
        if (ids.has(m.id) || remove.has(m.id))
          throw Error('Duplicate or conflicting object');
        ids.add(m.id);
        const before = all.get(m.id);
        if (before && !mutable.has(m.id)) {
          if (
            before.kind !== m.kind ||
            JSON.stringify(before.refs) !== JSON.stringify(m.refs) ||
            before.checksum !== m.checksum ||
            !Buffer.from(this.get(m.id).bytes).equals(bytes)
          )
            throw Error('Immutable ID conflict');
          return;
        }
        if (
          before &&
          (before.protected ||
            before.kind !== m.kind ||
            ![
              'run',
              'profile',
              'queue',
              'template',
              'settings',
              'pin',
              'series',
            ].includes(m.kind))
        )
          throw Error('Immutable object');
        total += m.size - (before?.size ?? 0);
        all.set(m.id, m);
        save.run(this.namespace, m.id, JSON.stringify(m), bytes);
      };
      values.forEach(put);
      if (batch) {
        const get = this.db.prepare(
          'SELECT meta,bytes FROM object_stage WHERE space=? AND lease=? AND batch=? AND id=?',
        );
        for (const id of batch.keys) {
          const row = get.get(this.namespace, this.ledger.token, batch.id, id);
          if (!row) throw Error('Missing staged object');
          put({ meta: JSON.parse(row.meta), bytes: row.bytes });
        }
      }
      for (const id of remove) {
        const old = all.get(id);
        if (!old || old.protected) throw Error('Protected or missing deletion');
        total -= old.size;
        all.delete(id);
        this.db
          .prepare('DELETE FROM objects WHERE space=? AND id=?')
          .run(this.namespace, id);
      }
      if ([...all.values()].some((m) => m.refs.some((id) => !all.has(id))))
        throw Error('Missing referenced object');
      if (
        !Number.isSafeInteger(budget) ||
        budget < 1 ||
        budget > defaultDiskBudget ||
        total > budget
      )
        throw Error('Managed storage budget exceeded');
      this.db
        .prepare(
          'UPDATE store_state SET revision=revision+1,total=?,budget=? WHERE space=?',
        )
        .run(total, budget, this.namespace);
      this.onCommit?.(values, state.revision + 1);
      return state.revision + 1;
    });
    this.afterCommit?.();
    return revision;
  }
}
