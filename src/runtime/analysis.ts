import { scenarioSet, evaluate, type TraceSample } from '../training/episode';
import { readVersion, type Version } from '../storage/library';
import type { StorePort } from '../storage/objects';
import type { Draft } from './runConfig';
import { fingerprint } from './fingerprint';
export interface AnalysisRequest {
  versions: string[];
  draft: Draft;
}
export async function analyze(
  db: StorePort,
  { versions, draft }: AnalysisRequest,
) {
  if (!versions.length || versions.length > 2)
    throw Error('Ein oder zwei Modelle auswählen.');
  const [scenario] = scenarioSet(
    fingerprint,
    draft.options.master ?? 42,
    draft.options.segment ?? 0,
    [{ ...draft.scenarios[0], purpose: 'test' }],
  );
  const results = [];
  for (const id of versions) {
    const { genome, version } = await readVersion(db, id);
    if (genome.model.signature !== scenario.modelSignature)
      throw Error(
        'Sensor- oder Controllervertrag passt nicht zur Vergleichsfahrt.',
      );
    const start = performance.now();
    const result = evaluate(scenario, genome.brain(), {
      maxSamples: 200,
      everyTicks: Math.max(1, Math.ceil(scenario.task.maxTicks / 200)),
    });
    if (!result.ok) throw Error(result.message);
    results.push({
      version: id,
      genome: version.genome,
      origin: version.origin as Version['origin'],
      fitness: result.fitness.F,
      reason: result.reason,
      ticks: result.tick,
      laps: result.lapTimes,
      errors: result.errors,
      duration: result.duration,
      elapsedMs: performance.now() - start,
      path: result.trace?.samples.map((p: TraceSample) => p.position) ?? [],
      truncated: result.trace?.truncated ?? false,
    });
  }
  return {
    contract: scenario.key,
    seed: scenario.seed,
    track: scenario.track.def.name,
    purpose: scenario.purpose,
    sampleCount: 1,
    results,
  };
}
export type AnalysisResult = Awaited<ReturnType<typeof analyze>>;
