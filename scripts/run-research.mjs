import process from 'node:process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { availableParallelism } from 'node:os';
import { performance } from 'node:perf_hooks';
import { environment } from './evolution-runtime.mjs';
import {
  openCampaign,
  ActiveTime,
  publishJSON,
  parseFlags,
} from './research/campaign.mjs';
import {
  experiment,
  interaction,
  slots,
  sha,
  hashJSON,
} from './research/manifest.mjs';
import {
  exportExperiment,
  fileHash,
  spaceCheck,
  storageProjection,
} from './research/evidence.mjs';
import { runExperiment } from './research/coordinator.mjs';
import { auditExperiment } from './research/audit-data.mjs';
import { reuseReference } from './research/reference.mjs';

const [directory, request, manifestFile] = process.argv.slice(2),
  runtime = environment();
if (runtime.sourceDiff) throw Error('Research CLI needs committed source');
const supplied =
  request === '--manifest'
    ? JSON.parse(readFileSync(manifestFile, 'utf8'))
    : null;
const id = supplied?.definition?.experimentId;
const proposedInteraction = supplied?.definition?.interaction;
if (
  supplied &&
  (supplied.hash !== hashJSON(supplied.definition) ||
    (!proposedInteraction && !slots.some((row) => row.ExperimentID === id)))
)
  throw Error('Invalid or unknown manifest');
const phase = supplied
  ? {
      B: 'baseline',
      S: 'screen',
      C: 'confirmation',
      L: 'long',
      X: 'interaction',
    }[id[0]]
  : request;
if (
  !['baseline', 'screen', 'confirmation', 'long'].includes(phase) &&
  !(phase === 'interaction' && proposedInteraction)
)
  throw Error('Expected baseline, screen, confirmation or long');
const start = performance.now(),
  ledger = openCampaign(directory, parseFlags()),
  clock = new ActiveTime(
    ledger,
    { experimentId: 'phase-' + phase },
    'research',
    120000,
    start,
  );
try {
  const scale = JSON.parse(
    readFileSync(join(directory, 'worker-scaling.json'), 'utf8'),
  );
  const workers = scale.workers,
    hardware = availableParallelism();
  const prefixes = {
    baseline: 'B-',
    screen: 'S',
    confirmation: 'C',
    long: 'L',
  };
  const extra = proposedInteraction
    ? interaction(ledger.definition.id, proposedInteraction, workers, hardware)
    : undefined;
  if (
    extra &&
    (extra.hash !== supplied.hash || extra.definition.experimentId !== id)
  )
    throw Error('Interaction differs from approved parameters');
  const rows = extra
    ? [
        {
          ExperimentID: id,
          ConfigID: extra.definition.configId,
          Seed: extra.definition.masterSeed,
        },
      ]
    : slots.filter(
        (s) =>
          s.ExperimentID.startsWith(prefixes[phase]) &&
          (!supplied || s.ExperimentID === id),
      );
  if (phase === 'screen') {
    // Bring each family into the paired comparison before deeper exploration.
    const priority = [
      'S01',
      'S03',
      'S15',
      'S19',
      'S22',
      'S26',
      'S28',
      'S33',
      'S35',
      'S42',
      'S45',
      'S46',
      'S47',
      'S31',
      'S06',
      'S12',
      'S36',
    ];
    rows.sort((a, b) => {
      const index = (id) =>
        priority.includes(id)
          ? priority.indexOf(id)
          : priority.length + Number(id.slice(1));
      return (
        index(a.ConfigID) - index(b.ConfigID) || Number(a.Seed) - Number(b.Seed)
      );
    });
  }
  async function auditBaseline(id) {
    if (phase !== 'baseline') return;
    const root = join(directory, 'experiments', id),
      key = 'baseline-audit:' + id,
      cached = ledger.db
        .prepare('SELECT data FROM manifests WHERE id=?')
        .get(key);
    if (cached) {
      const files = JSON.parse(cached.data);
      for (const [name, hash] of Object.entries(files))
        if ((await fileHash(join(root, name))).sha256 !== hash)
          throw Error('Baseline audit changed');
      return;
    }
    const options = { pulse: () => clock.pulse() };
    const audit = await auditExperiment(directory, id, options),
      prefix = await auditExperiment(directory, id, {
        ...options,
        prefix: true,
      });
    const peer = id.replace('random', 'evolution');
    if (peer !== id) {
      const prior = JSON.parse(
        readFileSync(
          join(directory, 'experiments', peer, 'audit.json'),
          'utf8',
        ),
      );
      if (hashJSON(prior.g0) !== hashJSON(audit.g0))
        throw Error('Random search starts from different G0');
    }
    publishJSON(join(directory, 'experiments', id, 'audit.json'), audit);
    publishJSON(join(directory, 'experiments', id, 'prefix-8192.json'), prefix);
    const files = {
      'audit.json': (await fileHash(join(root, 'audit.json'))).sha256,
      'prefix-8192.json': (await fileHash(join(root, 'prefix-8192.json')))
        .sha256,
    };
    ledger.transaction(() => {
      ledger.assertLease();
      ledger.manifest(key, files);
    });
  }
  let selected;
  if (phase === 'confirmation' || phase === 'long') {
    const saved = ledger.db
      .prepare('SELECT data FROM manifests WHERE id=?')
      .get('selection:' + phase);
    if (!saved) throw Error('Phase selection is not frozen');
    selected = JSON.parse(saved.data);
  }
  const progress = {
    phase,
    source: runtime.sha,
    completed: [],
    deferred: [],
    stopped: null,
  };
  for (const row of rows) {
    const id = row.ExperimentID,
      finalist = row.ConfigID.startsWith('Finalist '),
      config = finalist
        ? selected?.configs[Number(row.ConfigID.split(' ')[1]) - 1]
        : undefined;
    if (
      ledger.machine.experiments &&
      !ledger.machine.experiments.includes(id)
    ) {
      if (supplied) throw Error('Experiment assigned to a different machine');
      continue;
    }
    if (finalist && !config) {
      progress.deferred.push({ id, reason: 'outside frozen selection' });
      continue;
    }
    if (progress.deferred.some((r) => r.id === id)) {
      ledger.transaction(() => {
        ledger.assertLease();
        ledger.event(
          ledger.token,
          'deferred',
          'research',
          { experimentId: id, reason: 'paired seed postponed' },
          { ms: 0, ticks: 0, episodes: 0 },
          { ms: 0, ticks: 0, episodes: 0 },
        );
      });
      continue;
    }
    const entry =
        extra ??
        experiment(id, ledger.definition.id, workers, hardware, config),
      published = join(directory, 'experiments', id, 'experiment.json');
    if (supplied && supplied.hash !== entry.hash)
      throw Error(
        'Manifest conflicts with frozen parameters or worker allocation',
      );
    if (existsSync(published)) {
      const saved = JSON.parse(readFileSync(published, 'utf8'));
      if (
        saved.entry.hash !== entry.hash ||
        saved.completed !== entry.definition.draft.options.generations
      )
        throw Error('Conflicting or incomplete experiment');
      for (const [name, asset] of Object.entries(saved.artifacts)) {
        if (
          (await fileHash(join(directory, 'experiments', id, name))).sha256 !==
          asset.sha256
        )
          throw Error('Missing or changed evidence');
      }
      await auditBaseline(id);
      progress.completed.push(id);
      clock.pulse();
      continue;
    }
    clock.pulse();
    spaceCheck(directory, 2 * 1024 ** 3);
    if (id === 'B-evolution-42') {
      await reuseReference(ledger, directory, entry);
      await auditBaseline(id);
      progress.completed.push(id);
      continue;
    }
    const storage = storageProjection(ledger, entry, hardware);
    if (!storage.fits) {
      const reason = {
        id,
        reason: 'D13 storage projection exceeds quota',
        storage,
      };
      progress.deferred.push(reason);
      ledger.transaction(() => {
        ledger.assertLease();
        ledger.event(
          ledger.token,
          'deferred',
          'research',
          { experimentId: id, ...reason },
          { ms: 0, ticks: 0, episodes: 0 },
          { ms: 0, ticks: 0, episodes: 0 },
        );
      });
      continue;
    }
    if (phase !== 'baseline') {
      const used = ledger.usage('research').charged,
        limit = ledger.machine.training;
      // Use SQLite aggregates so a large campaign does not materialize every history row.
      const costs = (pattern) =>
        ledger.db
          .prepare(
            `SELECT SUM(json_extract(summary,'$.durationMs'))/SUM(json_extract(summary,'$.evaluations')) ms,
         1.0*SUM(json_extract(summary,'$.actualOrConservativelyChargedTicks'))/SUM(json_extract(summary,'$.evaluations')) ticks
         FROM chunks WHERE experiment LIKE ?`,
          )
          .get(pattern);
      const base = costs('B-%');
      if (!base.ms || !base.ticks)
        throw Error('Measured baselines required before comparison');
      const existing = costs(entry.definition.configId + '-%');
      const perMs = Math.max(base.ms, existing.ms ?? 0),
        perTick = Math.max(base.ticks, existing.ticks ?? 0);
      const reserveEpisodes =
        phase === 'screen'
          ? 3 * 3 * 25600 + 2 * 2 * 51200
          : phase === 'confirmation'
            ? 2 * 2 * 51200
            : 0;
      const seeds =
        phase === 'screen'
          ? [42, 43]
          : phase === 'confirmation'
            ? [101, 102, 103]
            : [201, 202];
      const proposed =
        entry.definition.episodeBudget *
        (extra ? 1 : seeds.length - seeds.indexOf(Number(row.Seed)));
      const futureDevelopmentCases =
        40 * (phase === 'screen' ? 100 : phase === 'confirmation' ? 18 : 4);
      const needed = {
        ms: Math.ceil(
          proposed * perMs +
            (reserveEpisodes + futureDevelopmentCases) * base.ms,
        ),
        ticks: Math.ceil(
          proposed * perTick +
            (reserveEpisodes + futureDevelopmentCases) * base.ticks,
        ),
        episodes: proposed + reserveEpisodes,
      };
      if (Object.keys(needed).some((k) => used[k] + needed[k] > limit[k])) {
        const reason = {
          id,
          reason: 'remaining paired phase allocation',
          estimated: needed,
          usage: used,
          limit,
        };
        progress.deferred.push(reason);
        ledger.transaction(() => {
          ledger.assertLease();
          ledger.event(
            ledger.token,
            'deferred',
            'research',
            { experimentId: id, ...reason },
            { ms: 0, ticks: 0, episodes: 0 },
            { ms: 0, ticks: 0, episodes: 0 },
          );
        });
        // Later seeds of this group must not run alone just because their forecast is smaller.
        for (const other of rows.filter(
          (r) =>
            r.ConfigID === row.ConfigID && Number(r.Seed) > Number(row.Seed),
        ))
          progress.deferred.push({ ...reason, id: other.ExperimentID });
        continue;
      }
    }
    const expDir = join(directory, 'experiments', id);
    mkdirSync(expDir, { recursive: true });
    publishJSON(join(expDir, 'definition.json'), entry);
    const state = await runExperiment(ledger, entry, clock, { hardware });
    if (state.phase !== 'Completed') {
      progress.stopped = {
        id,
        phase: state.phase,
        error: state.error,
        committed: state.durableGeneration,
      };
      break;
    }
    await exportExperiment(ledger, directory, entry, state, runtime);
    await auditBaseline(id);
    progress.completed.push(id);
    process.stdout.write(
      JSON.stringify({
        id,
        completed: progress.completed.length,
        usage: ledger.usage().charged,
      }) + '\n',
    );
  }
  const stamp = new Date().toISOString().replaceAll(':', '-'),
    bytes = JSON.stringify(progress);
  publishJSON(join(directory, 'progress-' + phase + '-' + stamp + '.json'), {
    ...progress,
    digest: sha(bytes),
    usage: ledger.usage().charged,
  });
  if (
    progress.stopped &&
    !/budget exhausted/i.test(progress.stopped.error ?? '')
  )
    throw Error(JSON.stringify(progress.stopped));
} finally {
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
