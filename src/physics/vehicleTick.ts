import { requireFinite, requireNonNegativeInteger } from '../core/validation';
import {
  resolveControlTick,
  type ControlDiagnostic,
  type ControlRequest,
} from '../input/controlInput';
import {
  NEUTRAL_KEYBOARD_STATE,
  stepKeyboardControls,
  type KeyboardControlState,
  type KeyboardSample,
} from '../input/keyboardControls';
import {
  createVehicle,
  type Vehicle,
  type VehicleOptions,
  type VehicleState,
} from '../vehicles/vehicle';
import {
  calculateFreeMotion,
  type PhysicsDiagnostics,
} from './vehicleDynamics';
import type { SurfaceQuery } from './surface';

export type TickCommand =
  | { readonly kind: 'analog'; readonly request: ControlRequest }
  | {
      readonly kind: 'keyboard';
      readonly sample: KeyboardSample;
      readonly sensitivity?: number;
    };

type Published<T> = { readonly [K in keyof T]: Published<T[K]> };

export interface VehicleFrame {
  readonly index: number;
  readonly state: Published<VehicleState>;
  readonly keyboard: KeyboardControlState;
  readonly controlDiagnostics: readonly ControlDiagnostic[];
  readonly physics?: Published<PhysicsDiagnostics>;
}

// Frames consist entirely of owned plain data. Shared snapshots stay safe across ticks.
export function freezeTree<T>(value: T): T {
  if (typeof value === 'number')
    requireFinite(value, 'published numeric field');
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function prepareVehicleTick(
  vehicle: Vehicle,
  state: VehicleState,
  keyboard: KeyboardControlState,
  command: TickCommand,
  query: SurfaceQuery,
  diagnostics: boolean,
) {
  const controls =
    command.kind === 'keyboard'
      ? stepKeyboardControls(
          keyboard,
          command.sample,
          state.drive,
          state.velocityMps,
          command.sensitivity,
        )
      : {
          ...resolveControlTick(
            command.request,
            state.drive,
            state.velocityMps,
          ),
          keyboard: NEUTRAL_KEYBOARD_STATE,
        };
  const motion = calculateFreeMotion(
    vehicle,
    { ...state, drive: controls.directionState },
    controls.input,
    query,
    diagnostics,
  );
  return {
    ...motion,
    keyboard: controls.keyboard,
    input: controls.input,
    controlDiagnostics: controls.diagnostics,
  };
}

export class VehicleTickSession {
  readonly #vehicle: Vehicle;
  readonly #query: SurfaceQuery;
  readonly #diagnostics: boolean;
  #frame: VehicleFrame;
  #failed = false;
  #stepping = false;

  constructor(
    options: VehicleOptions,
    surfaceQuery: SurfaceQuery,
    diagnostics = false,
  ) {
    this.#vehicle = freezeTree(createVehicle(options));
    this.#query = surfaceQuery;
    this.#diagnostics = diagnostics;
    this.#frame = freezeTree({
      index: 0,
      state: this.#vehicle.state,
      keyboard: NEUTRAL_KEYBOARD_STATE,
      controlDiagnostics: [],
    });
  }

  get frame(): VehicleFrame {
    return this.#frame;
  }
  get failed(): boolean {
    return this.#failed;
  }

  step(command: TickCommand): VehicleFrame {
    if (this.#failed)
      throw new Error('Vehicle session locked after a failed tick');
    if (this.#stepping) throw new Error('Vehicle tick already in progress');
    this.#stepping = true;
    const { index, state, keyboard } = this.#frame;
    try {
      const nextIndex = requireNonNegativeInteger(index + 1, 'vehicle tick');
      const prepared = prepareVehicleTick(
        this.#vehicle,
        state,
        keyboard,
        command,
        this.#query,
        this.#diagnostics,
      );
      const candidate = freezeTree({
        index: nextIndex,
        ...prepared,
      });
      this.#frame = candidate;
      return candidate;
    } catch (cause) {
      this.#failed = true;
      throw new Error(
        `Vehicle ${this.#vehicle.id} tick ${index + 1} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    } finally {
      this.#stepping = false;
    }
  }
}
