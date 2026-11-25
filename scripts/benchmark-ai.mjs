import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
registerHooks({
  resolve(name, ctx, next) {
    return next(
      name.startsWith('.') && !extname(name) ? name + '.ts' : name,
      ctx,
    );
  },
});
const { createTrack } = await import('../src/tracks/track.ts');
const { createVehicle } = await import('../src/vehicles/vehicle.ts');
const { standardProfile, profile, rayPose } =
  await import('../src/ai/profile.ts');
const { signature } = await import('../src/ai/schema.ts');
const { Brain } = await import('../src/ai/network.ts');
const { DriveWorld } = await import('../src/game/world.ts');
const { measure, wallIndex, obstacle } = await import('../src/ai/geometry.ts');
const track = createTrack(),
  walls = wallIndex(track),
  v = createVehicle({ id: 'A', startNumber: 0 });
const key = signature(v),
  memory = () => process.memoryUsage();
const result = {
  sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  node: process.version,
  os: os.version(),
  cpu: os.cpus()[0].model,
  totalRam: os.totalmem(),
  seed: 42,
  rows: [],
};
function bench(name, count, fn, extra = {}) {
  const warmup =
    name === 'world'
      ? Math.max(count, Math.ceil(600 / extra.instances))
      : count;
  for (let i = 0; i < warmup; i++) fn(i);
  const before = memory(),
    samples = [],
    counts = [];
  for (let trial = 0; trial < 5; trial++) {
    const start = performance.now();
    let calls = 0,
      elapsed;
    do {
      for (let i = 0; i < count; i++) fn(calls + i);
      calls += count;
      elapsed = performance.now() - start;
    } while (elapsed < 1000);
    counts.push(calls);
    samples.push(elapsed);
  }
  const after = memory(),
    sorted = samples.map((ms, i) => ms / counts[i]).sort((a, b) => a - b),
    median = sorted[2];
  result.rows.push({
    name,
    counts,
    warmup,
    samplesMs: samples,
    medianMsPerCall: median,
    p95MsPerCall: sorted[4],
    minMsPerCall: sorted[0],
    maxMsPerCall: sorted[4],
    throughput: 1000 / median,
    before,
    after,
    ...extra,
  });
}
const rays = standardProfile.rays.map((s) => rayPose(s, { x: 0, y: 70 }, 0));
const cars = [
  obstacle({
    id: 'B',
    position: { x: 26, y: 70 },
    heading: 0,
    lengthM: 4.5,
    widthM: 1.95,
    velocity: { x: 0, y: 0 },
  }),
];
for (const others of [[], cars])
  for (const reference of [true, false])
    bench(
      'rays',
      1024,
      (i) => measure(track, walls, rays[i % 16], others, reference),
      { reference, others: others.length },
    );
for (const dims of [
  [16, 8],
  [32, 16],
  [64, 32],
  [128, 128, 128, 128],
])
  for (const instances of [1, 10, 100]) {
    const brain = new Brain(key, 42, dims),
      inputs = Array.from({ length: instances }, (_, i) =>
        new Float64Array(248).fill((1 + i) / 100),
      );
    bench('mlp', 1000, (i) => brain.evaluate(inputs[i % instances]), {
      instances,
      dims,
      bytes: brain.parameters().byteLength,
    });
  }
for (const [n, hz, shared, trace] of [
  [1, 30, false, false],
  [10, 30, false, false],
  [100, 30, false, false],
  [1, 60, false, false],
  [10, 60, false, false],
  [100, 60, false, false],
  [2, 30, true, false],
  [1, 30, false, true],
]) {
  const p = profile(standardProfile.rays, hz),
    brain = new Brain(signature(v, p, hz)),
    options = Array.from({ length: n }, (_, i) => ({
      id: 'car' + i,
      startNumber: i,
      initialState: { positionM: { x: shared ? i * 10 : 0, y: 70 } },
    }));
  const ai = new Map(
    options.map((o) => [o.id, { brain, profile: p, decisionHz: hz }]),
  );
  const world = new DriveWorld(track, options, shared, ai);
  world.trace = trace;
  const commands = new Map();
  bench('world', Math.max(6, Math.round(240 / n)), () => world.step(commands), {
    instances: n,
    hz,
    shared,
    trace,
  });
  const row = result.rows.at(-1);
  row.vehicleTicksPerSecond = row.throughput * n;
  row.aggregateSimSecondsPerSecond = row.vehicleTicksPerSecond / 60;
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
