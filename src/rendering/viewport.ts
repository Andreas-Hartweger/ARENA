export function getViewport(
  width: number,
  height: number,
  devicePixelRatio: number,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    return null;
  }

  const aspect = width / height;
  const halfWidth = 3.5 * Math.max(1, aspect);
  const halfHeight = 3.5 * Math.max(1, 1 / aspect);
  const pixelRatio = Number.isFinite(devicePixelRatio)
    ? Math.min(2, Math.max(1, devicePixelRatio))
    : 1;

  return { width, height, halfWidth, halfHeight, pixelRatio };
}
