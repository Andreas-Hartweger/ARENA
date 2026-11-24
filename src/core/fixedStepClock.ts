import { TICKS_PER_SECOND, runHeadlessTicks, type TickHandler } from './ticks';
import { requireFinite, requireNonNegativeInteger } from './validation';

const MAX_FRAME_SECONDS = 0.25;
const MAX_FRAME_TICKS = 8;
// Compensate for floating-point noise near whole ticks.
const TICK_EPSILON = 1e-10;

export interface FrameResult {
  readonly executedTicks: number;
  readonly alpha: number;
  readonly discardedTicks: number;
  readonly discardedSeconds: number;
}

export class FixedStepClock {
  #lastFrameSeconds: number | undefined;
  #pendingTicks = 0;
  #tickIndex = 0;
  #paused = false;
  #dispatching = false;

  get tickIndex(): number {
    return this.#tickIndex;
  }

  get timeSeconds(): number {
    return this.#tickIndex / TICKS_PER_SECOND;
  }

  get paused(): boolean {
    return this.#paused;
  }

  pause(): void {
    this.#requireOutsideTick();
    this.#paused = true;
    this.#lastFrameSeconds = undefined;
    this.#pendingTicks = 0;
  }

  resume(): void {
    this.#requireOutsideTick();
    if (!this.#paused) return;
    this.#paused = false;
  }

  stepOnce(onTick: TickHandler): void {
    this.#requireOutsideTick();
    if (!this.#paused) throw new Error('Single step requires a paused clock');
    this.#runTick(onTick);
  }

  advanceFrame(
    nowSeconds: number,
    onTick: TickHandler,
    speed = 1,
  ): FrameResult {
    this.#requireOutsideTick();
    requireFinite(nowSeconds, 'frame timestamp');
    requireFinite(speed, 'simulation speed');
    if (speed < 0)
      throw new RangeError('Simulation speed must be non-negative');

    if (this.#paused || this.#lastFrameSeconds === undefined) {
      if (!this.#paused) this.#lastFrameSeconds = nowSeconds;
      return {
        executedTicks: 0,
        alpha: 0,
        discardedTicks: 0,
        discardedSeconds: 0,
      };
    }

    const elapsed = requireFinite(
      nowSeconds - this.#lastFrameSeconds,
      'frame elapsed time',
    );
    if (elapsed < 0) throw new RangeError('Frame timestamps must be monotonic');

    const accepted = Math.min(elapsed, MAX_FRAME_SECONDS);
    const pending = this.#pendingTicks + accepted * speed * TICKS_PER_SECOND;
    const wholeTicks = requireNonNegativeInteger(
      Math.floor(pending + TICK_EPSILON),
      'pending whole ticks',
    );
    const executedTicks = Math.min(wholeTicks, MAX_FRAME_TICKS);
    const discardedTicks = wholeTicks - executedTicks;
    const discardedSeconds = requireFinite(
      (elapsed - accepted) * speed + discardedTicks / TICKS_PER_SECOND,
      'discarded simulation time',
    );
    requireNonNegativeInteger(this.#tickIndex + executedTicks, 'end index');

    this.#lastFrameSeconds = nowSeconds;
    const remainder = Math.max(0, pending - wholeTicks);
    this.#pendingTicks = executedTicks + remainder;
    for (let i = 0; i < executedTicks; i += 1) {
      this.#runTick(onTick);
      this.#pendingTicks -= 1;
    }
    this.#pendingTicks = remainder;
    return {
      executedTicks,
      alpha: remainder,
      discardedTicks,
      discardedSeconds,
    };
  }

  #runTick(onTick: TickHandler): void {
    this.#dispatching = true;
    try {
      this.#tickIndex = runHeadlessTicks(1, onTick, this.#tickIndex);
    } finally {
      this.#dispatching = false;
    }
  }

  #requireOutsideTick(): void {
    if (this.#dispatching)
      throw new Error('Clock operations must run between ticks');
  }
}
