import { SeededRandom } from '../core/random';
export type Activation = 'tanh' | 'relu' | 'leaky';
export function activate(x: number, kind: Activation) {
  switch (kind) {
    case 'tanh':
      return Math.tanh(x);
    case 'relu':
      return Math.max(0, x);
    case 'leaky':
      return x >= 0 ? x : 0.01 * x;
    default:
      throw Error('Invalid activation');
  }
}
export function denseLayer(
  input: ArrayLike<number>,
  weights: Float64Array,
  offset: number,
  width: number,
  kind: Activation | 'linear',
  sums?: number[],
) {
  const out = new Float64Array(width);
  for (let j = 0; j < width; j++) {
    let z = weights[offset + width * input.length + j];
    for (let i = 0; i < input.length; i++)
      z += input[i] * weights[offset + j * input.length + i];
    if (!Number.isFinite(z))
      throw Error(
        'Nonfinite weighted sum at offset ' + offset + ' neuron ' + j,
      );
    sums?.push(z);
    out[j] = kind === 'linear' ? z : activate(z, kind);
  }
  return out;
}
export interface LayerTrace {
  sums: number[];
  values: number[];
}
export class Brain {
  readonly #weights: Float64Array;
  readonly dimensions: readonly number[];
  readonly layout = 'arena.dense.float64.v1';
  readonly signature: string;
  readonly seed: number;
  readonly activation: Activation;
  constructor(
    signature: string,
    seed = 42,
    hidden: readonly number[] = [32, 16],
    activation: Activation = 'tanh',
    parameters?: Float64Array,
  ) {
    this.signature = signature;
    this.seed = seed;
    this.activation = activation;
    const random = new SeededRandom(seed);
    if (
      !signature ||
      hidden.length < 1 ||
      hidden.length > 4 ||
      Array.from(hidden).some((n) => !Number.isInteger(n) || n < 4 || n > 128)
    )
      throw Error('Invalid model dimensions or signature');
    activate(0, activation);
    this.dimensions = Object.freeze([248, ...hidden, 3]);
    const count = this.dimensions
      .slice(1)
      .reduce((s, n, i) => s + n * (this.dimensions[i] + 1), 0);
    if (count > 100000) throw Error('Parameter limit');
    if (
      parameters &&
      (!(parameters instanceof Float64Array) ||
        parameters.length !== count ||
        !parameters.every(Number.isFinite))
    )
      throw Error('Invalid model parameters');
    this.#weights = parameters ? parameters.slice() : new Float64Array(count);
    if (!parameters) {
      let offset = 0;
      for (let l = 1; l < this.dimensions.length; l++) {
        const n = this.dimensions[l - 1],
          m = this.dimensions[l];
        const denom =
          l === this.dimensions.length - 1 || activation === 'tanh'
            ? n + m
            : activation === 'relu'
              ? n
              : n * 1.0001;
        const bound = Math.sqrt(6 / denom);
        for (let i = 0; i < n * m; i++)
          this.#weights[offset + i] = (2 * random.next() - 1) * bound;
        offset += (n + 1) * m;
      }
    }
    Object.freeze(this);
  }
  parameters() {
    return this.#weights.slice();
  }
  evaluate(input: ArrayLike<number>, trace = false) {
    if (input.length !== 248) throw Error('Expected 248 channels');
    for (let i = 0; i < input.length; i++)
      if (!Number.isFinite(input[i])) throw Error('Invalid input channel ' + i);
    let current = input,
      offset = 0;
    const layers: LayerTrace[] = [];
    for (let l = 1; l < this.dimensions.length; l++) {
      const sums = trace ? ([] as number[]) : undefined;
      const width = this.dimensions[l];
      const next = denseLayer(
        current,
        this.#weights,
        offset,
        width,
        l === this.dimensions.length - 1 ? 'linear' : this.activation,
        sums,
      );
      if (sums) layers.push({ sums, values: Array.from(next) });
      offset += width * (current.length + 1);
      current = next;
    }
    return { output: Array.from(current), layers };
  }
}
