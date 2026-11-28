import assert from 'node:assert/strict';
import { slots } from './manifest.mjs';

// Confirmation has a new baseline for each seed. Long runs share a seed with
// the other long finalist and may have no baseline configuration at all.
export function replicationRows(experiments, states) {
  const planned = slots.filter(
    (s) => s.Phase === 'Bestätigung' || s.Phase === 'Langzeit',
  );
  const status = new Map(states.map((r) => [r.id, r]));
  const measured = new Map(experiments.map((r) => [r.id, r]));
  const metric = (r) => r?.metrics.find((m) => m.file === 'audit.json');
  const lapTime = (m) =>
    m?.lapTimeBoundaries?.find((b) => b.episodes === m.episodes)?.seconds
      ?.median ?? null;
  return planned.map((s) => {
    const id = s.ExperimentID,
      run = measured.get(id),
      m = metric(run),
      state = status.get(id);
    const peers = planned.filter(
      (p) => p.Phase === s.Phase && p.Seed === s.Seed,
    );
    const control =
      s.Phase === 'Bestätigung'
        ? peers.find((p) => p.ConfigID === 'Baseline')
        : (peers.find(
            (p) => measured.get(p.ExperimentID)?.configId === 'Baseline',
          ) ?? peers.find((p) => p.ConfigID === 'Finalist 1'));
    const reference = measured.get(control.ExperimentID),
      other = metric(reference);
    if (run) {
      assert(m, 'Missing full-budget audit for ' + id);
      assert.equal(run.seed, Number(s.Seed));
      assert.equal(m.episodes, Number(s.EpisodeBudget));
      if (s.ConfigID === 'Baseline') assert.equal(run.configId, 'Baseline');
    }
    const paired = Boolean(m && other && reference.id !== id);
    return {
      experiment: id,
      phase: s.Phase,
      plannedSlot: s.ConfigID,
      config: run?.configId ?? null,
      seed: s.Seed,
      state: state.state,
      plannedEpisodes: Number(s.EpisodeBudget),
      auditedEpisodes: m?.episodes ?? null,
      committedGenerations: state.generations,
      population: m?.firstGeneration.evaluated ?? null,
      successes: m?.successes ?? null,
      firstSuccessGeneration: m?.firstSuccessGeneration ?? null,
      censored: m?.firstSuccessCensored ?? null,
      medianSuccessfulLapS: lapTime(m),
      fastestLapS: m?.fastest?.time ?? null,
      finalMedianProgressM: m?.lastGeneration.progressMetres.median ?? null,
      physicalTicks: m?.rawTicks ?? null,
      generationWallMs: m?.generationWallMs ?? null,
      pairedWithExperiment: paired ? reference.id : null,
      pairedWithConfig: paired ? reference.configId : null,
      differencePercentagePoints: paired
        ? (100 * (m.successes - other.successes)) / m.episodes
        : null,
      comparisonMedianLapDifferenceS:
        paired && lapTime(m) !== null && lapTime(other) !== null
          ? lapTime(m) - lapTime(other)
          : null,
      genome: m?.champion.genome ?? null,
      auditSHA256: run?.auditHashes['audit.json'] ?? null,
      comparisonAuditSHA256: paired
        ? reference.auditHashes['audit.json']
        : null,
    };
  });
}
