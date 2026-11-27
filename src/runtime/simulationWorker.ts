import { scenario, stepEpisode, type Digest } from '../training/episode';
import { Genome, model } from '../training/genome';
import {
  maxChunkTicks,
  softChunkMs,
  protocolVersion,
  sameAssignment,
  validRate,
  type Job,
  type WorkerCommand,
  type WorkerEvent,
  type Rate,
} from './compute';

export function simulationWorker(
  digest: Digest,
  send: (e: WorkerEvent) => void,
  schedule: (f: () => void, delay: number) => void,
  close: () => void,
  now = () => performance.now(),
) {
  let active: Job | undefined,
    steps: ReturnType<typeof stepEpisode> | undefined;
  let contract: ReturnType<typeof scenario> | undefined;
  let activeModel: ReturnType<typeof model> | undefined;
  let phase: 'idle' | 'running' | 'paused' | 'result' = 'idle';
  let tick = 0,
    computeMs = 0,
    rate: Rate = 'max',
    lastReport = 0,
    token = 0;
  let lastFrame: import('../game/world').WorldFrame | undefined,
    awaitingSample = false;
  function report() {
    if (!lastFrame || !active?.observation) return;
    const car = lastFrame.cars[0];
    lastReport = now();
    awaitingSample = true;
    send({
      type: 'progress',
      key: active.key,
      tick: lastFrame.index,
      certifiedM: car.lap.certified,
      validLaps: car.lap.laps,
      braking: car.input.brake,
      contacts: lastFrame.events.length,
      nextGate: car.lap.next,
      x: car.state.positionM.x,
      y: car.state.positionM.y,
      heading: car.state.headingRad,
      speed: Math.hypot(car.state.velocityMps.x, car.state.velocityMps.y),
      ...(active.observation === 'detail'
        ? { ai: car.ai, applied: car.input }
        : {}),
    });
  }
  let lastResult: WorkerEvent | undefined;
  function reset() {
    token++;
    active = undefined;
    steps = undefined;
    lastFrame = undefined;
    awaitingSample = false;
    lastResult = undefined;
    phase = 'idle';
  }
  function fault(error: unknown) {
    if (!active) throw error;
    phase = 'result';
    lastResult = {
      type: 'fault',
      key: active.key,
      message: String(error),
      transient: false,
    };
    send(lastResult);
  }
  function queue(delay = 0) {
    const ticket = ++token;
    schedule(() => {
      if (ticket === token && phase === 'running') run();
    }, delay);
  }
  function run() {
    if (!active || !steps) return;
    const started = now(),
      first = tick;
    try {
      do {
        const next = steps.next();
        tick++;
        if (next.done) {
          computeMs += now() - started;
          phase = 'result';
          lastResult = {
            type: 'result',
            key: active.key,
            result: next.value,
            elapsedMs: computeMs,
          };
          send(lastResult);
          steps = undefined;
          return;
        }
        lastFrame = active.observation ? next.value : undefined;
        if (lastFrame && !awaitingSample && now() - lastReport >= 100) report();
      } while (
        tick - first <
          (rate === 'max'
            ? maxChunkTicks
            : Math.max(1, Math.min(maxChunkTicks, Math.floor(rate * 0.48)))) &&
        now() - started < softChunkMs
      );
      const spent = now() - started;
      computeMs += spent;
      queue(
        rate === 'max'
          ? 0
          : Math.max(0, ((tick - first) * 1000) / (60 * rate) - spent),
      );
    } catch (error) {
      fault(error);
    }
  }
  function receive(command: WorkerCommand) {
    if (command.type === 'shutdown') {
      reset();
      close();
      return;
    }
    if (command.type === 'assign') {
      if (active) {
        if (sameAssignment(active.key, command.job.key) && lastResult)
          send(lastResult);
        else throw Error('Busy worker');
        return;
      }
      active = command.job;
      try {
        const {
          key,
          scenario: options,
          model: spec,
          parameters,
          trace,
        } = active;
        if (
          key.protocolVersion !== 1 ||
          !validRate(command.rate) ||
          options.seed !== key.scenarioSeed
        )
          throw Error('Invalid assignment');
        // The coordinator binds every contract to its immutable content digest.
        if (contract?.key !== key.contractId)
          contract = scenario(digest, options);
        if (
          !activeModel ||
          activeModel.key !== key.modelKey ||
          activeModel.weightLimit !== spec.weightLimit ||
          activeModel.biasLimit !== spec.biasLimit
        )
          activeModel = model(
            spec.signature,
            spec.hidden,
            spec.activation,
            spec.weightLimit,
            spec.biasLimit,
          );
        if (
          contract.key !== key.contractId ||
          activeModel.key !== key.modelKey ||
          activeModel.signature !== contract.modelSignature
        )
          throw Error('Incompatible job');
        const genome = new Genome(activeModel, parameters, digest);
        if (genome.hash !== key.genomeHash)
          throw Error('Genome fingerprint mismatch');
        steps = stepEpisode(
          contract,
          genome.brain(),
          trace,
          undefined,
          () => active?.observation === 'detail',
        );
        rate = command.rate;
        tick = 0;
        computeMs = 0;
        lastReport = now();
        phase = 'running';
        send({ type: 'running', key, tick });
        queue();
      } catch (error) {
        fault(error);
      }
      return;
    }
    if (!active || !sameAssignment(command.key, active.key)) return;
    switch (command.type) {
      case 'sampleAck':
        awaitingSample = false;
        break;
      case 'observe':
        active.observation = command.observation;
        if (!command.observation) lastFrame = undefined;
        break;
      case 'ack':
        if (phase === 'result') reset();
        break;
      case 'cancel': {
        const key = active.key;
        reset();
        send({ type: 'cancelled', key, tick });
        break;
      }
      case 'pause':
        if (phase === 'running') {
          token++;
          phase = 'paused';
          report();
          send({ type: 'paused', key: active.key, tick });
        }
        break;
      case 'resume':
        if (phase === 'paused') {
          phase = 'running';
          send({ type: 'running', key: active.key, tick });
          queue();
        }
        break;
      case 'rate':
        if (!validRate(command.rate)) {
          fault(Error('Invalid speed'));
          break;
        }
        rate = command.rate;
        if (phase === 'running') queue();
        break;
    }
  }
  send({ type: 'ready', protocolVersion });
  return receive;
}
