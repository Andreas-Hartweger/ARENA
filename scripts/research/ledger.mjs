import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { caps, trainingCaps, hashJSON } from './manifest.mjs';

const units = ['ms', 'ticks', 'episodes'];
const zero = { ms: 0, ticks: 0, episodes: 0 };
function amounts(value) {
  if (
    !value ||
    Object.keys(value).some((k) => !units.includes(k)) ||
    !units.every((k) => Number.isSafeInteger(value[k]) && value[k] >= 0)
  )
    throw Error('Invalid budget amounts');
  return value;
}
export function campaign(id, matrixHash, sha, machines) {
  if (
    !/^[\w-]{1,80}$/.test(id) ||
    !/^[\da-f]{64}$/.test(matrixHash) ||
    !/^[\da-f]{40}$/.test(sha) ||
    !machines.length ||
    new Set(machines.map((m) => m.id)).size !== machines.length
  )
    throw Error('Invalid campaign identity');
  for (const m of machines) {
    if (!/^[\w.-]{1,100}$/.test(m.id)) throw Error('Invalid machine ID');
    amounts(m.total);
    amounts(m.training);
    if (units.some((k) => m.training[k] > m.total[k]))
      throw Error('Machine training cap exceeds total');
  }
  for (const [name, limit] of [
    ['total', caps],
    ['training', trainingCaps],
  ]) {
    if (
      units.some((k) => machines.reduce((n, m) => n + m[name][k], 0) > limit[k])
    )
      throw Error('Global quota exceeded');
  }
  return {
    version: 1,
    id,
    matrixHash,
    sha,
    machines: globalThis.structuredClone(machines),
  };
}

// One local database per assigned machine. State changes and the audit event share a transaction.
export class ResearchLedger {
  constructor(path, definition, machineId) {
    const spec = campaign(
      definition.id,
      definition.matrixHash,
      definition.sha,
      definition.machines,
    );
    this.machine = spec.machines.find((m) => m.id === machineId);
    if (!this.machine) throw Error('Machine has no assigned quota');
    this.definition = spec;
    this.db = new DatabaseSync(path);
    try {
      this.db
        .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
        CREATE TABLE IF NOT EXISTS manifests (id TEXT PRIMARY KEY, hash TEXT NOT NULL, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ownership (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, lease TEXT NOT NULL, scope TEXT NOT NULL, context TEXT NOT NULL, ms INTEGER NOT NULL,ticks INTEGER NOT NULL,episodes INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS charges (scope TEXT PRIMARY KEY, ms INTEGER NOT NULL,ticks INTEGER NOT NULL,episodes INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, eventId TEXT NOT NULL UNIQUE, lease TEXT NOT NULL, state TEXT NOT NULL, scope TEXT NOT NULL, context TEXT NOT NULL, delta TEXT NOT NULL, reserved TEXT NOT NULL, stamp INTEGER NOT NULL);
        INSERT OR IGNORE INTO charges VALUES ('research',0,0,0),('validation',0,0,0);`);
      this.transaction(() => this.manifest('assignment', { spec, machineId }));
    } catch (e) {
      this.db.close();
      throw e;
    }
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.db.exec('COMMIT');
      return value;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  manifest(id, data) {
    const hash = hashJSON(data);
    this.db
      .prepare('INSERT OR IGNORE INTO manifests VALUES (?,?,?)')
      .run(id, hash, JSON.stringify(data));
    const old = this.db
      .prepare('SELECT hash,data FROM manifests WHERE id=?')
      .get(id);
    if (old.hash !== hash || hashJSON(JSON.parse(old.data)) !== hash)
      throw Error('Immutable manifest conflict: ' + id);
    return hash;
  }
  claim({ recover = false } = {}) {
    const token = randomUUID();
    this.transaction(() => {
      const owner = this.db
        .prepare('SELECT token FROM ownership WHERE id=1')
        .get();
      if (owner && !recover) throw Error('Machine already leased');
      if (owner) {
        for (const r of this.db
          .prepare('SELECT * FROM reservations WHERE lease=?')
          .all(owner.token))
          this.closeReservation(
            owner.token,
            r.id,
            { ms: r.ms, ticks: r.ticks, episodes: 0 },
            'fenced-uncertain',
          );
        this.event(owner.token, 'fenced', 'research', {}, zero, zero);
      }
      this.db
        .prepare('INSERT OR REPLACE INTO ownership VALUES (1,?)')
        .run(token);
      this.event(token, 'acquired', 'research', {}, zero, zero);
    });
    this.token = token;
    return token;
  }
  assertLease() {
    if (
      !this.token ||
      this.db.prepare('SELECT token FROM ownership WHERE id=1').get()?.token !==
        this.token
    )
      throw Error('Stale machine lease');
  }
  event(lease, state, scope, context, delta, reserved) {
    this.db
      .prepare(
        'INSERT INTO events(eventId,lease,state,scope,context,delta,reserved,stamp) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run(
        randomUUID(),
        lease,
        state,
        scope,
        JSON.stringify(context),
        JSON.stringify(delta),
        JSON.stringify(reserved),
        Date.now(),
      );
  }
  usage(scope) {
    const filter = scope ? ' WHERE scope=?' : '';
    const args = scope ? [scope] : [];
    const sum = (table) =>
      this.db
        .prepare(
          'SELECT COALESCE(SUM(ms),0) ms,COALESCE(SUM(ticks),0) ticks,COALESCE(SUM(episodes),0) episodes FROM ' +
            table +
            filter,
        )
        .get(...args);
    return { charged: sum('charges'), reserved: sum('reservations') };
  }
  reserve(id, scope, context, limit) {
    amounts(limit);
    if (!id || !['research', 'validation'].includes(scope))
      throw Error('Invalid reservation');
    this.transaction(() => {
      this.assertLease();
      for (const [filter, cap] of [
        [undefined, this.machine.total],
        ...(scope === 'research' ? [['research', this.machine.training]] : []),
      ]) {
        const { charged, reserved } = this.usage(filter);
        if (units.some((k) => limit[k] > cap[k] - charged[k] - reserved[k]))
          throw Error('Budget exhausted: ' + scope);
      }
      if (
        this.db
          .prepare('SELECT 1 FROM manifests WHERE id=?')
          .get('reservation:' + id)
      )
        throw Error('Reservation identity already used');
      this.manifest('reservation:' + id, { context, scope, lease: this.token });
      this.db
        .prepare('INSERT INTO reservations VALUES (?,?,?,?,?,?,?)')
        .run(
          id,
          this.token,
          scope,
          JSON.stringify(context),
          limit.ms,
          limit.ticks,
          limit.episodes,
        );
      this.event(
        this.token,
        'reserved',
        scope,
        { ...context, reservation: id },
        zero,
        limit,
      );
    });
  }
  closeReservation(token, id, actual, state) {
    amounts(actual);
    const r = this.db
      .prepare('SELECT * FROM reservations WHERE id=? AND lease=?')
      .get(id, token);
    if (!r || units.some((k) => actual[k] > r[k]))
      throw Error('Missing reservation or consumption beyond reservation');
    this.db
      .prepare(
        'UPDATE charges SET ms=ms+?,ticks=ticks+?,episodes=episodes+? WHERE scope=?',
      )
      .run(actual.ms, actual.ticks, actual.episodes, r.scope);
    this.db.prepare('DELETE FROM reservations WHERE id=?').run(id);
    this.event(
      token,
      state,
      r.scope,
      { ...JSON.parse(r.context), reservation: id },
      actual,
      zero,
    );
  }
  settle(id, actual, state = 'completed') {
    this.transaction(() => {
      this.assertLease();
      this.closeReservation(this.token, id, actual, state);
    });
  }
  release() {
    this.transaction(() => {
      this.assertLease();
      if (
        this.db
          .prepare('SELECT 1 FROM reservations WHERE lease=?')
          .get(this.token)
      )
        throw Error('Active reservations');
      this.event(this.token, 'released', 'research', {}, zero, zero);
      this.db.prepare('DELETE FROM ownership WHERE id=1').run();
    });
    this.token = undefined;
  }
  close() {
    this.db.close();
  }
}
