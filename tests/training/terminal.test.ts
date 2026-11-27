import { expect, it } from 'vitest';
import { Brain } from '../../src/ai/network';
import { DriveWorld } from '../../src/game/world';
import { academy } from '../../src/tracks/track';
import { GT_01 } from '../../src/vehicles/vehicleDefinition';
import { evaluate, scenario, type Digest } from '../../src/training/episode';
const adapter = '../../scripts/evolution-runtime.mjs';
const { digest }: { digest: Digest } = await import(adapter);

it('EPS-004 EPS-005 PRG-004 PRG-012 PEN-010 stops a real fixed test Brain on its interpolated goal, including at the limit tick', () => {
  // A circular test circuit and a constant kinematic steering command give this
  // fixture a predictable crossing. This model never participates in evolution.
  const track = {
    ...academy,
    id: 'test-circle',
    name: 'Terminal fixture',
    startDistance: 0,
    width: 30,
    runoff: 2,
    pieces: Array.from({ length: 4 }, () => ({
      kind: 'arc' as const,
      radius: 35,
      turnRad: -Math.PI / 2,
    })),
  };
  const s = scenario(digest, { track }),
    width = 4,
    output = 249 * width,
    bias = output + 3 * width,
    p = new Float64Array(bias + 3);
  p[0] = -7.5;
  p[248 * width] = 0.45;
  p[output] = 2;
  p[bias + 1] = Math.atan(GT_01.wheelbaseM / 35) / GT_01.maxSteeringRad;
  const brain = new Brain(s.modelSignature, 0, [4], 'tanh', p);
  const world = new DriveWorld(
    s.track,
    [s.vehicle],
    false,
    new Map([[s.vehicle.id, { brain }]]),
  );
  const startLine = s.track.gates[0].position,
    crossings: number[] = [],
    commands = new Map();
  for (let tick = 1; tick <= 21600 && crossings.length < 4; tick++) {
    const from = world.frame.cars[0].state.positionM,
      to = world.step(commands).cars[0].state.positionM;
    if (
      from.x < startLine.x &&
      to.x >= startLine.x &&
      Math.abs(to.y - startLine.y) < track.width / 2
    ) {
      const fraction = (startLine.x - from.x) / (to.x - from.x);
      crossings.push((tick - 1 + fraction) / 60);
    }
  }
  expect(crossings).toHaveLength(4);
  const requiredTick = Math.ceil(crossings[1] * 60);
  const limited = scenario(digest, { track, task: { maxTicks: requiredTick } });
  const result = evaluate(limited, brain);
  expect(result).toMatchObject({
    ok: true,
    reason: 'completed',
    tick: requiredTick,
    fitness: { P: 1, A: 1, K: 1 },
  });
  if (!result.ok) throw Error(result.message);
  expect(result.duration).toBeCloseTo(crossings[1], 10);
  expect(result.duration).toBeLessThan(requiredTick / 60);
  expect(result.lapTimes).toHaveLength(1);
  expect(result.lapTimes[0]).toBeCloseTo(crossings[1] - crossings[0], 10);
  const early = evaluate(
    scenario(digest, { track, task: { maxTicks: requiredTick - 1 } }),
    brain,
  );
  expect(early).toMatchObject({ ok: true, reason: 'timeout', lapTimes: [] });
  const multi = evaluate(
    scenario(digest, { track, task: { laps: 3, maxTicks: 21600 } }),
    brain,
  );
  expect(multi).toMatchObject({
    ok: true,
    reason: 'completed',
    tick: Math.ceil(crossings[3] * 60),
  });
  if (!multi.ok) throw Error(multi.message);
  expect(multi.lapTimes).toHaveLength(3);
  for (const [i, t] of multi.lapTimes.entries())
    expect(t).toBeCloseTo(crossings[i + 1] - crossings[i], 10);
  expect(multi.duration).toBeCloseTo(crossings[3], 10);
}, 20000);
