import { expect, it } from 'vitest';
import { FixedStepClock } from '../../src/core/fixedStepClock';
import { SeededRandom } from '../../src/core/random';
import { runHeadlessTicks } from '../../src/core/ticks';
import { stepKeyboardControls } from '../../src/input/keyboardControls';
import { calculateFreeMotion } from '../../src/physics/vehicleDynamics';
import { createVehicle } from '../../src/vehicles/vehicle';
import { VehicleTickSession } from '../../src/physics/vehicleTick';
import {
  createGT01Setup,
  type SurfaceId,
} from '../../src/vehicles/vehicleSetup';
import { advance, brake, coast, fixture, forward, reverse } from './fixture';

const reverseKeys = {
  buttons: { reverse: true, forward: false, left: false, right: true },
};

it('publishes keyboard and analog reversals after exactly 18 consecutive stationary ticks', () => {
  const keys = fixture(),
    analog = fixture();
  for (let i = 1; i <= 18; i++) {
    const a = advance(analog, reverse),
      k = keys.step({ kind: 'keyboard', sample: reverseKeys });
    for (const frame of [a, k]) {
      expect(frame.state.drive.oppositeHeldTicks).toBe(i % 18);
      expect(frame.state.drive.direction).toBe(i < 18 ? 'forward' : 'reverse');
      if (i < 18) expect(frame.state.velocityMps.x).toBe(0);
      else expect(frame.state.velocityMps.x).toBeLessThan(0);
    }
  }
  expect(keys.frame.keyboard.throttle).toBeCloseTo(1 / 15);
});
it('resets a pending reversal during sideways sliding and retains lateral momentum', () => {
  const car = fixture({
    velocityMps: { x: 0, y: 2 },
    drive: { direction: 'forward', oppositeHeldTicks: 17 },
  });
  const d = advance(car, reverse);
  expect(d.state.drive).toEqual({ direction: 'forward', oppositeHeldTicks: 0 });
  expect(d.state.velocityMps.y).toBeGreaterThan(1);
  expect(d.physics!.driveN).toBe(0);
});
it('uses the same forces for equivalent keyboard and analog tick commands', () => {
  const keyboard = fixture(),
    analog = fixture();
  const sample = {
    buttons: { forward: true, reverse: false, left: true, right: false },
  };
  for (let i = 0; i < 90; i++) {
    const { keyboard: prior, state } = keyboard.frame;
    const resolved = stepKeyboardControls(
      prior,
      sample,
      state.drive,
      state.velocityMps,
    );
    const frame = keyboard.step({ kind: 'keyboard', sample });
    expect(advance(analog, resolved.input).state).toEqual(frame.state);
  }
});
it('neutralizes invalid raw fields and applies brake priority before computing forces', () => {
  const car = fixture({ velocityMps: { x: 12, y: 0 } });
  const d = advance(car, { ...forward, brake: 1 });
  expect(d.physics!.driveN).toBe(0);
  expect(d.physics!.brakeN).toBeLessThan(0);
  expect(d.state.velocityMps.x).toBeLessThan(12);
  const bad = advance(car, {
    ...brake,
    brake: Infinity,
    throttle: NaN,
    steering: -Infinity,
  });
  expect(bad.controlDiagnostics).toHaveLength(3);
  expect(bad.physics!.driveN).toBe(0);
  expect(bad.physics!.brakeN).toBe(0);
});
it('delivers an unpublished free-motion candidate with semi-implicit translation and rotation', () => {
  const car = createVehicle({
    id: 'candidate',
    startNumber: 1,
    initialState: { velocityMps: { x: 20, y: 1 }, yawRateRadPerSecond: 0.2 },
  });
  const before = structuredClone(car.state);
  const { state, physics } = calculateFreeMotion(
    car,
    car.state,
    { ...forward, steering: -1 },
    () => 'asphalt',
    true,
  );
  const d = physics!;
  const moment = 1.325 * (d.front.bodyForceN.y - d.rear.bodyForceN.y);
  expect(state.yawRateRadPerSecond).toBeCloseTo(
    (0.2 + moment / 2600 / 60) * (1 - 0.7 / 60),
    12,
  );
  expect(state.headingRad).toBeCloseTo(state.yawRateRadPerSecond / 60, 12);
  expect(state.positionM.x).toBeCloseTo(state.velocityMps.x / 60, 12);
  expect(state.positionM.y).toBeCloseTo(state.velocityMps.y / 60, 12);
  state.velocityMps = { x: 80, y: 0 };
  state.drive = { direction: 'reverse', oppositeHeldTicks: 0 };
  expect(car.state).toEqual(before);
});

it('preserves the whole confirmed frame on a rear query exception and locks the session', () => {
  let calls = 0;
  const car = fixture({ resetStatus: 'requested' }, () => {
    calls++;
    if (calls === 4) throw new Error('rear sensor offline');
    return calls === 3 ? 'grass' : 'asphalt';
  });
  const first = car.step({ kind: 'keyboard', sample: reverseKeys });
  const copy = structuredClone(first);
  expect(first.state.drive.oppositeHeldTicks).toBe(1);
  expect(first.keyboard.steering).toBeGreaterThan(0);
  expect(() => car.step({ kind: 'keyboard', sample: reverseKeys })).toThrow(
    /tick 2 failed: rear sensor offline/,
  );
  expect(car.frame).toBe(first);
  expect(car.frame).toEqual(copy);
  expect(car.failed).toBe(true);
  expect(() => advance(car, forward)).toThrow(/locked/);
  expect(calls).toBe(4);
});
it('rejects invalid parameters, unknown surfaces and numeric overflow before publication', () => {
  const setup = createGT01Setup();
  setup.maxDriveForceN = Infinity;
  expect(
    () =>
      new VehicleTickSession(
        { id: 'bad', startNumber: 1, setup },
        () => 'asphalt',
      ),
  ).toThrow(/maxDriveForceN/);
  const unknown = fixture({}, () => 'ice' as SurfaceId);
  expect(() => advance(unknown, forward)).toThrow(/surface/);
  expect(unknown.frame.index).toBe(0);
  const overflow = fixture({ velocityMps: { x: 1e200, y: 0 } });
  expect(() => advance(overflow, forward)).toThrow(/finite/);
  expect(overflow.failed).toBe(true);
});
it('isolates frozen published frames and produces the same motion with diagnostics disabled', () => {
  const observed = fixture();
  const headless = new VehicleTickSession(
    { id: 'headless', startNumber: 2 },
    () => 'asphalt',
  );
  const first = advance(observed, forward);
  expect(Object.isFrozen(first.state.velocityMps)).toBe(true);
  expect(Object.isFrozen(first.physics!.front.tireForceN)).toBe(true);
  advance(observed, forward, 29);
  expect(first.index).toBe(1);
  expect(first.state.positionM.x).toBeLessThan(
    observed.frame.state.positionM.x,
  );
  expect(advance(headless, forward, 30).state).toEqual(observed.frame.state);
  expect(headless.frame.physics).toBeUndefined();
});
it('matches complete seeded headless frames at 30, 60 and 144 FPS without dropped ticks', () => {
  function run(fps?: number) {
    const car = fixture({}, (p) => (p.x > 5 ? 'grass' : 'asphalt')),
      rng = new SeededRandom(123);
    const tick = () =>
      advance(car, { ...forward, steering: 2 * rng.next() - 1 });
    if (fps === undefined) runHeadlessTicks(240, tick);
    else {
      const clock = new FixedStepClock();
      for (let i = 0; i <= 4 * fps; i++)
        expect(clock.advanceFrame(i / fps, tick).discardedTicks).toBe(0);
    }
    expect(car.frame.index).toBe(240);
    return car.frame;
  }
  const reference = run();
  for (const fps of [30, 60, 144]) expect(run(fps)).toEqual(reference);
  expect(run()).toEqual(reference);
});
it('keeps the clock on the last successful index when a vehicle tick fails', () => {
  const clock = new FixedStepClock(),
    car = fixture({}, () => {
      throw new Error('sample failed');
    });
  clock.pause();
  expect(() => clock.stepOnce(() => advance(car, coast))).toThrow(
    /sample failed/,
  );
  expect(clock.tickIndex).toBe(car.frame.index);
  expect(car.failed).toBe(true);
});
