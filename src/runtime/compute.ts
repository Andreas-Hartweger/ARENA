import { bounded } from '../training/fitness';
import type {
  EpisodeResult,
  ScenarioOptions,
  TraceOptions,
} from '../training/episode';
import type { Activation } from '../ai/network';

export const protocolVersion = 1;
export const maxChunkTicks = 64;
export const softChunkMs = 8;
export type ResourceProfile = 'Eco' | 'Balanced' | 'Performance' | 'Custom';
const profiles = {
  Eco: [0.25, 256],
  Balanced: [0.5, 512],
  Performance: [0.75, 1024],
} as const;

export function resources(
  hardware: number | undefined,
  profile: ResourceProfile,
  custom?: { workers: number; managedMiB: number },
) {
  const h =
    hardware && Number.isSafeInteger(hardware) && hardware > 0 ? hardware : 1;
  const cap = Math.min(16, Math.max(1, h - 2));
  if (profile === 'Custom') {
    if (!custom) throw Error('Custom resources missing');
    return {
      cap,
      workers: bounded(custom.workers, 1, cap, 'workers', true),
      managedMiB: bounded(custom.managedMiB, 1, 4096, 'managed RAM', true),
    };
  }
  const preset = profiles[profile];
  if (!preset) throw Error('Unknown resource profile');
  return {
    cap,
    workers: Math.max(1, Math.min(cap, Math.floor(h * preset[0]))),
    managedMiB: preset[1],
  };
}

export interface ModelSpec {
  signature: string;
  hidden: readonly number[];
  activation: Activation;
  weightLimit: number;
  biasLimit: number;
}
export interface JobKey {
  protocolVersion: 1;
  runId: string;
  sessionId: string;
  segmentId: number;
  generation: number;
  slot: number;
  scenarioIndex: number;
  jobId: string;
  attempt: 0 | 1;
  workerLease: string;
  contractId: string;
  modelKey: string;
  genomeHash: string;
  scenarioSeed: number;
}
export interface Job {
  key: JobKey;
  model: ModelSpec;
  scenario: ScenarioOptions;
  parameters: Float64Array;
  trace?: TraceOptions;
}
export type Rate = number | 'max';
export type WorkerCommand =
  | { type: 'assign'; job: Job; rate: Rate }
  | { type: 'pause' | 'resume' | 'cancel' | 'ack'; key: JobKey }
  | { type: 'rate'; key: JobKey; rate: Rate }
  | { type: 'shutdown' };
export type WorkerEvent =
  | { type: 'ready'; protocolVersion: 1 }
  | { type: 'result'; key: JobKey; result: EpisodeResult; elapsedMs: number }
  | { type: 'paused' | 'cancelled' | 'running'; key: JobKey; tick: number }
  | {
      type: 'progress';
      key: JobKey;
      tick: number;
      x: number;
      y: number;
      heading: number;
      speed: number;
    }
  | { type: 'fault'; key: JobKey; message: string; transient: boolean };
export interface ComputePort {
  send(command: WorkerCommand, buffers?: ArrayBuffer[]): void;
  close(): void;
  listen(
    event: (message: WorkerEvent) => void,
    fault: (error: Error) => void,
  ): void;
}
export const keyFields = [
  'protocolVersion',
  'runId',
  'sessionId',
  'segmentId',
  'generation',
  'slot',
  'scenarioIndex',
  'jobId',
  'attempt',
  'workerLease',
  'contractId',
  'modelKey',
  'genomeHash',
  'scenarioSeed',
] as const;
export function sameAssignment(a: JobKey, b: JobKey) {
  return !!a && !!b && keyFields.every((k) => a[k] === b[k]);
}
export function validRate(rate: Rate) {
  return rate === 'max' || (Number.isFinite(rate) && rate > 0 && rate <= 10000);
}
