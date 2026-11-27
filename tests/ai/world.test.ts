import { it, expect } from 'vitest';
import { Brain } from '../../src/ai/network';
import { signature } from '../../src/ai/schema';
import { profile, standardProfile } from '../../src/ai/profile';
import { createVehicle } from '../../src/vehicles/vehicle';
import { createTrack } from '../../src/tracks/track';
import { DriveWorld } from '../../src/game/world';
import { FixedStepClock } from '../../src/core/fixedStepClock';
const track = createTrack(),
  options = {
    id: 'A',
    startNumber: 1,
    initialState: { positionM: { x: 0, y: 70 } },
  },
  v = createVehicle(options),
  w = new Float64Array(8547);
w[8544] = Math.atanh(0.6);
function world(sensorHz = 30, decisionHz = 30) {
  const p = profile(standardProfile.rays, sensorHz),
    brain = new Brain(signature(v, p, decisionHz), 0, [32, 16], 'tanh', w);
  return new DriveWorld(
    track,
    [options],
    true,
    new Map([['A', { brain, profile: p, decisionHz }]]),
  );
}
it('INT-001/005/006, INS-001–003 real measurement and decision ticks', () => {
  for (const [sh, dh] of [
    [10, 10],
    [15, 15],
    [20, 20],
    [30, 30],
    [60, 60],
    [20, 60],
    [60, 10],
  ]) {
    const sim = world(sh, dh);
    sim.trace = true;
    for (let i = 0; i < 8; i++) {
      const before = sim.frame.cars[0].state,
        car = sim.step(new Map()).cars[0],
        ai = car.ai!;
      expect(ai.observation.index).toBe(i - (i % (60 / sh)));
      expect(ai.decisionTick).toBe(i - (i % (60 / dh)));
      expect(ai.target.throttle).toBeCloseTo(0.6);
      expect(ai.output[0]).toBe(w[8544]);
      expect(ai.layers[2].sums).toEqual(ai.output);
      if (i % (60 / sh) === 0)
        expect(ai.observation.rays[6].origin.x).toBeCloseTo(
          before.positionM.x + 2.2,
          9,
        );
    }
    expect(sim.frame.cars[0].state.positionM.x).toBeGreaterThan(0);
  }
});
it('INT-002 retains both driver states and world on second-driver overflow', () => {
  const b = {
      ...options,
      id: 'B',
      initialState: {
        positionM: { x: 0, y: 72 },
        velocityMps: { x: 80, y: 0 },
      },
    },
    key = signature(v);
  const weights = w.slice();
  weights[0] = weights[1] = Number.MAX_VALUE;
  const sim = new DriveWorld(
    track,
    [options, b],
    false,
    new Map([
      ['A', { brain: new Brain(key) }],
      ['B', { brain: new Brain(key, 0, [32, 16], 'tanh', weights) }],
    ]),
  );
  const prior = sim.frame;
  expect(() => sim.step(new Map())).toThrow(/AI B/);
  expect(sim.frame).toBe(prior);
  expect(() => sim.step(new Map())).toThrow(/locked/);
});
it('INT-003 240 ticks headless vs 30/60/144 Hz, and diagnostics isolation', () => {
  const reference = world();
  for (let i = 0; i < 240; i++) reference.step(new Map());
  for (const fps of [30, 60, 144]) {
    const sim = world(),
      clock = new FixedStepClock();
    sim.trace = true;
    for (let i = 0; i <= 4 * fps; i++)
      clock.advanceFrame(i / fps, () => {
        sim.step(new Map());
      });
    expect(sim.frame.index).toBe(240);
    expect(sim.frame.cars[0].state).toEqual(reference.frame.cars[0].state);
    expect(sim.frame.cars[0].ai?.observation).toEqual(
      reference.frame.cars[0].ai?.observation,
    );
  }
});
it('INT-004 reset clears caches, first post-reset tick always fresh', () => {
  const sim = world();
  const car = sim.step(
    new Map([
      [
        'A',
        {
          recover: true,
          command: {
            kind: 'analog',
            request: {
              throttle: 0,
              brake: 0,
              steering: 0,
              direction: 'forward',
            },
          },
        },
      ],
    ]),
  ).cars[0];
  expect(car.recovery).toBe('accepted');
  expect(car.ai).toBeUndefined();
  expect(sim.step(new Map()).cars[0].ai?.decisionTick).toBe(1);
});
