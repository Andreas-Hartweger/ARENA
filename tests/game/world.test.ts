import { expect, it } from 'vitest';
import { DriveWorld, type DriverCommand } from '../../src/game/world';
import { FixedStepClock } from '../../src/core/fixedStepClock';
import { runHeadlessTicks } from '../../src/core/ticks';
import { createTrack } from '../../src/tracks/track';
import { neutralControl } from '../../src/input/controlInput';
import { SeededRandom } from '../../src/core/random';
const track = createTrack();
const player = {
  id: 'player',
  startNumber: 7,
  initialState: { positionM: { x: -8, y: 70 } },
};

it('replays tick-indexed input for two cars identically at 30, 60 and 144 FPS and headless', () => {
  function run(fps?: number) {
    const rng = new SeededRandom(304),
      world = new DriveWorld(track, [
        player,
        {
          ...player,
          id: 'second',
          initialState: { positionM: { x: 0, y: 70 } },
        },
      ]);
    let impacts = 0;
    const tick = () => {
      const command: DriverCommand = {
        command: {
          kind: 'analog',
          request: {
            ...neutralControl('forward'),
            throttle: 1,
            steering: 0.05 * (rng.next() - 0.5),
          },
        },
      };
      impacts += world.step(new Map([['player', command]])).events.length;
    };
    if (fps) {
      const clock = new FixedStepClock();
      for (let i = 0; i <= 4 * fps; i++)
        expect(clock.advanceFrame(i / fps, tick).discardedTicks).toBe(0);
    } else runHeadlessTicks(240, tick);
    expect(world.frame.index).toBe(240);
    expect(impacts).toBeGreaterThan(0);
    return { frame: world.frame, impacts };
  }
  const baseline = run();
  for (const fps of [30, 60, 144]) expect(run(fps)).toEqual(baseline);
});

it('recovers without crossing a gate or retaining old motion, or rejects with no safe history', () => {
  const world = new DriveWorld(track, [
    {
      ...player,
      initialState: {
        positionM: { x: -0.2, y: 70 },
        velocityMps: { x: 30, y: 0 },
      },
    },
  ]);
  const reset = new Map<string, DriverCommand>([
    [
      'player',
      {
        recover: true,
        command: { kind: 'analog', request: neutralControl('forward') },
      },
    ],
  ]);
  const car = world.step(reset).cars[0];
  expect(car.recovery).toBe('accepted');
  expect(car.state.discontinuity).toBe(true);
  expect(car.state.positionM.x).toBe(-0.2);
  expect(car.state.velocityMps).toEqual({ x: 0, y: 0 });
  expect(car.lap.started).toBeNull();
  expect(car.lap.certified).toBe(0);
  const grass = new DriveWorld(track, [
    { ...player, initialState: { positionM: { x: 0, y: 80 } } },
  ]);
  expect(grass.step(reset).cars[0].recovery).toBe('blocked');
});

it('isolates an independent candidate from another car exhausting the wall budget', () => {
  const moving = {
    ...player,
    initialState: { positionM: { x: 0, y: 70 }, velocityMps: { x: 10, y: 0 } },
  };
  const fast = {
    ...player,
    id: 'fast',
    initialState: { positionM: { x: 0, y: 72 }, velocityMps: { x: 0, y: 700 } },
  };
  const separate = new DriveWorld(track, [moving], false).step(new Map());
  const together = new DriveWorld(track, [moving, fast], false).step(new Map());
  expect(together.fallback).toBe(true);
  expect(together.cars.find((c) => c.id === 'player')).toEqual(
    separate.cars[0],
  );
});

it('locates a vehicle spawned on the opposite straight without a start-line projection hint', () => {
  const point = track.sample(track.length * 0.48).position;
  const w = new DriveWorld(track, [
    { ...player, initialState: { positionM: point } },
  ]);
  expect(w.frame.cars[0].lap.s).toBeCloseTo(track.length * 0.48);
});

// Fixed keyboard pulses from the starting grid. The replay never reads the vehicle pose to steer.
function digitalAxis(rise: number, fall: number) {
  let value = 0,
    error = 0;
  return (target: number) => {
    const high = Math.min(1, value + rise),
      low = Math.max(0, value - fall);
    const pressed =
      target > 0 && (target === 1 || error + (high + low) / 2 < target);
    value = pressed ? high : low;
    error = target === 0 || target === 1 ? 0 : error + value - target;
    return pressed;
  };
}
it('drives two timed Academy laps from rest with a fixed keyboard recording', () => {
  const w = new DriveWorld(track, [player]);
  const gas = digitalAxis(1 / 15, 1 / 7.2),
    right = digitalAxis(1 / 15, 1 / 12);
  let impacts = 0;
  function block(ticks: number, throttle: number, steering: number) {
    for (let i = 0; i < ticks; i++) {
      const buttons = {
        forward: gas(throttle),
        right: right(steering),
        left: false,
        reverse: false,
      };
      impacts += w.step(
        new Map([
          ['player', { command: { kind: 'keyboard', sample: { buttons } } }],
        ]),
      ).events.length;
    }
  }
  block(88, 1, 0);
  block(458, 0.02423, 0);
  for (let corner = 0; corner < 8; corner++) {
    block(330, 0.040404, 0.242779);
    block(corner % 2 === 0 ? 420 : 900, 0.02423, 0);
  }
  const lap = w.frame.cars[0].lap;
  expect(impacts).toBe(0);
  expect(lap.valid).toBe(true);
  expect(lap.laps).toBe(2);
  expect(lap.last).toBeGreaterThan(60);
  expect(lap.last).toBeLessThan(70);
});
