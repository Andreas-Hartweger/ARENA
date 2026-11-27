import { useEffect, useMemo, useState } from 'react';
import { trainingLab } from './labClient';
import { useLabQuery, number } from './labData';
import type { Draft } from '../runtime/runConfig';
import type { RunState, TrainingController } from '../runtime/controller';
import type { WorkerEvent } from '../runtime/compute';
import { createTrack } from '../tracks/track';
import { viewWidth, zoom, type CameraMode } from '../rendering/camera';
import { Brain } from '../ai/network';
import { Inspector } from './Inspector';
import { NumberField, type Act } from './RunForm';
import { profiles, scoreFitness } from '../training/fitness';

type Pose = Extract<WorkerEvent, { type: 'progress' }>;
type DisplayPose = Pose & { latencyMs: number };
type History = ReturnType<TrainingController['history']>;
type Rows = ReturnType<TrainingController['population']>;
type BrainData = ReturnType<TrainingController['selectedBrain']>;
export function RunMap({
  draft,
  state,
  advanced,
  act,
}: {
  draft: Draft;
  state?: RunState;
  advanced: boolean;
  act: Act;
}) {
  const [visible, setVisible] = useState(draft.mode !== 'headless'),
    [slot, setSlot] = useState(0),
    [detail, setDetail] = useState(false),
    [mode, setMode] = useState<CameraMode>('Übersicht');
  const [free, setFree] = useState({ x: 0, y: 0, width: 120 }),
    [poses, setPoses] = useState<DisplayPose[]>([]),
    [path, setPath] = useState<Pick<Pose, 'key' | 'x' | 'y'>[]>([]);
  const scenarioIndex =
    poses.find(
      (p) =>
        p.key.slot === slot &&
        p.key.sessionId === state?.sessionId &&
        p.key.segmentId === state?.segment,
    )?.key.scenarioIndex ??
    poses.at(-1)?.key.scenarioIndex ??
    0;
  const track = useMemo(
    () => createTrack(draft.scenarios[scenarioIndex]?.track),
    [draft.scenarios, scenarioIndex],
  );
  const geometry = useMemo(() => {
    const points = track.stations.map((s) => track.sample(s).position),
      xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    const bounds = {
      width: Math.max(...xs) - Math.min(...xs) + 20,
      height: Math.max(...ys) - Math.min(...ys) + 20,
    };
    return {
      route:
        points.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + -p.y).join(' ') +
        ' Z',
      bounds,
      cx: (Math.max(...xs) + Math.min(...xs)) / 2,
      cy: (Math.max(...ys) + Math.min(...ys)) / 2,
    };
  }, [track]);
  const limit = advanced ? 16 : 8,
    session = state?.sessionId,
    phase = state?.phase;
  const active =
    !!session &&
    [
      'Running',
      'Paused',
      'Pausing',
      'Resuming',
      'Draining',
      'Stopping',
    ].includes(phase ?? '');
  useEffect(() => {
    const lab = trainingLab();
    let fresh = true;
    const refresh = () => {
      if (document.hidden) {
        setPoses([]);
        setPath([]);
      }
      void lab
        .call({
          type: 'observe',
          visible: visible && active && !document.hidden ? limit : 0,
          slot: detail ? slot : null,
        })
        .catch(() => {});
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    let timer: ReturnType<typeof setTimeout>;
    const receive = (sample: Pose) => {
      const p = {
        ...sample,
        latencyMs: Math.max(
          0,
          performance.timeOrigin + performance.now() - sample.capturedAtMs,
        ),
      };
      if (!visible || p.key.sessionId !== session || document.hidden) return;
      setPoses((values) => {
        const latest = values.at(-1);
        if (
          latest &&
          p.key.sessionId === latest.key.sessionId &&
          (p.key.segmentId < latest.key.segmentId ||
            (p.key.segmentId === latest.key.segmentId &&
              p.key.generation < latest.key.generation))
        )
          return values;
        const group = values.filter(
          (q) =>
            q.key.sessionId === p.key.sessionId &&
            q.key.segmentId === p.key.segmentId &&
            q.key.generation === p.key.generation,
        );
        const prior = group.find((q) => q.key.slot === p.key.slot);
        if (
          prior &&
          (prior.key.scenarioIndex > p.key.scenarioIndex ||
            (prior.key.workerLease === p.key.workerLease &&
              prior.sequence >= p.sequence))
        )
          return values;
        const next = [...group.filter((q) => q.key.slot !== p.key.slot), p];
        if (next.length > limit)
          next.splice(
            next.findIndex((q) => q.key.slot !== slot),
            1,
          );
        return next;
      });
      if (p.key.slot === slot)
        setPath((values) => [
          ...(values.at(-1)?.key.jobId === p.key.jobId
            ? values.slice(-599)
            : []),
          { key: p.key, x: p.x, y: p.y },
        ]);
    };
    const pull = async () => {
      if (!document.hidden && visible && active) {
        try {
          const batch = await lab.call<Pose[]>({ type: 'samples' });
          if (fresh) for (const p of batch) receive(p);
        } catch {
          /* Coordinator errors are reported by the run panel. */
        }
      }
      if (fresh) timer = setTimeout(pull, 100);
    };
    if (visible && active) void pull();
    return () => {
      fresh = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      void lab
        .call({ type: 'observe', visible: 0, slot: null })
        .catch(() => {});
    };
  }, [visible, active, session, slot, detail, limit]);
  const current = poses.filter(
    (p) =>
      p.key.sessionId === session &&
      p.key.segmentId === state?.segment &&
      p.key.scenarioIndex === scenarioIndex,
  );
  const pinned = current.find((p) => p.key.slot === slot),
    leader = current.reduce<DisplayPose | undefined>(
      (best, p) =>
        !best ||
        p.validLaps > best.validLaps ||
        (p.validLaps === best.validLaps && p.certifiedM > best.certifiedM)
          ? p
          : best,
      undefined,
    ),
    focus = pinned ?? leader;
  const b = useLabQuery<BrainData>(
    detail && visible && pinned?.ai ? { type: 'brain', slot } : null,
    pinned?.key.genomeHash,
  );
  const pinnedHash = pinned?.key.genomeHash;
  const brain = useMemo(
    () =>
      b.data && b.data.hash === pinnedHash
        ? new Brain(
            b.data.signature,
            0,
            b.data.hidden,
            b.data.activation,
            b.data.parameters,
          )
        : undefined,
    [b.data, pinnedHash],
  );
  const width = viewWidth(mode, 2, free.width, geometry.bounds),
    cx =
      mode === 'Frei'
        ? free.x
        : mode === 'Follow' && focus
          ? focus.x
          : geometry.cx,
    cy =
      mode === 'Frei'
        ? free.y
        : mode === 'Follow' && focus
          ? focus.y
          : geometry.cy;
  return (
    <section className="lab-panel">
      <div className="panel-title">
        <div>
          <small>GT-01 · {number(track.length, 1)} m</small>
          <h2>{track.def.name}</h2>
        </div>
        <button
          aria-pressed={visible}
          onClick={() => {
            if (visible) {
              setPoses([]);
              setPath([]);
            }
            setVisible(!visible);
          }}
        >
          {visible ? 'Beobachtung aus' : 'Beobachten'}
        </button>
      </div>
      {visible ? (
        <>
          <svg
            className="track-view"
            viewBox={[cx - width / 2, -cy - width / 4, width, width / 2].join(
              ' ',
            )}
            aria-label="Streckengeometrie und beobachtete Fahrzeuge"
            role="img"
            onPointerDown={(e) => {
              if (mode === 'Frei')
                e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (mode === 'Frei' && e.buttons === 1) {
                const factor = width / e.currentTarget.clientWidth;
                setFree((v) => ({
                  ...v,
                  x: v.x - e.movementX * factor,
                  y: v.y + e.movementY * factor,
                }));
              }
            }}
          >
            <path
              d={geometry.route}
              fill="none"
              stroke="#667275"
              strokeWidth={track.def.width + 1}
            />
            <path
              d={geometry.route}
              fill="none"
              stroke="#303a3c"
              strokeWidth={track.def.width}
            />
            <path
              d={geometry.route}
              fill="none"
              stroke="#889291"
              strokeWidth=".4"
              strokeDasharray="2 2"
            />
            {track.gates.map((g, i) => (
              <line
                key={i}
                stroke={i ? '#87928a' : '#f5eecc'}
                strokeWidth={i ? 0.65 : 1.3}
                x1={g.position.x - 5 * g.normal.x}
                y1={-g.position.y + 5 * g.normal.y}
                x2={g.position.x + 5 * g.normal.x}
                y2={-g.position.y - 5 * g.normal.y}
              />
            ))}
            {pinned && path.length > 1 && (
              <polyline
                fill="none"
                stroke="#f98250"
                strokeWidth="0.8"
                points={path
                  .filter((p) => p.key.jobId === pinned.key.jobId)
                  .map((p) => p.x + ',' + -p.y)
                  .join(' ')}
              />
            )}
            {current.map((p) => (
              <g
                key={p.key.jobId}
                transform={
                  'translate(' +
                  p.x +
                  ' ' +
                  -p.y +
                  ') rotate(' +
                  (-p.heading * 180) / Math.PI +
                  ')'
                }
              >
                <title>
                  Slot {p.key.slot} · Tick {p.tick} · {number(p.tick / 60, 2)} s
                  simuliert
                </title>
                <rect
                  x="-2.2"
                  y="-0.95"
                  width="4.4"
                  height="1.9"
                  rx=".35"
                  fill={p.key.slot === slot ? '#ff794a' : '#a8dccc'}
                />
              </g>
            ))}
          </svg>
          {mode !== 'Übersicht' && focus && (
            <svg
              aria-label="Minikarte mit ausgewählter Fahrzeugposition"
              width="180"
              height="88"
              viewBox={[
                geometry.cx - geometry.bounds.width / 2,
                -geometry.cy - geometry.bounds.height / 2,
                geometry.bounds.width,
                geometry.bounds.height,
              ].join(' ')}
            >
              <path
                d={geometry.route}
                fill="none"
                stroke="#839793"
                strokeWidth={track.def.width}
              />
              <circle cx={focus.x} cy={-focus.y} r="7" fill="#ff794a" />
            </svg>
          )}
          <div className="toolbar">
            {(['Übersicht', 'Follow', 'Frei'] as const).map((v) => (
              <button
                key={v}
                aria-pressed={mode === v}
                onClick={() => setMode(v)}
              >
                {v}
              </button>
            ))}
            {mode === 'Frei' && (
              <>
                <button
                  onClick={() =>
                    setFree((v) => ({ ...v, width: zoom(v.width, -250) }))
                  }
                >
                  Zoom +
                </button>
                <button
                  onClick={() =>
                    setFree((v) => ({ ...v, width: zoom(v.width, 250) }))
                  }
                >
                  Zoom −
                </button>
              </>
            )}
          </div>
          <div className="toolbar">
            <NumberField
              name="Ausgewählter Slot"
              value={slot}
              min={0}
              max={(draft.options.n ?? 128) - 1}
              change={(n) => {
                if (
                  Number.isInteger(n) &&
                  n >= 0 &&
                  n < (draft.options.n ?? 128)
                )
                  setSlot(n);
              }}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={detail}
                onChange={(e) => setDetail(e.target.checked)}
              />
              Sensoren und Brain beobachten
            </label>
          </div>
          {leader && (
            <p>
              Vorläufig führender sichtbarer Slot {leader.key.slot} ·{' '}
              {leader.validLaps} Runden · {number(leader.certifiedM, 1)} m
              zertifizierter Fortschritt
            </p>
          )}
          {focus && (
            <p>
              Segment {focus.key.segmentId} · G{focus.key.generation} · Szenario{' '}
              {focus.key.scenarioIndex + 1} · Tor {focus.nextGate} · Bremse{' '}
              {number(100 * focus.braking, 1)} % · {focus.contacts} Kontakte im
              Tick
            </p>
          )}
          {focus && (
            <p>
              <span data-sample-latency={focus.latencyMs}>
                Übertragung zur Ansicht {number(focus.latencyMs, 0)} ms
              </span>{' '}
              · Slot {focus.key.slot} · Versuch {focus.key.attempt + 1} ·
              Snapshot {focus.sequence} · Tick {focus.tick} ·{' '}
              {number(focus.tick / 60, 2)} s simuliert ·{' '}
              {number(focus.speed * 3.6, 1)} km/h · Sensortick{' '}
              {focus.observationTick ?? '–'} · Entscheidungstick{' '}
              {focus.decisionTick ?? '–'}
            </p>
          )}
          {detail &&
            (pinned?.ai && pinned.applied ? (
              <Inspector
                hud={{
                  ai: pinned.ai,
                  paused: phase === 'Paused',
                  index: pinned.tick,
                  applied: pinned.applied,
                }}
                brain={brain}
                seriesId={pinned.key.workerLease}
                onPause={() =>
                  act(() =>
                    trainingLab().call({
                      type: phase === 'Paused' ? 'resume' : 'pause',
                    }),
                  )
                }
              />
            ) : (
              <p>Für diesen Slot liegt noch keine Sensoraufnahme vor.</p>
            ))}
        </>
      ) : (
        <p className="empty">Die Fahrzeugansicht ist ausgeschaltet.</p>
      )}
    </section>
  );
}
export function HistoryChart({ state }: { state?: RunState }) {
  const [metric, setMetric] = useState<
    'fitness' | 'laps' | 'diversity' | 'progress'
  >('fitness');
  const { data, error } = useLabQuery<History>(
    { type: 'history', metric },
    state?.sessionId + ':' + state?.segment + ':' + state?.generation,
    state?.sessionId + ':' + state?.segment,
  );
  const rows = data ?? [],
    series =
      metric === 'fitness'
        ? (['best', 'mean', 'median', 'q1', 'q3'] as const)
        : (['value'] as const);
  const val = (r: History[number], k: (typeof series)[number]) =>
    k !== 'value'
      ? r.fitness[k]
      : metric === 'laps'
        ? r.lapTime
        : metric === 'diversity'
          ? r.diversity
          : r.progress;
  let max = 0;
  for (const row of rows)
    for (const k of series) max = Math.max(max, val(row, k) ?? 0);
  const palette = ['#ff814f', '#7edbc5', '#e6ce89', '#8a9fac', '#89909a'];
  return (
    <section className="lab-panel">
      <div className="panel-title">
        <h2>Generationsverlauf</h2>
        <select
          aria-label="Diagrammmetrik"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          <option value="fitness">Fitness</option>
          <option value="progress">Rohfortschritt</option>
          <option value="lineage">Elternlinie</option>
          <option value="laps">Beste Rundenzeit</option>
          <option value="diversity">Diversität</option>
          <option value="progress">Fortschritt</option>
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows.length ? (
        <>
          <svg
            className="history-chart"
            aria-label={'Bestätigte Generationen im Segment ' + state?.segment}
            viewBox="0 0 620 158"
            role="img"
          >
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="48"
                  x2="612"
                  y1={12 + i * 40}
                  y2={12 + i * 40}
                  stroke="#374344"
                />
                <text x="42" y={16 + i * 40} textAnchor="end">
                  {number(max * (1 - i / 3), 1)}
                </text>
              </g>
            ))}
            {series.map((k, j) => {
              let pen = false;
              const d = rows
                .map((row) => {
                  const v = val(row, k);
                  if (v === null) {
                    pen = false;
                    return '';
                  }
                  const point =
                    (pen ? 'L' : 'M') +
                    (49 +
                      (560 * (row.generation - (rows[0]?.generation ?? 0))) /
                        Math.max(
                          1,
                          (rows.at(-1)?.generation ?? 0) - rows[0].generation,
                        )) +
                    ' ' +
                    (132 - (120 * v) / (max || 1));
                  pen = true;
                  return point;
                })
                .join(' ');
              return (
                <path
                  key={k}
                  d={d}
                  stroke={palette[j]}
                  strokeWidth={j ? 1.25 : 2.8}
                  fill="none"
                />
              );
            })}
            <text x="49" y="153">
              G{rows[0].generation}
            </text>
            <text x="609" y="153" textAnchor="end">
              G{rows.at(-1)?.generation}
            </text>
          </svg>
          {metric === 'fitness' && (
            <div className="legend">
              {['Beste', 'Mittel', 'Median', 'Q1', 'Q3'].map((l, i) => (
                <span key={l} style={{ color: palette[i] }}>
                  {l}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="empty">
          Nach der ersten bestätigten Generation erscheinen hier die Messwerte.
        </p>
      )}
    </section>
  );
}
export function Population({
  state,
  draft,
}: {
  state?: RunState;
  draft: Draft;
}) {
  const [page, setPage] = useState(0),
    [which, setWhich] = useState<number | null>(null),
    [scenario, setScenario] = useState(0),
    [filter, setFilter] = useState(''),
    [sort, setSort] = useState<'slot' | 'fitness' | 'progress' | 'lineage'>(
      'slot',
    ),
    [whatIf, setWhatIf] = useState<keyof typeof profiles>('Balanced');
  const { data, error } = useLabQuery<Rows>(
    {
      type: 'population',
      offset: page * 32,
      limit: 32,
      filter,
      sort,
    },
    state?.sessionId + ':' + state?.generation,
    state?.sessionId + ':' + state?.segment,
  );
  const selected = data?.find((x) => x.slot === which),
    ep =
      selected?.episodes.find((e) => e.scenario === scenario) ??
      selected?.episodes[0];
  const scenarioOptions = ep ? draft.scenarios[ep.scenario] : undefined,
    task = scenarioOptions?.task;
  const score = ep
    ? scoreFitness(
        task?.laps ?? 1,
        ep.lapTimes.length,
        ep.reason === 'completed',
        ep.fitness.P,
        ep.fitness.A,
        ep.fitness.K,
        ep.duration,
        (task?.maxTicks ?? 7200) / 60,
        ep.errors,
        profiles[whatIf],
      ).F
    : null;
  return (
    <section className="lab-panel">
      <div className="panel-title">
        <h2>Population</h2>
        <span>Letzte bestätigte Generation</span>
      </div>
      <div className="toolbar">
        <label>
          Suche
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            placeholder="Slot, Fitness, Herkunft, Eltern oder Abschluss"
          />
        </label>
        <label>
          Sortieren
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              setPage(0);
            }}
          >
            <option value="slot">Slot</option>
            <option value="fitness">Fitness</option>
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {data?.length ? (
        <table>
          <thead>
            <tr>
              <th>Slot</th>
              <th>Fitness</th>
              <th>Herkunft</th>
              <th>Abschluss</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>
                  <button onClick={() => setWhich(r.slot)}>{r.slot}</button>
                </td>
                <td>{number(r.score, 3)}</td>
                <td>{r.origin}</td>
                <td>{r.episodes[0]?.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">Keine passenden bestätigten Ergebnisse.</p>
      )}
      <div className="toolbar">
        <button disabled={!page} onClick={() => setPage(page - 1)}>
          Zurück
        </button>
        <button
          disabled={(data?.length ?? 0) < 32}
          onClick={() => setPage(page + 1)}
        >
          Weitere Slots
        </button>
      </div>
      {selected && ep && (
        <details open>
          <summary>Fitness und Abstammung · Slot {selected.slot}</summary>
          {selected.episodes.length > 1 && (
            <label>
              Ausgewertetes Szenario
              <select
                value={ep.scenario}
                onChange={(e) => setScenario(Number(e.target.value))}
              >
                {selected.episodes.map((v) => (
                  <option key={v.scenario} value={v.scenario}>
                    {v.scenario + 1} · {v.reason}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            Seed {ep.seed} · Abschlusstick {ep.tick} · {number(ep.duration, 3)}{' '}
            s · {ep.reason}
          </p>
          <dl>
            {Object.entries(ep.fitness).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{number(v, 5)}</dd>
              </div>
            ))}
          </dl>
          <p>
            {selected.operator} · Eltern {selected.parents.join(', ') || '–'}
          </p>
          <p>
            Genom <code>{selected.hash}</code>
          </p>
          <label>
            Hypothetisches Profil
            <select
              value={whatIf}
              onChange={(e) =>
                setWhatIf(e.target.value as keyof typeof profiles)
              }
            >
              {Object.keys(profiles).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <p>Analysewert bei identischer Aufgabe: {number(score, 4)}</p>
          <details>
            <summary>Rohdaten, Strafwerte, Mutationen und Zeitgrenze</summary>
            <pre>
              {JSON.stringify(
                {
                  contract: ep.contract,
                  weights: Array.isArray(scenarioOptions?.fitness)
                    ? scenarioOptions.fitness
                    : profiles[
                        (scenarioOptions?.fitness ??
                          'Balanced') as keyof typeof profiles
                      ],
                  trace:
                    ep.trace ??
                    'Für diese Episode wurde kein Detailtrace aufgezeichnet.',
                  errors: ep.errors,
                  raw: ep.raw,
                  duration: ep.duration,
                  mutation: selected.mutation,
                  inheritance: selected.inheritance,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </details>
      )}
    </section>
  );
}
