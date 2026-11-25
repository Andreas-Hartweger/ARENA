import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SeededRandom } from '../../src/core/random';
import { createVehicle } from '../../src/vehicles/vehicle';
import { createTrack } from '../../src/tracks/track';
import { profile, rayPose, standardProfile } from '../../src/ai/profile';
import { registry, normalize, signature } from '../../src/ai/schema';
import { hit, measure, obstacle, wallIndex } from '../../src/ai/geometry';
import { preview } from '../../src/ai/preview';
import { observe } from '../../src/ai/perception';
const track = createTrack(),
  walls = wallIndex(track),
  v = createVehicle({
    id: 'ego',
    startNumber: 1,
    initialState: { positionM: { x: 0, y: 70 } },
  });
const ray = { origin: { x: 0, y: 71 }, direction: { x: 0, y: 1 }, range: 20 };
const body = (y: number, id = 'car') =>
  obstacle({
    position: { x: 0, y },
    heading: 0,
    widthM: 2,
    lengthM: 4,
    id,
    velocity: { x: 3, y: 15 },
  });
describe('Perception', () => {
  it('SEN-001–003 validates owned sensors and transforms', () => {
    const { rays } = standardProfile;
    expect(rays).toHaveLength(16);
    expect(standardProfile.hz).toBe(30);
    expect(rays.map((r) => r.angle)).toEqual([
      -90, -60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60, 90, -135, 135, 180,
    ]);
    expect(rayPose(rays[6], { x: 10, y: 20 }, Math.PI / 2).origin).toEqual({
      x: 10,
      y: 22.2,
    });
    for (const bad of [{ x: 3 }, { y: NaN }, { range: -1 }, { id: 'ray01' }])
      expect(() =>
        profile([{ ...rays[0], ...bad }, ...rays.slice(1)]),
      ).toThrow();
    expect(() => profile(rays, 7)).toThrow();
  });
  it('SEN-004–011 independent channels, boundaries and blocker ties', () => {
    const m = (cars: ReturnType<typeof body>[], range = 20) =>
      measure(track, walls, { ...ray, range }, cars);
    expect(m([])).toMatchObject({
      edge: 5,
      barrier: 13,
      vehicle: null,
      material: 'grass',
    });
    expect(m([body(90)])).toMatchObject({ vehicle: null, barrier: 13 });
    expect(m([body(80)])).toMatchObject({ edge: 5, vehicle: 8, barrier: null });
    expect(m([body(85)])).toMatchObject({ vehicle: null, barrier: 13 });
    expect(m([], 5)).toMatchObject({ edge: 5, material: null });
    expect(m([], 13).barrier).toBe(13);
    expect(m([], 13 - 0.00001).barrier).toBeNull();
    expect(m([body(71)]).vehicle).toBe(0);
    expect(hit({ ...ray, origin: { x: 2, y: 71 } }, body(80))).toBe(8);
    expect(hit({ ...ray, origin: { x: 2.1, y: 71 } }, body(80))).toBe(Infinity);
    expect(
      measure(
        track,
        walls,
        { origin: { x: 0, y: 80 }, direction: { x: 0, y: -1 }, range: 10 },
        [],
      ).material,
    ).toBe('asphalt');
  });
  it('SEN-012 compares 1002 seeded rays to exhaustive polygon search', () => {
    for (const seed of [0, 1, 42]) {
      const rng = new SeededRandom(seed);
      for (let i = 0; i < 334; i++) {
        const p = track.sample(
          rng.next() * track.length,
          (rng.next() - 0.5) * 30,
        );
        const r = rayPose(
          standardProfile.rays[i % 16],
          p.position,
          rng.next() * Math.PI * 2,
        );
        const others = [body(70 + 10 * rng.next())];
        expect(measure(track, walls, r, others)).toEqual(
          measure(track, walls, r, others, true),
        );
      }
    }
  });
  it('SEN-013–019 visible straight, curve, hidden continuation, ambiguity and range', () => {
    const sight = (x: number, h = 0, others: ReturnType<typeof body>[] = []) =>
      preview(track, walls, others, { x, y: 70 }, h);
    const straight = sight(-75);
    expect(straight.points[0]).toMatchObject({
      position: { x: -70, y: 70 },
      heading: 0,
      curvature: 0,
    });
    expect(straight.points[6]?.curvature).toBeNull();
    expect(sight(0, Math.PI / 2).local).toBeNull();
    expect(sight(0, Math.PI).points[0]?.position.x).toBeCloseTo(-5, 9);
    const wall = obstacle({
      id: 'thin',
      position: { x: 12.25, y: 70 },
      heading: 0,
      lengthM: 0.001,
      widthM: 2,
      velocity: { x: 0, y: 0 },
    });
    const blocked = sight(0, 0, [wall]);
    expect(blocked.points.slice(2)).toEqual([null, null, null, null, null]);
    const curve = track.sample(85);
    const curved = preview(track, walls, [], curve.position, curve.heading);
    expect(curved.local?.heading).toBeCloseTo(curve.heading);
  });
  it('OBS-001–005 and SEN-022 full register, strict masks and grip', () => {
    const channels = registry();
    const rows = readFileSync(
      'docs/first-intelligence/observation_channels.csv',
      'utf8',
    )
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.split(';'));
    expect(rows).toHaveLength(248);
    expect(
      channels.map((c) => [c.id, c.unit, c.min, c.max, c.rule, c.mask]),
    ).toEqual(rows.map((r) => [r[2], r[3], +r[4], +r[5], r[6], r[7]]));
    const obs = observe(track, walls, [], v, v.state, 0);
    expect(obs.raw[8]).toBe(v.setup.surfaces.asphalt.friction);
    expect(obs.raw.slice(216)).toEqual(Array(32).fill(0));
    const raw = obs.raw.slice();
    raw[0] = 37.5;
    raw[2] = -15;
    raw[8] = 1.25;
    raw[3] = 6;
    const result = normalize(raw, channels);
    expect([0, 2, 8, 3].map((i) => result.values[i])).toEqual([
      0.5, -0.5, 0.625, 1,
    ]);
    expect(result.clamped).toContain(3);
    for (const [i, value] of [
      [0, NaN],
      [5, 0],
      [7, 1],
      [217, 1],
    ]) {
      const bad = raw.slice();
      bad[i] = value;
      expect(() => normalize(bad, channels)).toThrow();
    }
    expect(signature(v)).not.toBe(signature(v, standardProfile, 60));
    expect(signature(v)).toBe(signature({ ...v, setup: { ...v.setup } }));
  });
});

it('SEN-009 detects shallow crossings on the straight in both directions', () => {
  for (const sign of [-1, 1]) {
    const dy = sign * 1e-6;
    const r = {
      origin: { x: 0, y: 76 - 10 * dy },
      direction: { x: Math.sqrt(1 - dy * dy), y: dy },
      range: 20,
    };
    const result = measure(track, walls, r, []);
    expect(result.edge).toBeCloseTo(10, 7);
    expect(result.material).toBe(sign > 0 ? 'grass' : 'asphalt');
  }
});
it('OBS-004 rejects a missing numeric channel', () => {
  const raw = observe(track, walls, [], v, v.state, 0).raw;
  delete raw[0];
  expect(() => normalize(raw, registry())).toThrow();
});

it('OBS-004 rejects material without an edge and simultaneous opaque returns', () => {
  const raw = observe(track, walls, [], v, v.state, 0).raw;
  const noEdge = raw.slice();
  noEdge.splice(12, 9, 0, 0, 0, 0, 0, 0, 1, 0, 1);
  expect(() => normalize(noEdge, registry())).toThrow(/ray00/);
  const doubleHit = raw.slice();
  doubleHit.splice(12, 9, 0, 0, 5, 1, 6, 1, 0, 0, 0);
  expect(() => normalize(doubleHit, registry())).toThrow(/ray00/);
});
