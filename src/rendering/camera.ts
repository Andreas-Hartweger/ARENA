import type { Vector2 } from '../core/math';
export type CameraMode = 'Follow' | 'Übersicht' | 'Frei';
export function mapPoint(p: Vector2, height = 0) {
  return { x: p.x, y: height, z: -p.y };
}
export function follow(
  center: Vector2,
  position: Vector2,
  velocity: Vector2,
  dt: number,
  snap: boolean,
) {
  const ahead = Math.min(
      0.35,
      15 / Math.max(1, Math.hypot(velocity.x, velocity.y)),
    ),
    weight = snap ? 1 : 1 - Math.exp(-dt / 0.15);
  return {
    x: center.x + (position.x + velocity.x * ahead - center.x) * weight,
    y: center.y + (position.y + velocity.y * ahead - center.y) * weight,
  };
}
export function zoom(width: number, dy: number) {
  return Math.max(20, Math.min(160, width * Math.exp(dy * 0.001)));
}
export function viewWidth(
  mode: CameraMode,
  aspect: number,
  free: number,
  bounds: { width: number; height: number },
) {
  if (mode === 'Übersicht')
    return 1.12 * Math.max(bounds.width, bounds.height * aspect);
  return mode === 'Frei' ? free : 45;
}
