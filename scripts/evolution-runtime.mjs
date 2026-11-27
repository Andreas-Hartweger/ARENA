import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { URL } from 'node:url';
import process from 'node:process';
const sourceRoots = [
  new URL('../src/', import.meta.url).href,
  new URL('../tests/', import.meta.url).href,
];
export function includeSourceDirectory(directory) {
  sourceRoots.push(
    directory.href.endsWith('/') ? directory.href : directory.href + '/',
  );
}
registerHooks({
  resolve(name, ctx, next) {
    return next(
      name.startsWith('.') &&
        !extname(name) &&
        sourceRoots.some((root) => ctx.parentURL?.startsWith(root))
        ? name + '.ts'
        : name,
      ctx,
    );
  },
});
export function digest(header, values = new Float64Array()) {
  const text = Buffer.from(header, 'utf8'),
    lengths = Buffer.alloc(8),
    bytes = Buffer.alloc(values.length * 8);
  lengths.writeUInt32LE(text.length);
  lengths.writeUInt32LE(values.length, 4);
  for (let i = 0; i < values.length; i++)
    bytes.writeDoubleLE(values[i] || 0, i * 8);
  return createHash('sha256')
    .update(lengths)
    .update(text)
    .update(bytes)
    .digest('hex');
}
export function environment() {
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  return {
    sha: git('rev-parse', 'HEAD'),
    sourceDiff: git('status', '--porcelain', '--', 'src', 'scripts'),
    node: process.version,
    os: os.version(),
    cpu: os.cpus()[0].model,
    logicalCpus: os.cpus().length,
    totalRam: os.totalmem(),
    power: 'uncontrolled',
    backgroundLoad: 'uncontrolled',
    renderer: null,
  };
}
