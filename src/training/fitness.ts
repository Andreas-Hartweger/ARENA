import { requireFinite } from '../core/validation';
import { freezeTree } from '../physics/vehicleTick';
import type { TravelFact } from '../tracks/progress';

export const profiles = freezeTree({
  Balanced: [0.5, 0.25, 0.08, 0.07, 0.04, 0.06, 0],
  Speed: [0.8, 0.1, 0.02, 0.03, 0.02, 0.03, 0],
  Safety: [0.15, 0.45, 0.15, 0.05, 0.07, 0.1, 0.03],
});
// DR-02B-001: keep adjacent lap tiers distinguishable in the published Float64 score.
export const MAX_TASK_LAPS = 1_000_000;
export const clampUnit = (x: number) =>
  Math.min(1, Math.max(0, requireFinite(x, 'fraction')));
export function bounded(
  x: number,
  min: number,
  max: number,
  name: string,
  integer = false,
) {
  if (
    !(x >= min && x <= max && Number.isFinite(x)) ||
    (integer && !Number.isSafeInteger(x))
  )
    throw new RangeError('Invalid ' + name);
  return x;
}
export function normalized(weights: readonly number[]) {
  if (
    !weights.length ||
    Array.from(weights).some((x) => !Number.isFinite(x) || x < 0)
  )
    throw Error('Invalid weights');
  const max = Math.max(...weights);
  if (!max) throw Error('Zero weights');
  const scaled = weights.map((x) => x / max),
    total = scaled.reduce((a, b) => a + b, 0);
  return Object.freeze(scaled.map((x) => x / total));
}
export function scoreFitness(
  N: number,
  L: number,
  success: boolean,
  P: number,
  A: number,
  K: number,
  elapsed: number,
  limit: number,
  errors: readonly number[],
  weights: readonly number[],
) {
  bounded(N, 1, MAX_TASK_LAPS, 'required laps', true);
  bounded(L, 0, N, 'laps', true);
  if (
    (success && L !== N) ||
    weights.length !== 7 ||
    errors.length !== 6 ||
    !(limit > 0) ||
    !Number.isFinite(limit)
  )
    throw Error('Invalid fitness inputs');
  [P, A, K, ...errors].forEach((x) => bounded(x, 0, 1, 'fraction'));
  bounded(elapsed, 0, Number.MAX_VALUE, 'elapsed');
  const w = normalized(weights),
    T = success ? clampUnit(1 - elapsed / limit) : P;
  const Q = clampUnit(
    errors.reduce((q, e, i) => q + w[i + 1] * (1 - e), w[0] * T),
  );
  const R = 900 * P + 10 * A + 15 * K + 75 * P * Q;
  return { P, A, K, T, Q, R, F: 1100 * ((N + 1) * Number(success) + L) + R };
}

export class ProgressLedger {
  readonly length: number;
  readonly gates: number;
  readonly required: number;
  readonly approachLength: number;
  approach = 0;
  partial = 0;
  completed = 0;
  distance = 0;
  active = false;
  finishedAt: number | null = null;
  readonly lapTimes: number[] = [];
  #approaching = true;
  #approachPosition = 0;
  #endStation: number;
  #position = 0;
  #seen = new Set<number>();
  #next = 1;
  constructor(length: number, gates: number, required: number, startS: number) {
    if (!(requireFinite(length, 'length') > 0)) throw Error('Invalid length');
    this.length = length;
    this.gates = bounded(gates, 1, 256, 'gates', true);
    this.required = bounded(required, 1, MAX_TASK_LAPS, 'laps', true);
    this.approachLength = Math.max(0, -requireFinite(startS, 'start station'));
    this.#endStation = startS;
  }
  get highwater() {
    return this.approach + this.completed * this.length + this.partial;
  }
  get fractions() {
    return {
      P: clampUnit(
        (this.completed + this.partial / this.length) / this.required,
      ),
      A: this.approachLength ? this.approach / this.approachLength : 0,
      K:
        this.gates === 1
          ? 0
          : (this.completed + this.#seen.size / (this.gates - 1)) /
            this.required,
    };
  }
  accept(facts: readonly TravelFact[]) {
    for (const f of facts) {
      if (this.finishedAt !== null) break;
      switch (f.kind) {
        case 'move': {
          this.distance += f.distance;
          if (this.active) {
            // A backward solver correction can expose the same road again. Remove
            // that overlap before accumulating real travel. Forward gaps earn zero.
            this.#position += Math.min(0, f.fromS - this.#endStation) + f.delta;
            this.partial = Math.max(
              this.partial,
              Math.min(this.#position, (this.length * this.#next) / this.gates),
            );
          } else if (this.#approaching) {
            // Count only the part inside the physical approach, including reverse travel.
            const within = (s: number) =>
              Math.min(0, Math.max(-this.approachLength, s));
            this.#approachPosition +=
              Math.min(0, within(f.fromS) - within(this.#endStation)) +
              within(f.toS) -
              within(f.fromS);
            this.approach = Math.max(
              this.approach,
              Math.min(this.approachLength, this.#approachPosition),
            );
          }
          this.#endStation = f.toS;
          break;
        }
        case 'invalidate':
          this.distance += f.uncreditedDistance ?? 0;
          this.active = false;
          this.#approaching = false;
          break;
        case 'start':
          this.#endStation = f.station;
          this.active = true;
          this.#approaching = false;
          this.#position = 0;
          this.#next = 1;
          break;
        case 'gate':
          if (!this.active || f.gate !== this.#next)
            throw Error('Unexpected certified gate');
          this.#seen.add(f.gate);
          this.#next++;
          break;
        case 'finish':
          if (
            !this.active ||
            this.#next !== this.gates ||
            this.#seen.size !== this.gates - 1
          )
            throw Error('Incomplete certified finish');
          this.completed++;
          this.partial = 0;
          this.#seen.clear();
          this.lapTimes.push(f.lapTime);
          if (this.completed === this.required) this.finishedAt = f.time;
          break;
      }
    }
  }
}
