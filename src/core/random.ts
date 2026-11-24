import { requireNonNegativeInteger } from './validation';

const UINT32_RANGE = 0x1_0000_0000;

export class SeededRandom {
  #state = 0;

  constructor(seed: number) {
    this.restoreState(seed);
  }

  getState(): number {
    return this.#state;
  }

  restoreState(state: number): void {
    if (requireNonNegativeInteger(state, 'PRNG state') >= UINT32_RANGE) {
      throw new RangeError('PRNG state must fit in uint32');
    }
    this.#state = state || 0;
  }

  next(): number {
    // Mulberry32 advances the state and mixes its bits to produce a sample.
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(this.#state ^ (this.#state >>> 15), this.#state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  }
}
