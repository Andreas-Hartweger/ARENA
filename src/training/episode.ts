import { Brain } from '../ai/network';
import { profile, standardProfile, period } from '../ai/profile';
import { canonical, signature } from '../ai/schema';
import { dot } from '../core/math';
import { DriveWorld } from '../game/world';
import { freezeTree } from '../physics/vehicleTick';
import { startGrid } from '../tracks/grid';
import { createTrack, type TrackDefinition } from '../tracks/track';
import { createVehicle } from '../vehicles/vehicle';
import { GT_01 } from '../vehicles/vehicleDefinition';
import {
  ProgressLedger,
  bounded,
  normalized,
  profiles,
  scoreFitness,
} from './fitness';
import { Penalties } from './penalties';

export const standardTask = Object.freeze({
  laps: 1,
  maxTicks: 7200,
  graceTicks: 300,
  noProgressTicks: 900,
  progressM: 2,
});
export type Task = typeof standardTask extends infer T
  ? { -readonly [K in keyof T]: number }
  : never;
export function deadline(
  task: Task,
  tick: number,
  H: number,
  state: { anchor: number; last: number },
  success: boolean,
) {
  if (
    tick === task.graceTicks ||
    (tick > task.graceTicks && H - state.anchor >= task.progressM)
  ) {
    state.anchor = H;
    state.last = tick;
  }
  const stalled =
    tick >= task.graceTicks && tick - state.last >= task.noProgressTicks;
  return {
    reason: success
      ? ('completed' as const)
      : tick >= task.maxTicks
        ? ('timeout' as const)
        : stalled
          ? ('noProgress' as const)
          : null,
    stalled,
  };
}
export interface ScenarioOptions {
  id?: string;
  seed?: number;
  track?: TrackDefinition;
  task?: Partial<Task>;
  sensorHz?: number;
  decisionHz?: number;
  fitness?: keyof typeof profiles | readonly number[];
  purpose?: 'training' | 'validation' | 'test';
}
export type Digest = (header: string, parameters?: Float64Array) => string;
export function scenario(digest: Digest, options: ScenarioOptions = {}) {
  const task = { ...standardTask, ...options.task };
  bounded(task.laps, 1, Number.MAX_SAFE_INTEGER, 'task laps', true);
  bounded(task.maxTicks, 1, Number.MAX_SAFE_INTEGER, 'max ticks', true);
  bounded(task.graceTicks, 0, task.maxTicks - 1, 'grace ticks', true);
  bounded(
    task.noProgressTicks,
    1,
    Number.MAX_SAFE_INTEGER,
    'progress ticks',
    true,
  );
  if (!(Number.isFinite(task.progressM) && task.progressM > 0))
    throw Error('Invalid progress threshold');
  const track = createTrack(options.track),
    pose = startGrid(track, 1, GT_01.lengthM, GT_01.widthM)[0];
  const vehicle = {
    id: 'candidate',
    startNumber: 0,
    initialState: { positionM: pose.position, headingRad: pose.heading },
  };
  const sensor = profile(standardProfile.rays, options.sensorHz ?? 30),
    decisionHz = options.decisionHz ?? 30;
  period(decisionHz);
  const car = createVehicle(vehicle),
    modelSignature = signature(car, sensor, decisionHz);
  const fitness = options.fitness ?? 'Balanced',
    weights = normalized(
      typeof fitness === 'string' ? profiles[fitness] : fitness,
    );
  if (weights.length !== 7) throw Error('Expected seven fitness weights');
  const seed = bounded(options.seed ?? 0, 0, 0xffffffff, 'scenario seed', true),
    id = options.id ?? 'academy-grid',
    purpose = options.purpose ?? 'training';
  if (!id || !['training', 'validation', 'test'].includes(purpose))
    throw Error('Invalid scenario identity');
  const structure = digest(
    canonical({
      version: 'arena.evaluation.v1',
      physics: 'first-drive.v1',
      task,
      fitness,
      weights,
      modelSignature,
      definition: car.definition,
      setup: car.setup,
    }),
  );
  const key = digest(
    canonical({ structure, track: track.def, vehicle, id, seed, purpose }),
  );
  // Track compilation is shared read-only. Every call to evaluate starts a fresh world and driver.
  return freezeTree({
    track,
    vehicle,
    sensor,
    decisionHz,
    weights,
    modelSignature,
    task,
    key,
    structure,
    id,
    seed,
    purpose,
  });
}
export type Scenario = ReturnType<typeof scenario>;
export interface TraceOptions {
  maxSamples: number;
  everyTicks: number;
}
export interface TraceSample {
  tick: number;
  position: { x: number; y: number };
  observationTick: number;
  values: readonly number[];
  decisionTick: number;
  layers: ReturnType<Brain['evaluate']>['layers'];
}
export interface EpisodeFailure {
  ok: false;
  reason:
    | 'externalReset'
    | 'cancelled'
    | 'modelFault'
    | 'simulationFault'
    | 'infrastructureFault';
  tick: number;
  message: string;
  transient?: boolean;
}
export function evaluate(
  s: Scenario,
  brain: Brain,
  trace?: TraceOptions,
  stop?: () => 'cancelled' | 'externalReset' | undefined,
) {
  let tick = 0;
  try {
    if (brain.signature !== s.modelSignature)
      throw Error('Incompatible AI model');
    if (trace) {
      bounded(trace.maxSamples, 0, 100000, 'trace budget', true);
      bounded(
        trace.everyTicks,
        1,
        Number.MAX_SAFE_INTEGER,
        'trace stride',
        true,
      );
    }
    const world = new DriveWorld(
      s.track,
      [s.vehicle],
      false,
      new Map([
        [s.vehicle.id, { brain, profile: s.sensor, decisionHz: s.decisionHz }],
      ]),
      true,
    );
    const ledger = new ProgressLedger(
        s.track.length,
        s.track.gates.length,
        s.task.laps,
        world.frame.cars[0].lap.s,
      ),
      penalty = new Penalties();
    const clock = { anchor: 0, last: s.task.graceTicks },
      commands = new Map(),
      samples: TraceSample[] = [];
    let truncated = false;
    for (tick = 1; tick <= s.task.maxTicks; tick++) {
      const interruption = stop?.();
      if (interruption)
        return {
          ok: false,
          reason: interruption,
          tick: tick - 1,
          message: 'Episode interrupted',
        } satisfies EpisodeFailure;
      const sampled = !!trace && (tick - 1) % trace.everyTicks === 0;
      world.trace = sampled && samples.length < trace!.maxSamples;
      const frame = world.step(commands),
        car = frame.cars[0],
        p = car.physics!,
        facts = frame.evaluation![0],
        before = ledger.highwater;
      ledger.accept(facts.travel);
      const end = ledger.finishedAt ?? tick / 60;
      const speed = Math.hypot(p.velocityMps.x, p.velocityMps.y);
      const tangent = s.track.sample(car.lap.s).tangent;
      const local = s.track.project(car.state.positionM, car.lap.s);
      const tangential =
        local.distance <= s.track.def.width / 2 + s.track.def.runoff + 1e-7
          ? dot(p.velocityMps, tangent)
          : null;
      penalty.accept(
        tick,
        end,
        {
          speed,
          longitudinal: p.longitudinalMps,
          lateral: p.lateralMps,
          tangential,
          grassAxles:
            Number(p.front.surface.surface === 'grass') +
            Number(p.rear.surface.surface === 'grass'),
          reverse: car.input.direction === 'reverse',
          steering: car.input.steering,
          pedal: car.input.throttle - car.input.brake,
          fallback: frame.fallback,
        },
        facts.contacts,
        ledger.highwater - before,
      );
      if (sampled) {
        if (world.trace)
          samples.push({
            tick,
            position: car.state.positionM,
            observationTick: car.ai!.observation.index,
            values: car.ai!.observation.values,
            decisionTick: car.ai!.decisionTick,
            layers: car.ai!.layers,
          });
        else truncated = true;
      }
      const { reason, stalled } = deadline(
        s.task,
        tick,
        ledger.highwater,
        clock,
        ledger.finishedAt !== null,
      );
      if (reason) {
        const { P, A, K } = ledger.fractions,
          errors = penalty.errors;
        const fitness = scoreFitness(
          s.task.laps,
          ledger.completed,
          reason === 'completed',
          P,
          A,
          K,
          end,
          s.task.maxTicks / 60,
          errors,
          s.weights,
        );
        return freezeTree({
          ok: true as const,
          reason,
          tick,
          duration: end,
          stalled,
          fitness,
          errors,
          raw: {
            ...penalty.raw,
            distance: ledger.distance,
            approach: ledger.approach,
            progress: ledger.highwater,
            partial: ledger.partial,
            meanSpeed: end ? penalty.raw.speedIntegral / end : null,
            productiveMps: end ? ledger.highwater / end : null,
          },
          lapTimes: ledger.lapTimes,
          ...(trace ? { trace: { samples, truncated } } : {}),
        });
      }
    }
    throw Error('Episode exceeded tick limit');
  } catch (error) {
    const message = String(error);
    return {
      ok: false,
      reason: /AI |model/i.test(message) ? 'modelFault' : 'simulationFault',
      tick,
      message,
    } satisfies EpisodeFailure;
  }
}
export type EpisodeResult = ReturnType<typeof evaluate> | EpisodeFailure;
export type ScoredEpisode = Extract<EpisodeResult, { ok: true }>;
