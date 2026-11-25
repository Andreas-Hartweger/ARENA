import { expect, it } from 'vitest';
import { limitTireForce, tireContact, toBody } from '../../src/physics/tires';
import { advance, coast, fixture } from './fixture';

it('resolves steered and yawing contact velocities in the wheel axes', () => {
  for (const u of [-12, 12]) {
    const angle = 0.21,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    const front = tireContact(u, 2, 1.5, 1.325, cos, sin);
    const rear = tireContact(u, 2, 1.5, -1.325, 1, 0);
    const body = toBody(
      { x: front.longitudinalMps, y: front.lateralMps },
      cos,
      sin,
    );
    expect(body.x).toBeCloseTo(u);
    expect(body.y).toBeCloseTo(2 + 1.5 * 1.325);
    expect(rear.lateralMps).toBeCloseTo(2 - 1.5 * 1.325);
    expect(Math.sign(front.slipRad)).toBe(Math.sign(front.lateralMps));
    expect(front.slipRad).toBeCloseTo(
      Math.atan2(front.lateralMps, Math.abs(front.longitudinalMps)),
    );
  }
});

it('scales combined forces proportionally at each grip budget', () => {
  for (const grip of [2869.425, 7970.625]) {
    const { x, y } = limitTireForce(-9000, 12000, grip);
    expect(y / x).toBeCloseTo(-4 / 3);
    expect(Math.hypot(x, y)).toBeCloseTo(grip);
    expect(limitTireForce(100, -50, grip)).toEqual({ x: 100, y: -50 });
  }
});

it('retains lateral slip and produces different yaw with front versus rear grip loss', () => {
  const start = { velocityMps: { x: 22, y: 4 }, steeringAngleRad: 0.1 };
  const frontGrass = fixture(start, (p) => (p.x > 0 ? 'grass' : 'asphalt'));
  const rearGrass = fixture(start, (p) => (p.x < 0 ? 'grass' : 'asphalt'));
  const a = advance(frontGrass, coast).state,
    b = advance(rearGrass, coast).state;
  expect(a.velocityMps.y).toBeGreaterThan(3);
  expect(b.velocityMps.y).toBeGreaterThan(3);
  expect(a.yawRateRadPerSecond).toBeGreaterThan(b.yawRateRadPerSecond);
  expect(
    Math.abs(a.headingRad - Math.atan2(a.velocityMps.y, a.velocityMps.x)),
  ).toBeGreaterThan(0.1);
});
