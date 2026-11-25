import { expect, it } from 'vitest';
import { corners } from '../../src/tracks/grid';
import { createTrack, type Barrier } from '../../src/tracks/track';
import { compileWalls, solveContacts } from '../../src/collision/solver';
import {
  respond,
  sat,
  sweptBounds,
  type Body,
} from '../../src/collision/contact';
import { DriveWorld } from '../../src/game/world';
const car = (id: string, x: number, v: number): Body => ({
  id,
  position: { x, y: 0 },
  heading: 0,
  lengthM: 4.5,
  widthM: 1.95,
  velocity: { x: v, y: 0 },
  yaw: 0,
  invMass: 1 / 1300,
  invInertia: 1 / 2600,
});
const barrier: Barrier = {
  id: 'wall',
  a: { x: 0, y: -10 },
  b: { x: 0, y: 10 },
  outerA: { x: 0.02, y: -10 },
  outerB: { x: 0.02, y: 10 },
};
const walls = compileWalls([barrier]);
const energy = (b: Body) =>
  (b.velocity.x ** 2 + b.velocity.y ** 2) / 2 / b.invMass +
  b.yaw ** 2 / 2 / b.invInertia;
it('handles separated, touching and rotated boxes and bounds their rotation', () => {
  const a = car('a', 0, 0),
    b = car('b', 5, 0);
  expect(sat(corners(a), corners(b))).toBeNull();
  b.position = { x: 4.5, y: 0 };
  expect(sat(corners(a), corners(b))!.depth).toBeCloseTo(0);
  b.position = { x: 3, y: 0.4 };
  b.heading = Math.PI / 4;
  expect(sat(corners(a), corners(b))!.depth).toBeGreaterThan(0);
  const box = sweptBounds(b, 1 / 60);
  for (const p of corners({ ...b, heading: 1.2 }))
    expect(p.x <= box.maxX && p.y >= box.minY).toBe(true);
});
it('hits a 2 cm wall at 250 km/h, loses energy and rebounds at the centered contact', () => {
  const a = car('a', -3, 250 / 3.6),
    before = energy(a);
  const solved = solveContacts([a], walls, 1);
  expect(solved.fallback).toBe(false);
  expect(solved.events).toHaveLength(1);
  expect(a.position.x).toBeLessThan(-2.2);
  expect(a.velocity.x).toBeCloseTo((-0.15 * 250) / 3.6, 6);
  expect(Math.abs(a.yaw)).toBeLessThan(1e-8);
  expect(energy(a)).toBeLessThan(before);
});
it('slides along a wall and rotates under an off-center impulse', () => {
  const a = car('a', -2.25, 2);
  a.velocity = { x: 2, y: 18 };
  respond(a, null, {
    point: { x: 0, y: 0.85 },
    normal: { x: 1, y: 0 },
    depth: 0.02,
  });
  expect(Math.abs(a.yaw)).toBeGreaterThan(0.1);
  expect(a.velocity.y).toBeGreaterThan(15);
  expect(a.velocity.x).toBeLessThan(2);
});
it('resolves two oncoming vehicles and filters independent candidates', () => {
  const a = car('a', -3, 65),
    b = car('b', 3, -65),
    e = energy(a) + energy(b);
  const result = solveContacts([a, b], [], 2);
  expect(result.events.length).toBe(1);
  expect(a.velocity.x).toBeLessThan(0);
  expect(b.velocity.x).toBeGreaterThan(0);
  expect(energy(a) + energy(b)).toBeLessThan(e);
  const c = car('a', -3, 65),
    d = car('b', 3, -65);
  expect(solveContacts([c, d], [], 2, false).events).toHaveLength(0);
  expect(c.velocity.x).toBe(65);
});
it('bounds multi-contact iterations and corrects resting overlap without adding energy', () => {
  const a = car('a', -2.15, 0);
  for (let tick = 0; tick < 180; tick++) solveContacts([a], walls, tick + 1);
  expect(energy(a)).toBe(0);
  expect(a.position.x).toBeLessThanOrEqual(-2.239);
  function run() {
    const cars = [car('a', -7, 32), car('b', -2.25, 0)];
    for (let i = 1; i <= 120; i++) solveContacts(cars, walls, i);
    return cars;
  }
  expect(run()).toEqual(run());
  for (const b of run()) expect(b.position.x).toBeLessThan(0);
});
it('falls back before exhausting safe motion at extreme speed or spin', () => {
  const a = car('a', -8, 700);
  a.yaw = 100;
  expect(solveContacts([a], walls, 1).fallback).toBe(true);
  expect(a.position.x).toBeLessThan(-3);
  expect(energy(a)).toBe(0);
});
it('keeps the complete multi-vehicle frame on failure in the second vehicle', () => {
  const track = createTrack(),
    query = track.surfaceQuery;
  let calls = 0;
  track.surfaceQuery = (p) => {
    if (++calls === 4) throw Error('rear query');
    return query(p);
  };
  const options = ['a', 'b'].map((id, i) => ({
    id,
    startNumber: i,
    initialState: { positionM: { x: -8 - 10 * i, y: 70 } },
  }));
  // Allow constructor spawn validation; count only the four subsequent axle samples.
  const broken = { ...track, surfaceQuery: query };
  const world = new DriveWorld(broken, options);
  broken.surfaceQuery = track.surfaceQuery;
  const frame = world.frame;
  expect(() => world.step(new Map())).toThrow(/rear query/);
  expect(world.frame).toBe(frame);
  expect(() => world.step(new Map())).toThrow(/locked/);
});
it('preserves free motion across the asphalt edge and safely recovers without lap credit', () => {
  const track = createTrack(),
    world = new DriveWorld(track, [
      {
        id: 'p',
        startNumber: 1,
        initialState: {
          positionM: { x: 0, y: 75 },
          headingRad: Math.PI / 2,
          velocityMps: { x: 0, y: 10 },
        },
      },
    ]);
  for (let i = 0; i < 25; i++) world.step(new Map());
  expect(world.frame.cars[0].state.positionM.y).toBeGreaterThan(76);
  expect(world.frame.events).toHaveLength(0);
});
it('separates coincident GT-01 start positions without velocity or lap travel', () => {
  const bodies = [car('a', 0, 0), car('b', 0, 0)];
  const result = solveContacts(bodies, [], 1);
  expect(result.fallback).toBe(false);
  expect(
    sat(corners(bodies[0]), corners(bodies[1]))?.depth ?? 0,
  ).toBeLessThanOrEqual(0.011);
  expect(bodies.map(energy)).toEqual([0, 0]);
  for (const paths of result.paths)
    for (const path of paths) expect(path.from).toEqual(path.to);
});
