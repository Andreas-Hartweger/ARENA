import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { availableParallelism } from 'node:os';
import { Buffer, Blob } from 'node:buffer';
import { environment } from '../evolution-runtime.mjs';
import { slots, hashJSON } from './manifest.mjs';
import {
  openCampaign,
  ActiveTime,
  publishJSON,
  publish,
  parseFlags,
} from './campaign.mjs';
import { loadCandidate, loadPanel, evaluatePanel } from './evaluate-panel.mjs';
import { NodeStore } from './store.mjs';
import { sha } from './manifest.mjs';
const { createModel, profiles, readVersion } =
  await import('../../src/storage/library.ts');
const { exportPackage, importPackage, previewPackage } =
  await import('../../src/storage/transfer.ts');
const { caseStatistics, comparePaired } =
  await import('../../src/research/validation.ts');
const { distribution } = await import('../../src/training/evolution.ts');
const [directory, phase] = process.argv.slice(2);
if (!['confirmation', 'long', 'freeze'].includes(phase))
  throw Error('Expected target phase');
const runtime = environment(),
  clockStart = performance.now(),
  ledger = openCampaign(directory, parseFlags()),
  clock = new ActiveTime(
    ledger,
    { experimentId: 'selection-' + phase },
    'research',
    120000,
    clockStart,
  );
const folder = join(directory, 'selection');
mkdirSync(folder, { recursive: true });
function criterion(row) {
  return [
    -row.success,
    -row.weakest,
    row.success ? (row.time ?? Infinity) : Infinity,
    row.severe,
    row.grass ?? Infinity,
    -row.progress,
    row.msPerEpisode,
    row.configId,
    row.experimentId ?? '',
  ];
}
function rank(a, b) {
  const x = criterion(a),
    y = criterion(b);
  for (let i = 0; i < x.length; i++) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  return 0;
}
async function select() {
  const key = phase === 'freeze' ? 'final-candidates' : 'selection:' + phase;
  const previous = ledger.readManifest(key);
  if (previous) {
    publishJSON(join(folder, phase + '.json'), previous);
    return;
  }
  const scale = JSON.parse(
    readFileSync(join(directory, 'worker-scaling.json'), 'utf8'),
  );
  const development = loadPanel(directory, 'development'),
    available = [];
  for (const slot of slots) {
    let relevant;
    if (phase === 'confirmation')
      relevant =
        slot.ExperimentID.startsWith('S') ||
        slot.ExperimentID.startsWith('B-evolution-');
    else if (phase === 'long') relevant = slot.ExperimentID.startsWith('C');
    else relevant = !slot.ExperimentID.startsWith('B-random-');
    if (
      !relevant ||
      !existsSync(
        join(directory, 'experiments', slot.ExperimentID, 'experiment.json'),
      )
    )
      continue;
    const isPrefix =
      phase === 'confirmation' && slot.ExperimentID.startsWith('B-');
    const candidate = loadCandidate(
      directory,
      slot.ExperimentID,
      isPrefix ? 'prefixChampion' : 'champion',
    );
    const outcome = await evaluatePanel(
      ledger,
      clock,
      development,
      candidate,
      Math.min(availableParallelism(), scale.workers),
    );
    const result = caseStatistics(outcome.actual);
    if (outcome.actual.some((c) => !c.result.ok))
      throw Error('Incomplete development validation');
    const file = slot.ExperimentID + (isPrefix ? '-prefix' : '') + '.json';
    let paired = null;
    if (slot.ExperimentID.startsWith('S')) {
      const peer = join(
        folder,
        'dev-B-evolution-' + slot.Seed + '-prefix.json',
      );
      if (existsSync(peer))
        paired = comparePaired(
          JSON.parse(readFileSync(peer, 'utf8')).outcome.actual,
          outcome.actual,
        );
    }
    publishJSON(join(folder, 'dev-' + file), {
      paired,
      panel: development.hash,
      genome: candidate.genome.hash,
      outcome,
      result,
    });
    const gen = readFileSync(
      join(directory, 'experiments', slot.ExperimentID, 'generations.ndjson'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    if (isPrefix) gen.splice(64);
    const first = gen.find((g) => g.successes > 0),
      latest = gen.at(-1);
    const elapsed = gen.reduce((n, g) => n + (g.durationMs ?? g.ms), 0);
    available.push({
      experimentId: slot.ExperimentID,
      configId: candidate.report.entry.definition.configId,
      genome: candidate.genome.hash,
      seed: Number(slot.Seed),
      role: candidate.role,
      success: result.success,
      weakest: Math.min(...result.byGroup),
      time: result.times?.median ?? null,
      severe: result.severe,
      grass: result.grass?.median ?? null,
      progress: result.lawfulProgress.median,
      msPerEpisode:
        elapsed / (isPrefix ? 8192 : candidate.report.regularEpisodes),
      comparedEpisodes: isPrefix ? 8192 : candidate.report.regularEpisodes,
      paired,
      firstSuccessGeneration: first?.generation ?? null,
      censored: !first,
      progressGain: latest.progress.mean - gen[0].progress.mean,
      devHash: hashJSON(outcome),
      modelKey: candidate.genome.model.key,
      versionSource: candidate.report.models[candidate.role].id,
      devFile: 'dev-' + file,
    });
  }
  if (!available.length)
    throw Error('No eligible measured development candidates');
  const groups = new Map();
  for (const r of available) {
    const a = groups.get(r.configId) ?? [];
    a.push(r);
    groups.set(r.configId, a);
  }
  const grouped = [...groups]
    .filter(
      ([, rows]) =>
        phase === 'freeze' ||
        new Set(rows.map((r) => r.seed)).size >=
          (phase === 'confirmation' ? 2 : 3),
    )
    .map(([configId, rows]) => {
      const median = (k) => {
        const v = rows.map((r) => r[k]).filter(Number.isFinite);
        return v.length ? distribution(v).median : null;
      };
      return {
        configId,
        success: median('success'),
        weakest: Math.min(...rows.map((r) => r.weakest)),
        time: median('time'),
        severe: Math.max(...rows.map((r) => r.severe)),
        grass: median('grass'),
        progress: median('progress'),
        msPerEpisode: median('msPerEpisode'),
        progressGain: median('progressGain'),
        firstSuccess: median('firstSuccessGeneration'),
      };
    })
    .sort(rank);
  const reserveReason =
    'Ein Platz für eine später lernende oder effizientere Alternative mit gemessenem Fortschritt.';
  if (phase === 'freeze') {
    available.sort(rank);
    const shortlist = [];
    for (const r of available) {
      if (shortlist.some((c) => c.genome === r.genome)) continue;
      shortlist.push(r);
      if (shortlist.length === 3) break;
    }
    const candidates = [];
    const registry = new NodeStore(ledger, 'research-finalists');
    for (const [i, r] of shortlist.entries()) {
      clock.pulse();
      const source = loadCandidate(directory, r.experimentId, r.role);
      const name =
        'Forschung · ' + r.experimentId + ' · ' + r.genome.slice(0, 12);
      const profile =
        (await profiles(registry)).find((p) => p.name === name) ??
        (await createModel(
          registry,
          name,
          source.draft,
          {
            genome: source.genome,
            id: r.versionSource,
            role: 'experiment',
          },
          availableParallelism(),
        ));
      const file = r.genome + '.arena-model',
        path = join(folder, file);
      const bytes = existsSync(path)
        ? readFileSync(path)
        : Buffer.from(
            await (
              await exportPackage(
                registry,
                'model',
                [profile.id],
                process.version,
              )
            ).arrayBuffer(),
          );
      const restore = new NodeStore(ledger, 'finalist-restore-' + r.genome);
      const preview = await previewPackage(restore, new Blob([bytes]));
      if (
        preview.conflicts.length ||
        preview.manifest.roots.length !== 1 ||
        preview.manifest.roots[0] !== profile.id ||
        !preview.manifest.entries.some((e) => e.id === profile.active)
      )
        throw Error('Finalist package version or contents differ');
      if (!restore.get(profile.active)) await importPackage(restore, preview);
      const restored = await readVersion(restore, profile.active);
      if (
        restored.genome.hash !== r.genome ||
        restored.genome.model.key !== r.modelKey
      )
        throw Error('Finalist package roundtrip differs');
      publish(path, bytes);
      candidates.push({
        genome: r.genome,
        experimentId: r.experimentId,
        modelRole: r.role,
        roles: i === 0 ? ['Starter', 'Performance'] : ['Starter'],
        modelKey: r.modelKey,
        devHash: r.devHash,
        sourceGenomeObject: r.versionSource,
        version: profile.active,
        file,
        packageSHA256: sha(bytes),
      });
    }
    const output = {
      schema: 'arena.selection.v1',
      phase,
      dev: development.hash,
      panels: JSON.parse(
        readFileSync(
          'docs/intelligence-validation/evidence/panel-commitments.json',
          'utf8',
        ),
      ),
      candidates,
      data: available,
      rules:
        'Erfolg, schlechteste Gruppe, gültige Zeit, Kontakt, Gras, Fortschritt, Aufwand, ID',
      usage: ledger.usage().charged,
    };
    ledger.transaction(() => {
      ledger.assertLease();
      ledger.manifest('final-candidates', output);
    });
    publishJSON(join(folder, 'freeze.json'), output);
  } else {
    const count = phase === 'confirmation' ? 5 : 2,
      eligible = grouped.filter(
        (r) =>
          phase === 'long' || !['Baseline', 'evolution'].includes(r.configId),
      ),
      best = eligible.slice(0, count);
    if (phase === 'confirmation' && eligible.length > count) {
      const alternative = eligible
        .slice(count - 1)
        .filter((r) => r.progressGain > 0)
        .sort(
          (a, b) =>
            (b.firstSuccess ?? 0) - (a.firstSuccess ?? 0) ||
            b.progressGain - a.progressGain ||
            rank(a, b),
        )[0];
      if (alternative) best[count - 1] = alternative;
    }
    const output = {
      schema: 'arena.selection.v1',
      phase,
      dev: development.hash,
      configs: best.map((c) => c.configId),
      ranked: grouped,
      data: available,
      reasons: { tie: 'ConfigID lexikografisch', alternative: reserveReason },
      runtime,
      usage: ledger.usage().charged,
    };
    ledger.transaction(() => {
      ledger.assertLease();
      ledger.manifest('selection:' + phase, output);
    });
    publishJSON(join(folder, phase + '.json'), output);
  }
}
try {
  await select();
} finally {
  try {
    clock.finish();
    ledger.release();
  } finally {
    ledger.close();
  }
}
