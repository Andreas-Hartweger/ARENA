import { describe, expect, it } from 'vitest';
import { metersPerSecondToKilometersPerHour } from '../../src/core/math';
import {
  createVehicle,
  createVehicles,
  validateVehicleState,
} from '../../src/vehicles/vehicle';
import {
  defineVehicle,
  GT_01,
  type VehicleDefinition,
} from '../../src/vehicles/vehicleDefinition';
import {
  createGT01Setup,
  validateVehicleSetup,
  type VehicleSetup,
} from '../../src/vehicles/vehicleSetup';

describe('GT-01 vehicle data', () => {
  it('stores immutable GT-01 nominal data in SI units (VEH-001–003, VEH-009)', () => {
    const car = createVehicle({ id: 'driver-1', startNumber: 11 });
    expect(car.definition).toBe(GT_01);
    expect(Object.isFrozen(car.definition)).toBe(true);
    expect(car.definition).toMatchObject({
      id: 'gt-01',
      name: 'ARENA GT-01',
      lengthM: 4.5,
      widthM: 1.95,
      wheelbaseM: 2.65,
      frontAxleDistanceM: 1.325,
      rearAxleDistanceM: 1.325,
      massKg: 1300,
      yawInertiaKgM2: 2600,
      powerW: 330974.4375,
      targetZeroToHundredSeconds: 3.8,
      nominalBrakingMps2: 12,
      maxSteeringRad: Math.PI / 6,
    });
    expect(
      metersPerSecondToKilometersPerHour(car.definition.targetTopSpeedMps),
    ).toBeCloseTo(250);
    expect(
      metersPerSecondToKilometersPerHour(car.definition.reverseLimitMps),
    ).toBeCloseTo(30);
    expect(car.state.positionM).toEqual({ x: 0, y: 0 });
    expect(car.state.headingRad).toBe(0);
    expect(car.state.drive).toEqual({
      direction: 'forward',
      oppositeHeldTicks: 0,
    });
    expect(car.state.discontinuity).toBe(true);
  });

  it('stores G-03 calibration defaults separately from named vehicle data', () => {
    expect(createGT01Setup()).toEqual({
      gravityMps2: 9.81,
      airDensityKgM3: 1.225,
      dragAreaM2: 0.75,
      drivetrainEfficiency: 0.85,
      maxDriveForceN: 9800,
      reverseDriveFactor: 0.35,
      frontStaticLoadFraction: 0.5,
      frontCorneringStiffnessNPerRad: 45000,
      rearCorneringStiffnessNPerRad: 50000,
      maxSteeringRateRadPerSecond: (2 * Math.PI) / 3,
      handlingBlendStartMps: 5 / 3.6,
      handlingBlendEndMps: 15 / 3.6,
      steeringReferenceSpeedMps: 15,
      forwardTaperStartMps: 240 / 3.6,
      forwardTaperEndMps: 260 / 3.6,
      reverseTaperStartMps: 25 / 3.6,
      surfaceTransitionSeconds: 0.1,
      surfaces: {
        asphalt: { friction: 1.25, rollingResistance: 0.015 },
        grass: { friction: 0.45, rollingResistance: 0.08 },
      },
    });
  });

  it('shares only the frozen definition and copies mutable inputs (VEH-004, VEH-008)', () => {
    const setup = createGT01Setup();
    const spawn = { x: 12, y: -2 };
    const surface = {
      surface: 'asphalt' as const,
      previousSurface: null,
      transitionElapsedSeconds: 0,
    };
    const initialState = {
      positionM: spawn,
      headingRad: 3 * Math.PI,
      frontAxle: surface,
    };
    const [first, second] = createVehicles([
      { id: 'one', startNumber: 1, setup, initialState },
      { id: 'two', startNumber: 2, color: '#ff0000', setup, initialState },
    ]);
    expect(first.definition).toBe(second.definition);
    expect(first.state.positionM).not.toBe(second.state.positionM);
    expect(first.state.velocityMps).not.toBe(second.state.velocityMps);
    expect(first.state.drive).not.toBe(second.state.drive);
    expect(first.state.headingRad).toBe(-Math.PI);
    expect(first.appearance).toEqual({ color: '#397ac4', startNumber: 1 });

    first.state.frontAxle.transitionElapsedSeconds = 0.05;
    first.state.positionM = { x: 5, y: 10 };
    first.appearance.startNumber = 20;
    first.setup.surfaces.grass.friction = 0.5;
    spawn.x = 100;

    expect(second.state.positionM).toEqual({ x: 12, y: -2 });
    expect(second.state.frontAxle.transitionElapsedSeconds).toBe(0);
    expect(surface.transitionElapsedSeconds).toBe(0);
    expect(second.setup.surfaces.grass.friction).toBe(0.45);
    expect(setup.surfaces.grass.friction).toBe(0.45);
    expect(second.appearance).toEqual({ color: '#ff0000', startNumber: 2 });
  });

  it.each<Partial<VehicleDefinition>>([
    { lengthM: 0 },
    { widthM: Infinity },
    { massKg: -5 },
    { yawInertiaKgM2: NaN },
    { wheelbaseM: 4.5 },
    { frontAxleDistanceM: 1.5 },
    { maxSteeringRad: Math.PI },
  ])('rejects invalid nominal data %o', (patch) => {
    expect(() => defineVehicle({ ...GT_01, ...patch })).toThrow(RangeError);
  });

  it.each<Partial<VehicleSetup>>([
    { reverseDriveFactor: 1.1 },
    { dragAreaM2: NaN },
    { frontStaticLoadFraction: 1 },
    { handlingBlendStartMps: 9 },
    { reverseTaperStartMps: GT_01.reverseLimitMps },
    { maxSteeringRateRadPerSecond: Infinity },
  ])('rejects invalid calibration %o', (patch) => {
    expect(() =>
      validateVehicleSetup({ ...createGT01Setup(), ...patch }),
    ).toThrow(RangeError);
  });

  it('rejects invalid surface properties, ID, appearance and duplicate vehicle IDs', () => {
    const setup = createGT01Setup();
    setup.surfaces.grass.rollingResistance = -0.01;
    expect(() => validateVehicleSetup(setup)).toThrow(RangeError);
    expect(() => createVehicle({ id: ' ', startNumber: 1 })).toThrow(
      RangeError,
    );
    expect(() => createVehicle({ id: 'one', startNumber: 1.5 })).toThrow(
      RangeError,
    );
    expect(() =>
      createVehicle({ id: 'one', startNumber: 1, color: 'red' }),
    ).toThrow(RangeError);
    expect(() =>
      createVehicles([
        { id: 'same', startNumber: 1 },
        { id: 'same', startNumber: 2 },
      ]),
    ).toThrow(/Duplicate/);
  });

  it('validates pose, motion, steering and transition state at the state boundary', () => {
    const options = { id: 'one', startNumber: 1 };
    expect(() =>
      createVehicle({ ...options, initialState: { headingRad: NaN } }),
    ).toThrow(RangeError);
    expect(() =>
      createVehicle({ ...options, initialState: { steeringAngleRad: 1 } }),
    ).toThrow(RangeError);
    const { state } = createVehicle(options);
    expect(() =>
      validateVehicleState({ ...state, yawRateRadPerSecond: Infinity }, GT_01),
    ).toThrow(RangeError);
    expect(() =>
      validateVehicleState({ ...state, velocityMps: { x: 0, y: NaN } }, GT_01),
    ).toThrow(RangeError);
    expect(() =>
      validateVehicleState(
        { ...state, drive: { direction: 'reverse', oppositeHeldTicks: 18 } },
        GT_01,
      ),
    ).toThrow(RangeError);
    expect(() =>
      validateVehicleState(
        {
          ...state,
          frontAxle: { ...state.frontAxle, transitionElapsedSeconds: -1 },
        },
        GT_01,
      ),
    ).toThrow(RangeError);
  });
});
