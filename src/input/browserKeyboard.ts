import type { KeyboardButtons, KeyboardSample } from './keyboardControls';

const DRIVE_CODES = new Set([
  'KeyW',
  'ArrowUp',
  'KeyS',
  'ArrowDown',
  'KeyA',
  'ArrowLeft',
  'KeyD',
  'ArrowRight',
]);

type KeyboardDocument = Pick<Document, 'activeElement' | 'hidden'> &
  EventTarget;

export function attachBrowserKeyboard(
  windowTarget: EventTarget,
  documentTarget: KeyboardDocument,
  onPauseChange: (paused: boolean) => void,
) {
  const keys = new Set<string>();
  let paused = false;
  let drivingEnabled = true;
  let disposed = false;
  let reset = false;
  let holdInterrupted = false;

  function buttons(): KeyboardButtons {
    return {
      forward: keys.has('KeyW') || keys.has('ArrowUp'),
      reverse: keys.has('KeyS') || keys.has('ArrowDown'),
      left: keys.has('KeyA') || keys.has('ArrowLeft'),
      right: keys.has('KeyD') || keys.has('ArrowRight'),
    };
  }

  function clear(): void {
    keys.clear();
    reset = true;
  }

  function setPaused(value: boolean): void {
    if (disposed || paused === value) return;
    paused = value;
    clear();
  }

  function suspendForFocusLoss(): void {
    clear();
    if (paused || !drivingEnabled) return;
    setPaused(true);
    onPauseChange(true);
  }

  function setKey(code: string, pressed: boolean): void {
    const before = buttons();
    if (pressed) keys.add(code);
    else keys.delete(code);
    const after = buttons();
    if (before.forward !== after.forward || before.reverse !== after.reverse) {
      holdInterrupted = true;
    }
  }

  function onKeyDown(event: Event): void {
    const key = event as KeyboardEvent;
    if (
      !drivingEnabled ||
      documentTarget.hidden ||
      key.altKey ||
      key.ctrlKey ||
      key.metaKey ||
      key.isComposing
    )
      return;
    if (
      isEditing(documentTarget.activeElement) ||
      key.composedPath().some(isEditing)
    ) {
      clear();
      return;
    }
    if (key.defaultPrevented) return;
    if (key.code === 'Escape') {
      key.preventDefault();
      if (!key.repeat) {
        setPaused(!paused);
        onPauseChange(paused);
      }
      return;
    }
    if (paused || !DRIVE_CODES.has(key.code)) return;
    key.preventDefault();
    if (!key.repeat) setKey(key.code, true);
  }

  function onKeyUp(event: Event): void {
    const key = event as KeyboardEvent;
    if (DRIVE_CODES.has(key.code)) setKey(key.code, false);
  }

  function onVisibilityChange(): void {
    if (documentTarget.hidden) suspendForFocusLoss();
  }

  function onFocusIn(event: Event): void {
    if (event.composedPath().some(isEditing)) clear();
  }

  windowTarget.addEventListener('keydown', onKeyDown);
  // Release keys even when focus has moved or a control consumes the event.
  windowTarget.addEventListener('keyup', onKeyUp, true);
  windowTarget.addEventListener('blur', suspendForFocusLoss);
  documentTarget.addEventListener('visibilitychange', onVisibilityChange);
  documentTarget.addEventListener('focusin', onFocusIn, true);

  return {
    readSample(): KeyboardSample {
      const suspended =
        disposed ||
        paused ||
        !drivingEnabled ||
        documentTarget.hidden ||
        isEditing(documentTarget.activeElement);
      if (suspended) clear();
      const sample = { buttons: buttons(), suspended, reset, holdInterrupted };
      reset = false;
      holdInterrupted = false;
      return sample;
    },
    setPaused,
    setDrivingEnabled(enabled: boolean): void {
      if (disposed || drivingEnabled === enabled) return;
      drivingEnabled = enabled;
      clear();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clear();
      windowTarget.removeEventListener('keydown', onKeyDown);
      windowTarget.removeEventListener('keyup', onKeyUp, true);
      windowTarget.removeEventListener('blur', suspendForFocusLoss);
      documentTarget.removeEventListener(
        'visibilitychange',
        onVisibilityChange,
      );
      documentTarget.removeEventListener('focusin', onFocusIn, true);
    },
  };
}

function isEditing(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.isContentEditable ||
    element?.closest?.('.ai-tools, input, textarea, select, [role="textbox"]'),
  );
}
