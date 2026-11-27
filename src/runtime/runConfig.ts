import { bounded } from '../training/fitness';
import { model, type Model } from '../training/genome';
import {
  scenarioSet,
  type Digest,
  type ScenarioOptions,
} from '../training/episode';
import { config, type EvolutionOptions } from '../training/population';
import type { Activation } from '../ai/network';
import type { GenerationSummary } from '../training/evolution';
import {
  resources,
  validRate,
  type Rate,
  type ResourceProfile,
} from './compute';

export type GoalMetric =
  'fitness' | 'laps' | 'successes' | 'lapTime' | 'successFraction' | 'plateau';
export interface Goal {
  logic: 'and' | 'or';
  leaves: { metric: GoalMetric; threshold: number }[];
  consecutive: number;
}
export interface Draft {
  version: 1;
  options: EvolutionOptions;
  hidden: number[];
  activation: Activation;
  weightLimit: number;
  biasLimit: number;
  scenarios: ScenarioOptions[];
  weights?: number[];
  sourceVersion?: string;
  profile: ResourceProfile;
  custom: { workers: number; managedMiB: number };
  rate: Rate;
  mode: 'live' | 'accelerated' | 'headless';
  goal?: Goal;
  time?: { seconds: number; hard: boolean };
  autosave: 1 | 5 | 10 | 25;
  volatile: boolean;
}
export const defaultDraft = (): Draft => ({
  version: 1,
  options: { n: 128, generations: 100, master: 42 },
  hidden: [32, 16],
  activation: 'tanh',
  weightLimit: 8,
  biasLimit: 4,
  scenarios: [{}],
  profile: 'Balanced',
  custom: { workers: 1, managedMiB: 512 },
  rate: 'max',
  mode: 'headless',
  autosave: 1,
  volatile: false,
});
export function validateGoal(goal: Goal) {
  if (
    !['and', 'or'].includes(goal.logic) ||
    !Array.isArray(goal.leaves) ||
    !goal.leaves.length ||
    goal.leaves.length > 32
  )
    throw Error('Invalid goal expression');
  bounded(goal.consecutive, 1, 0xffffffff, 'goal streak', true);
  for (const leaf of goal.leaves) {
    if (
      ![
        'fitness',
        'laps',
        'successes',
        'lapTime',
        'successFraction',
        'plateau',
      ].includes(leaf.metric)
    )
      throw Error('Unknown goal metric');
    bounded(
      leaf.threshold,
      0,
      leaf.metric === 'successFraction' ? 1 : Number.MAX_SAFE_INTEGER,
      'goal threshold',
      ['laps', 'successes', 'plateau'].includes(leaf.metric),
    );
  }
}
export function matchedGoal(goal: Goal, s: GenerationSummary) {
  const values = {
    fitness: s.fitness.best,
    laps: s.laps,
    successes: s.successes,
    lapTime: s.lapTimes?.worst ?? null,
    successFraction: s.successRate,
    plateau: s.adaptive.count,
  };
  const matches = goal.leaves.map((l) => {
    const x = values[l.metric];
    return (
      x !== null &&
      (l.metric === 'lapTime' ? x <= l.threshold : x >= l.threshold)
    );
  });
  return goal.logic === 'and' ? matches.every(Boolean) : matches.some(Boolean);
}
export function memoryEstimate(
  m: Model,
  n: number,
  scenarios: number,
  workers: number,
  traceSamples = 0,
) {
  const population = 8 * m.count * n;
  return {
    population,
    total:
      2 * population +
      workers * (m.count * 8 * 4 + 4 * 1024 ** 2) +
      n * scenarios * 12_288 +
      Math.min(traceSamples, 100000) * 4096 +
      16 * 1024 ** 2,
  };
}
export function preflight(draft: Draft, digest: Digest, hardware?: number) {
  if (
    draft.version !== 1 ||
    !Array.isArray(draft.scenarios) ||
    !draft.scenarios.length ||
    draft.scenarios.length > 64 ||
    !validRate(draft.rate) ||
    !['headless', 'live', 'accelerated'].includes(draft.mode) ||
    ![1, 5, 10, 25].includes(draft.autosave)
  )
    throw Error('Invalid run configuration');
  if (draft.goal) validateGoal(draft.goal);
  if (draft.time)
    bounded(draft.time.seconds, 0.001, Number.MAX_SAFE_INTEGER, 'wall time');
  const master = draft.options.master ?? 42,
    segment = draft.options.segment ?? 0;
  const scenarios = scenarioSet(digest, master, segment, draft.scenarios);
  const m = model(
      scenarios[0].modelSignature,
      draft.hidden,
      draft.activation,
      draft.weightLimit,
      draft.biasLimit,
    ),
    c = config(m, draft.options);
  if (
    scenarios.some(
      (s) => s.purpose !== 'training' || s.structure !== scenarios[0].structure,
    ) ||
    c.budget < c.n * scenarios.length
  )
    throw Error(
      'Incompatible scenarios or insufficient whole-generation budget',
    );
  const allocation = resources(hardware, draft.profile, draft.custom);
  const estimated = memoryEstimate(
    m,
    c.n,
    scenarios.length,
    allocation.workers,
    c.trace?.maxSamples,
  );
  if (estimated.total > allocation.managedMiB * 1024 ** 2)
    throw Error('Population and workers exceed managed RAM budget');
  if (
    draft.weights &&
    (draft.weights.length !== scenarios.length ||
      draft.weights.some((n) => !Number.isFinite(n) || n < 0) ||
      !draft.weights.some((n) => n > 0))
  )
    throw Error('Invalid scenario weights');
  return { m, scenarios, c, allocation, estimated };
}
