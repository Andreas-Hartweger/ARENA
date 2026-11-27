import { Brain, type Activation } from '../ai/network';
import { canonical } from '../ai/schema';
import { freezeTree } from '../physics/vehicleTick';
import { bounded } from './fitness';
import type { Digest } from './episode';

export function model(
  signature: string,
  hidden: readonly number[] = [32, 16],
  activation: Activation = 'tanh',
  weightLimit = 8,
  biasLimit = 4,
) {
  const brain = new Brain(signature, 0, hidden, activation);
  for (const limit of [weightLimit, biasLimit])
    if (!(bounded(limit, 0, 1e6, 'parameter limit') > 0))
      throw Error('Zero parameter limit');
  let count = 0;
  const layers = brain.dimensions.slice(1).map((width, i) => {
    const inputs = brain.dimensions[i],
      denom =
        i === hidden.length || activation === 'tanh'
          ? inputs + width
          : activation === 'relu'
            ? inputs
            : inputs * 1.0001;
    const scale = Math.sqrt(2 / denom);
    if (weightLimit < Math.sqrt(6 / denom))
      throw Error('Limits exclude legal initialization');
    const offset = count,
      bias = offset + inputs * width;
    count = bias + width;
    return { i, inputs, width, scale, offset, bias, end: count };
  });
  const key = canonical({
    version: 'arena.genome.v1',
    signature,
    layout: brain.layout,
    dimensions: brain.dimensions,
    activation,
  });
  return freezeTree({
    key,
    signature,
    layout: brain.layout,
    activation,
    hidden: [...hidden],
    weightLimit,
    biasLimit,
    layers,
    count,
  });
}
export type Model = ReturnType<typeof model>;
export function checkedParameters(m: Model, values: Float64Array) {
  if (!(values instanceof Float64Array) || values.length !== m.count)
    throw Error('Invalid genome length/type');
  const copy = values.slice();
  for (const l of m.layers)
    for (let i = l.offset; i < l.end; i++) {
      const limit = i < l.bias ? m.weightLimit : m.biasLimit;
      bounded(copy[i], -limit, limit, 'gene');
      if (copy[i] === 0) copy[i] = 0;
    }
  return copy;
}
export class Genome {
  readonly model: Model;
  readonly hash: string;
  readonly #values: Float64Array;
  constructor(m: Model, values: Float64Array, digest: Digest) {
    const copy = checkedParameters(m, values);
    this.model = m;
    this.#values = copy;
    this.hash = digest(m.key, copy.slice());
    Object.freeze(this);
  }
  static fromBrain(m: Model, b: Brain, digest: Digest) {
    if (
      b.signature !== m.signature ||
      b.activation !== m.activation ||
      b.layout !== m.layout ||
      canonical(b.dimensions) !== canonical([248, ...m.hidden, 3])
    )
      throw Error('Incompatible brain');
    return new Genome(m, b.parameters(), digest);
  }
  static initialize(m: Model, seed: number, digest: Digest) {
    return Genome.fromBrain(
      m,
      new Brain(m.signature, seed, m.hidden, m.activation),
      digest,
    );
  }
  parameters() {
    return this.#values.slice();
  }
  brain() {
    const m = this.model;
    return new Brain(m.signature, 0, m.hidden, m.activation, this.#values);
  }
  equals(b: Genome) {
    return (
      this === b ||
      (this.hash === b.hash &&
        this.model.key === b.model.key &&
        this.#values.every((v, i) => v === b.#values[i]))
    );
  }
}
export class GenomeSet {
  #buckets = new Map<string, Genome[]>();
  size = 0;
  add(g: Genome) {
    const bucket = this.#buckets.get(g.hash);
    if (bucket?.some((x) => x.equals(g))) return false;
    if (bucket) bucket.push(g);
    else this.#buckets.set(g.hash, [g]);
    this.size++;
    return true;
  }
}
