import { sha256 } from '../runtime/fingerprint';

export const defaultDiskBudget = 1024 ** 3;
export type ObjectKind =
  | 'genome'
  | 'history'
  | 'checkpoint'
  | 'run'
  | 'manifest'
  | 'version'
  | 'profile'
  | 'record'
  | 'queue'
  | 'template'
  | 'series'
  | 'settings'
  | 'trace'
  | 'pin';
export interface ObjectMeta {
  id: string;
  kind: ObjectKind;
  refs: string[];
  size: number;
  checksum: string;
  root: boolean;
  protected: boolean;
  created: number;
  trashedAt?: number;
}
export interface StoredObject {
  meta: ObjectMeta;
  bytes: Uint8Array;
}
export interface StorePort {
  get(id: string): Promise<StoredObject | undefined>;
  list(): Promise<ObjectMeta[]>;
  commit(
    values: readonly StoredObject[],
    options?: WriteOptions,
  ): Promise<number>;
}
export interface WriteOptions {
  expectedRevision?: number;
  replace?: readonly string[];
  remove?: readonly string[];
  budget?: number;
}
export const kinds: readonly ObjectKind[] = [
  'genome',
  'history',
  'checkpoint',
  'run',
  'manifest',
  'version',
  'profile',
  'record',
  'queue',
  'template',
  'series',
  'settings',
  'trace',
  'pin',
];
export function object(
  kind: ObjectKind,
  id: string,
  bytes: Uint8Array,
  refs: string[] = [],
  root = false,
  protectedObject = false,
): StoredObject {
  const meta = {
    id,
    kind,
    refs: [...new Set(refs)],
    size: bytes.length,
    checksum: sha256(bytes),
    root,
    protected: protectedObject,
    created: Date.now(),
  };
  return { meta, bytes };
}
export function jsonObject(
  kind: ObjectKind,
  id: string,
  data: unknown,
  refs: string[] = [],
  root = false,
  protectedObject = false,
) {
  return object(
    kind,
    id,
    new TextEncoder().encode(JSON.stringify(data)),
    refs,
    root,
    protectedObject,
  );
}
export function decode<T>(entry: StoredObject): T {
  if (entry.meta.checksum !== sha256(entry.bytes))
    throw Error('Stored checksum mismatch');
  return JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(entry.bytes),
  ) as T;
}
export function reachable(
  all: Map<string, ObjectMeta>,
  roots: Iterable<string>,
) {
  const reached = new Set<string>(),
    stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (reached.has(id)) continue;
    const row = all.get(id);
    if (!row) throw Error('Missing dependent object ' + id);
    reached.add(id);
    stack.push(...row.refs);
  }
  return reached;
}
export function deletionPreview(
  all: readonly ObjectMeta[],
  drop: readonly string[],
) {
  const dropped = new Set(drop),
    map = new Map(all.map((r) => [r.id, r]));
  for (const id of dropped) {
    const row = map.get(id);
    if (!row || row.protected) throw Error('Object is protected or missing');
  }
  const retained = reachable(
    map,
    all
      .filter((r) => r.protected || (r.root && !dropped.has(r.id)))
      .map((r) => r.id),
  );
  if (drop.some((id) => retained.has(id)))
    throw Error('Object is referenced by a retained root');
  const remove = all.filter((r) => !retained.has(r.id)).map((r) => r.id);
  return {
    remove,
    bytes: remove.reduce((sum, id) => sum + map.get(id)!.size, 0),
  };
}
export function validateObject(o: StoredObject) {
  const m = o.meta;
  if (
    !kinds.includes(m.kind) ||
    !/^[a-zA-Z0-9_.:-]{1,180}$/.test(m.id) ||
    !Array.isArray(m.refs) ||
    m.refs.length > 100_000 ||
    m.size !== o.bytes.length ||
    !/^[a-f0-9]{64}$/.test(m.checksum) ||
    sha256(o.bytes) !== m.checksum ||
    o.bytes.length > 64 * 1024 ** 2
  )
    throw Error('Invalid storage object');
}
