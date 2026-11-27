import { clampUnit } from './fitness';
import type { ContactInterval } from '../collision/solver';

export function impactCost(approach: number) {
  return 0.05 + 0.45 * clampUnit(approach / 15) ** 2;
}
export interface TickSample {
  speed: number;
  longitudinal: number;
  lateral: number;
  tangential: number | null;
  grassAxles: number;
  reverse: boolean;
  steering: number;
  pedal: number;
  fallback: boolean;
}
export class Penalties {
  raw = {
    contactSeconds: 0,
    clusters: 0,
    impactSum: 0,
    peakApproach: 0,
    grassSeconds: 0,
    idleSeconds: 0,
    wrongWaySeconds: 0,
    unstableSeconds: 0,
    steeringWindows: 0,
    steeringChange: 0,
    reverseSeconds: 0,
    unknownTangentSeconds: 0,
    maxSpeed: 0,
    speedIntegral: 0,
    tangentialIntegral: 0,
    fallbackTicks: 0,
    recoveries: 0,
  };
  #contactEnd = -Infinity;
  #clusterPeak = 0;
  #continuity = [0, 0, 0];
  #steer = 0;
  #pedal = 0;
  #activity = 0;
  #streak = 0;
  #maneuver = false;
  accept(
    index: number,
    end: number,
    s: TickSample,
    contacts: readonly ContactInterval[],
    gain: number,
  ) {
    const start = (index - 1) / 60,
      dt = Math.min(1 / 60, Math.max(0, end - start)),
      r = this.raw;
    for (const c of contacts) {
      const a = Math.max(c.start, start),
        b = Math.min(c.end, end);
      if (b <= a) continue;
      if (a - this.#contactEnd >= 0.25 - 1e-12) {
        this.#clusterPeak = c.approach;
        r.clusters++;
        r.impactSum += impactCost(c.approach);
      } else if (c.approach > this.#clusterPeak) {
        r.impactSum += impactCost(c.approach) - impactCost(this.#clusterPeak);
        this.#clusterPeak = c.approach;
      }
      r.peakApproach = Math.max(r.peakApproach, c.approach);
      r.contactSeconds += Math.max(0, b - Math.max(a, this.#contactEnd));
      this.#contactEnd = Math.max(b, this.#contactEnd);
    }
    r.grassSeconds += (dt * s.grassAxles) / 2;
    r.speedIntegral += dt * s.speed;
    r.maxSpeed = Math.max(s.speed, r.maxSpeed);
    if (s.tangential === null) r.unknownTangentSeconds += dt;
    else r.tangentialIntegral += s.tangential * dt;
    if (s.reverse) {
      r.reverseSeconds += dt;
      this.#maneuver = true;
    } else if (this.#maneuver && gain > 1e-8) {
      r.recoveries++;
      this.#maneuver = false;
    }
    if (s.fallback) r.fallbackTicks++;
    const conditions = [
      s.speed < 0.5 && gain <= 1e-8,
      s.tangential !== null && s.tangential < -1,
      s.speed >= 5 &&
        Math.atan2(Math.abs(s.lateral), Math.abs(s.longitudinal)) >
          (35 * Math.PI) / 180 &&
        s.tangential !== null &&
        s.tangential / s.speed < 0.25,
    ];
    const keys = ['idleSeconds', 'wrongWaySeconds', 'unstableSeconds'] as const;
    conditions.forEach((active, i) => {
      const before = this.#continuity[i];
      this.#continuity[i] = active ? before + 1 : 0;
      if (active && before >= [180, 120, 30][i]) r[keys[i]] += dt;
    });
    this.#activity +=
      Math.abs(s.steering - this.#steer) + Math.abs(s.pedal - this.#pedal);
    this.#steer = s.steering;
    this.#pedal = s.pedal;
    r.steeringChange = this.#activity;
    if (index % 60 === 0 && end >= index / 60 - 1e-12) {
      this.#streak = this.#activity > 4 ? this.#streak + 1 : 0;
      r.steeringWindows += this.#streak === 2 ? 2 : Number(this.#streak > 2);
      this.#activity = 0;
    }
  }
  get errors() {
    const r = this.raw;
    return [
      r.impactSum + 0.01 * r.contactSeconds,
      r.grassSeconds / 20,
      r.idleSeconds / 10,
      r.wrongWaySeconds / 10,
      r.unstableSeconds / 10,
      r.steeringWindows / 10,
    ].map(clampUnit);
  }
}
