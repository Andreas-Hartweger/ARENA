import { expect, it } from 'vitest';
import { modelWeight } from '../../src/physics/handling';
import { advance, coast, fixture } from './fixture';

it('blends side force smoothly at both speed boundaries and through the midpoint', () => {
  const start = 5 / 3.6,
    end = 15 / 3.6;
  for (const [fraction, expected] of [
    [-1, 0],
    [0, 0],
    [0.25, 0.15625],
    [0.5, 0.5],
    [1, 1],
    [2, 1],
  ]) {
    const speed = start + fraction * (end - start);
    expect(modelWeight(speed, start, end)).toBeCloseTo(expected, 12);
  }
  for (const boundary of [start, end]) {
    const yaw = (speed: number) =>
      advance(fixture({ velocityMps: { x: speed, y: 0 } }), {
        ...coast,
        steering: -1,
      }).state.yawRateRadPerSecond;
    expect(Math.abs(yaw(boundary + 1e-6) - yaw(boundary - 1e-6))).toBeLessThan(
      1e-6,
    );
  }
});

it('steers to the mechanical limit at rest with a two-degree step and no motion', () => {
  const car = fixture(),
    left = { ...coast, steering: -1 };
  expect(advance(car, left).state.steeringAngleRad).toBeCloseTo(Math.PI / 90);
  const { state } = advance(car, left, 30);
  expect(state.steeringAngleRad).toBe(Math.PI / 6);
  expect(state.yawRateRadPerSecond).toBe(0);
  expect(state.positionM).toEqual({ x: 0, y: 0 });
});
it('moves toward a suddenly smaller target envelope at the physical steering rate', () => {
  const car = fixture({
    velocityMps: { x: 30, y: 0 },
    steeringAngleRad: Math.PI / 6,
  });
  const frame = advance(car, { ...coast, steering: -1 });
  expect(frame.physics!.steeringLimitRad).toBeCloseTo(Math.PI / 30);
  expect(frame.state.steeringAngleRad).toBeCloseTo(Math.PI / 6 - Math.PI / 90);
});
it('turns in opposite directions with left and right steering and reverses yaw when backing up', () => {
  for (const speed of [1, -1, 8, -8])
    for (const steering of [1, -1]) {
      const car = fixture({ velocityMps: { x: speed, y: 0 } });
      const { state } = advance(car, { ...coast, steering }, 15);
      expect(Math.sign(state.yawRateRadPerSecond)).toBe(
        -Math.sign(speed) * steering,
      );
      expect(Math.sign(state.headingRad)).toBe(-Math.sign(speed) * steering);
      if (Math.abs(speed) === 1)
        expect(Math.abs(state.headingRad)).toBeLessThan(0.1);
    }
});
