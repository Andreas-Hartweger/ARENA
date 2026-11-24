import { requireNonNegativeInteger } from './validation';

export const TICKS_PER_SECOND = 60;
export const TICK_SECONDS = 1 / TICKS_PER_SECOND;

export interface Tick {
  readonly index: number;
  readonly dt: number;
  readonly timeSeconds: number;
}

export type TickHandler = (tick: Tick) => void;

export function runHeadlessTicks(
  count: number,
  onTick: TickHandler,
  startIndex = 0,
): number {
  requireNonNegativeInteger(count, 'tick count');
  requireNonNegativeInteger(startIndex, 'start index');
  const endIndex = requireNonNegativeInteger(startIndex + count, 'end index');

  for (let completed = startIndex; completed < endIndex; completed += 1) {
    const index = completed + 1;
    onTick({ index, dt: TICK_SECONDS, timeSeconds: index / TICKS_PER_SECOND });
  }

  return endIndex;
}
