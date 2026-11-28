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

// Compare the same scheduled starts, retaining both lost and newly successful cases.
export function investigateRegression(pair, rows, panel = 'holdout') {
  const cases = (genome) =>
    new Map(
      rows
        .filter((r) => r.genome === genome && r.panel === panel)
        .map((r) => [r.caseId, r]),
    );
  const a = cases(pair.a),
    b = cases(pair.b);
  assert(a.size && a.size === b.size);
  const groups = new Map(),
    changes = [],
    commonTimes = [];
  const successful = (r) => r.scored && r.outcome === 'completed';
  const facts = (r) => ({
    reason: r.outcome,
    record: r.recordDigest,
    contactClusters: r.contactClusters,
    peakNormalApproachMps: r.peakNormalApproachMps,
    grassSeconds: r.grassSeconds,
    lawfulProgressM: r.lawfulProgressM,
  });
  for (const x of a.values()) {
    const y = b.get(x.caseId);
    assert(y && x.group === y.group && x.effective === y.effective);
    const g = groups.get(x.group) ?? {
      group: x.group,
      scheduled: 0,
      successA: 0,
      successB: 0,
      lost: 0,
      gained: 0,
      commonSuccessful: 0,
    };
    groups.set(x.group, g);
    const first = successful(x),
      next = successful(y);
    g.scheduled++;
    g.successA += Number(first);
    g.successB += Number(next);
    if (first && next) {
      g.commonSuccessful++;
      const [timeA] = JSON.parse(x.lapSeconds),
        [timeB] = JSON.parse(y.lapSeconds);
      assert(timeA > 0 && timeB > 0);
      commonTimes.push({
        caseId: x.caseId,
        group: x.group,
        secondsA: timeA,
        secondsB: timeB,
        differenceSeconds: timeB - timeA,
      });
    } else if (first !== next) {
      const direction = first ? 'lost' : 'gained';
      g[direction]++;
      changes.push({
        caseId: x.caseId,
        group: x.group,
        direction,
        a: facts(x),
        b: facts(y),
      });
    }
  }
  const byGroup = [...groups.values()];
  assert.equal(
    byGroup.reduce((n, g) => n + g.successB - g.successA, 0) / a.size,
    pair.deltaSuccess,
  );
  assert.equal(commonTimes.length, pair.paired.commonSuccessful);
  return {
    panel,
    byGroup,
    changes,
    commonTimes: commonTimes.sort(
      (x, y) => y.differenceSeconds - x.differenceSeconds,
    ),
  };
}

export function reviewedCandidate(r, rawChecks) {
  const candidate = r.candidate;
  const audited = rawChecks.find((item) => item.genome === candidate.genome);
  assert.equal(
    audited?.source,
    r.sha256,
    'Missing matching raw candidate audit',
  );
  assert.deepEqual(
    audited.traces.map((t) => t.id).sort(),
    [...r.auditCases].sort(),
  );
  const single = r.gates[0].single;
  const holdout = audited.panels.holdout;
  assert.equal(single.success, holdout.complete);
  assert.equal(single.severe, holdout.severeIncludingFailures);
  for (const group of holdout.byGroup) {
    assert.equal(single.byGroup[group.group], group.completed);
  }
  return {
    genome: candidate.genome,
    version: candidate.version,
    experiment: candidate.experimentId,
    modelRole: candidate.modelRole,
    packageSHA256: candidate.packageSHA256,
    caseFile: 'validation/' + r.file,
    caseSHA256: r.sha256,
    traceFile: 'validation/' + r.traces,
    traceSHA256: r.traceSHA256,
    auditedTraces: audited.traces.map(
      ({ id, sampledTicks, travelIntervals, contactIntervals }) => ({
        id,
        sampledTicks,
        travelIntervals,
        contactIntervals,
      }),
    ),
    panels: audited.panels,
    singleLapQuality: {
      successful: single.success,
      collisionFreeSuccessful: single.clean,
      severeContactCases: single.severe,
      medianSuccessfulGrassS: single.grass?.median ?? null,
      maximumSuccessfulGrassS: single.grass?.best ?? null,
    },
    roles: r.gates.map((g) => ({
      role: g.role,
      status: g.status,
      checks: g.checks,
    })),
  };
}
