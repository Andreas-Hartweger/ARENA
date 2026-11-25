import { it, expect } from 'vitest';
import { DriveWorld } from '../../src/game/world';
import { createTrack } from '../../src/tracks/track';
import { createVehicle } from '../../src/vehicles/vehicle';
import { Brain } from '../../src/ai/network';
import { signature } from '../../src/ai/schema';
import { profile, standardProfile } from '../../src/ai/profile';
import { sampleAxles } from '../../src/physics/surface';
import { headingAxes } from '../../src/core/math';
import { wallIndex } from '../../src/ai/geometry';
import { observe } from '../../src/ai/perception';
const track = createTrack(),
  v = createVehicle({ id: 'A', startNumber: 1 });
function run(p: number, s: number, d: number, xSpeed = 0, y = 70) {
  const w = new Float64Array(8547);
  w.set([p, s, d].map(Math.atanh), 8544);
  const o = {
    id: 'A',
    startNumber: 1,
    initialState: { positionM: { x: 0, y }, velocityMps: { x: xSpeed, y: 0 } },
  };
  return new DriveWorld(
    track,
    [o],
    true,
    new Map([
      ['A', { brain: new Brain(signature(v), 0, [32, 16], 'tanh', w) }],
    ]),
  );
}
it('INT-004/005 reverse, steer, brake and blocked recovery', () => {
  const reverse = run(0.8, 0.25, -0.9);
  for (let i = 0; i < 50; i++) reverse.step(new Map());
  const c = reverse.frame.cars[0];
  expect(c.state.drive.direction).toBe('reverse');
  expect(c.state.velocityMps.x).toBeLessThan(0);
  expect(c.state.steeringAngleRad).toBeLessThan(0);
  const brake = run(-0.8, 0, -0.9, 4);
  for (let i = 0; i < 50; i++) brake.step(new Map());
  expect(brake.frame.cars[0].state.drive.direction).toBe('forward');
  expect(brake.frame.cars[0].state.velocityMps.x).toBeLessThan(0.05);
  const grass = run(0.5, 0, 0, 0, 79);
  const prior = grass.step(new Map()).cars[0];
  const next = grass.step(
    new Map([
      [
        'A',
        { command: { kind: 'target', request: prior.input }, recover: true },
      ],
    ]),
  ).cars[0];
  expect(next.recovery).toBe('blocked');
  expect(next.ai).toBe(prior.ai);
});
it('SEN-022 raw grip follows the next free tick after changing surfaces', () => {
  const index = wallIndex(track);
  let state = v.state;
  for (const y of [70, 79, 70, 70]) {
    state = { ...state, positionM: { x: 0, y } };
    const before = structuredClone(state);
    const axles = sampleAxles(
      v,
      state,
      headingAxes(0).forward,
      track.surfaceQuery,
    );
    const o = observe(track, index, [], v, state, 0);
    expect([o.raw[8], o.raw[11]]).toEqual([
      axles.front.profile.friction,
      axles.rear.profile.friction,
    ]);
    expect(state).toEqual(before);
    state = {
      ...state,
      frontAxle: axles.front.state,
      rearAxle: axles.rear.state,
    };
  }
});
it('OBS-005 rejects changed geometry, order, frequency, setup and controller signature', () => {
  const defaultBrain = new Brain(signature(v)),
    rays = standardProfile.rays;
  for (const p of [
    profile([...rays].reverse()),
    profile(rays, 60),
    profile([{ ...rays[0], range: 99 }, ...rays.slice(1)]),
  ]) {
    expect(
      () =>
        new DriveWorld(
          track,
          [{ id: 'A', startNumber: 1 }],
          true,
          new Map([['A', { brain: defaultBrain, profile: p }]]),
        ),
    ).toThrow(/Incompatible/);
  }
  expect(signature({ ...v, setup: { ...v.setup, gravityMps2: 4 } })).not.toBe(
    signature(v),
  );
  expect(
    () =>
      new DriveWorld(
        track,
        [{ id: 'A', startNumber: 1 }],
        true,
        new Map([['A', { brain: new Brain('other controller') }]]),
      ),
  ).toThrow(/Incompatible/);
});
it('SEN-011 independent cars do not contribute any ray/slot or occlusion', () => {
  const a = {
      id: 'A',
      startNumber: 1,
      initialState: { positionM: { x: 0, y: 70 } },
    },
    b = { ...a, id: 'B', initialState: { positionM: { x: 10, y: 70 } } },
    drivers = new Map([['A', { brain: new Brain(signature(v)) }]]);
  const solo = new DriveWorld(track, [a], false, drivers),
    independent = new DriveWorld(track, [a, b], false, drivers),
    shared = new DriveWorld(track, [a, b], true, drivers);
  const first = (w: DriveWorld) => w.step(new Map()).cars[0].ai!.observation;
  expect(first(solo)).toEqual(first(independent));
  expect(first(shared).raw[216]).toBe(1);
});
