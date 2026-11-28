import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { hashJSON, sha, slots } from './manifest.mjs';
import { campaignStatus } from './status.mjs';

// Read completed inputs on the machine to which the static plan assigned them.
// Only the local ledger owns the new dispatch and its budget.
export function peerInputs(directory, ledger, directories) {
  if (ledger.definition.machines.length === 1 && !directories.length)
    return null;
  const roots = new Map([[ledger.machine.id, directory]]);
  const assignment = hashJSON(ledger.definition);
  for (const root of directories) {
    const peer = campaignStatus(root);
    if (peer.assignment !== assignment || roots.has(peer.machine))
      throw Error('Duplicate or incompatible peer assignment');
    roots.set(peer.machine, root);
  }
  if (!roots.has(ledger.definition.machines[0].id))
    throw Error('Missing coordinator snapshot for the static assignment');
  function source(id) {
    if (ledger.definition.machines.length === 1) return directory;
    const owner = ledger.definition.machines.find((m) =>
      m.experiments.includes(id),
    );
    const root = roots.get(owner?.id);
    if (!root) throw Error('Missing assigned source for ' + id);
    return root;
  }
  function manifest(root, key) {
    if (root === directory) return ledger.readManifest(key);
    const db = new DatabaseSync(join(root, 'research.sqlite'), {
      readOnly: true,
    });
    try {
      const row = db
        .prepare('SELECT hash,data FROM manifests WHERE id=?')
        .get(key);
      if (!row) return undefined;
      const data = JSON.parse(row.data);
      if (hashJSON(data) !== row.hash)
        throw Error('Damaged peer manifest: ' + key);
      return data;
    } finally {
      db.close();
    }
  }
  function common(key) {
    let value;
    for (const root of roots.values()) {
      const input = manifest(root, key);
      if (!input) continue;
      if (value && hashJSON(value) !== hashJSON(input))
        throw Error('Conflicting phase evidence: ' + key);
      value = input;
    }
    return value;
  }
  function baselineCost(measuredMin) {
    if (!(measuredMin > 0)) throw Error('Missing local throughput measurement');
    let ticks = 0,
      episodes = 0;
    const sources = [];
    for (const row of slots.filter((s) => s.ExperimentID.startsWith('B-'))) {
      const id = row.ExperimentID,
        root = source(id);
      const checked = manifest(root, 'baseline-audit:' + id);
      const run = JSON.parse(
        readFileSync(join(root, 'experiments', id, 'experiment.json'), 'utf8'),
      );
      const entry = manifest(root, 'experiment:' + id);
      if (
        !entry ||
        entry.definition?.experimentId !== id ||
        entry.definition.campaignId !== ledger.definition.id ||
        hashJSON(run.entry) !== hashJSON(entry) ||
        !['completed', 'reused-historical'].includes(run.state.toLowerCase())
      )
        throw Error('Baseline differs from its committed experiment: ' + id);
      const bytes = readFileSync(join(root, 'experiments', id, 'audit.json'));
      if (checked?.['audit.json'] !== sha(bytes))
        throw Error('Missing or changed baseline audit: ' + id);
      const audit = JSON.parse(bytes);
      if (
        audit.regularEpisodes !== Number(row.EpisodeBudget) ||
        run.regularEpisodes !== audit.regularEpisodes ||
        !Number.isSafeInteger(audit.ticks) ||
        audit.ticks <= 0
      )
        throw Error('Incomplete baseline measurement: ' + id);
      ticks += audit.ticks;
      episodes += audit.regularEpisodes;
      sources.push({
        id,
        definition: entry.hash,
        audit: checked['audit.json'],
        episodes: audit.regularEpisodes,
        ticks: audit.ticks,
      });
    }
    const perEpisode = ticks / episodes;
    return {
      ticks: perEpisode,
      ms: (perEpisode * 1000) / measuredMin,
      measuredMin,
      sources,
    };
  }
  const hosts = new Map(
    ledger.definition.machines
      .filter((m) => roots.has(m.id))
      .map((m) => [m.id, roots.get(m.id)]),
  );
  return {
    roots: [...hosts.values()],
    hosts,
    source,
    manifest,
    common,
    baselineCost,
  };
}

// Merge the recorded settlement times; an overlapping interval on two machines counts twice.
export function combinedMilestone(peers, thresholdMs) {
  if (!Number.isSafeInteger(thresholdMs) || thresholdMs <= 0)
    throw Error('Invalid time threshold');
  const readers = new Map();
  try {
    const receipts = [];
    for (const [machine, root] of peers.hosts) {
      const db = new DatabaseSync(join(root, 'research.sqlite'), {
        readOnly: true,
      });
      readers.set(machine, db);
      db.exec('BEGIN');
      for (const r of db
        .prepare(
          "SELECT seq,stamp,json_extract(delta,'$.ms') ms,context FROM events WHERE json_extract(delta,'$.ms')>0 ORDER BY seq",
        )
        .iterate())
        receipts.push({ ...r, machine });
    }
    receipts.sort(
      (a, b) =>
        a.stamp - b.stamp ||
        (a.machine < b.machine
          ? -1
          : a.machine > b.machine
            ? 1
            : a.seq - b.seq),
    );
    let ms = 0;
    const cutoff = receipts.find((r) => (ms += r.ms) >= thresholdMs);
    if (!cutoff)
      throw Error('Combined active-time threshold has not been reached');
    const machines = [];
    for (const [machine, db] of readers) {
      const sameStampCutoff =
        machine === cutoff.machine
          ? cutoff.seq
          : machine < cutoff.machine
            ? Number.MAX_SAFE_INTEGER
            : -1;
      const { seq } = db
        .prepare(
          'SELECT COALESCE(MAX(seq),0) seq FROM events WHERE stamp<? OR (stamp=? AND seq<=?)',
        )
        .get(cutoff.stamp, cutoff.stamp, sameStampCutoff);
      const charge = db
        .prepare(
          "SELECT scope, SUM(json_extract(delta,'$.ms')) ms, SUM(json_extract(delta,'$.ticks')) ticks, SUM(json_extract(delta,'$.episodes')) episodes FROM events WHERE seq<=? GROUP BY scope ORDER BY scope",
        )
        .all(seq);
      const generations = db
        .prepare(
          "SELECT json_extract(context,'$.experimentId') id, count(*) generations, sum(json_extract(delta,'$.episodes')) episodes FROM events WHERE state='generation-committed' AND seq<=? GROUP BY id",
        )
        .all(seq);
      machines.push({ machine, seq, charge, generations });
    }
    const total = { ms: 0, ticks: 0, episodes: 0 };
    for (const m of machines)
      for (const charge of m.charge)
        for (const k of Object.keys(total)) total[k] += charge[k];
    if (total.ms !== ms)
      throw Error('Inconsistent event timestamps at the combined boundary');
    return {
      thresholdMs,
      stamp: new Date(cutoff.stamp).toISOString(),
      machine: cutoff.machine,
      cursor: JSON.parse(cutoff.context),
      total,
      machines,
    };
  } finally {
    for (const db of readers.values()) db.close();
  }
}
