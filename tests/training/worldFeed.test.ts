import { expect, it } from 'vitest';
import { solveContacts, compileWalls } from '../../src/collision/solver';
import { type Body } from '../../src/collision/contact';
import { DriveWorld } from '../../src/game/world';
import { createTrack } from '../../src/tracks/track';
import { neutralControl } from '../../src/input/controlInput';
import {
  initialLap,
  recordTravel,
  type TravelFact,
} from '../../src/tracks/progress';
import { ProgressLedger } from '../../src/training/fitness';

const walls = compileWalls([
  {
    id: 'wall',
    a: { x: 0, y: -10 },
    b: { x: 0, y: 10 },
    outerA: { x: 0.02, y: -10 },
    outerB: { x: 0.02, y: 10 },
  },
]);
const body = (x: number, speed: number): Body => ({
  id: 'a',
  position: { x, y: 0 },
  velocity: { x: speed, y: 0 },
  heading: 0,
  yaw: 0,
  lengthM: 4.5,
  widthM: 1.95,
  invMass: 1 / 1300,
  invInertia: 1 / 2600,
});
it('PEN-003 PEN-004 PRG-009 collects resting and gentle contacts, discards ambiguous contact candidates', () => {
  for (const v of [0, 0.1]) {
    const a = body(-2.25, v),
      b = body(-2.25, v),
      off = solveContacts([a], walls, 1),
      on = solveContacts([b], walls, 1, true, true);
    expect(on.events).toEqual([]);
    expect(on.paths).toEqual(off.paths);
    expect(b).toEqual(a);
    expect(on.contacts![0]).toHaveLength(1);
    expect(on.contacts![0][0]).toMatchObject({
      start: 0,
      end: 1 / 60,
      approach: v,
      partners: ['wall'],
    });
  }
  const a = body(-8, 700);
  a.yaw = 100;
  const rolled = solveContacts([a], walls, 1, true, true);
  expect(rolled.fallback).toBe(true);
  const last = rolled.paths[0].at(-1)?.endTime ?? 0;
  expect(rolled.contacts![0].every((c) => c.end <= last)).toBe(true);
  const stacked = Array.from({ length: 9 }, (_, i) => ({
    ...body(-0.1, 0),
    id: String(i),
  }));
  const all = solveContacts(stacked, walls, 1, true, true);
  expect(all.fallback).toBe(true);
  expect(all.paths.flat()).toEqual([]);
  expect(all.contacts!.flat()).toEqual([]);
  expect(all.events).toEqual([]);
});
it('REG-002 REG-004 PRG-007 publishes one immutable feed with all cars or preserves the entire old frame', () => {
  const t = createTrack(),
    options = {
      id: 'a',
      startNumber: 0,
      initialState: { positionM: t.sample(-8).position },
    };
  const off = new DriveWorld(t, [options], false),
    on = new DriveWorld(t, [options], false, new Map(), true);
  for (let i = 0; i < 190; i++) {
    const commands = new Map([
      [
        'a',
        {
          command: {
            kind: 'analog' as const,
            request: {
              ...neutralControl('forward'),
              throttle: 1,
              steering: 0.1,
            },
          },
          recover: i === 176,
        },
      ],
    ]);
    const { evaluation, ...measured } = on.step(commands);
    expect(measured).toEqual(off.step(commands));
    expect(Object.isFrozen(evaluation![0].travel)).toBe(true);
  }
  const prior = on.frame;
  t.surfaceQuery = () => {
    throw Error('fixture failure');
  };
  expect(() => on.step(new Map())).toThrow(/fixture failure/);
  expect(on.frame).toBe(prior);
  expect(() => on.step(new Map())).toThrow(/locked/);
});
it('PRG-003 PRG-006 PRG-008 protects against wrong-order gates, infield cutting and repeated start-line crossings', () => {
  const t = createTrack(),
    l = new ProgressLedger(t.length, 8, 1, -8);
  let lap = initialLap(-8);
  function travel(a: number, b: number, offset = 0) {
    const f: TravelFact[] = [];
    lap = recordTravel(
      t,
      lap,
      {
        from: t.sample(a, offset).position,
        to: t.sample(b, offset).position,
        startTime: 0,
        endTime: 1,
      },
      f,
    );
    l.accept(f);
    return f;
  }
  travel(-8, 2);
  const high = l.partial;
  travel(t.length / 4 - 1, t.length / 4 + 1);
  expect(lap.valid).toBe(false);
  expect(lap.certified).toBe(0);
  expect(l.fractions.K).toBe(0);
  travel(3, 7);
  const invalidHigh = l.partial;
  expect(invalidHigh).toBeGreaterThanOrEqual(high);
  travel(1, -1);
  travel(-1, 1);
  expect(l.partial).toBe(invalidHigh);
  // Clockwise bend, inside grass just beyond the 6 m road half-width.
  travel(83, 84, -6.1);
  expect(lap.valid).toBe(false);
});
