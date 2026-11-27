import { driver, type AiState, type DriverOptions } from '../ai/driver';
import { obstacle, wallIndex } from '../ai/geometry';
import { dot, headingAxes } from '../core/math';
import { TICKS_PER_SECOND } from '../core/ticks';
import { requireNonNegativeInteger } from '../core/validation';
import { neutralControl, type ControlInput } from '../input/controlInput';
import {
  NEUTRAL_KEYBOARD_STATE,
  type KeyboardControlState,
} from '../input/keyboardControls';
import {
  createVehicle,
  validateVehicleState,
  type VehicleOptions,
  type VehicleState,
} from '../vehicles/vehicle';
import {
  freezeTree,
  prepareVehicleTick,
  type TickCommand,
} from '../physics/vehicleTick';
import type { PhysicsDiagnostics } from '../physics/vehicleDynamics';
import {
  compileWalls,
  solveContacts,
  type CollisionEvent,
  type ContactInterval,
} from '../collision/solver';
import type { Body } from '../collision/contact';
import {
  initialLap,
  invalidateLap,
  recordTravel,
  type LapState,
  type TravelFact,
} from '../tracks/progress';
import { recoveryCandidate, safePose, type SafePosition } from '../tracks/grid';
import type { Track } from '../tracks/track';
export interface Racer {
  ai?: AiState;
  id: string;
  state: VehicleState;
  lap: LapState;
  keyboard: KeyboardControlState;
  input: ControlInput;
  physics?: PhysicsDiagnostics;
  history: readonly SafePosition[];
  recovery: 'none' | 'accepted' | 'blocked';
}
export interface WorldFrame {
  index: number;
  cars: readonly Racer[];
  events: readonly CollisionEvent[];
  fallback: boolean;
  evaluation?: readonly { travel: TravelFact[]; contacts: ContactInterval[] }[];
}
export interface DriverCommand {
  command: TickCommand;
  recover?: boolean;
}
export class DriveWorld {
  readonly #vehicles;
  readonly #walls;
  readonly #drivers;
  trace = false;
  readonly #track: Track;
  readonly #shared: boolean;
  readonly #measure: boolean;
  #frame: WorldFrame;
  #failed = false;
  #busy = false;
  constructor(
    track: Track,
    options: readonly VehicleOptions[],
    shared = true,
    ai: ReadonlyMap<string, DriverOptions> = new Map(),
    measure = false,
  ) {
    this.#track = track;
    this.#walls = compileWalls(track.barriers);
    this.#shared = shared;
    this.#measure = measure;
    this.#vehicles = options
      .map(createVehicle)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (
      !options.length ||
      new Set(this.#vehicles.map((v) => v.id)).size !== options.length
    )
      throw Error('Invalid world vehicle IDs');
    const geometry = ai.size ? wallIndex(track) : undefined;
    this.#drivers = this.#vehicles.map((v) => {
      const opts = ai.get(v.id);
      return opts && geometry ? driver(opts, v, track, geometry) : undefined;
    });
    if (this.#drivers.filter(Boolean).length !== ai.size)
      throw Error('Unknown AI driver');
    this.#frame = freezeTree({
      index: 0,
      events: [],
      fallback: false,
      cars: this.#vehicles.map((v) => {
        const distance = track.project(v.state.positionM).s;
        const s =
            distance > track.length / 2 ? distance - track.length : distance,
          pose = {
            position: v.state.positionM,
            heading: v.state.headingRad,
            s,
            lengthM: v.definition.lengthM,
            widthM: v.definition.widthM,
          };
        return {
          id: v.id,
          state: v.state,
          lap: initialLap(s),
          history: safePose(track, pose, []) ? [pose] : [],
          keyboard: NEUTRAL_KEYBOARD_STATE,
          input: neutralControl(v.state.drive.direction),
          recovery: 'none' as const,
        };
      }),
    });
  }
  get frame() {
    return this.#frame;
  }
  step(commands: ReadonlyMap<string, DriverCommand>): WorldFrame {
    if (this.#failed || this.#busy) throw Error('World tick locked');
    this.#busy = true;
    try {
      const previous = this.#frame,
        index = requireNonNegativeInteger(previous.index + 1, 'world tick');
      const obstacles =
        this.#shared && this.#vehicles.length > 1 && this.#drivers.some(Boolean)
          ? previous.cars.map((c, i) =>
              obstacle({
                position: c.state.positionM,
                heading: c.state.headingRad,
                velocity: c.state.velocityMps,
                id: c.id,
                lengthM: this.#vehicles[i].definition.lengthM,
                widthM: this.#vehicles[i].definition.widthM,
              }),
            )
          : [];
      const cars: Racer[] = previous.cars.map((old, i) => {
        const ai = this.#drivers[i]?.(
          previous.index,
          old.state,
          obstacles.filter((p) => p.id !== old.id),
          old.ai,
          this.trace,
        );
        const cmd: TickCommand = ai
          ? { kind: 'target', request: ai.target }
          : (commands.get(old.id)?.command ?? {
              kind: 'analog',
              request: neutralControl(old.state.drive.direction),
            });
        return {
          ...old,
          ...(ai ? { ai } : {}),
          ...prepareVehicleTick(
            this.#vehicles[i],
            old.state,
            old.keyboard,
            cmd,
            this.#track.surfaceQuery,
            true,
          ),
          recovery: 'none',
        };
      });
      const bodies: Body[] = cars.map((car, i) => {
        const d = this.#vehicles[i].definition,
          old = previous.cars[i].state;
        return {
          id: car.id,
          position: old.positionM,
          heading: old.headingRad,
          velocity: car.state.velocityMps,
          yaw: car.state.yawRateRadPerSecond,
          lengthM: d.lengthM,
          widthM: d.widthM,
          invMass: 1 / d.massKg,
          invInertia: 1 / d.yawInertiaKgM2,
        };
      });
      const { events, paths, fallback, contacts } = solveContacts(
        bodies,
        this.#walls,
        index,
        this.#shared,
        this.#measure,
      );
      const evaluation = contacts?.map((intervals) => ({
        travel: [] as TravelFact[],
        contacts: intervals,
      }));
      cars.forEach((car, i) => {
        const body = bodies[i],
          others = this.#shared ? bodies.filter((b) => b !== body) : [];
        let lap = car.lap;
        for (const path of paths[i])
          lap = recordTravel(this.#track, lap, path, evaluation?.[i].travel);
        lap = { ...lap, s: this.#track.project(body.position, lap.s).s };
        car.state = {
          ...car.state,
          positionM: body.position,
          headingRad: body.heading,
          velocityMps: body.velocity,
          yawRateRadPerSecond: body.yaw,
        };
        if (commands.get(car.id)?.recover) {
          const safe = recoveryCandidate(
            this.#track,
            car.history,
            lap.s,
            others,
          );
          if (safe) {
            car.state = createVehicle({
              id: car.id,
              startNumber: 0,
              definition: this.#vehicles[i].definition,
              initialState: {
                positionM: safe.position,
                headingRad: safe.heading,
              },
            }).state;
            body.position = safe.position;
            body.heading = safe.heading;
            lap = invalidateLap(previous.cars[i].lap, safe.s);
            car.history = car.history.filter((p) => p.s <= safe.s);
            car.input = neutralControl('forward');
            car.keyboard = NEUTRAL_KEYBOARD_STATE;
            car.physics = undefined;
            delete car.ai;
            car.recovery = 'accepted';
          } else car.recovery = 'blocked';
        } else if (index % 15 === 0 && safePose(this.#track, body, others)) {
          car.history = [
            ...car.history.slice(-119),
            {
              position: body.position,
              heading: body.heading,
              s: lap.s,
              lengthM: body.lengthM,
              widthM: body.widthM,
            },
          ];
        }
        if (car.physics) {
          const axes = headingAxes(body.heading);
          car.physics = {
            ...car.physics,
            velocityMps: body.velocity,
            longitudinalMps: dot(body.velocity, axes.forward),
            lateralMps: dot(body.velocity, axes.left),
            yawRateRadPerSecond: body.yaw,
          };
        }
        car.lap = lap;
        validateVehicleState(car.state, this.#vehicles[i].definition);
      });
      this.#frame = freezeTree({
        index,
        events,
        fallback,
        cars,
        ...(evaluation ? { evaluation } : {}),
      });
      return this.#frame;
    } catch (cause) {
      this.#failed = true;
      throw new Error(
        'World tick ' + (this.#frame.index + 1) + ' failed: ' + String(cause),
        { cause },
      );
    } finally {
      this.#busy = false;
    }
  }
  get timeSeconds() {
    return this.#frame.index / TICKS_PER_SECOND;
  }
}
