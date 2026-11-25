import { useEffect, useRef, useState } from 'react';
import { startDrive, type Telemetry } from '../rendering/firstDrive';
import type { CameraMode } from '../rendering/camera';
import { createTrack } from '../tracks/track';

const course = createTrack();
const mapPath =
  course.stations
    .map((s, i) => {
      const p = course.sample(s).position;
      return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + (-p.y).toFixed(1);
    })
    .join(' ') + 'Z';
const duration = (s: number | null | undefined) =>
  s == null
    ? '—:—.——'
    : Math.floor(s / 60) + ':' + (s % 60).toFixed(2).padStart(5, '0');
export function App() {
  const canvas = useRef<HTMLCanvasElement>(null),
    controller = useRef<ReturnType<typeof startDrive> | null>(null);
  const [hud, setHud] = useState<Telemetry | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    try {
      controller.current = startDrive(canvas.current!, setHud, setError);
    } catch (e) {
      setError(String(e));
    }
    return () => {
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  const mode = hud?.mode ?? 'Follow';
  return (
    <main className="cockpit">
      <header className="mast">
        <div className="wordmark">
          <i aria-hidden="true" />
          ARENA
        </div>
        <span className="edition">FIRST DRIVE</span>
        <div className="session">
          <b /> {hud?.paused ? 'PAUSE' : 'TRAINING'} <span> / </span> GT-01
        </div>
      </header>
      <section
        data-camera={mode}
        className="field"
        aria-label="Academy Fahrsimulation"
      >
        <canvas
          ref={canvas}
          aria-label="Academy Training Circuit mit ARENA GT-01"
        />
        <section className="track-card">
          <div className="eyebrow">ACADEMY</div>
          <h1>Training Circuit</h1>
          <div className="track-meta">
            659,91 m <span>·</span> Uhrzeigersinn
          </div>
          <svg
            className="map"
            viewBox="-126 -84 252 168"
            aria-label="Streckenkarte"
          >
            <path d={mapPath} fill="none" stroke="#59636a" strokeWidth="7" />
            <path d="M0 -78v16" stroke="#fff" strokeWidth="2" />
            <circle
              cx={hud?.x ?? -8}
              cy={-(hud?.y ?? 70)}
              r="6"
              fill="#ff683b"
              stroke="#101419"
              strokeWidth="2"
            />
          </svg>
          <div className="segment">
            <span>Torfortschritt</span>
            <b>{Math.round(100 * (hud?.progress ?? 0))} %</b>
          </div>
          <progress value={hud?.progress ?? 0} max="1" />
        </section>
        <section className="timing">
          <div>
            <small>RUNDE {String((hud?.laps ?? 0) + 1).padStart(2, '0')}</small>
            <strong>{duration(hud?.lap)}</strong>
          </div>
          <div>
            <small>LETZTE RUNDE</small>
            <span>{duration(hud?.last)}</span>
          </div>
        </section>
        <div className="camera-controls" aria-label="Kamerawahl">
          {(['Follow', 'Übersicht', 'Frei'] as CameraMode[]).map((m) => (
            <button
              key={m}
              aria-pressed={m === mode}
              onClick={() => controller.current?.setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <section className="instruments">
          <div className="car-id">
            <b>07</b> ARENA GT-01
          </div>
          <div className="speed">
            <strong>{Math.round(hud?.speed ?? 0)}</strong>
            <span>km/h</span>
          </div>
          <div className="pedals">
            {(['gas', 'brake'] as const).map((k) => (
              <label key={k}>
                {k === 'gas' ? 'GAS' : 'BREMSE'}
                <meter min="0" max="1" value={hud?.[k] ?? 0} />
              </label>
            ))}
          </div>
          <div className="surface">
            VA <b>{hud?.front === 'grass' ? 'Gras' : 'Asphalt'}</b> HA{' '}
            <b>{hud?.rear === 'grass' ? 'Gras' : 'Asphalt'}</b>
          </div>
        </section>
        {hud?.debug && (
          <output className="diagnostic">
            Tick {hud.index} · {hud.fps.toFixed(1)} FPS · Grip VA{' '}
            {(100 * hud.frontGrip).toFixed(0)} % / HA{' '}
            {(100 * hud.rearGrip).toFixed(0)} %{' '}
            {hud.fallback && '· Kontaktfallback'}
          </output>
        )}
        {(error || hud?.paused) && (
          <div className="shade">
            <div className="dialog">
              <h2>{error ? 'Simulation angehalten' : 'Pause'}</h2>
              {error ? (
                <p>{error}</p>
              ) : (
                <button onClick={() => controller.current?.pause()}>
                  Fahrt fortsetzen
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      <footer>
        <div className="bindings">
          <span>
            <kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> Fahren
          </span>
          <span>
            <kbd>R</kbd> Rücksetzen
          </span>
          <span>
            <kbd>C / V</kbd> Kamera
          </span>
          <span>
            <kbd>F3</kbd> Diagnose
          </span>
          {mode === 'Frei' && <span>Maus ziehen · Rad zum Zoomen</span>}
        </div>
        <output>{hud?.recovery}</output>
        <span className="fps">{Math.round(hud?.fps ?? 0)} FPS</span>
        <button onClick={() => controller.current?.pause()}>
          Esc · {hud?.paused ? 'Weiter' : 'Pause'}
        </button>
      </footer>
    </main>
  );
}
