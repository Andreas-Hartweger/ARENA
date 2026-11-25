import * as THREE from 'three';
import type { VehicleDefinition } from '../vehicles/vehicleDefinition';
import type { VehicleAppearance } from '../vehicles/vehicle';
export function carMesh(d: VehicleDefinition, appearance: VehicleAppearance) {
  const group = new THREE.Group(),
    geometry = new THREE.BoxGeometry(),
    materials = new Map<string | number, THREE.MeshBasicMaterial>();
  function box(
    x: number,
    z: number,
    length: number,
    width: number,
    height: number,
    color: string | number,
    y: number,
  ) {
    let m = materials.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      materials.set(color, m);
    }
    const mesh = new THREE.Mesh(geometry, m);
    mesh.scale.set(length, height, width);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  const l = d.lengthM,
    w = d.widthM;
  // Cross-sections in fractions of the wheel-aligned vehicle footprint.
  function panel(
    sections: readonly number[][],
    color: string | number,
    y: number,
  ) {
    const shape = new THREE.Shape();
    sections.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x * l, z * w);
      else shape.lineTo(x * l, z * w);
    });
    for (const [x, z] of [...sections].reverse()) shape.lineTo(x * l, -z * w);
    shape.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    group.add(mesh);
    return mesh;
  }
  const silhouette = [
    [-0.48, 0.29],
    [-0.42, 0.44],
    [-0.25, 0.46],
    [-0.12, 0.39],
    [0.16, 0.39],
    [0.26, 0.45],
    [0.39, 0.42],
    [0.49, 0.24],
    [0.5, 0.13],
  ];
  const shadow = panel(silhouette, 0x252a29, 0.17);
  shadow.position.x = -0.08;
  shadow.position.z = 0.08;
  const steering: THREE.Mesh[] = [];
  for (const x of [d.frontAxleDistanceM, -d.rearAxleDistanceM])
    for (const side of [-1, 1]) {
      const wheel = box(x, side * w * 0.43, 0.7, 0.28, 0.28, 0x14191c, 0.33);
      if (x > 0) steering.push(wheel);
    }
  panel(silhouette, appearance.color, 0.54);
  panel(
    [
      [-0.3, 0.2],
      [-0.2, 0.29],
      [0.1, 0.3],
      [0.23, 0.22],
      [0.24, 0.14],
    ],
    0x1a303b,
    0.64,
  );
  panel(
    [
      [-0.16, 0.18],
      [-0.11, 0.25],
      [0.045, 0.25],
      [0.075, 0.19],
    ],
    appearance.color,
    0.72,
  );
  for (const side of [-1, 1]) {
    const intake = box(
      0.33 * l,
      side * 0.2 * w,
      0.26,
      0.07,
      0.02,
      0x293a40,
      0.62,
    );
    intake.rotation.y = side * 0.2;
    box(-0.18 * l, side * 0.38 * w, 0.36, 0.09, 0.04, 0xe8ebe1, 0.61);
  }
  box(l * 0.34, 0, l * 0.21, 0.13, 0.03, 0xdde7e3, 0.63);
  box(-l * 0.45, 0, 0.22, w * 0.95, 0.09, 0x182124, 0.7);
  const lamps: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    box(l * 0.45, side * w * 0.26, 0.13, 0.4, 0.08, 0xfff3c5, 0.63);
    lamps.push(box(-l * 0.45, side * w * 0.28, 0.14, 0.39, 0.1, 0xb52e2a, 0.6));
  }
  const label = document.createElement('canvas');
  label.width = 128;
  label.height = 128;
  const ctx = label.getContext('2d')!;
  ctx.fillStyle = '#e7ebe6';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#131e25';
  ctx.textAlign = 'center';
  ctx.font = 'bold 88px Arial';
  ctx.fillText(String(appearance.startNumber), 64, 96);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.6),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  number.rotation.x = -Math.PI / 2;
  number.position.set(-0.06, 0.8, 0);
  group.add(number);
  return {
    group,
    update(angle: number, braking: boolean) {
      steering.forEach((m) => (m.rotation.y = angle));
      lamps.forEach((m) =>
        (m.material as THREE.MeshBasicMaterial).color.setHex(
          braking ? 0xff3a29 : 0x821c20,
        ),
      );
    },
  };
}
