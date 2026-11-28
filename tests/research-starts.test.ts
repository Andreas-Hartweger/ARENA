import { describe, it, expect } from 'vitest';
import { evaluate, scenario, scenarioSet } from '../src/training/episode';
import { Brain } from '../src/ai/network';
import { buildPanels } from '../src/research/panels';
import { fingerprint } from '../src/runtime/fingerprint';
import { createTrack } from '../src/tracks/track';
import { startState } from '../src/training/scenarioStart';
import { RecoveryProof } from '../src/training/recovery';
import { GT_01 } from '../src/vehicles/vehicleDefinition';
import { defaultDraft, preflight } from '../src/runtime/runConfig';

const roots = { development: 123, holdout: 456, endurance: 789, recovery: 42 };
describe('D14 physical panels and recovery', () => {
  it('physically returns from the grass and verifies subsequent travel on Academy with a fixed test controller', () => {
    const s = scenario(fingerprint, {
      id: 'technical-recovery-shoulder',
      purpose: 'validation',
      start: {
        version: 1,
        kind: 'recovery',
        stationM: -35,
        lateralM: 7.4,
        headingRad: -Math.PI / 12,
        speedMps: 8,
      },
      task: { maxTicks: 1500, noProgressTicks: 1500 },
    });
    const weights = new Float64Array((248 + 1) * 4 + (4 + 1) * 3);
    weights[weights.length - 3] = 0.25;
    const result = evaluate(
      s,
      new Brain(s.modelSignature, 0, [4], 'tanh', weights),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.message);
    expect(result.recovery?.success).toBe(true);
    expect(result.recovery!.returnedAtTick).toBeGreaterThan(1);
    expect(result.recovery!.returnedAtTick).toBeLessThanOrEqual(1200);
    expect(
      result.recovery!.verifiedAtTick! - result.recovery!.returnedAtTick!,
    ).toBeLessThanOrEqual(300);
    expect(result.recovery!.progressM).toBeGreaterThanOrEqual(20);
  });
  it('uses independent reproducible physical states and excludes test scenarios from evolution', () => {
    const panels = buildPanels(fingerprint, roots);
    expect(Object.values(panels).map((p) => p.cases.length)).toEqual([
      40, 60, 12, 18,
    ]);
    const states = Object.values(panels).flatMap((p) =>
      p.cases.map((c) => c.effective),
    );
    expect(new Set(states).size).toBe(130);
    expect(buildPanels(fingerprint, roots).development.hash).toBe(
      panels.development.hash,
    );
    expect(() =>
      preflight(
        { ...defaultDraft(), scenarios: [panels.holdout.cases[0].scenario] },
        fingerprint,
        8,
      ),
    ).toThrow();
    const standard = scenario(fingerprint);
    expect(scenarioSet(fingerprint, 43, 4, [{ seed: 17 }])[0].seed).toBe(17);
    const recovery = panels.recovery.cases[0].scenario;
    expect(scenario(fingerprint, recovery).structure).not.toBe(
      standard.structure,
    );
    expect(() =>
      scenario(fingerprint, { ...recovery, purpose: 'training' }),
    ).toThrow();

    expect(standard.vehicle.initialState).not.toHaveProperty('velocityMps');
    expect(standard).not.toHaveProperty('start');
    const start = panels.development.cases[0].scenario.start!;
    expect(() =>
      startState(standard.track, { ...start, stationM: -0.1 }),
    ).toThrow();
    expect(() =>
      startState(standard.track, { ...start, lateralM: 50 }),
    ).toThrow();
    const { velocityMps, headingRad } = startState(standard.track, start);
    expect(velocityMps.x).toBeCloseTo(
      Math.cos(headingRad) * start.speedMps,
      13,
    );
  });
  it('counts continuous accepted forward progress after the return, including the deadline tick', () => {
    const track = createTrack(),
      at = track.sample(-32),
      body = {
        position: at.position,
        heading: at.heading,
        lengthM: GT_01.lengthM,
        widthM: GT_01.widthM,
      };
    const move = (fromS: number, toS: number) => ({
      kind: 'move' as const,
      time: 0,
      fromS,
      toS,
      delta: toS - fromS,
      distance: Math.abs(toS - fromS),
    });
    for (const [end, from, contacts, expected] of [
      [1500, -32, false, true],
      [1501, -32, false, false],
      [1499, -31, false, false],
      [1499, -32, true, false],
    ] as const) {
      const proof = new RecoveryProof();
      proof.accept(1200, track, body, -32, 1, [], []);
      proof.accept(
        end,
        track,
        body,
        -12,
        1,
        [move(from, -12)],
        contacts
          ? [{ start: 1, end: 2, approach: 10, partners: ['wall'] }]
          : [],
      );
      expect(proof.result.success).toBe(expected);
    }
  });
});
