import { expect, it } from 'vitest';
import { dampMotion } from '../../src/physics/stabilization';
import { measureVehicle } from '../../scripts/calibration';
import { advance, brake, fixture, forward } from './fixture';

it('damps lateral and angular momentum without increasing energy or removing forward speed', () => {
  const d = dampMotion({ x: 3, y: 10 }, -2, { x: 1, y: 0 });
  expect(d.velocityMps.x).toBeCloseTo(3 * (1 - 0.5 / 60));
  expect(d.velocityMps.y).toBe(10);
  expect(d.yawRateRadPerSecond).toBeCloseTo(-2 * (1 - 0.7 / 60));
});
it('shares the friction budget across braking, acceleration and lateral slip at all model weights', () => {
  for (const speed of [1, 10 / 3.6, 12, -8])
    for (const input of [brake, forward]) {
      const car = fixture(
        { velocityMps: { x: speed, y: 0.8 }, yawRateRadPerSecond: -0.4 },
        (p) => (p.x > 0 ? 'grass' : 'asphalt'),
      );
      const d = advance(car, { ...input, steering: -1 }).physics!;
      for (const axle of [d.front, d.rear]) {
        expect(Math.abs(axle.tireForceN.x)).toBeGreaterThan(0);
        expect(Math.abs(axle.tireForceN.y)).toBeGreaterThan(0);
        expect(
          Math.hypot(axle.tireForceN.x, axle.tireForceN.y),
        ).toBeLessThanOrEqual(axle.gripN * (1 + 1e-12));
        if (d.modelWeight === 1)
          expect(axle.slipRad * axle.tireForceN.y).toBeLessThan(0);
      }
    }
});
it('repeats the complete measurements and dissipates energy throughout the 120-tick braking turn', () => {
  const run = measureVehicle();
  expect(measureVehicle()).toEqual(run);
  expect(run.turn.maxEnergyGainJ).toBe(0);
  expect(run.turn.combinedForceTicks).toBe(120);
  expect(run.turn.maxUtilization).toBeLessThanOrEqual(1 + 1e-12);
  expect(run.turn.maxUtilization).toBeGreaterThan(0.99);
  expect(run.turn.maxYawRadPerSecond).toBeGreaterThan(0);
});
