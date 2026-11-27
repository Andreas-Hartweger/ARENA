import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { slots } from './manifest.mjs';
import { publishJSON } from './campaign.mjs';
export function campaignStatus(dir) {
  const db = new DatabaseSync(join(dir, 'research.sqlite'), { readOnly: true });
  try {
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
    const slotsWithStatus = slots.map((s) => {
      const id = s.ExperimentID,
        path = join(dir, 'experiments', id, 'experiment.json');
      if (existsSync(path)) {
        const r = JSON.parse(readFileSync(path, 'utf8'));
        return {
          id,
          phase: s.Phase,
          state: r.state,
          outcome: r.outcome,
          episodes: r.regularEpisodes,
          generations: r.completed,
        };
      }
      const started = definitions.has(id);
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
          : started
            ? 'started-unpublished'
            : 'not-started',
        outcome: 'not-evaluated',
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
