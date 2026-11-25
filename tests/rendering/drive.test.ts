import { expect, it } from 'vitest';
import { follow, mapPoint, viewWidth, zoom } from '../../src/rendering/camera';
import { createTrack } from '../../src/tracks/track';
import { circuitMesh, trackGuides } from '../../src/rendering/circuitMesh';
import { headingAxes } from '../../src/core/math';
it('maps all four forward headings onto the Three.js XZ plane', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const p = mapPoint(headingAxes(heading).forward);
    expect(p.x).toBeCloseTo(Math.cos(heading));
    expect(p.z).toBeCloseTo(-Math.sin(heading));
  }
});
it('fits the course, limits free zoom and smooths capped lookahead', () => {
  const size = { width: 248, height: 168 };
  expect(viewWidth('Follow', 2, 100, size)).toBe(45);
  expect(viewWidth('Übersicht', 3, 0, size) / 3).toBeGreaterThan(168);
  expect(zoom(50, 10000)).toBe(160);
  expect(zoom(50, -10000)).toBe(20);
  expect(
    follow({ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 100, y: 0 }, 1, true),
  ).toEqual({ x: 20, y: 2 });
  expect(
    follow({ x: 0, y: 0 }, { x: 5, y: 2 }, { x: 100, y: 0 }, 0.01, false).x,
  ).toBeLessThan(20);
});
it('builds track geometry and inspection lines from the compiled track offline', () => {
  const t = createTrack();
  expect(circuitMesh(t).children.length).toBeGreaterThan(4);
  expect(trackGuides(t).geometry.getAttribute('position').count).toBe(
    2 * (t.stations.length + t.gates.length + t.barriers.length),
  );
});
