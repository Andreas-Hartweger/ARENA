import { distribution } from '../training/evolution';
import type { EpisodeResult } from '../training/episode';

export type Capability = 'Starter' | 'Performance' | 'Spezialist';
export interface CaseResult {
  id: string;
  group: number;
  genome: string;
  effective: string;
  result: EpisodeResult;
}
export interface ExpectedCase {
  id: string;
  group: number;
  effective: string;
}
export interface PanelResult {
  expected: readonly ExpectedCase[];
  actual: readonly CaseResult[];
}
function complete(panel: PanelResult, genome: string, size: number) {
  if (
    panel.expected.length !== size ||
    panel.actual.length !== size ||
    new Set(panel.expected.map((c) => c.id)).size !== size ||
    new Set(panel.expected.map((c) => c.effective)).size !== size ||
    new Set(panel.actual.map((c) => c.id)).size !== size
  )
    return false;
  return panel.expected.every((e) => {
    const c = panel.actual.find((c) => c.id === e.id);
    return (
      c?.group === e.group &&
      c.effective === e.effective &&
      c.genome === genome &&
      c.result.ok &&
      validMetrics(c.result)
    );
  });
}
function validMetrics(r: Extract<EpisodeResult, { ok: true }>) {
  return (
    !!r.raw &&
    Array.isArray(r.lapTimes) &&
    [
      r.duration,
      r.raw.grassSeconds,
      r.raw.peakApproach,
      r.raw.clusters,
      r.raw.progress,
      ...r.lapTimes,
    ].every((x) => Number.isFinite(x) && x >= 0) &&
    Number.isSafeInteger(r.raw.clusters) &&
    Number.isSafeInteger(r.tick) &&
    r.tick > 0 &&
    r.duration <= r.tick / 60 + 1e-8 &&
    r.lapTimes.every((s) => s > 0) &&
    ['completed', 'timeout', 'noProgress'].includes(r.reason)
  );
}
export function caseStatistics(rows: readonly CaseResult[], laps = 1) {
  const successful = rows.filter(
    (c) =>
      c.result.ok &&
      validMetrics(c.result) &&
      c.result.reason === 'completed' &&
      c.result.lapTimes.length === laps,
  );
  const scores = successful.map((c) => {
    if (!c.result.ok) throw Error('Missing metrics');
    return c.result;
  });
  const times = scores.flatMap((r) => r.lapTimes),
    grass = scores.map((r) => r.raw.grassSeconds);
  const severe = rows.filter(
    (c) => c.result.ok && c.result.raw?.peakApproach >= 10,
  ).length;
  return {
    n: rows.length,
    success: successful.length,
    byGroup: [0, 1, 2].map(
      (g) => successful.filter((c) => c.group === g).length,
    ),
    severe,
    times: times.length ? distribution(times) : null,
    grass: grass.length ? distribution(grass) : null,
    clean: scores.filter((r) => r.raw.clusters === 0).length,
    lawfulProgress:
      rows.length && rows.every((c) => c.result.ok && validMetrics(c.result))
        ? distribution(
            rows.map((c) => (c.result.ok ? c.result.raw.progress : 0)),
          )
        : null,
  };
}
export interface ValidationEvidence {
  genome: string;
  standard: PanelResult;
  holdout: PanelResult;
  endurance: PanelResult;
  standardEndurance: PanelResult;
  recovery?: PanelResult;
}
export function validateCapability(role: Capability, data: ValidationEvidence) {
  const { genome, standard, holdout, endurance, standardEndurance, recovery } =
    data;
  const validSingle =
    complete(standard, genome, 1) &&
    complete(holdout, genome, 60) &&
    [0, 1, 2].every(
      (g) => holdout.expected.filter((e) => e.group === g).length === 20,
    );
  const validMulti =
    complete(standardEndurance, genome, 1) && complete(endurance, genome, 12);
  const single = caseStatistics(holdout.actual),
    one = caseStatistics(standard.actual),
    multi = caseStatistics(endurance.actual, 3),
    standardMulti = caseStatistics(standardEndurance.actual, 3);
  const specialist = role === 'Spezialist',
    fast = role === 'Performance';
  const recoveryComplete =
    !!recovery &&
    complete(recovery, genome, 18) &&
    [0, 1, 2].every(
      (g) => recovery.expected.filter((c) => c.group === g).length === 6,
    );
  const recovered =
    recovery?.actual.filter((c) => c.result.ok && c.result.recovery?.success) ??
    [];
  const recoveryPass =
    recoveryComplete &&
    recovered.length >= 12 &&
    [0, 1, 2].every((g) => recovered.filter((c) => c.group === g).length >= 3);
  const checks = {
    coverage: validSingle && validMulti,
    standard:
      one.success === 1 &&
      one.times!.median <= (fast ? 50 : 75) &&
      one.severe === 0,
    reliability: single.success >= 54 && single.byGroup.every((n) => n >= 16),
    pace: single.times !== null && single.times.median <= (fast ? 60 : 75),
    contacts:
      single.severe === 0 &&
      single.success > 0 &&
      single.clean >= Math.ceil(0.9 * single.success),
    grass:
      single.grass !== null &&
      single.grass.median <= 2 &&
      single.grass.best <= 10,
    multi:
      multi.success >= 10 &&
      standardMulti.success === 1 &&
      multi.severe === 0 &&
      standardMulti.severe === 0 &&
      [...endurance.actual, ...standardEndurance.actual].every(
        (c) => c.result.ok && c.result.duration <= 360,
      ),
    specialty: !specialist || recoveryPass,
  };
  const status =
    !checks.coverage || (specialist && !recoveryComplete)
      ? 'pending'
      : Object.values(checks).every(Boolean)
        ? 'passed'
        : 'failed';
  return {
    role,
    genome,
    status,
    checks,
    single,
    standard: one,
    multi,
    standardMulti,
    recoveryPass,
  };
}
export function comparePaired(
  a: readonly CaseResult[],
  b: readonly CaseResult[],
) {
  const byId = new Map(b.map((c) => [c.id, c])),
    differences: number[] = [];
  let paired = 0,
    successA = 0,
    successB = 0;
  for (const ca of a) {
    const cb = byId.get(ca.id);
    if (!cb || cb.effective !== ca.effective) continue;
    paired++;
    const ra = ca.result,
      rb = cb.result,
      sa = ra.ok && ra.reason === 'completed',
      sb = rb.ok && rb.reason === 'completed';
    if (sa) successA++;
    if (sb) successB++;
    if (sa && sb && ra.lapTimes.length && rb.lapTimes.length)
      differences.push(rb.lapTimes[0] - ra.lapTimes[0]);
  }
  return {
    paired,
    successA,
    successB,
    commonSuccessful: differences.length,
    timeDifference: differences.length ? distribution(differences) : null,
  };
}
