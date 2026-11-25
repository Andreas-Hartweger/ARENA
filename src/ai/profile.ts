import { headingAxes, type Vector2 } from '../core/math';
import { shift } from '../tracks/track';
import { GT_01 } from '../vehicles/vehicleDefinition';
export interface Sensor {
  id: string;
  angle: number;
  x: number;
  y: number;
  range: number;
}
export function period(hz: number) {
  if (!Number.isInteger(hz) || hz <= 0 || 60 % hz !== 0)
    throw Error('Invalid frequency: ' + hz);
  return 60 / hz;
}
export function profile(rays: readonly Sensor[], hz = 30) {
  period(hz);
  if (rays.length !== 16 || new Set(rays.map((r) => r.id)).size !== 16)
    throw Error('Invalid ray IDs');
  for (const r of rays) {
    if (
      !r.id ||
      ![r.x, r.y, r.angle, r.range].every(Number.isFinite) ||
      r.range <= 0 ||
      Math.abs(r.x) > GT_01.lengthM / 2 ||
      Math.abs(r.y) > GT_01.widthM / 2
    )
      throw Error('Invalid sensor ' + r.id);
  }
  return Object.freeze({
    id: 'arena.perception.standard.v1',
    hz,
    rays: Object.freeze(rays.map((r) => Object.freeze({ ...r }))),
  });
}
export const standardProfile = profile(
  [
    [-90, 0, -0.925, 75],
    [-60, 1.9, -0.9, 100],
    [-45, 1.9, -0.9, 120],
    [-30, 2.2, 0, 120],
    [-20, 2.2, 0, 150],
    [-10, 2.2, 0, 150],
    [0, 2.2, 0, 150],
    [10, 2.2, 0, 150],
    [20, 2.2, 0, 150],
    [30, 2.2, 0, 120],
    [45, 1.9, 0.9, 120],
    [60, 1.9, 0.9, 100],
    [90, 0, 0.925, 75],
    [-135, -2.2, -0.9, 60],
    [135, -2.2, 0.9, 60],
    [180, -2.2, 0, 60],
  ].map(([angle, x, y, range], i) => ({
    id: 'ray' + String(i).padStart(2, '0'),
    angle,
    x,
    y,
    range,
  })),
);
export function rayPose(sensor: Sensor, position: Vector2, heading: number) {
  const axes = headingAxes(heading);
  return {
    origin: shift(shift(position, axes.forward, sensor.x), axes.left, sensor.y),
    direction: headingAxes(heading + (sensor.angle * Math.PI) / 180).forward,
    range: sensor.range,
  };
}
