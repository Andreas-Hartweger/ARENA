import { expect, it } from 'vitest';
import type { Vector2 } from '../../src/core/math';
import type { SurfaceId } from '../../src/vehicles/vehicleSetup';
import { advance, coast, fixture, forward } from './fixture';

it('samples both world axle centers before motion and assigns their individual budgets', () => {
  const points: Vector2[] = [];
  const car = fixture(
    { positionM: { x: 3, y: 7 }, headingRad: Math.PI / 2 },
    (p) => {
      points.push(p);
      return p.y > 7 ? 'grass' : 'asphalt';
    },
  );
  const { physics } = advance(car, forward);
  expect(points).toHaveLength(2);
  expect(points[0].x).toBeCloseTo(3);
  expect(points[0].y).toBeCloseTo(8.325);
  expect(points[1].x).toBeCloseTo(3);
  expect(points[1].y).toBeCloseTo(5.675);
  expect(physics!.front.gripN).toBeCloseTo(2869.425);
  expect(physics!.rear.gripN).toBeCloseTo(7970.625);
});
it('immediately enforces grass grip and interpolates rolling resistance over six ticks', () => {
  let surface: SurfaceId = 'asphalt';
  const car = fixture({ velocityMps: { x: 10, y: 0 } }, () => surface);
  advance(car, coast);
  surface = 'grass';
  for (let i = 1; i <= 6; i++) {
    const d = advance(car, forward).physics!;
    expect(d.front.gripN).toBeCloseTo(2869.425);
    expect(d.front.utilization).toBeLessThanOrEqual(1 + 1e-12);
    expect(d.front.rollingResistance).toBeCloseTo(
      0.015 + ((0.08 - 0.015) * i) / 6,
      12,
    );
    expect(d.rollN).toBeCloseTo(1300 * 9.81 * d.front.rollingResistance);
  }
  expect(car.frame.state.frontAxle.transitionElapsedSeconds).toBe(0.1);
});
it('restarts interrupted transitions at the effective coefficients on that axle', () => {
  let material: SurfaceId = 'asphalt';
  const car = fixture({}, () => material);
  advance(car, coast);
  material = 'grass';
  const grass = advance(car, coast, 2).physics!.front;
  material = 'asphalt';
  const asphalt = advance(car, coast).physics!.front;
  expect(asphalt.rollingResistance).toBeCloseTo(
    grass.rollingResistance + (0.015 - grass.rollingResistance) / 6,
  );
  expect(asphalt.gripN).toBeCloseTo(grass.gripN + (7970.625 - grass.gripN) / 6);
  material = 'grass';
  const interrupted = advance(car, coast).physics!.front;
  expect(interrupted.gripN).toBeCloseTo(2869.425);
  expect(interrupted.rollingResistance).toBeCloseTo(
    asphalt.rollingResistance + (0.08 - asphalt.rollingResistance) / 6,
  );
  for (let i = 0; i < 180; i++) {
    material = i % 2 ? 'grass' : 'asphalt';
    expect(advance(car, forward).physics!.rear.utilization).toBeLessThanOrEqual(
      1 + 1e-12,
    );
  }
});
