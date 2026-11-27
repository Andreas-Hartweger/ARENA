import { useEffect, useMemo, useState } from 'react';
import type { Brain } from '../ai/network';
import { registry } from '../ai/schema';
import { standardProfile } from '../ai/profile';
import type { Telemetry } from '../rendering/firstDrive';
const channels = registry();
const channelIndices = new Map(channels.map((c, i) => [c.id, i]));
const groupLabels = {
  ego: 'Eigenes Fahrzeug',
  ray: 'Sensorstrahlen',
  local: 'Lokale Orientierung',
  preview: 'Vorschaupunkte',
  object: 'Erkannte Fahrzeuge',
};
const channelOptions = Object.entries(groupLabels).map(([prefix, label]) => (
  <optgroup label={label} key={prefix}>
    {channels.map(
      (channel, i) =>
        channel.id.startsWith(prefix) && (
          <option key={channel.id} value={i}>
            {i} · {channel.id}
          </option>
        ),
    )}
  </optgroup>
));
const percent = new Intl.NumberFormat('de-AT', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const fmt = (x: number | undefined | null) => (x == null ? '–' : x.toFixed(4));
function SampleSeries({
  label,
  tick,
  value,
}: {
  label: string;
  tick: number | null | undefined;
  value: number | null | undefined;
}) {
  const [samples, setSamples] = useState<
    { tick: number; value: number | null }[]
  >([]);
  useEffect(() => {
    if (
      tick == null ||
      value === undefined ||
      (value !== null && !Number.isFinite(value))
    )
      return;
    setSamples((previous) =>
      previous.length && previous[previous.length - 1].tick >= tick
        ? previous
        : [...previous.slice(-599), { tick, value }],
    );
  }, [tick, value]);
  if (!samples.length) return <p>Noch keine Messpunkte aufgezeichnet.</p>;
  const first = samples[0].tick,
    last = samples[samples.length - 1].tick;
  const valid = samples.flatMap((p) => (p.value === null ? [] : [p.value]));
  const min = Math.min(0, ...valid),
    max = Math.max(0, ...valid);
  let connected = false;
  const path = samples
    .map((p) => {
      if (p.value === null) {
        connected = false;
        return '';
      }
      const point =
        (connected ? 'L' : 'M') +
        (4 + (392 * (p.tick - first)) / Math.max(1, last - first)) +
        ' ' +
        (75 - (70 * (p.value - min)) / (max - min || 1));
      connected = true;
      return point;
    })
    .join(' ');
  return (
    <figure>
      <figcaption>
        {label} · Tick {first} bis {last} · {samples.length} Messpunkte
      </figcaption>
      <svg aria-label={label} viewBox="0 0 400 80" style={{ height: 80 }}>
        <path fill="none" stroke="#7edbc5" strokeWidth="2" d={path} />
      </svg>
    </figure>
  );
}
export function Inspector({
  hud,
  brain,
  onPause,
  onStep,
  seriesId,
}: {
  hud: Pick<Telemetry, 'ai' | 'paused' | 'index' | 'applied'>;
  brain?: Brain;
  seriesId?: string;
  onPause: () => void;
  onStep?: () => void;
}) {
  const [channel, setChannel] = useState(0),
    [layer, setLayer] = useState(0),
    [neuron, setNeuron] = useState(0),
    [source, setSource] = useState(0);
  const params = useMemo(() => brain?.parameters(), [brain]);
  const ai = hud.ai,
    obs = ai?.observation;
  const dims = brain?.dimensions ?? [],
    width = dims[layer + 1] ?? 0,
    fan = dims[layer] ?? 0;
  const maskIndex = channelIndices.get(channels[channel].mask);
  const validChannel = maskIndex === undefined || obs?.values[maskIndex] === 1;
  let offset = 0;
  for (let l = 0; l < layer; l++) offset += (dims[l] + 1) * dims[l + 1];
  const entry = ai?.layers[layer];
  const points =
    obs?.rays.flatMap((r) => [
      r.origin,
      {
        x: r.origin.x + r.direction.x * (r.barrier ?? r.vehicle ?? r.range),
        y: r.origin.y + r.direction.y * (r.barrier ?? r.vehicle ?? r.range),
      },
    ]) ?? [];
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  return (
    <div className="ai-inspector">
      <button onClick={onPause}>{hud.paused ? 'Fortsetzen' : 'Pause'}</button>
      <button disabled={!hud.paused || !onStep} onClick={onStep}>
        Einzeltick
      </button>
      <h2>Sensor Inspector</h2>
      <p>
        {standardProfile.id} · Messtick {obs?.index ?? '–'} · Alter{' '}
        {obs ? hud.index - obs.index : '–'} Ticks
      </p>
      {obs && (
        <svg
          aria-label="Sichtstrahlen am Messframe"
          viewBox={[minX - 2, -maxY - 2, maxX - minX + 4, maxY - minY + 4].join(
            ' ',
          )}
        >
          {obs.rays.map((r, i) => (
            <g key={i}>
              <line
                x1={r.origin.x}
                y1={-r.origin.y}
                x2={points[2 * i + 1].x}
                y2={-points[2 * i + 1].y}
                stroke="#54cdca"
              />
              {[r.edge, r.vehicle, r.barrier].map(
                (d, j) =>
                  d !== null && (
                    <circle
                      key={j}
                      cx={r.origin.x + d * r.direction.x}
                      cy={-r.origin.y - d * r.direction.y}
                      r="1.5"
                      fill={['white', 'orange', 'red'][j]}
                    />
                  ),
              )}
            </g>
          ))}
          {obs.points.map(
            (p, i) =>
              p && (
                <circle
                  key={i}
                  cx={p.position.x}
                  cy={-p.position.y}
                  r="1.5"
                  fill="lime"
                />
              ),
          )}
        </svg>
      )}
      <label>
        Kanal{' '}
        <select value={channel} onChange={(e) => setChannel(+e.target.value)}>
          {channelOptions}
        </select>
      </label>
      <p>
        Rohwert {fmt(obs?.raw[channel])} {channels[channel].unit} · Normiert{' '}
        {fmt(obs?.values[channel])}
        {seriesId && maskIndex !== undefined && (
          <>
            {' '}
            · Gültigkeitsmaske {maskIndex} ({channels[maskIndex].id}) ·{' '}
            {obs ? (validChannel ? 'gültig' : 'ungültig') : 'unbekannt'}
          </>
        )}
      </p>
      {seriesId && (
        <SampleSeries
          label="Normierter Wert des gewählten Sensorkanals"
          key={[seriesId, channel].join('/')}
          tick={obs?.index}
          value={validChannel ? obs?.values[channel] : null}
        />
      )}

      <details>
        <summary>Strahlen am Messtick</summary>
        {obs?.rays.map((r, i) => (
          <p key={i}>
            {standardProfile.rays[i].id} · ({fmt(r.origin.x)}, {fmt(r.origin.y)}
            ) m · {standardProfile.rays[i].angle}° · Reichweite {r.range} m ·
            Rand {fmt(r.edge)} · Barriere {fmt(r.barrier)} · Fahrzeug{' '}
            {fmt(r.vehicle)} · Material {r.material ?? '–'}
          </p>
        ))}
      </details>
      <h2>Brain Inspector</h2>
      <p>
        {dims.join(' → ')} · {brain?.activation} ·{' '}
        {brain?.initialization === 'supplied'
          ? 'Vorgegebene Gewichte'
          : 'Seed ' + brain?.seed}{' '}
        · Eingabetick {ai?.inputTick ?? '–'} · Entscheidungstick{' '}
        {ai?.decisionTick ?? '–'}
      </p>
      <label>
        Schicht{' '}
        <select
          value={layer}
          onChange={(e) => {
            setLayer(+e.target.value);
            setNeuron(0);
            setSource(0);
          }}
        >
          {dims.slice(1).map((n, i) => (
            <option key={i} value={i}>
              {i + 1} · {n} Neuronen
            </option>
          ))}
        </select>
      </label>
      <label>
        Neuron{' '}
        <select value={neuron} onChange={(e) => setNeuron(+e.target.value)}>
          {Array.from({ length: width }, (_, i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </label>
      <label>
        Verbindung von{' '}
        <select value={source} onChange={(e) => setSource(+e.target.value)}>
          {layer === 0
            ? channelOptions
            : Array.from({ length: fan }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
        </select>
      </label>
      <svg
        viewBox="0 0 320 54"
        aria-label="Ausgewählte neuronale Verbindung"
        style={{ height: 64 }}
      >
        <line
          x1="38"
          x2="282"
          y1="27"
          y2="27"
          stroke={
            (params?.[offset + neuron * fan + source] ?? 0) < 0
              ? '#ff9266'
              : '#7ccfdb'
          }
          strokeWidth="3"
        />
        <circle cx="38" cy="27" r="17" fill="#334653" />
        <circle cx="282" cy="27" r="17" fill="#334653" />
        <g fill="white" textAnchor="middle" fontSize="11">
          <text x="38" y="31">
            {source}
          </text>
          <text x="282" y="31">
            {neuron}
          </text>
          <text x="160" y="19">
            {fmt(params?.[offset + neuron * fan + source])}
          </text>
        </g>
      </svg>
      <p>
        Gewicht {fmt(params?.[offset + neuron * fan + source])} · Bias{' '}
        {fmt(params?.[offset + fan * width + neuron])} · Eingang{' '}
        {fmt(
          layer === 0
            ? ai?.decisionInput?.[source]
            : ai?.layers[layer - 1]?.values[source],
        )}{' '}
        · Summe {fmt(entry?.sums[neuron])} · Aktivierung{' '}
        {fmt(entry?.values[neuron])}
      </p>
      <p>
        {entry ? '' : 'Noch kein Trace. '}Rohoutput{' '}
        {ai?.output.map(fmt).join(' / ')} · Tanh{' '}
        {ai?.output.map((x) => fmt(Math.tanh(x))).join(' / ')}
      </p>
      {seriesId && (
        <SampleSeries
          label="Aktivierung des gewählten Neurons"
          key={[seriesId, layer, neuron].join('/')}
          tick={ai?.decisionTick}
          value={entry?.values[neuron]}
        />
      )}
      <table aria-label="Fahrbefehle">
        <thead>
          <tr>
            <th scope="col">Fahrbefehl</th>
            <th scope="col">Gas</th>
            <th scope="col">Bremse</th>
            <th scope="col">Lenkung</th>
            <th scope="col">Richtung</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              ['KI-Ziel', ai?.target, ai?.decisionTick],
              ['Angewandt', hud.applied, hud.index],
            ] as const
          ).map(([label, command, tick]) => (
            <tr key={label}>
              <th scope="row">
                {label}
                {tick != null && <small>Tick {tick}</small>}
              </th>
              <td>{command ? percent.format(command.throttle) : '–'}</td>
              <td>{command ? percent.format(command.brake) : '–'}</td>
              <td>
                {command
                  ? command.steering === 0
                    ? 'Gerade'
                    : percent.format(Math.abs(command.steering)) +
                      (command.steering < 0 ? ' links' : ' rechts')
                  : '–'}
              </td>
              <td>
                {command
                  ? command.direction === 'forward'
                    ? 'Vorwärts'
                    : 'Rückwärts'
                  : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
