import { normalizeAngle } from '../core/math';
import { safePose, type Footprint } from '../tracks/grid';
import type { TravelFact } from '../tracks/progress';
import type { Track } from '../tracks/track';
import type { ContactInterval } from '../collision/solver';

// A separate objective over accepted travel. Reversing cancels out forward distance.
export class RecoveryProof {
  #returnTick: number | null = null;
  #station: number | null = null;
  #distance = 0;
  #verified: number | null = null;
  #invalid = false;
  accept(
    tick: number,
    track: Track,
    body: Footprint,
    station: number,
    longitudinal: number,
    facts: readonly TravelFact[],
    contacts: readonly ContactInterval[],
  ) {
    if (this.#verified !== null || this.#invalid) return;
    if (
      contacts.some((c) => c.approach >= 10) ||
      facts.some((f) => f.kind === 'invalidate')
    ) {
      this.#invalid = true;
      return;
    }
    if (this.#returnTick === null) {
      if (
        tick <= 1200 &&
        !contacts.length &&
        longitudinal > 0 &&
        Math.abs(
          normalizeAngle(body.heading - track.sample(station).heading),
        ) <=
          Math.PI / 6 &&
        safePose(track, body, [])
      ) {
        this.#returnTick = tick;
        this.#station = station;
      }
      return;
    }
    if (tick - this.#returnTick > 300) {
      this.#invalid = true;
      return;
    }
    for (const f of facts)
      if (f.kind === 'move') {
        if (
          this.#station === null ||
          Math.abs(f.fromS - this.#station) > 1e-6
        ) {
          this.#invalid = true;
          return;
        }
        this.#distance += f.delta;
        this.#station = f.toS;
      }
    if (this.#distance >= 20) this.#verified = tick;
  }
  get result() {
    return {
      returnedAtTick: this.#returnTick,
      verifiedAtTick: this.#verified,
      progressM: this.#distance,
      success: this.#verified !== null && !this.#invalid,
    };
  }
}
