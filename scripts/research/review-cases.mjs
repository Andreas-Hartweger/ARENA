import assert from 'node:assert/strict';
import { hashJSON } from './manifest.mjs';

// One row per scheduled case, including failed and missing measurements.
export function reviewCases(candidate, measurements, sourceSHA256) {
  assert.equal(measurements.genome, candidate.genome);
  const rows = [];
  for (const [name, panel] of Object.entries(measurements)) {
    if (name === 'genome') continue;
    const measured = new Map(panel.actual.map((row) => [row.id, row]));
    const scheduled = new Set(panel.expected.map((row) => row.id));
    assert.equal(measured.size, panel.actual.length);
    assert.equal(scheduled.size, panel.expected.length);
    for (const id of measured.keys()) assert(scheduled.has(id));
    for (const planned of panel.expected) {
      const observation = measured.get(planned.id),
        result = observation?.result;
      if (observation) {
        assert.equal(observation.genome, candidate.genome);
        assert.equal(observation.group, planned.group);
        assert.equal(observation.effective, planned.effective);
      }
      const scored = result?.ok ? result : null;
      rows.push({
        genome: candidate.genome,
        version: candidate.version,
        roles: candidate.roles.join('|'),
        panel: name,
        caseId: planned.id,
        group: planned.group,
        effective: planned.effective,
        outcome: result?.reason ?? 'missing',
        scored: scored !== null,
        physicalTicks: result?.ticksUnknown ? null : (result?.tick ?? null),
        taskSeconds: scored?.duration ?? null,
        lapSeconds: Array.isArray(scored?.lapTimes)
          ? JSON.stringify(scored.lapTimes)
          : null,
        contactClusters: scored?.raw?.clusters ?? null,
        peakNormalApproachMps: scored?.raw?.peakApproach ?? null,
        grassSeconds: scored?.raw?.grassSeconds ?? null,
        lawfulProgressM: scored?.raw?.progress ?? null,
        recovery: scored?.recovery?.success ?? null,
        returnedAtTick: scored?.recovery?.returnedAtTick ?? null,
        verifiedAtTick: scored?.recovery?.verifiedAtTick ?? null,
        recoveryProgressM: scored?.recovery?.progressM ?? null,
        recordDigest: result ? hashJSON(result) : null,
        sourceSHA256,
      });
    }
  }
  return rows;
}
export function casesCSV(rows) {
  const cell = (v) =>
    v === null ? '' : '"' + String(v).replaceAll('"', '""') + '"';
  return (
    [
      Object.keys(rows[0]).join(','),
      ...rows.map((r) => Object.values(r).map(cell).join(',')),
    ].join('\n') + '\n'
  );
}
