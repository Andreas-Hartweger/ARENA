import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { sha, hashJSON } from './manifest.mjs';
import { digest } from '../evolution-runtime.mjs';
import { nodeComputePort } from '../node-compute-port.mjs';
const { readGenome } = await import('../../src/storage/checkpoint.ts');
const { object } = await import('../../src/storage/objects.ts');
const { preflight } = await import('../../src/runtime/runConfig.ts');
const { scenario } = await import('../../src/training/episode.ts');
const { sameAssignment } = await import('../../src/runtime/compute.ts');
const { canonical } = await import('../../src/ai/schema.ts');

let sourceHash;
function evaluationSources() {
  return (sourceHash ??= sha(
    execFileSync('git', [
      'ls-tree',
      '-r',
      'HEAD',
      '--',
      'src/ai',
      'src/physics',
      'src/collision',
      'src/vehicles',
      'src/tracks',
      'src/core',
      'src/input',
      'src/game',
      'src/training',
      'src/runtime/compute.ts',
      'src/runtime/simulationWorker.ts',
      'scripts/episode-worker.mjs',
      'scripts/node-compute-port.mjs',
    ]),
  ));
}
export function loadCandidate(directory, experimentId, role = 'champion') {
  if (!/^[\w-]+$/.test(experimentId)) throw Error('Invalid experiment ID');
  const folder = join(directory, 'experiments', experimentId),
    report = JSON.parse(readFileSync(join(folder, 'experiment.json'), 'utf8'));
  const ref = report.models[role];
  if (!ref || !/^[a-f0-9]{64}\.f64le$/.test(ref.file))
    throw Error('Model unavailable');
  const bytes = readFileSync(join(folder, ref.file));
  if (sha(bytes) !== ref.sha256 || bytes.length !== ref.size)
    throw Error('Model artifact damaged');
  const draft = report.entry.definition.draft,
    { m } = preflight(draft, digest, 64);
  const genome = readGenome(object('genome', ref.id, bytes), m);
  return { genome, draft, report, experimentId, role };
}
export function loadPanel(directory, name) {
  const commitments = JSON.parse(
    readFileSync(
      'docs/intelligence-validation/evidence/panel-commitments.json',
      'utf8',
    ),
  );
  if (!Object.hasOwn(commitments, name))
    throw Error('Unknown validation panel');
  const bytes = readFileSync(join(directory, 'panels', name + '.json')),
    panel = JSON.parse(bytes);
  if (
    sha(bytes) !== commitments[name].sha256 ||
    digest(canonical(panel.cases)) !== commitments[name].contentHash ||
    panel.name !== name
  )
    throw Error('Frozen panel changed');
  return panel;
}
export function standardPanel(multi = false) {
  return {
    name: multi ? 'standard-endurance' : 'standard',
    cases: [
      {
        id: multi ? 'standard-3' : 'standard',
        group: 0,
        effective: hashJSON({
          track: 'academy',
          stationM: -8,
          lateralM: 0,
          headingRad: 0,
          speedMps: 0,
        }),
        scenario: multi ? { task: { laps: 3, maxTicks: 21600 } } : {},
      },
    ],
  };
}
export async function evaluatePanel(
  ledger,
  clock,
  panel,
  candidate,
  workers,
  { traceCases = [], portFactory = nodeComputePort } = {},
) {
  const final = panel.name !== 'development',
    scope = final ? 'validation' : 'research',
    genome = candidate.genome,
    m = genome.model;
  if (final) {
    const frozen = ledger.db
      .prepare("SELECT data FROM manifests WHERE id='final-candidates'")
      .get();
    if (
      !frozen ||
      !JSON.parse(frozen.data).candidates.some((c) => c.genome === genome.hash)
    )
      throw Error('Model has not been frozen for final validation');
  }
  const rows = new Array(panel.cases.length),
    spec = {
      signature: m.signature,
      hidden: m.hidden,
      activation: m.activation,
      weightLimit: m.weightLimit,
      biasLimit: m.biasLimit,
    };
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw Error('Invalid evaluation worker count');
  const pending = [];
  for (const [slot, c] of panel.cases.entries()) {
    clock.pulse();
    const options = { ...candidate.draft.scenarios[0], ...c.scenario };
    const s = scenario(digest, options);
    if (s.modelSignature !== m.signature)
      throw Error('Validation and model signatures differ');
    const tracing = traceCases.includes(c.id);
    const cache =
      'case:' +
      hashJSON([
        scope,
        panel.name,
        c.effective,
        s.key,
        genome.hash,
        process.version,
        evaluationSources(),
        tracing,
      ]);
    const existing = ledger.readManifest(cache);
    if (existing) {
      if (
        existing.genome !== genome.hash ||
        existing.effective !== c.effective ||
        existing.id !== c.id ||
        existing.contract !== s.key
      )
        throw Error('Cached assignment differs');
      rows[slot] = existing;
    } else {
      const trace = tracing ? { everyTicks: 12, maxSamples: 1801 } : undefined;
      pending.push({ slot, c, options, s, cache, trace });
    }
  }
  let next = 0,
    stopped = false;
  async function lane() {
    let worker, current, reply, fail, ready;
    function connect() {
      const port = portFactory();
      worker = port;
      ready = new Promise((ok, bad) => {
        reply = ok;
        fail = bad;
      });
      port.listen(
        (event) => {
          if (worker !== port) return;
          if (event.type === 'ready' && !current) {
            reply();
            return;
          }
          if (!current || !event.key || !sameAssignment(current, event.key))
            return;
          if (event.type === 'result') {
            port.send({ type: 'ack', key: current });
            reply(event.result);
          } else if (event.type === 'fault')
            fail(
              Object.assign(Error(event.message), {
                transient: event.transient,
              }),
            );
        },
        (error) => {
          if (worker === port) fail(Object.assign(error, { transient: true }));
        },
      );
    }
    try {
      while (!stopped && next < pending.length) {
        clock.pulse();
        const { slot, c, options, s, cache, trace } = pending[next++];
        const runId = candidate.experimentId,
          sessionId = ledger.token,
          jobId = randomUUID(),
          max = s.task.maxTicks;
        const context = {
          experimentId: runId,
          panel: panel.name,
          caseId: c.id,
          runId,
          sessionId,
          segment: 0,
          generation: 0,
          slot,
          scenario: slot,
          jobId,
          attempt: 0,
        };
        ledger.reserve(jobId, scope, context, {
          ms: 0,
          ticks: 2 * max,
          episodes: 0,
        });
        let ticks = 0,
          last;
        for (let attempt = 0; attempt <= 1; attempt++) {
          const assignment = {
            protocolVersion: 1,
            runId,
            sessionId,
            segmentId: 0,
            generation: 0,
            slot,
            scenarioIndex: slot,
            jobId,
            attempt,
            workerLease: randomUUID(),
            contractId: s.key,
            modelKey: m.key,
            genomeHash: genome.hash,
            scenarioSeed: s.seed,
          };
          let spent,
            uncertain = false;
          try {
            if (!worker) {
              current = undefined;
              connect();
              await ready;
            }
            current = assignment;
            const result = new Promise((ok, bad) => {
              reply = ok;
              fail = bad;
            });
            const parameters = genome.parameters();
            worker.send(
              {
                type: 'assign',
                rate: 'max',
                job: {
                  key: current,
                  model: spec,
                  scenario: { ...options, seed: s.seed },
                  parameters,
                  trace,
                },
              },
              [parameters.buffer],
            );
            last = await result;
            if (
              !Number.isSafeInteger(last.tick) ||
              last.tick < 0 ||
              last.tick > max
            )
              throw Error('Invalid measured ticks');
            spent = last.tick;
          } catch (error) {
            worker?.close();
            worker = undefined;
            uncertain = true;
            spent = max;
            last = {
              ok: false,
              reason: 'infrastructureFault',
              tick: 0,
              ticksUnknown: true,
              transient: error.transient === true,
              contract: s.key,
              seed: s.seed,
              modelSignature: m.signature,
              message: String(error),
            };
          }
          ticks += spent;
          ledger.event(
            ledger.token,
            'measurement-attempt',
            scope,
            {
              ...context,
              attempt,
              workerLease: assignment.workerLease,
              result: last.reason,
              ticks: uncertain ? null : last.tick,
              chargedTicks: spent,
              uncertain,
              ...(!last.ok ? { failure: last.message } : {}),
            },
            { ms: 0, ticks: 0, episodes: 0 },
            { ms: 0, ticks: 0, episodes: 0 },
          );
          current = undefined;
          if (
            last.ok ||
            last.reason !== 'infrastructureFault' ||
            !last.transient
          )
            break;
        }
        current = undefined;
        const value = {
          id: c.id,
          group: c.group,
          effective: c.effective,
          genome: genome.hash,
          contract: s.key,
          seed: s.seed,
          result: last,
        };
        ledger.transaction(() => {
          ledger.assertLease();
          ledger.closeReservation(
            ledger.token,
            jobId,
            { ms: 0, ticks, episodes: 0 },
            last.ok ? 'evaluated' : 'measurement-failed',
          );
          ledger.manifest(cache, value);
        });
        rows[slot] = value;
      }
    } catch (error) {
      stopped = true;
      throw error;
    } finally {
      worker?.close();
    }
  }
  const lanes = await Promise.allSettled(
    Array.from({ length: Math.min(workers, pending.length) }, () => lane()),
  );
  const failed = lanes.find((r) => r.status === 'rejected');
  if (failed) throw failed.reason;
  return {
    expected: panel.cases.map(({ id, group, effective }) => ({
      id,
      group,
      effective,
    })),
    actual: rows,
  };
}
