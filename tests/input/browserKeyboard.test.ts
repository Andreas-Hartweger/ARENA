import { describe, expect, it, vi } from 'vitest';
import { FixedStepClock } from '../../src/core/fixedStepClock';
import { TICK_SECONDS } from '../../src/core/ticks';
import { attachBrowserKeyboard } from '../../src/input/browserKeyboard';
import type { DirectionState } from '../../src/input/controlInput';
import {
  NEUTRAL_KEYBOARD_STATE,
  stepKeyboardControls,
} from '../../src/input/keyboardControls';

class TestDocument extends EventTarget {
  activeElement: Element | null = null;
  hidden = false;
}

function key(type: 'keydown' | 'keyup', code: string, extra = {}) {
  return Object.assign(new Event(type, { cancelable: true }), {
    code,
    repeat: false,
    ...extra,
  });
}

function dispatchFocus(target: TestDocument, element: Element) {
  const event = new Event('focusin');
  vi.spyOn(event, 'composedPath').mockReturnValue([element, target]);
  target.dispatchEvent(event);
}

function setup(onPauseChange = vi.fn()) {
  const browser = new EventTarget();
  const document = new TestDocument();
  const adapter = attachBrowserKeyboard(browser, document, onPauseChange);
  return { browser, document, adapter, onPauseChange };
}

const neutral = { forward: false, reverse: false, left: false, right: false };

describe('browser keyboard adapter', () => {
  it.each([
    ['KeyW', 'KeyS', 'KeyA', 'KeyD'],
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
  ])(
    'supports all four keys and releases them (%s, %s, %s, %s) (CTRL-001)',
    (...codes) => {
      const { browser, adapter } = setup();
      for (const [index, button] of (
        ['forward', 'reverse', 'left', 'right'] as const
      ).entries()) {
        expect(browser.dispatchEvent(key('keydown', codes[index]))).toBe(false);
        expect(adapter.readSample().buttons).toEqual({
          ...neutral,
          [button]: true,
        });
        browser.dispatchEvent(key('keyup', codes[index]));
        expect(adapter.readSample().buttons).toEqual(neutral);
      }
      adapter.dispose();
    },
  );

  it('retains a held alias but records a release and re-press between ticks', () => {
    const { browser, adapter } = setup();
    browser.dispatchEvent(key('keydown', 'KeyS'));
    expect(adapter.readSample().holdInterrupted).toBe(true);
    browser.dispatchEvent(key('keydown', 'ArrowDown'));
    browser.dispatchEvent(key('keyup', 'KeyS'));
    expect(adapter.readSample()).toMatchObject({
      buttons: { reverse: true },
      holdInterrupted: false,
    });
    browser.dispatchEvent(key('keyup', 'ArrowDown'));
    browser.dispatchEvent(key('keydown', 'KeyS'));
    const sample = adapter.readSample();
    expect(sample).toMatchObject({
      buttons: { reverse: true },
      holdInterrupted: true,
    });
    const drive: DirectionState = {
      direction: 'forward',
      oppositeHeldTicks: 17,
    };
    expect(
      stepKeyboardControls(NEUTRAL_KEYBOARD_STATE, sample, drive, {
        x: 0,
        y: 0,
      }).directionState,
    ).toEqual({ direction: 'forward', oppositeHeldTicks: 1 });
    adapter.dispose();
  });

  it.each(['blur', 'hidden'] as const)(
    'pauses on %s and requires a fresh key after explicit resume (CTRL-010)',
    (cause) => {
      const { browser, document, adapter, onPauseChange } = setup();
      browser.dispatchEvent(key('keydown', 'KeyW'));
      expect(adapter.readSample().buttons.forward).toBe(true);
      if (cause === 'blur') browser.dispatchEvent(new Event('blur'));
      else {
        document.hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      browser.dispatchEvent(new Event('blur'));
      expect(onPauseChange).toHaveBeenCalledExactlyOnceWith(true);
      document.hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(adapter.readSample()).toMatchObject({
        suspended: true,
        buttons: neutral,
      });
      adapter.setPaused(false);
      browser.dispatchEvent(key('keydown', 'KeyW', { repeat: true }));
      expect(adapter.readSample()).toMatchObject({
        suspended: false,
        buttons: neutral,
        reset: true,
      });
      browser.dispatchEvent(key('keydown', 'KeyW'));
      expect(adapter.readSample().buttons.forward).toBe(true);
      adapter.dispose();
    },
  );

  it('clears on Escape and can pause the existing clock through a host callback', () => {
    const clock = new FixedStepClock();
    const onTick = vi.fn();
    const { browser, adapter } = setup(
      vi.fn((paused: boolean) => (paused ? clock.pause() : clock.resume())),
    );
    clock.advanceFrame(0, onTick);
    browser.dispatchEvent(key('keydown', 'KeyA'));
    browser.dispatchEvent(key('keydown', 'Escape'));
    expect(clock.paused).toBe(true);
    expect(adapter.readSample()).toMatchObject({
      buttons: neutral,
      suspended: true,
    });
    browser.dispatchEvent(key('keydown', 'Escape', { repeat: true }));
    expect(clock.paused).toBe(true);
    expect(clock.advanceFrame(10, onTick).executedTicks).toBe(0);
    browser.dispatchEvent(key('keydown', 'Escape'));
    expect(clock.paused).toBe(false);
    expect(clock.advanceFrame(20, onTick).executedTicks).toBe(0);
    expect(clock.advanceFrame(20 + TICK_SECONDS, onTick).executedTicks).toBe(1);
    expect(adapter.readSample().buttons).toEqual(neutral);
    adapter.dispose();
  });

  it.each(['input', 'textarea', 'contenteditable', 'textbox'])(
    'does not capture text editing (%s)',
    (kind) => {
      const { browser, document, adapter, onPauseChange } = setup();
      const field = {
        isContentEditable: kind === 'contenteditable',
        closest: (selector: string) =>
          kind !== 'contenteditable' && selector.includes(kind),
      } as unknown as Element;
      browser.dispatchEvent(key('keydown', 'KeyS'));
      dispatchFocus(document, field);
      document.activeElement = field;
      expect(browser.dispatchEvent(key('keydown', 'ArrowDown'))).toBe(true);
      expect(browser.dispatchEvent(key('keydown', 'Escape'))).toBe(true);
      expect(onPauseChange).not.toHaveBeenCalled();
      expect(adapter.readSample()).toMatchObject({
        buttons: neutral,
        suspended: true,
      });
      document.activeElement = null;
      expect(adapter.readSample().buttons).toEqual(neutral);
      adapter.dispose();
    },
  );

  it('allows a menu to suppress bindings and removes every listener on dispose', () => {
    const browser = new EventTarget();
    const document = new TestDocument();
    const windowAdd = vi.spyOn(browser, 'addEventListener');
    const windowRemove = vi.spyOn(browser, 'removeEventListener');
    const docAdd = vi.spyOn(document, 'addEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');
    const pause = vi.fn();
    const adapter = attachBrowserKeyboard(browser, document, pause);
    browser.dispatchEvent(key('keydown', 'KeyW'));
    adapter.setDrivingEnabled(false);
    expect(browser.dispatchEvent(key('keydown', 'Escape'))).toBe(true);
    expect(adapter.readSample()).toMatchObject({
      buttons: neutral,
      suspended: true,
    });
    adapter.setDrivingEnabled(true);
    expect(adapter.readSample().buttons).toEqual(neutral);
    adapter.dispose();
    adapter.dispose();
    expect(windowAdd.mock.calls).toHaveLength(3);
    expect(docAdd.mock.calls).toHaveLength(2);
    expect(windowRemove.mock.calls).toEqual(windowAdd.mock.calls);
    expect(docRemove.mock.calls).toEqual(docAdd.mock.calls);
    browser.dispatchEvent(new Event('blur'));
    expect(browser.dispatchEvent(key('keydown', 'Escape'))).toBe(true);
    expect(pause).not.toHaveBeenCalled();
  });
});
