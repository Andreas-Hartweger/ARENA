// SHA-256 for synchronous Genome construction in a browser worker, using
// the same framed bytes as the Node crypto adapter. Package integrity uses raw bytes.
const constants = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotate = (v: number, n: number) => (v >>> n) | (v << (32 - n));
export function sha256(input: Uint8Array) {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  const blocks = Math.ceil((input.length + 9) / 64);
  const tail = new Uint8Array(128);
  const full = Math.floor(input.length / 64);
  tail.set(input.subarray(full * 64));
  tail[input.length % 64] = 128;
  new DataView(tail.buffer).setBigUint64(
    (blocks - full) * 64 - 8,
    BigInt(input.length) * 8n,
  );
  const data = new DataView(input.buffer, input.byteOffset, input.byteLength),
    end = new DataView(tail.buffer);
  for (let b = 0; b < blocks; b++) {
    const source = b < full ? data : end,
      offset = (b < full ? b : b - full) * 64;
    for (let i = 0; i < 16; i++) words[i] = source.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = words[i - 15],
        z = words[i - 2];
      words[i] =
        words[i - 16] +
        (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) +
        words[i - 7] +
        (rotate(z, 17) ^ rotate(z, 19) ^ (z >>> 10));
    }
    let [a, c, d, e, f, g, h, j] = state;
    for (let i = 0; i < 64; i++) {
      const t =
        j +
        (rotate(f, 6) ^ rotate(f, 11) ^ rotate(f, 25)) +
        ((f & g) ^ (~f & h)) +
        constants[i] +
        words[i];
      const u =
        (rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
        ((a & c) ^ (a & d) ^ (c & d));
      j = h;
      h = g;
      g = f;
      f = (e + t) >>> 0;
      e = d;
      d = c;
      c = a;
      a = (t + u) >>> 0;
    }
    const work = [a, c, d, e, f, g, h, j];
    for (let i = 0; i < 8; i++) state[i] += work[i];
  }
  return Array.from(state, (n) => n.toString(16).padStart(8, '0')).join('');
}
export function parameterBytes(values: Float64Array) {
  const bytes = new Uint8Array(values.length * 8),
    view = new DataView(bytes.buffer);
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) throw Error('Nonfinite parameter');
    view.setFloat64(i * 8, values[i] === 0 ? 0 : values[i], true);
  }
  return bytes;
}
export function fingerprint(
  header: string,
  values: Float64Array = new Float64Array(0),
) {
  const text = new TextEncoder().encode(header);
  const bytes = new Uint8Array(8 + text.length + values.length * 8),
    view = new DataView(bytes.buffer);
  view.setUint32(0, text.length, true);
  view.setUint32(4, values.length, true);
  bytes.set(text, 8);
  bytes.set(parameterBytes(values), 8 + text.length);
  return sha256(bytes);
}
