import { expect, it } from 'vitest';
import { academy, createTrack } from '../../src/tracks/track';
import { startGrid, recoveryCandidate } from '../../src/tracks/grid';
import {
  recordTravel,
  initialLap,
  invalidateLap,
} from '../../src/tracks/progress';
import { fixture, advance, forward } from '../physics/fixture';
const track = createTrack();
it('closes analytic lines and arcs at the specified seam and offset bounds', () => {
  expect(track.length).toBeCloseTo(659.91148575, 8);
  expect(track.sample(0)).toEqual(track.sample(track.length));
  expect(track.sample(0).position).toEqual({ x: 0, y: 70 });
  for (const [offset, x, y] of [
    [0, 110, 70],
    [6, 116, 76],
    [14, 124, 84],
  ]) {
    const points = track.stations.map((s) => track.sample(s, offset).position);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(x);
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(y);
  }
  for (const wall of track.barriers)
    expect(
      Math.hypot(wall.a.x - wall.b.x, wall.a.y - wall.b.y),
    ).toBeLessThanOrEqual(1.000001);
});
it('projects continuously on both sides of the start seam and on corner offsets', () => {
  for (let s = -4; s < track.length + 4; s += 1.7) {
    const p = track.project(track.sample(s, 4).position, s);
    expect(p.s).toBeCloseTo(s, 7);
    expect(p.lateral).toBeCloseTo(4, 7);
  }
});
it('delivers distinct materials to actual physics axles and leaves grass drivable', () => {
  const car = fixture(
    { positionM: { x: 0, y: 76 }, headingRad: Math.PI / 2 },
    track.surfaceQuery,
  );
  const d = advance(car, forward).physics!;
  expect(d.front.surface.surface).toBe('grass');
  expect(d.rear.surface.surface).toBe('asphalt');
  expect(track.surfaceQuery({ x: 0, y: 77 })).toBe('grass');
});
it('rejects malformed or self-overlapping circuits and unsafe starts', () => {
  for (const bad of [
    { width: -1 },
    { pieces: academy.pieces.slice(1) },
    { pieces: [...academy.pieces, ...academy.pieces] },
    { schema: 2 },
    { startDistance: Infinity },
  ])
    expect(() =>
      createTrack({ ...academy, ...bad } as typeof academy),
    ).toThrow();
  expect(() => startGrid(track, 1, 5, 16)).toThrow();
});
it('builds a centered solo grid and staggered double grid, recovers only to free past poses', () => {
  expect(startGrid(track, 1, 4.5, 1.95)[0].position).toEqual({ x: -8, y: 70 });
  const grid = startGrid(track, 4, 4.5, 1.95);
  expect(grid[2].position.x - grid[0].position.x).toBe(-10);
  expect(Math.abs(grid[1].position.y - grid[0].position.y)).toBe(4);
  const history = grid.map((body) => ({ ...body, s: body.position.x }));
  expect(recoveryCandidate(track, history, -8, grid)).toBeNull();
  expect(recoveryCandidate(track, history, -20, [])!.s).toBeLessThanOrEqual(
    -20,
  );
});
it('opens and finishes two ordered laps using swept simulation timestamps', () => {
  let lap = initialLap(-1);
  let t = 0;
  const end = 2 * track.length + 1;
  for (let s = -1; s < end; s += 2) {
    lap = recordTravel(track, lap, {
      from: track.sample(s).position,
      to: track.sample(s + 2).position,
      startTime: t,
      endTime: t + 0.1,
    });
    t += 0.1;
  }
  expect(lap.laps).toBe(2);
  expect(lap.last).toBeCloseTo(track.length / 20, 3);
  const reset = invalidateLap(lap, -8);
  expect(reset.laps).toBe(2);
  expect(reset.certified).toBe(0);
});
it('rejects reverse crossings, missed gates and shortcuts through the infield', () => {
  const move = (a: number, b: number) => ({
    from: track.sample(a).position,
    to: track.sample(b).position,
    startTime: 0,
    endTime: 1,
  });
  const opened = recordTravel(track, initialLap(-1), move(-1, 2));
  expect(recordTravel(track, opened, move(2, -1)).valid).toBe(false);
  expect(
    recordTravel(
      track,
      opened,
      move(track.length / 4 - 1, track.length / 4 + 1),
    ).valid,
  ).toBe(false);
  expect(recordTravel(track, opened, move(1, track.length / 2)).valid).toBe(
    false,
  );
});
it('orders multiple gates crossed in one straight movement', () => {
  const dense = createTrack({ ...academy, gateCount: 64 });
  const lap = recordTravel(dense, initialLap(-2), {
    from: dense.sample(-2).position,
    to: dense.sample(34).position,
    startTime: 1,
    endTime: 2,
  });
  expect(lap.next).toBe(4);
  expect(lap.laps).toBe(0);
});
