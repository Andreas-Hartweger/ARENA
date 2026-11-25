import { expect, it } from 'vitest';
import { Brain, activate, denseLayer } from '../../src/ai/network';
import { targets, directionRequest } from '../../src/ai/driver';
import { SeededRandom } from '../../src/core/random';
import {
  stepKeyboardControls,
  stepTargetControls,
  NEUTRAL_KEYBOARD_STATE,
} from '../../src/input/keyboardControls';
it('NN-001–004 sizes, dense layout, activation and ownership', () => {
  const net = new Brain('test');
  expect(net.parameters().length).toBe(8547);
  expect(new Brain('test', 0, [128, 128, 128, 128]).parameters().length).toBe(
    81795,
  );
  for (const dims of [[], [3], [129], [4.5], [4, 4, 4, 4, 4]])
    expect(() => new Brain('test', 0, dims)).toThrow();
  const z: number[] = [];
  const h = denseLayer([1, 2], new Float64Array([2, -1, 0.5]), 0, 1, 'tanh', z);
  expect(z).toEqual([0.5]);
  expect(
    denseLayer(h, new Float64Array([3, -0.1]), 0, 1, 'linear')[0],
  ).toBeCloseTo(3 * Math.tanh(0.5) - 0.1, 12);
  expect([-2, 0, 2].map((x) => activate(x, 'leaky'))).toEqual([-0.02, 0, 2]);
  expect(activate(-2, 'relu')).toBe(0);
  const copy = net.parameters();
  copy.fill(1);
  const owned = new Brain('test', 1, [32, 16], 'relu', copy);
  copy.fill(0);
  expect(owned.parameters()[0]).toBe(1);
});
it('NN-005–007 exact seed stream, overflow, independent trace', () => {
  for (const seed of [0, 1, 42])
    for (const kind of ['tanh', 'relu', 'leaky'] as const) {
      const brain = new Brain('test', seed, [4], kind),
        rng = new SeededRandom(seed),
        w = brain.parameters();
      const bound = Math.sqrt(
        6 / (kind === 'tanh' ? 252 : kind === 'leaky' ? 248 * 1.0001 : 248),
      );
      for (let i = 0; i < 992; i++)
        expect(w[i]).toBe((2 * rng.next() - 1) * bound);
      expect([...w.slice(992, 996)]).toEqual([0, 0, 0, 0]);
      expect(w[996]).toBe((2 * rng.next() - 1) * Math.sqrt(6 / 7));
    }
  const brain = new Brain('test'),
    input = new Float64Array(248);
  input[2] = 1;
  const a = brain.evaluate(input, true);
  brain.evaluate(new Float64Array(248));
  expect(brain.evaluate(input, true)).toEqual(a);
  input[2] = Infinity;
  expect(() => brain.evaluate(input)).toThrow(/channel 2/);
  expect(() => brain.evaluate([])).toThrow();
  expect(() =>
    denseLayer([2], new Float64Array([Number.MAX_VALUE, 0]), 0, 1, 'relu'),
  ).toThrow();
});
it('CTL-001–005 same effective controls and reversal gate', () => {
  expect(directionRequest(-0.5, 'forward')).toBe('reverse');
  expect(directionRequest(0.5, 'reverse')).toBe('forward');
  for (const p of [-0.6, 0, 0.6]) {
    const t = targets([Math.atanh(p), Math.atanh(p), 0]);
    expect(t.throttle).toBeCloseTo(Math.max(0, p));
    expect(t.brake).toBeCloseTo(Math.max(0, -p));
    expect(t.steering).toBeCloseTo(p);
  }
  for (const [value, previous, result] of [
    [-0.51, 'forward', 'reverse'],
    [-0.49, 'forward', 'forward'],
    [0.49, 'reverse', 'reverse'],
    [0.51, 'reverse', 'forward'],
  ] as const)
    expect(targets([0, 0, Math.atanh(value)], previous).direction).toBe(result);
  let state = NEUTRAL_KEYBOARD_STATE,
    drive = {
      direction: 'forward' as 'forward' | 'reverse',
      oppositeHeldTicks: 0,
    };
  for (let i = 0; i < 45; i++) {
    const buttons = {
      forward: i < 5,
      reverse: i >= 5 && i < 35,
      left: i < 6,
      right: i > 8,
    };
    const velocity = { x: 0, y: 0 };
    const k = stepKeyboardControls(state, { buttons }, drive, velocity),
      a = stepTargetControls(
        state,
        {
          throttle: Number(buttons.forward || buttons.reverse),
          brake: 0,
          steering: Number(buttons.right) - Number(buttons.left),
          direction: buttons.reverse ? 'reverse' : drive.direction,
        },
        drive,
        velocity,
      );
    expect(a).toEqual(k);
    state = k.keyboard;
    drive = k.directionState;
    if (i === 21) expect(drive.oppositeHeldTicks).toBe(17);
    if (i === 22) expect(drive.direction).toBe('reverse');
  }
});

it('NN-001 rejects an uninitialized hidden width', () => {
  expect(() => new Brain('test', 42, new Array<number>(1))).toThrow();
});
it('CTL-001 rejects an incomplete output even when the array has length three', () => {
  const output = [0, 0, 0];
  delete output[2];
  expect(() => targets(output)).toThrow();
});
