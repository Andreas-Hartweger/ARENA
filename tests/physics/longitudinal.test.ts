import { expect, it } from 'vitest';
import { advance, brake, coast, fixture, forward, reverse } from './fixture';

it('reaches the acceleration and stationary top-speed targets on dry asphalt', () => {
  const car = fixture();
  let crossing = 0;
  let lastSecond = 0;
  for (let tick = 1; tick <= 10800; tick++) {
    const { state } = advance(car, forward);
    if (!crossing && state.velocityMps.x >= 100 / 3.6) crossing = tick;
    if (tick === 10740) lastSecond = state.velocityMps.x;
  }
  expect(crossing / 60).toBeGreaterThanOrEqual(3.5);
  expect(crossing / 60).toBeLessThanOrEqual(4.1);
  expect(car.frame.state.velocityMps.x * 3.6).toBeGreaterThanOrEqual(245);
  expect(car.frame.state.velocityMps.x * 3.6).toBeLessThanOrEqual(255);
  expect(lastSecond).toBeCloseTo(car.frame.state.velocityMps.x, 8);
  expect(car.frame.state.positionM.y).toBe(0);
});

it('brakes from exactly 100 km/h to rest inside the distance corridor', () => {
  const car = fixture({ velocityMps: { x: 100 / 3.6, y: 0 } });
  let ticks = 0;
  while (car.frame.state.velocityMps.x > 0 && ticks < 200) {
    advance(car, brake);
    ticks++;
  }
  const startSpeed = 100 / 3.6;
  const rollDeceleration = 0.015 * 9.81;
  const peakDragDeceleration = (0.5 * 1.225 * 0.75 * startSpeed ** 2) / 1300;
  expect(ticks / 60).toBeGreaterThanOrEqual(
    startSpeed / (12 + rollDeceleration + peakDragDeceleration),
  );
  expect(ticks / 60).toBeLessThanOrEqual(
    startSpeed / (12 + rollDeceleration) + 1 / 60,
  );
  expect(car.frame.state.positionM.x).toBeGreaterThanOrEqual(29);
  expect(car.frame.state.positionM.x).toBeLessThanOrEqual(35);
  expect(advance(car, brake, 12).state.velocityMps.x).toBe(0);
});

it('limits propulsion by force, power and direction-specific linear tapers', () => {
  function drive(speedKmh: number, backwards = false) {
    const request = backwards ? reverse : forward;
    const car = fixture({
      velocityMps: { x: speedKmh / 3.6, y: 0 },
      drive: { direction: request.direction, oppositeHeldTicks: 0 },
    });
    return advance(car, request).physics!.driveN;
  }
  expect(drive(0)).toBe(9800);
  expect(drive(180)).toBeCloseTo((0.85 * 330974.4375) / 50);
  expect(drive(250)).toBeCloseTo((0.5 * 0.85 * 330974.4375) / (250 / 3.6));
  expect(drive(260)).toBe(0);
  expect(drive(-27.5, true)).toBeCloseTo((-9800 * 0.35) / 2);
  expect(Math.abs(drive(-30, true))).toBe(0);
});

it('approaches the reverse limit under power and retains external overspeed', () => {
  const car = fixture();
  const peak = Math.abs(advance(car, reverse, 3600).state.velocityMps.x) * 3.6;
  expect(peak).toBeGreaterThan(29);
  expect(peak).toBeLessThanOrEqual(30);
  for (const speed of [85, -12]) {
    const request = speed > 0 ? forward : reverse;
    const car = fixture({
      velocityMps: { x: speed, y: 0 },
      drive: { direction: request.direction, oppositeHeldTicks: 0 },
    });
    expect(Math.abs(advance(car, request).state.velocityMps.x)).toBeGreaterThan(
      Math.abs(speed) - 0.1,
    );
  }
});

it('settles residual motion after a turning stop while preserving meaningful sideways speed', () => {
  const car = fixture({
    velocityMps: { x: 10, y: 1 },
    headingRad: 0.2,
    yawRateRadPerSecond: 0.3,
  });
  const stopped = advance(car, { ...brake, steering: 1 }, 240).state;
  expect(stopped.velocityMps).toEqual({ x: 0, y: 0 });
  expect(stopped.yawRateRadPerSecond).toBe(0);
  expect(advance(car, brake).state.positionM).toEqual(stopped.positionM);
  const sliding = fixture({ velocityMps: { x: 0, y: 0.04 } });
  expect(advance(sliding, coast).state.velocityMps.y).toBeGreaterThan(0.02);
});

it('coasts monotonically to rest in either direction without crossing zero', () => {
  for (const sign of [1, -1]) {
    const car = fixture({ velocityMps: { x: sign * 0.15, y: 0 } });
    let previous = 0.15;
    for (let i = 0; i < 120; i++) {
      const speed = sign * advance(car, coast).state.velocityMps.x;
      expect(speed >= 0 && speed <= previous).toBe(true);
      previous = speed;
    }
    expect(Math.abs(previous)).toBe(0);
  }
});
