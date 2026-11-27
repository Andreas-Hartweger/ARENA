import { bounded } from './fitness';
import type { Genome, Model } from './genome';
import { GenomeSet, checkedParameters } from './genome';
import { gaussian, integer, permutation, type Draw } from './random';

export interface MutationOptions {
  p: number;
  alpha: number;
  absoluteSigma?: number;
  largeProbability: number;
  largeMultiplier: number;
  biasProbabilityFactor: number;
  biasStrengthFactor: number;
  layerProbabilityFactors?: readonly number[];
  layerStrengthFactors?: readonly number[];
}
export const standardMutation = Object.freeze({
  p: 0.05,
  alpha: 0.2,
  largeProbability: 0.05,
  largeMultiplier: 5,
  biasProbabilityFactor: 1,
  biasStrengthFactor: 1,
});
export function validateMutation(m: Model, c: MutationOptions) {
  bounded(c.p, 0, 1, 'mutation probability');
  bounded(c.alpha, 0.01, 2, 'alpha');
  if (c.absoluteSigma !== undefined)
    bounded(c.absoluteSigma, 0.001, 1, 'absolute sigma');
  bounded(c.largeProbability, 0, 0.3, 'large probability');
  bounded(c.largeMultiplier, 1, 10, 'large multiplier');
  bounded(c.biasProbabilityFactor, 0, 2, 'bias probability factor');
  bounded(c.biasStrengthFactor, 0, 2, 'bias strength factor');
  for (const factors of [c.layerProbabilityFactors, c.layerStrengthFactors])
    if (factors) {
      if (factors.length !== m.layers.length)
        throw Error('Invalid layer factors');
      for (const x of factors) bounded(x, 0, 2, 'layer factor');
    }
}
const stats = () => ({
  eligible: 0,
  selected: 0,
  changed: 0,
  normal: 0,
  large: 0,
  clipped: 0,
  meanAbs: 0,
  rms: 0,
  maxAbs: 0,
});
// The public mutation configuration caps the mixture at 30%. The two endpoint
// distributions can also be exercised directly with the same draw schedule.
export function mixedGaussian(
  r: Draw,
  sigma: number,
  probability: number,
  multiplier: number,
) {
  const large = r.next() < probability;
  return { large, delta: sigma * (large ? multiplier : 1) * gaussian(r) };
}
export function mutate(
  m: Model,
  source: Float64Array,
  c: MutationOptions,
  r: Draw,
  maxDetails = 0,
  protectedLayers: readonly number[] = [],
) {
  validateMutation(m, c);
  bounded(maxDetails, 0, 100000, 'change budget', true);
  const out = checkedParameters(m, source),
    layers = m.layers.map(() => ({ weight: stats(), bias: stats() }));
  const details: {
    index: number;
    old: number;
    value: number;
    large: boolean;
    clipped: boolean;
  }[] = [];
  const selected: number[] = [],
    eligibleGroups: {
      start: number;
      end: number;
      sigma: number;
      limit: number;
      summary: ReturnType<typeof stats>;
    }[] = [];
  let eligible = 0;
  for (const l of m.layers) {
    if (protectedLayers.includes(l.i)) continue;
    for (const bias of [false, true]) {
      const start = bias ? l.bias : l.offset,
        end = bias ? l.end : l.bias;
      const p = Math.min(
          1,
          c.p *
            (c.layerProbabilityFactors?.[l.i] ?? 1) *
            (bias ? c.biasProbabilityFactor : 1),
        ),
        sigma =
          (c.absoluteSigma ?? c.alpha * l.scale) *
          (c.layerStrengthFactors?.[l.i] ?? 1) *
          (bias ? c.biasStrengthFactor : 1);
      if (!p || !sigma) continue;
      const summary = bias ? layers[l.i].bias : layers[l.i].weight;
      summary.eligible = end - start;
      eligible += end - start;
      eligibleGroups.push({
        start,
        end,
        sigma,
        limit: bias ? m.biasLimit : m.weightLimit,
        summary,
      });
      for (let i = start; i < end; i++) if (r.next() < p) selected.push(i);
    }
  }
  if (eligible && !selected.length) {
    let pick = integer(r, eligible);
    for (const g of eligibleGroups) {
      if (pick < g.end - g.start) {
        selected.push(g.start + pick);
        break;
      }
      pick -= g.end - g.start;
    }
  }
  let cursor = 0;
  for (const i of selected) {
    while (i >= eligibleGroups[cursor].end) cursor++;
    const { sigma, limit, summary } = eligibleGroups[cursor];
    const step = mixedGaussian(r, sigma, c.largeProbability, c.largeMultiplier),
      large = step.large;
    const raw = out[i] + step.delta;
    if (!Number.isFinite(raw)) throw Error('Nonfinite mutated gene');
    const value = Math.max(-limit, Math.min(limit, raw)),
      old = out[i],
      delta = Math.abs(value - old);
    out[i] = value;
    summary.selected++;
    summary.changed += Number(value !== old);
    summary[large ? 'large' : 'normal']++;
    summary.clipped += Number(raw !== value);
    summary.meanAbs += delta;
    summary.rms += delta ** 2;
    summary.maxAbs = Math.max(summary.maxAbs, delta);
    if (details.length < maxDetails)
      details.push({ index: i, old, value, large, clipped: raw !== value });
  }
  for (const { summary } of eligibleGroups)
    if (summary.selected) {
      summary.meanAbs /= summary.selected;
      summary.rms = Math.sqrt(summary.rms / summary.selected);
    }
  return {
    parameters: out,
    layers,
    details,
    truncated: maxDetails > 0 && selected.length > details.length,
  };
}
export type Operator = 'uniform' | 'neuron-wise';
export function crossover(
  a: Genome,
  b: Genome,
  kind: Operator,
  r: Draw,
  protectedLayers: readonly number[] = [],
  donorMask?: Uint8Array,
) {
  if (a.model.key !== b.model.key || !['uniform', 'neuron-wise'].includes(kind))
    throw Error('Incompatible crossover');
  const out = a.parameters(),
    other = b.parameters();
  for (const l of a.model.layers) {
    if (protectedLayers.includes(l.i)) continue;
    if (kind === 'uniform') {
      for (let i = l.offset; i < l.end; i++)
        if (r.next() >= 0.5) {
          out[i] = other[i];
          if (donorMask && i < donorMask.length) donorMask[i] = 1;
        }
    } else
      for (let j = 0; j < l.width; j++)
        if (r.next() >= 0.5) {
          const start = l.offset + j * l.inputs;
          out.set(other.subarray(start, start + l.inputs), start);
          out[l.bias + j] = other[l.bias + j];
          if (donorMask) {
            donorMask.fill(1, start, start + l.inputs);
            if (l.bias + j < donorMask.length) donorMask[l.bias + j] = 1;
          }
        }
  }
  return out;
}
export function ranking(scores: readonly number[], r: Draw) {
  if (!Array.from(scores).every(Number.isFinite))
    throw Error('Invalid selection score');
  // Stable sort preserves this Fisher-Yates tie order.
  return permutation(r, scores.length).sort((a, b) => scores[b] - scores[a]);
}
export function eliteCount(n: number, rate: number) {
  return Math.min(
    n - 1,
    Math.max(1, Math.round(n * bounded(rate, 0.01, 0.2, 'elite rate'))),
  );
}
export function elites(
  order: readonly number[],
  genomes: readonly Genome[],
  count: number,
) {
  const chosen: number[] = [],
    duplicate: number[] = [],
    seen = new GenomeSet();
  for (const i of order) {
    if (seen.add(genomes[i])) chosen.push(i);
    else duplicate.push(i);
    if (chosen.length === count) break;
  }
  return chosen.concat(duplicate.slice(0, count - chosen.length));
}
export function tournament(pool: readonly number[], k: number, r: Draw) {
  bounded(k, 2, 8, 'tournament size', true);
  if (!pool.length) throw Error('Empty parent pool');
  if (pool.length === 1) return pool[0];
  const entries = new Map<number, number>();
  let best = pool.length;
  for (let i = 0; i < Math.min(k, pool.length); i++) {
    const j = i + integer(r, pool.length - i),
      rank = entries.get(j) ?? j;
    entries.set(j, entries.get(i) ?? i);
    best = Math.min(best, rank);
  }
  return pool[best];
}
