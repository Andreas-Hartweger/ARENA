import * as THREE from 'three';
import type { Track } from '../tracks/track';
import type { Vector2 } from '../core/math';
export function circuitMesh(track: Track) {
  const group = new THREE.Group(),
    batches = new Map<number, number[]>();
  function quad(
    a: Vector2,
    b: Vector2,
    c: Vector2,
    d: Vector2,
    height: number,
    color: number,
  ) {
    let data = batches.get(color);
    if (!data) {
      data = [];
      batches.set(color, data);
    }
    for (const p of [a, b, c, a, c, d]) data.push(p.x, height, -p.y);
  }
  const points = track.stations;
  const half = track.def.width / 2;
  for (let i = 0; i < points.length; i++) {
    const s = points[i],
      end = points[(i + 1) % points.length];
    const strip = (a: number, b: number, h: number, color: number) =>
      quad(
        track.sample(s, a).position,
        track.sample(end, a).position,
        track.sample(end, b).position,
        track.sample(s, b).position,
        h,
        color,
      );
    strip(-half, half, 0.02, track.def.colors.asphalt);
    for (const side of [-1, 1]) {
      strip(side * (half - 0.16), side * (half - 0.03), 0.04, 0xf4f2dc);
      const isCorner =
        Math.abs(track.sample(s).heading - track.sample(end).heading) > 1e-5;
      if (isCorner)
        strip(
          side * half,
          side * (half + 0.7),
          0.045,
          i % 6 < 3 ? track.def.colors.curb : 0xf4eddb,
        );
    }
  }
  for (const wall of track.barriers)
    quad(wall.a, wall.b, wall.outerB, wall.outerA, 0.15, 0xc3c7b9);
  // Grass mowing bands share one draw call and extend past both camera limits.
  for (let i = -30; i < 30; i += 2) {
    const x = i * 12;
    quad(
      { x, y: -500 },
      { x: x + 12, y: -500 },
      { x: x + 12, y: 500 },
      { x, y: 500 },
      0,
      0x48674b,
    );
  }
  function patch(
    s: number,
    t: number,
    l: number,
    r: number,
    h: number,
    color: number,
  ) {
    quad(
      track.sample(s, l).position,
      track.sample(t, l).position,
      track.sample(t, r).position,
      track.sample(s, r).position,
      h,
      color,
    );
  }
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 20; col++)
      patch(
        row * 0.6,
        (row + 1) * 0.6,
        -half + col * 0.6,
        -half + (col + 1) * 0.6,
        0.06,
        (col + row) % 2 ? 0x272a2e : 0xf3f0dc,
      );
  for (let n = 0; n < 8; n++) {
    const s =
      -track.def.grid.behind -
      Math.floor(n / 2) * track.def.grid.rowGap -
      (n % 2) * track.def.grid.stagger;
    const side = ((n % 2) - 0.5) * track.def.grid.columnGap;
    patch(s + 2.2, s + 2.32, side - 1.2, side + 1.2, 0.05, 0xb0b5af);
    for (const sign of [-1, 1])
      patch(
        s + 1.2,
        s + 2.2,
        side + sign * 1.2,
        side + sign * 1.2 + 0.09,
        0.05,
        0xb0b5af,
      );
  }
  for (const [color, data] of batches) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
    group.add(
      new THREE.Mesh(
        g,
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      ),
    );
  }
  return group;
}
export function trackGuides(track: Track) {
  const data: number[] = [];
  function line(a: Vector2, b: Vector2) {
    data.push(a.x, 0.35, -a.y, b.x, 0.35, -b.y);
  }
  track.stations.forEach((s, i) =>
    line(
      track.sample(s).position,
      track.sample(track.stations[(i + 1) % track.stations.length]).position,
    ),
  );
  track.gates.forEach((_, i) =>
    line(
      track.sample(
        (i * track.length) / track.gates.length,
        -track.def.width / 2,
      ).position,
      track.sample((i * track.length) / track.gates.length, track.def.width / 2)
        .position,
    ),
  );
  track.barriers.forEach((w) => line(w.a, w.b));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
  return new THREE.LineSegments(
    g,
    new THREE.LineBasicMaterial({ color: 0xffb347 }),
  );
}
