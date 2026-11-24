import { requireFinite } from './validation';

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

const FULL_TURN = 2 * Math.PI;

export function normalizeAngle(angle: number): number {
  const wrapped = requireFinite(angle, 'angle') % FULL_TURN;
  if (wrapped >= Math.PI) return wrapped - FULL_TURN;
  if (wrapped < -Math.PI) return wrapped + FULL_TURN;
  return wrapped || 0;
}

export function headingAxes(angle: number): {
  forward: Vector2;
  left: Vector2;
} {
  const heading = normalizeAngle(angle);
  const x = Math.cos(heading);
  const y = Math.sin(heading);
  return { forward: { x, y }, left: { x: -y, y: x } };
}

export function dot(a: Vector2, b: Vector2): number {
  return requireFinite(
    requireFinite(a.x, 'a.x') * requireFinite(b.x, 'b.x') +
      requireFinite(a.y, 'a.y') * requireFinite(b.y, 'b.y'),
    'dot product',
  );
}

export function metersPerSecondToKilometersPerHour(speed: number): number {
  return requireFinite(speed * 3.6, 'speed in km/h');
}

export function interpolateAngle(
  from: number,
  to: number,
  alpha: number,
): number {
  const start = normalizeAngle(from);
  const delta = normalizeAngle(normalizeAngle(to) - start);
  return normalizeAngle(start + delta * interpolationFraction(alpha));
}

export function interpolatePosition(
  from: Vector2,
  to: Vector2,
  alpha: number,
): Vector2 {
  const fraction = interpolationFraction(alpha);
  return {
    x: interpolateCoordinate(from.x, to.x, fraction),
    y: interpolateCoordinate(from.y, to.y, fraction),
  };
}

function interpolationFraction(alpha: number): number {
  return Math.min(1, Math.max(0, requireFinite(alpha, 'alpha')));
}

function interpolateCoordinate(
  from: number,
  to: number,
  fraction: number,
): number {
  return requireFinite(
    requireFinite(from, 'from') * (1 - fraction) +
      requireFinite(to, 'to') * fraction,
    'interpolated coordinate',
  );
}
