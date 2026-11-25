import { standardProfile } from './profile';
import { distances } from './preview';
import type { Vehicle } from '../vehicles/vehicle';
const groups = {
  ego: [
    ['speed', 'm/s', 0, 75, 'positive', ''],
    ['longitudinal', 'm/s', -75, 75, 'signed', ''],
    ['lateral', 'm/s', -30, 30, 'signed', ''],
    ['yaw_rate', 'rad/s', -3, 3, 'signed', ''],
    [
      'steer_angle',
      'rad',
      -0.5235987755982988,
      0.5235987755982988,
      'signed',
      '',
    ],
    ['drive_direction', 'enum', -1, 1, 'enum', ''],
    ['front.asphalt', 'bool', 0, 1, 'bit', ''],
    ['front.grass', 'bool', 0, 1, 'bit', ''],
    ['front.mu', '1', 0, 2, 'positive', ''],
    ['rear.asphalt', 'bool', 0, 1, 'bit', ''],
    ['rear.grass', 'bool', 0, 1, 'bit', ''],
    ['rear.mu', '1', 0, 2, 'positive', ''],
  ],
  ray: [
    ['edge.distance', 'm', 0, 75, 'positive', 'edge.valid'],
    ['edge.valid', 'bool', 0, 1, 'bit', ''],
    ['barrier.distance', 'm', 0, 75, 'positive', 'barrier.valid'],
    ['barrier.valid', 'bool', 0, 1, 'bit', ''],
    ['vehicle.distance', 'm', 0, 75, 'positive', 'vehicle.valid'],
    ['vehicle.valid', 'bool', 0, 1, 'bit', ''],
    ['material.asphalt', 'bool', 0, 1, 'bit', 'material.valid'],
    ['material.grass', 'bool', 0, 1, 'bit', 'material.valid'],
    ['material.valid', 'bool', 0, 1, 'bit', ''],
  ],
  local: [
    ['offset', 'm', -12, 12, 'signed', 'valid'],
    ['sin_heading', '1', -1, 1, 'signed', 'valid'],
    ['cos_heading', '1', -1, 1, 'signed', 'valid'],
    ['valid', 'bool', 0, 1, 'bit', ''],
  ],
  preview: [
    ['x', 'm', -150, 150, 'signed', 'position_valid'],
    ['y', 'm', -150, 150, 'signed', 'position_valid'],
    ['position_valid', 'bool', 0, 1, 'bit', ''],
    ['sin_heading', '1', -1, 1, 'signed', 'heading_valid'],
    ['cos_heading', '1', -1, 1, 'signed', 'heading_valid'],
    ['heading_valid', 'bool', 0, 1, 'bit', ''],
    ['curvature', '1/m', -0.1, 0.1, 'signed', 'curvature_valid'],
    ['curvature_valid', 'bool', 0, 1, 'bit', ''],
  ],
  object: [
    ['valid', 'bool', 0, 1, 'bit', ''],
    ['x', 'm', -150, 150, 'signed', 'valid'],
    ['y', 'm', -150, 150, 'signed', 'valid'],
    ['vx', 'm/s', -150, 150, 'signed', 'valid'],
    ['vy', 'm/s', -150, 150, 'signed', 'valid'],
    ['sin_heading', '1', -1, 1, 'signed', 'valid'],
    ['cos_heading', '1', -1, 1, 'signed', 'valid'],
    ['distance', 'm', 0, 150, 'positive', 'valid'],
  ],
} as const;
export function registry(profile = standardProfile) {
  const channels: {
    id: string;
    unit: string;
    min: number;
    max: number;
    rule: string;
    mask: string;
  }[] = [];
  function group(key: keyof typeof groups, prefix: string, range?: number) {
    for (const [suffix, unit, min, max, rule, mask] of groups[key]) {
      channels.push({
        id: prefix + '.' + suffix,
        unit,
        min,
        max: range !== undefined && unit === 'm' ? range : max,
        rule,
        mask: mask ? prefix + '.' + mask : '',
      });
    }
  }
  group('ego', 'ego');
  for (const ray of profile.rays) group('ray', ray.id, ray.range);
  group('local', 'local');
  for (const d of distances)
    group('preview', 'preview' + String(d).padStart(3, '0'));
  for (let i = 0; i < 4; i++) group('object', 'object0' + i);
  const indices = new Map(channels.map((c, i) => [c.id, i]));
  if (indices.size !== channels.length) throw Error('Duplicate channel ID');
  return Object.freeze(
    channels.map((c) => {
      const maskIndex = c.mask ? indices.get(c.mask) : -1;
      if (maskIndex === undefined) throw Error('Unknown mask ' + c.mask);
      return Object.freeze({ ...c, maskIndex });
    }),
  );
}
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => JSON.stringify(k) + ':' + canonical(x))
        .join(',') +
      '}'
    );
  return JSON.stringify(v);
}
export function signature(
  vehicle: Pick<Vehicle, 'definition' | 'setup'>,
  profile = standardProfile,
  decisionHz = 30,
) {
  return canonical({
    vehicle: vehicle.definition,
    setup: vehicle.setup,
    profile,
    decisionHz,
    channels: registry(profile),
    distances,
    controller: 'arena.target.v1',
    layout: 'arena.dense.float64.v1',
    schema: 'arena.observation.standard.v1',
  });
}
export function normalize(
  raw: readonly number[],
  channels: ReturnType<typeof registry>,
) {
  if (raw.length !== channels.length) throw Error('Invalid observation width');
  const clamped: number[] = [];
  const values = raw.map((v, i) => {
    const c = channels[i];
    if (
      !Number.isFinite(v) ||
      (c.rule === 'bit' && v !== 0 && v !== 1) ||
      (c.rule === 'enum' && Math.abs(v) !== 1)
    )
      throw Error('Invalid channel ' + c.id);
    if (v < c.min || v > c.max) clamped.push(i);
    return Math.max(c.min, Math.min(c.max, v)) / c.max || 0;
  });
  function oneHot(i: number, valid: number) {
    if (raw[i] + raw[i + 1] !== valid)
      throw Error('Invalid material at ' + channels[i].id);
  }
  oneHot(6, 1);
  oneHot(9, 1);
  for (let i = 12; i < 156; i += 9) oneHot(i + 6, raw[i + 8]);
  for (let i = 160; i < 216; i += 8)
    if (!raw[i + 2] && (raw[i + 5] || raw[i + 7]))
      throw Error('Invalid preview masks');
  for (let i = 0; i < values.length; i++) {
    const c = channels[i];
    if (c.mask && raw[i] !== 0 && raw[c.maskIndex] === 0)
      throw Error('Missing mask for ' + c.id);
  }
  return { values, clamped };
}
