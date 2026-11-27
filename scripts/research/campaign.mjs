import {
  existsSync,
  readFileSync,
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync,
  fsyncSync,
  linkSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { caps, trainingCaps, matrixHash, sha } from './manifest.mjs';
import { ResearchLedger, campaign } from './ledger.mjs';
import { environment } from '../evolution-runtime.mjs';

export function publish(path, bytes) {
  const tmp = path + '.' + randomUUID() + '.tmp';
  const fd = openSync(tmp, 'wx');
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  try {
    linkSync(tmp, path);
  } catch (e) {
    if (e.code !== 'EEXIST' || sha(readFileSync(path)) !== sha(bytes)) throw e;
  } finally {
    unlinkSync(tmp);
  }
}
export function publishJSON(path, data) {
  publish(path, Buffer.from(JSON.stringify(data, null, 2) + '\n'));
}
export function openCampaign(
  directory,
  { init = false, recover = false, allocationFile } = {},
) {
  if (!directory) throw Error('Expected evidence directory');
  const json = join(directory, 'campaign.json'),
    state = join(directory, 'research.sqlite'),
    machine = hostname();
  if (init) {
    mkdirSync(directory, { recursive: true });
    if (existsSync(json) || existsSync(state))
      throw Error('Campaign already initialized');
    const runtime = environment();
    if (runtime.sourceDiff)
      throw Error('Commit research implementation before dispatch');
    const allocation = allocationFile
      ? JSON.parse(readFileSync(allocationFile, 'utf8'))
      : [{ id: machine, total: caps, training: trainingCaps }];
    const definition = campaign(
      'ARENA-02D',
      matrixHash,
      runtime.sha,
      allocation,
    );
    if (!definition.machines.some((m) => m.id === machine))
      throw Error('This host has no static quota');
    publishJSON(json, {
      version: 1,
      definition,
      runtime,
      started: new Date().toISOString(),
    });
  } else if (!existsSync(state)) throw Error('Campaign database missing');
  const header = JSON.parse(readFileSync(json, 'utf8'));
  if (header.definition.matrixHash !== matrixHash)
    throw Error('Changed matrix');
  const ledger = new ResearchLedger(state, header.definition, machine);
  try {
    ledger.claim({ recover });
  } catch (e) {
    ledger.close();
    throw e;
  }
  return ledger;
}

// Reserve an upper bound before work, including checkpoint, archive I/O and cleanup.
// Regular pulses create measured, durable intervals. The current interval remains reserved after a crash.
export class ActiveTime {
  constructor(
    ledger,
    context,
    scope = 'research',
    sliceMs = 120000,
    start = performance.now(),
  ) {
    this.ledger = ledger;
    this.context = context;
    this.scope = scope;
    this.sliceMs = sliceMs;
    this.start = start;
    this.wall = Date.now() - (performance.now() - start);
    this.arm();
  }
  arm() {
    this.id = 'time:' + randomUUID();
    const { charged, reserved } = this.ledger.usage(),
      local = this.ledger.machine;
    let available = local.total.ms - charged.ms - reserved.ms;
    if (this.scope === 'research') {
      const used = this.ledger.usage('research');
      available = Math.min(
        available,
        local.training.ms - used.charged.ms - used.reserved.ms,
      );
    }
    this.limit = Math.min(this.sliceMs, available);
    if (this.limit < 5000)
      throw Error('Time budget exhausted before safe dispatch');
    this.ledger.reserve(this.id, this.scope, this.context, {
      ms: this.limit,
      ticks: 0,
      episodes: 0,
    });
  }
  elapsed() {
    return Math.ceil(
      Math.max(performance.now() - this.start, Date.now() - this.wall),
    );
  }
  pulse() {
    if (this.elapsed() < this.limit / 2) return;
    const mono = performance.now(),
      wall = Date.now();
    this.finish();
    this.start = mono;
    this.wall = wall;
    this.arm();
  }
  finish() {
    if (!this.id) return;
    const elapsed = this.elapsed(),
      ms = Math.min(this.limit, elapsed),
      reservation = this.id;
    this.ledger.transaction(() => {
      this.ledger.assertLease();
      this.ledger.closeReservation(
        this.ledger.token,
        reservation,
        { ms, ticks: 0, episodes: 0 },
        elapsed > this.limit ? 'clock-uncertain' : 'elapsed',
      );
      if (elapsed > this.limit) {
        this.ledger.manifest('clock-hold', {
          reservation,
          observedElapsedMs: elapsed,
          reservedMs: ms,
          context: this.context,
        });
      }
      const usage = this.ledger.usage();
      for (const hours of [12, 24, 48]) {
        const id = 'report-hour-' + hours;
        if (
          usage.charged.ms >= hours * 3600000 &&
          !this.ledger.db.prepare('SELECT 1 FROM manifests WHERE id=?').get(id)
        ) {
          const experiments = this.ledger.db
            .prepare("SELECT id FROM manifests WHERE id LIKE 'experiment:%'")
            .all();
          this.ledger.manifest(id, {
            hours,
            stamp: new Date().toISOString(),
            context: this.context,
            usage,
            experiments: experiments.map((e) => e.id),
          });
        }
      }
    });
    this.id = undefined;
    if (elapsed > this.limit)
      throw Error(
        'Clock discontinuity; campaign dispatch suspended for reconciliation',
      );
  }
}
export function parseFlags() {
  const place = process.argv.indexOf('--allocation');
  if (
    place >= 0 &&
    (!process.argv[place + 1] || !process.argv.includes('--init'))
  )
    throw Error('Expected a static allocation file at campaign initialization');
  return {
    init: process.argv.includes('--init'),
    recover: process.argv.includes('--recover'),
    allocationFile: place >= 0 ? process.argv[place + 1] : undefined,
  };
}
