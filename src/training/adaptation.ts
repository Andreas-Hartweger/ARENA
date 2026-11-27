import { GenomeSet, type Genome } from './genome';
import { bounded } from './fitness';
import type { MutationOptions } from './operators';
export const standardAdaptation = Object.freeze({
  window: 15,
  epsilon: 1,
  probabilityEnabled: false,
  strengthEnabled: false,
  immigrantRate: 0,
  rescueEnabled: false,
});
export interface AdaptationOptions {
  window: number;
  epsilon: number;
  probabilityEnabled: boolean;
  strengthEnabled: boolean;
  immigrantRate: number;
  rescueEnabled: boolean;
}
export interface AdaptiveState {
  refBest: number;
  count: number;
  next: 'p' | 'alpha';
  p: number;
  alpha: number;
  reason: string;
}
export function adapt(
  prev: AdaptiveState | null,
  champion: number,
  c: AdaptationOptions,
  m: MutationOptions,
): AdaptiveState {
  bounded(c.window, 5, 100, 'window', true);
  bounded(c.epsilon, 0.001, 100, 'epsilon');
  if (
    (c.probabilityEnabled && m.p > 0.2) ||
    (c.strengthEnabled && (m.alpha > 0.8 || m.absoluteSigma !== undefined))
  )
    throw Error('Invalid adaptive range/mode');
  if (!prev || champion - prev.refBest >= c.epsilon)
    return {
      refBest: champion,
      count: 0,
      next: 'p',
      p: m.p,
      alpha: m.alpha,
      reason: prev ? 'improvement' : 'initial',
    };
  const state = { ...prev, count: prev.count + 1, reason: 'no trigger' };
  if (state.count % c.window) return state;
  const p = c.probabilityEnabled && state.p > 0 && state.p < 0.2,
    alpha = c.strengthEnabled && state.alpha < 0.8;
  if (p && (state.next === 'p' || !alpha)) {
    state.p = Math.min(0.2, state.p * 1.5);
    state.next = 'alpha';
    state.reason = 'probability';
  } else if (alpha) {
    state.alpha = Math.min(0.8, state.alpha * 1.5);
    state.next = 'p';
    state.reason = 'strength';
  }
  return state;
}
export function immigrantCount(
  n: number,
  E: number,
  c: AdaptationOptions,
  count: number,
) {
  const r = bounded(c.immigrantRate, 0, 0.25, 'immigrant rate'),
    rescue = c.rescueEnabled && count > 0 && count % 45 === 0;
  return Math.max(
    0,
    Math.min(n - E - 1, Math.round(n * (rescue ? Math.max(r, 0.15) : r))),
  );
}
export function diversity(genomes: readonly Genome[]) {
  if (!genomes.length) throw Error('Empty population');
  const m = genomes[0].model,
    mean = new Float64Array(m.count),
    m2 = new Float64Array(m.count),
    seen = new GenomeSet();
  genomes.forEach((g, i) => {
    if (g.model.key !== m.key) throw Error('Mixed diversity contracts');
    seen.add(g);
    const values = g.parameters();
    for (const l of m.layers)
      for (let j = l.offset; j < l.end; j++) {
        const x = values[j] / l.scale,
          difference = x - mean[j];
        mean[j] += difference / (i + 1);
        m2[j] += difference * (x - mean[j]);
      }
  });
  const n = genomes.length,
    layers = m.layers.map((l) => {
      let sum = 0;
      for (let j = l.offset; j < l.end; j++) sum += m2[j];
      return n < 2 ? 0 : (2 * sum) / ((n - 1) * (l.end - l.offset));
    });
  const D2 =
    layers.reduce(
      (s, v, i) => s + v * (m.layers[i].end - m.layers[i].offset),
      0,
    ) / m.count;
  return {
    unique: seen.size,
    duplicates: n - seen.size,
    uniqueFraction: seen.size / n,
    D2,
    D: Math.sqrt(D2),
    layers,
  };
}
