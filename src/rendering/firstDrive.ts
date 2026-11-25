import { Brain } from '../ai/network';
import { signature } from '../ai/schema';
import type { AiState } from '../ai/driver';
import { createVehicle } from '../vehicles/vehicle';
import type { ControlInput } from '../input/controlInput';
export type DriverMode = 'human' | 'fixture' | 'seed';
import * as THREE from 'three';
import { FixedStepClock } from '../core/fixedStepClock';
import {
  interpolateAngle,
  interpolatePosition,
  headingAxes,
} from '../core/math';
import { DriveWorld } from '../game/world';
import { attachBrowserKeyboard } from '../input/browserKeyboard';
import { createTrack, shift } from '../tracks/track';
import { startGrid, corners } from '../tracks/grid';
import { GT_01 } from '../vehicles/vehicleDefinition';
import { follow, mapPoint, viewWidth, zoom, type CameraMode } from './camera';
import { circuitMesh, trackGuides } from './circuitMesh';
import { carMesh } from './carMesh';
export interface Telemetry {
  ai?: AiState;
  applied: ControlInput;
  x: number;
  y: number;
  speed: number;
  gas: number;
  brake: number;
  front: string;
  rear: string;
  progress: number;
  lap: number | null;
  last: number | null;
  fps: number;
  paused: boolean;
  mode: CameraMode;
  index: number;
  debug: boolean;
  frontGrip: number;
  rearGrip: number;
  frontGripN?: number;
  rearGripN?: number;
  recovery: string;
  fallback: boolean;
  laps: number;
}
export function startDrive(
  canvas: HTMLCanvasElement,
  track: ReturnType<typeof createTrack>,
  report: (v: Telemetry) => void,
  onError: (s: string) => void,
  driverMode: DriverMode = 'human',
) {
  const gl = canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw Error('WebGL 2 ist auf diesem Gerät nicht verfügbar.');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: true,
  });
  const spawn = startGrid(track, 1, GT_01.lengthM, GT_01.widthM)[0];
  const appearance = { color: '#397ac4', startNumber: 7 };
  const options = {
    id: 'player',
    ...appearance,
    initialState: { positionM: spawn.position, headingRad: spawn.heading },
  };
  let brain: Brain | undefined;
  if (driverMode !== 'human') {
    const key = signature(createVehicle(options));
    if (driverMode === 'fixture') {
      const params = new Float64Array(8547);
      params.set([Math.atanh(0.6), 0, 1], 8544);
      brain = new Brain(key, 0, [32, 16], 'tanh', params);
    } else brain = new Brain(key, 42);
  }
  const world = new DriveWorld(
    track,
    [options],
    true,
    brain ? new Map([['player', { brain }]]) : undefined,
  );
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(track.def.colors.grass);
  const model = carMesh(GT_01, appearance),
    guides = trackGuides(track);
  const vectors = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x8affec }),
  );
  const buffer = new THREE.Float32BufferAttribute(new Float32Array(60), 3);
  vectors.geometry.setAttribute('position', buffer);
  vectors.frustumCulled = false;
  scene.add(circuitMesh(track), model.group, guides, vectors);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  camera.up.set(0, 0, -1);
  const boundary = track.barriers.map((w) => w.outerA);
  const size = {
    width:
      Math.max(...boundary.map((p) => p.x)) -
      Math.min(...boundary.map((p) => p.x)),
    height:
      Math.max(...boundary.map((p) => p.y)) -
      Math.min(...boundary.map((p) => p.y)),
  };
  const clock = new FixedStepClock();
  let paused = false,
    mode: CameraMode = 'Follow',
    debug = driverMode !== 'human',
    requestReset = false,
    center = spawn.position,
    freeWidth = 45,
    snap = true,
    dragging = false,
    frameId = 0,
    closed = false,
    failed = false;
  let prior = world.frame,
    now = prior,
    lastTime = 0,
    lastReport = -1,
    fps = 0,
    resetMessage = '',
    resetExpires = 0;
  const keys = attachBrowserKeyboard(window, document, pause);
  function pause(value: boolean) {
    paused = value;
    if (paused) requestReset = false;
    keys.setPaused(value);
    if (value) clock.pause();
    else clock.resume();
    prior = now;
    lastReport = -1;
  }
  function setMode(m: CameraMode) {
    mode = m;
    snap = true;
    lastReport = -1;
  }
  function key(ev: KeyboardEvent) {
    if (
      ev.repeat ||
      ev.altKey ||
      ev.ctrlKey ||
      ev.metaKey ||
      document.hidden ||
      (ev.target as HTMLElement)?.closest?.(
        '.ai-tools,input,textarea,select,[contenteditable=true]',
      )
    )
      return;
    if (ev.code === 'KeyC')
      setMode(
        mode === 'Follow' ? 'Frei' : mode === 'Frei' ? 'Übersicht' : 'Follow',
      );
    if (ev.code === 'KeyV')
      setMode(mode === 'Übersicht' ? 'Follow' : 'Übersicht');
    if (ev.code === 'KeyR' && !paused) requestReset = true;
    if (ev.code === 'F3') {
      ev.preventDefault();
      debug = !debug;
      lastReport = -1;
    }
  }
  function down(e: PointerEvent) {
    if (mode === 'Frei') {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
    }
  }
  function up() {
    dragging = false;
  }
  function move(e: PointerEvent) {
    if (mode === 'Frei' && dragging && canvas.clientWidth > 0)
      center = {
        x: center.x - (e.movementX * freeWidth) / canvas.clientWidth,
        y: center.y + (e.movementY * freeWidth) / canvas.clientWidth,
      };
  }
  function wheel(e: WheelEvent) {
    if (mode === 'Frei') {
      e.preventDefault();
      freeWidth = zoom(freeWidth, e.deltaY);
    }
  }
  function resize() {
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(
      Math.max(1, canvas.clientWidth),
      Math.max(1, canvas.clientHeight),
      false,
    );
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function lost(e: Event) {
    e.preventDefault();
    failed = true;
    keys.setDrivingEnabled(false);
    onError('Grafikkontext verloren. Bitte lade die Seite neu.');
  }
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('keydown', key);
  function tick() {
    prior = now;
    now = world.step(
      new Map([
        [
          'player',
          {
            command: { kind: 'keyboard', sample: keys.readSample() },
            recover: requestReset,
          },
        ],
      ]),
    );
    requestReset = false;
    if (now.cars[0].recovery !== 'none') {
      lastReport = -1;
      resetExpires = now.index + 180;
      resetMessage =
        now.cars[0].recovery === 'accepted'
          ? 'Zurückgesetzt'
          : 'Rücksetzen blockiert';
    }
    if (now.index === resetExpires) lastReport = -1;
    if (now.cars[0].state.discontinuity) {
      prior = now;
      snap = true;
    }
  }
  function draw(ms: number) {
    if (closed || failed) return;
    try {
      const time = ms / 1000,
        dt = lastTime ? time - lastTime : 0;
      lastTime = time;
      if (dt > 0) fps = fps ? fps * 0.9 + 0.1 / dt : 1 / dt;
      const timing = clock.advanceFrame(time, tick);
      const racer = now.cars[0],
        state = racer.state,
        old = prior.cars[0].state,
        p = interpolatePosition(old.positionM, state.positionM, timing.alpha),
        heading = interpolateAngle(
          old.headingRad,
          state.headingRad,
          timing.alpha,
        );
      model.group.position.set(p.x, 0, -p.y);
      model.group.rotation.y = heading;
      model.update(state.steeringAngleRad, racer.input.brake > 0);
      const aspect =
          Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight),
        width = viewWidth(mode, aspect, freeWidth, size);
      if (mode === 'Follow')
        center = follow(center, p, state.velocityMps, dt, snap);
      if (mode === 'Übersicht') center = { x: 0, y: 0 };
      snap = false;
      camera.position.set(center.x, 100, -center.y);
      camera.lookAt(center.x, 0, -center.y);
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = width / 2 / aspect;
      camera.bottom = -camera.top;
      camera.updateProjectionMatrix();
      guides.visible = vectors.visible = debug;
      if (debug) {
        const pts = corners({
            position: p,
            heading,
            lengthM: GT_01.lengthM,
            widthM: GT_01.widthM,
          }),
          axes = headingAxes(heading);
        const lines = pts.flatMap((q, i) => [q, pts[(i + 1) % 4]]);
        lines.push(p, shift(p, state.velocityMps, 0.3));
        for (const [offset, d] of [
          [GT_01.frontAxleDistanceM, racer.physics?.front],
          [-GT_01.rearAxleDistanceM, racer.physics?.rear],
        ] as const) {
          const a = shift(p, axes.forward, offset);
          lines.push(shift(a, axes.left, -0.3), shift(a, axes.left, 0.3));
          if (d)
            lines.push(
              a,
              shift(
                shift(a, axes.forward, d.bodyForceN.x / 2500),
                axes.left,
                d.bodyForceN.y / 2500,
              ),
            );
        }
        lines.forEach((q, i) => {
          const v = mapPoint(q, 1);
          buffer.setXYZ(i, v.x, v.y, v.z);
        });
        buffer.needsUpdate = true;
        vectors.geometry.setDrawRange(0, lines.length);
      }
      renderer.render(scene, camera);
      if (time - lastReport >= 0.1) {
        lastReport = time;
        report({
          ai: world.trace ? racer.ai : undefined,
          applied: racer.input,
          x: p.x,
          y: p.y,
          speed: 3.6 * Math.hypot(state.velocityMps.x, state.velocityMps.y),
          gas: racer.input.throttle,
          brake: racer.input.brake,
          front: state.frontAxle.surface ?? 'asphalt',
          rear: state.rearAxle.surface ?? 'asphalt',
          progress: racer.lap.certified / track.length,
          lap:
            racer.lap.started === null
              ? null
              : world.timeSeconds - racer.lap.started,
          last: racer.lap.last,
          fps,
          paused,
          mode,
          index: now.index,
          debug,
          frontGrip: racer.physics?.front.utilization ?? 0,
          rearGrip: racer.physics?.rear.utilization ?? 0,
          frontGripN: racer.physics?.front.gripN,
          rearGripN: racer.physics?.rear.gripN,
          recovery: now.index < resetExpires ? resetMessage : '',
          fallback: now.fallback,
          laps: racer.lap.laps,
        });
      }
      frameId = requestAnimationFrame(draw);
    } catch (error) {
      failed = true;
      keys.setDrivingEnabled(false);
      onError(String(error));
    }
  }
  frameId = requestAnimationFrame(draw);
  return {
    brain,
    inspect: (enabled: boolean) => {
      world.trace = enabled;
      lastReport = -1;
    },
    step: () => {
      if (paused && !failed) {
        try {
          clock.stepOnce(tick);
          prior = now;
          lastReport = -1;
        } catch (error) {
          failed = true;
          onError(String(error));
        }
      }
    },
    pause: () => pause(!paused),
    setMode,
    recover: () => {
      if (!paused) requestReset = true;
    },
    dispose() {
      closed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      keys.dispose();
      window.removeEventListener('keydown', key);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      const materials = new Set<THREE.Material>(),
        geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          geometries.add(obj.geometry);
          for (const m of [obj.material].flat()) materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        if (m instanceof THREE.MeshBasicMaterial) m.map?.dispose();
        m.dispose();
      });
      renderer.dispose();
    },
  };
}
