import { it, expect } from 'vitest';
import { createTrack, academy, shift } from '../../src/tracks/track';
import { headingAxes } from '../../src/core/math';
import { observe } from '../../src/ai/perception';
import { preview } from '../../src/ai/preview';
import { obstacle, wallIndex } from '../../src/ai/geometry';
import { Brain } from '../../src/ai/network';
import { createVehicle } from '../../src/vehicles/vehicle';
import { standardProfile, rayPose } from '../../src/ai/profile';
const track = createTrack(),
  idx = wallIndex(track),
  v = createVehicle({
    id: 'A',
    startNumber: 1,
    initialState: { positionM: { x: 0, y: 70 } },
  });
function body(
  id: string,
  x: number,
  y: number,
  heading = 0,
  lengthM = 0.2,
  widthM = 0.2,
) {
  return obstacle({
    id,
    position: { x, y },
    heading,
    lengthM,
    widthM,
    velocity: { x: 3, y: 15 },
  });
}
it('SEN-014/016 curve sign in both directions and separate neighborhood masks', () => {
  const pose = track.sample(90);
  for (const sign of [-1, 1]) {
    const h = pose.heading + (sign < 0 ? Math.PI : 0),
      p = preview(track, idx, [], pose.position, h).points[0];
    expect(p?.curvature).toBeCloseTo(-sign / 35, 12);
    expect(p?.position.x).toBeCloseTo(
      track.sample(90 + sign * 5).position.x,
      9,
    );
  }
  const blocked = preview(
    track,
    idx,
    [body('thin', 5.25, 70, 0, 0.01, 1)],
    v.state.positionM,
    0,
  ).points[0];
  expect(blocked?.position.x).toBeCloseTo(5);
  expect(blocked?.heading).toBeNull();
  expect(blocked?.curvature).toBeNull();
});
it('SEN-005/017 hidden vehicle, track ID and distant geometry do not affect brain', () => {
  const wall = body('opaque', 12, 70, 0, 1, 12),
    hidden = body('hidden', 20, 70);
  const a = observe(track, idx, [wall], v, v.state, 0),
    b = observe(track, idx, [hidden, wall], v, v.state, 0);
  expect(a.values).toEqual(b.values);
  const changed = createTrack({
    ...academy,
    id: 'other',
    pieces: academy.pieces.map((p, i) =>
      i === 2 || i === 6 ? { kind: 'line', length: 100 } : p,
    ),
  });
  const c = observe(changed, wallIndex(changed), [wall], v, v.state, 0);
  expect(c.values).toEqual(a.values);
  const brain = new Brain('fixture');
  expect(brain.evaluate(a.values)).toEqual(brain.evaluate(c.values));
});
it('SEN-020/021 four nearest detected slots; rotating frame relative speed', () => {
  const obstacles = [1, 3, 5, 7, 9, 11].map((i, n) => {
    const r = rayPose(standardProfile.rays[i], v.state.positionM, 0);
    const p = shift(r.origin, r.direction, 4 + n * 0.6);
    return body('other' + i, p.x, p.y);
  });
  const a = observe(track, idx, obstacles, v, v.state, 0),
    b = observe(track, idx, obstacles.reverse(), v, v.state, 0);
  expect(
    a.rays.filter((r) => r.vehicle !== null).length,
  ).toBeGreaterThanOrEqual(6);
  expect(a.raw).toEqual(b.raw);
  expect([216, 224, 232, 240].map((i) => a.raw[i])).toEqual([1, 1, 1, 1]);
  expect(a.raw[223]).toBeLessThanOrEqual(a.raw[231]);
  const state = {
      ...v.state,
      headingRad: Math.PI / 2,
      velocityMps: { x: 0, y: 10 },
    },
    target = shift(state.positionM, headingAxes(state.headingRad).forward, 5);
  const o = observe(track, idx, [body('B', target.x, target.y)], v, state, 0);
  expect(o.raw[219]).toBeCloseTo(5, 12);
  expect(o.raw[220]).toBeCloseTo(-3, 12);
});

it('SEN-013/018/019 all seven visible stations on a long straight, ambiguous and out of range cases', () => {
  const long = createTrack({
    ...academy,
    pieces: academy.pieces.map((p, i) =>
      i === 0 || i === 4 ? { kind: 'line', length: 360 } : p,
    ),
  });
  const p = preview(long, wallIndex(long), [], { x: 0, y: 70 }, 0);
  expect(p.points.map((point) => point?.position.x)).toEqual([
    5, 10, 20, 40, 60, 100, 150,
  ]);
  for (const point of p.points) {
    expect(point?.position.y).toBe(70);
    expect(point?.heading).toBe(0);
    expect(point?.curvature).toBe(0);
  }
  // Two equally near, distinct centerlines are an ambiguous local anchor.
  const narrow = createTrack({
    ...academy,
    width: 2,
    runoff: 1,
    barrierThickness: 0.1,
    pieces: [
      { kind: 'line', length: 100 },
      { kind: 'arc', radius: 5, turnRad: -Math.PI },
      { kind: 'line', length: 100 },
      { kind: 'arc', radius: 5, turnRad: -Math.PI },
    ],
  });
  const unobstructed = { ...narrow, barriers: [] };
  expect(
    preview(unobstructed, wallIndex(unobstructed), [], { x: -25, y: 65 }, 0)
      .local,
  ).toBeNull();
  expect(
    preview(track, idx, [], { x: 500, y: 500 }, 0).points.every(
      (point) => point === null,
    ),
  ).toBe(true);
});
