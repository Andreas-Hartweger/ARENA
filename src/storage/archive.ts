// Restricted single-disk ZIP STORE container. Every local record must be listed
// exactly once and the central directory must immediately precede the EOCD.
export const archiveLimits = {
  bytes: 1024 ** 3,
  entries: 16384,
  entry: 64 * 1024 ** 2,
  json: 8 * 1024 ** 2,
  name: 160,
  depth: 32,
};
const enc = new TextEncoder(),
  dec = new TextDecoder('utf-8', { fatal: true });
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const v of bytes) c = table[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function nameOk(n: string) {
  if (
    n.length > archiveLimits.name ||
    !/^(manifest\.json|data\/[a-z0-9_-]+\.json|genomes\/[a-z0-9_-]+\.bin)$/.test(
      n,
    )
  )
    throw Error('Unsupported package path');
}
function header(len: number) {
  const bytes = new Uint8Array(len),
    v = new DataView(bytes.buffer);
  return {
    bytes,
    u16: (p: number, x: number) => v.setUint16(p, x, true),
    u32: (p: number, x: number) => v.setUint32(p, x, true),
  };
}
export interface ArchiveEntry {
  name: string;
  size: number;
  crc: number;
  offset: number;
}
export async function writeArchive(
  entries: AsyncIterable<{ name: string; bytes: Uint8Array }>,
) {
  const parts: BlobPart[] = [],
    directory: BlobPart[] = [],
    names = new Set<string>();
  let offset = 0,
    centralSize = 0;
  for await (const { name, bytes } of entries) {
    nameOk(name);
    if (
      names.has(name) ||
      names.size >= archiveLimits.entries ||
      bytes.length >
        (name.endsWith('.json') ? archiveLimits.json : archiveLimits.entry)
    )
      throw Error('Invalid archive entry');
    names.add(name);
    const n = enc.encode(name),
      crc = crc32(bytes);
    const l = header(30 + n.length);
    l.u32(0, 0x04034b50);
    l.u16(4, 20);
    l.u16(6, 0x800);
    l.u32(14, crc);
    l.u32(18, bytes.length);
    l.u32(22, bytes.length);
    l.u16(26, n.length);
    l.bytes.set(n, 30);
    const c = header(46 + n.length);
    c.u32(0, 0x02014b50);
    c.u16(4, 20);
    c.u16(6, 20);
    c.u16(8, 0x800);
    c.u32(16, crc);
    c.u32(20, bytes.length);
    c.u32(24, bytes.length);
    c.u16(28, n.length);
    c.u32(42, offset);
    c.bytes.set(n, 46);
    // Blob takes ownership of an immutable snapshot of each entry.
    parts.push(l.bytes, new Blob([bytes as Uint8Array<ArrayBuffer>]));
    directory.push(c.bytes);
    centralSize += c.bytes.length;
    offset += l.bytes.length + bytes.length;
    if (offset + centralSize + 22 > archiveLimits.bytes)
      throw Error('Archive size limit');
  }
  if (!names.has('manifest.json')) throw Error('Manifest fehlt');
  const end = header(22);
  end.u32(0, 0x06054b50);
  end.u16(8, names.size);
  end.u16(10, names.size);
  end.u32(12, centralSize);
  end.u32(16, offset);
  return new Blob([...parts, ...directory, end.bytes], {
    type: 'application/zip',
  });
}
export async function scanArchive(file: Blob, budget = archiveLimits.bytes) {
  if (file.size < 22 || file.size > Math.min(archiveLimits.bytes, budget))
    throw Error('Package exceeds staging limit');
  async function view(start: number, length: number) {
    if (start < 0 || length < 0 || start + length > file.size)
      throw Error('Archive boundary');
    return new DataView(await file.slice(start, start + length).arrayBuffer());
  }
  const end = await view(file.size - 22, 22),
    count = end.getUint16(10, true),
    central = end.getUint32(16, true),
    centralSize = end.getUint32(12, true);
  if (
    end.getUint32(0, true) !== 0x06054b50 ||
    end.getUint32(4, true) !== 0 ||
    count !== end.getUint16(8, true) ||
    !count ||
    count > archiveLimits.entries ||
    end.getUint16(20, true) !== 0 ||
    central + centralSize !== file.size - 22 ||
    centralSize > count * (46 + archiveLimits.name)
  )
    throw Error('Unsupported ZIP directory');
  const cd = await view(central, centralSize),
    records: ArchiveEntry[] = [],
    names = new Set<string>();
  let at = 0,
    physical = 0;
  for (let i = 0; i < count; i++) {
    if (
      at + 46 > centralSize ||
      cd.getUint32(at, true) !== 0x02014b50 ||
      cd.getUint16(at + 8, true) !== 0x800 ||
      cd.getUint16(at + 10, true) !== 0 ||
      cd.getUint16(at + 30, true) ||
      cd.getUint16(at + 32, true) ||
      cd.getUint16(at + 34, true) ||
      cd.getUint32(at + 38, true) !== 0
    )
      throw Error('Unsupported archive flags or fields');
    const nameLen = cd.getUint16(at + 28, true),
      size = cd.getUint32(at + 24, true),
      offset = cd.getUint32(at + 42, true),
      crc = cd.getUint32(at + 16, true);
    if (
      !nameLen ||
      nameLen > archiveLimits.name ||
      at + 46 + nameLen > centralSize ||
      cd.getUint32(at + 20, true) !== size ||
      offset !== physical ||
      offset + 30 + nameLen + size > central
    )
      throw Error('Inconsistent ZIP member');
    const name = dec.decode(new Uint8Array(cd.buffer, at + 46, nameLen));
    nameOk(name);
    if (
      names.has(name) ||
      size > (name.endsWith('.json') ? archiveLimits.json : archiveLimits.entry)
    )
      throw Error('Duplicate or oversized ZIP member');
    names.add(name);
    const local = await view(offset, 30 + nameLen);
    if (
      local.getUint32(0, true) !== 0x04034b50 ||
      local.getUint16(6, true) !== 0x800 ||
      local.getUint16(8, true) !== 0 ||
      local.getUint32(14, true) !== crc ||
      local.getUint32(18, true) !== size ||
      local.getUint32(22, true) !== size ||
      local.getUint16(26, true) !== nameLen ||
      local.getUint16(28, true) !== 0 ||
      dec.decode(new Uint8Array(local.buffer, 30)) !== name
    )
      throw Error('Local ZIP header mismatch');
    const start = offset + 30 + nameLen;
    records.push({ name, size, crc, offset: start });
    physical = start + size;
    at += 46 + nameLen;
  }
  if (at !== centralSize || physical !== central || !names.has('manifest.json'))
    throw Error('Incomplete ZIP directory');
  return {
    records,
    async read(entry: ArchiveEntry) {
      if (!records.includes(entry)) throw Error('Unknown ZIP member');
      const bytes = new Uint8Array(
        await file.slice(entry.offset, entry.offset + entry.size).arrayBuffer(),
      );
      if (bytes.length !== entry.size || crc32(bytes) !== entry.crc)
        throw Error('ZIP CRC mismatch');
      return bytes;
    },
  };
}

// Parse the JSON grammar before native decoding so duplicate fields and excessive
// nesting cannot be hidden by last-key-wins deserialization.
export function strictJson(bytes: Uint8Array): unknown {
  if (bytes.length > archiveLimits.json) throw Error('JSON size limit');
  const text = dec.decode(bytes),
    token =
      /\s*(?:(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)|("(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*")|([{}[\],:]))/y;
  let position = 0,
    items = 0;
  function next() {
    token.lastIndex = position;
    const m = token.exec(text);
    if (!m) throw Error('Invalid JSON');
    position = token.lastIndex;
    return m[1] ?? m[2] ?? m[3];
  }
  function visit(depth: number, t: string) {
    if (++items > 1_000_000 || depth > archiveLimits.depth)
      throw Error('JSON limit');
    if (t === '{') {
      const keys = new Set<string>();
      let k = next();
      if (k === '}') return;
      for (;;) {
        if (!k.startsWith('"')) throw Error('Invalid key');
        const key = JSON.parse(k) as string;
        if (
          keys.has(key) ||
          ['__proto__', 'constructor', 'prototype'].includes(key)
        )
          throw Error('Invalid or duplicate key');
        keys.add(key);
        if (next() !== ':') throw Error('Expected colon');
        visit(depth + 1, next());
        const sep = next();
        if (sep === '}') break;
        if (sep !== ',') throw Error('Expected comma');
        k = next();
      }
    } else if (t === '[') {
      let v = next();
      if (v === ']') return;
      for (;;) {
        visit(depth + 1, v);
        const sep = next();
        if (sep === ']') break;
        if (sep !== ',') throw Error('Expected comma');
        v = next();
      }
    } else if (
      !t.startsWith('"') &&
      !['true', 'false', 'null'].includes(t) &&
      !Number.isFinite(Number(t))
    )
      throw Error('Invalid value');
  }
  visit(0, next());
  if (text.slice(position).trim()) throw Error('Trailing JSON data');
  return JSON.parse(text);
}
