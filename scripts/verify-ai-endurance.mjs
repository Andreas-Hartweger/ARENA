// Run with Node 24 from the repository root. Each pair covers 30 simulated minutes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';

registerHooks({
  resolve(name, context, next) {
    return next(
      name.startsWith('.') && !extname(name) ? name + '.ts' : name,
      context,
    );
  },
});
const { DriveWorld } = await import('../src/game/world.ts');
const { createVehicle } = await import('../src/vehicles/vehicle.ts');
const { createTrack } = await import('../src/tracks/track.ts');
const { Brain } = await import('../src/ai/network.ts');
const { signature } = await import('../src/ai/schema.ts');
const { profile, standardProfile } = await import('../src/ai/profile.ts');
const track = createTrack();
const cases = [
  { id: 'A', seed: 42, sensorHz: 60, decisionHz: 10, x: 0 },
  { id: 'B', seed: 1, sensorHz: 20, decisionHz: 60, x: 6 },
];
const vehicles = cases.map(({ id, x }, i) => ({
  id,
  startNumber: i + 1,
  initialState: { positionM: { x, y: 70 } },
}));
const drivers = new Map(
  cases.map(({ id, seed, sensorHz, decisionHz }, i) => {
    const sensors = profile(standardProfile.rays, sensorHz);
    const brain = new Brain(
      signature(createVehicle(vehicles[i]), sensors, decisionHz),
      seed,
    );
    return [id, { brain, profile: sensors, decisionHz }];
  }),
);
const noCommands = new Map();
const recovery = new Map(
  vehicles.map(({ id }) => [
    id,
    {
      recover: true,
      command: {
        kind: 'analog',
        request: { direction: 'forward', throttle: 0, brake: 0, steering: 0 },
      },
    },
  ]),
);

function compareWorlds(shared) {
  const control = new DriveWorld(track, vehicles, shared, drivers);
  const inspected = new DriveWorld(track, vehicles, shared, drivers);
  const start = performance.now(),
    ticksPerWorld = 108000;
  let hits = 0,
    resets = 0,
    snapshots = 0;
  for (let i = 0; i < ticksPerWorld; i++) {
    inspected.trace = i % 600 < 450;
    const commands = i > 0 && i % 18000 === 0 ? recovery : noCommands;
    const a = control.step(commands),
      b = inspected.step(commands);
    assert.equal(a.index, b.index);
    hits += a.events.length;
    for (let j = 0; j < vehicles.length; j++) {
      const c = a.cars[j],
        d = b.cars[j];
      assert.deepEqual(c.state.positionM, d.state.positionM);
      assert.deepEqual(c.input, d.input);
      if (c.recovery === 'accepted') resets++;
      if (i % 60 === 0 || i === ticksPerWorld - 1) {
        assert.deepEqual(c.state, d.state);
        assert.deepEqual(c.lap, d.lap);
        assert.deepEqual(c.ai?.observation, d.ai?.observation);
        snapshots++;
      }
    }
  }
  return {
    shared,
    ticksPerWorld,
    comparedWorlds: 2,
    driversPerWorld: vehicles.length,
    hits,
    resets,
    snapshots,
    elapsedSeconds: (performance.now() - start) / 1000,
  };
}
const result = {
  implementation: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  node: process.version,
  cases,
  report: [compareWorlds(true), compareWorlds(false)],
};
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
