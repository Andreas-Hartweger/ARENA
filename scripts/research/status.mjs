import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { slots, sha } from './manifest.mjs';
import { publishJSON } from './campaign.mjs';
export function campaignStatus(dir) {
  const db = new DatabaseSync(join(dir, 'research.sqlite'), { readOnly: true });
  try {
    db.exec('BEGIN');
    const assigned = JSON.parse(
      readFileSync(join(dir, 'campaign.json'), 'utf8'),
    );
    const charge = db.prepare('SELECT * FROM charges').all();
    const active = db
      .prepare(
        'SELECT scope,sum(ms) ms,sum(ticks) ticks,sum(episodes) episodes FROM reservations GROUP BY scope',
      )
      .all();
    const chunks = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='chunks'",
      )
      .get()
      ? db
          .prepare(
            'SELECT experiment,count(*) generations FROM chunks GROUP BY experiment',
          )
          .all()
      : [];
    const definitions = new Set(
      db
        .prepare("SELECT id FROM manifests WHERE id LIKE 'experiment:%'")
        .all()
        .map((r) => r.id.slice(11)),
    );
    const deferred = new Set(
      db
        .prepare(
          "SELECT DISTINCT json_extract(context,'$.experimentId') id FROM events WHERE state='deferred'",
        )
        .all()
        .map((r) => r.id),
    );
    const stops = new Map();
    for (const file of readdirSync(dir)
      .filter((name) => /^progress-[\w]+-[\dTZ.-]+\.json$/.test(name))
      .sort()) {
      const { digest, usage, ...progress } = JSON.parse(
        readFileSync(join(dir, file), 'utf8'),
      );
      if (!usage || !digest || sha(JSON.stringify(progress)) !== digest)
        throw Error('Damaged phase report');
      for (const r of progress.deferred) deferred.add(r.id);
      if (progress.stopped) stops.set(progress.stopped.id, progress.stopped);
    }
    const extras = [...definitions]
      .filter((id) => id.startsWith('X-'))
      .map((ExperimentID) => ({ ExperimentID, Phase: 'Interaction' }));
    const slotsWithStatus = [...slots, ...extras].map((s) => {
      const id = s.ExperimentID,
        path = join(dir, 'experiments', id, 'experiment.json');
      if (existsSync(path)) {
        const r = JSON.parse(readFileSync(path, 'utf8'));
        return {
          id,
          phase: s.Phase,
          state: r.state.toLowerCase(),
          outcome: r.outcome,
          episodes: r.regularEpisodes,
          generations: r.completed,
        };
      }
      const started = definitions.has(id);
      const stop = stops.get(id);
      const reserved =
        started &&
        db
          .prepare(
            "SELECT 1 FROM reservations WHERE json_extract(context,'$.experimentId')=? LIMIT 1",
          )
          .get(id);
      return {
        id,
        phase: s.Phase,
        state: reserved
          ? 'running'
          : stop
            ? /budget exhausted/i.test(stop.error ?? '')
              ? 'stopped-budget'
              : 'failed'
            : started
              ? 'started-unpublished'
              : deferred.has(id)
                ? 'deferred'
                : 'not-started',
        outcome: 'not-evaluated',
        ...(stop ? { stop } : {}),
        episodes: null,
        generations: chunks.find((r) => r.experiment === id)?.generations ?? 0,
      };
    });
    const milestones = db
      .prepare(
        "SELECT id,data FROM manifests WHERE id LIKE 'report-hour-%' ORDER BY id",
      )
      .all()
      .map((r) => JSON.parse(r.data));
    const state = {};
    for (const x of slotsWithStatus) state[x.state] = (state[x.state] ?? 0) + 1;
    return {
      schema: 'arena.campaign-status.v1',
      at: new Date().toISOString(),
      campaign: assigned.definition.id,
      quota: assigned.definition.machines,
      charge,
      active,
      state,
      milestones,
      slots: slotsWithStatus,
    };
  } finally {
    db.close();
  }
}
export function requireSelectionPredecessors(directory, target, ledger) {
  const prefixes = {
    confirmation: ['B-', 'S'],
    long: ['B-', 'S', 'C'],
    freeze: ['B-', 'S', 'C', 'L'],
  }[target];
  if (!prefixes) throw Error('Unknown selection phase');
  const status = campaignStatus(directory);
  for (const prefix of prefixes) {
    const records = status.slots.filter((r) => r.id.startsWith(prefix));
    const stopped = records.some((r) => r.state === 'stopped-budget');
    for (const r of records) {
      if (r.state === 'completed' || r.state === 'reused-historical') {
        const audit = ledger.readManifest(
          (prefix === 'B-' ? 'baseline-audit:' : 'experiment-audit:') + r.id,
        );
        if (!audit) throw Error('Missing completed experiment audit: ' + r.id);
      } else if (
        prefix === 'B-' ||
        !(
          r.state === 'deferred' ||
          r.state === 'stopped-budget' ||
          (stopped && r.state === 'not-started')
        )
      ) {
        throw Error(
          'Selection requires a completed or budget-accounted predecessor: ' +
            r.id +
            ' (' +
            r.state +
            ')',
        );
      }
    }
  }
  return status;
}

// Keep assigned nominal work ahead of a discretionary interaction.
export function interactionReserve(ledger, status) {
  const confirmation = ledger.readManifest('selection:confirmation'),
    long = ledger.readManifest('selection:long');
  const states = new Map(status.slots.map((r) => [r.id, r.state]));
  let episodes = 0,
    devModels = 1;
  for (const slot of slots) {
    const id = slot.ExperimentID;
    if (ledger.machine.experiments && !ledger.machine.experiments.includes(id))
      continue;
    const state = states.get(id);
    if (id.startsWith('S') && !confirmation && state === 'completed')
      devModels++;
    if (
      !['C', 'L'].includes(id[0]) ||
      ['deferred', 'stopped-budget', 'failed'].includes(state)
    )
      continue;
    const selection = id.startsWith('C') ? confirmation : long;
    const ordinal = /^Finalist (\d+)$/.exec(slot.ConfigID);
    if (selection && ordinal && Number(ordinal[1]) > selection.configs.length)
      continue;
    if (state !== 'completed') {
      const committed = ledger.db
        .prepare(
          "SELECT COALESCE(SUM(json_extract(summary,'$.regularEpisodes')),0) n FROM chunks WHERE experiment=?",
        )
        .get(id).n;
      episodes += Math.max(0, Number(slot.EpisodeBudget) - committed);
    }
    if (id.startsWith('L') || !long) devModels++;
  }
  devModels += status.slots.filter(
    (r) => r.id.startsWith('X-') && r.state === 'completed',
  ).length;
  return { episodes, developmentCases: 40 * devModels };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/research/status.mjs')) {
  const r = campaignStatus(process.argv[2]);
  if (process.argv[3]) publishJSON(process.argv[3], r);
  process.stdout.write(
    JSON.stringify({
      at: r.at,
      state: r.state,
      charge: r.charge,
      active: r.active,
      milestones: r.milestones.map((m) => m.hours),
    }) + '\n',
  );
}
