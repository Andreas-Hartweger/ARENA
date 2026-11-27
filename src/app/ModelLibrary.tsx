import { useState } from 'react';
import type { Draft } from '../runtime/runConfig';
import type {
  Profile,
  Version,
  PerformanceRecord,
  compareParameters,
  readVersion,
} from '../storage/library';
import type { EpisodeResult } from '../training/episode';
import { trainingLab } from './labClient';
import { download, number, useLabQuery } from './labData';
import type { Act } from './RunForm';

type Props = {
  draft: Draft;
  models: Profile[];
  act: Act;
  revision: number;
  active: boolean;
  champion: boolean;
  openDraft: (draft: Draft) => void;
};
type Details = {
  version: Version;
  manifest: Awaited<ReturnType<typeof readVersion>>['manifest'];
  records: PerformanceRecord[];
};
function ProfileEditor({ p, act }: { p: Profile; act: Act }) {
  const [name, setName] = useState(p.name),
    [desc, setDesc] = useState(p.description),
    [tags, setTags] = useState(p.tags.join(', ')),
    [collection, setCollection] = useState(p.collection),
    [color, setColor] = useState(p.color ?? '#fc7848'),
    [icon, setIcon] = useState(p.icon ?? '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        act(() =>
          trainingLab().call({
            type: 'profile',
            id: p.id,
            changes: {
              name,
              description: desc,
              tags: tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
              collection,
              color,
              icon,
            },
          }),
        );
      }}
    >
      <fieldset>
        <legend>Profil bearbeiten</legend>
        <label>
          Name
          <input
            value={name}
            maxLength={128}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Sammlung
          <input
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          />
        </label>
        <label>
          Tags, durch Kommas getrennt
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label>
          Profilfarbe
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <label>
          Symbol
          <input value={icon} onChange={(e) => setIcon(e.target.value)} />
        </label>
        <label>
          Beschreibung
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
      </fieldset>
      <button>Profil speichern</button>
    </form>
  );
}
function VersionView({
  p,
  models,
  act,
  revision,
  active,
  champion,
  openDraft,
}: Props & { p: Profile }) {
  const [selected, setSelected] = useState(p.active),
    [other, setOther] = useState(''),
    [clone, setClone] = useState(''),
    [drive, setDrive] = useState<EpisodeResult>(),
    [diff, setDiff] = useState<ReturnType<typeof compareParameters>>();
  const details = useLabQuery<Details>(
      { type: 'version', id: selected },
      revision,
    ),
    lab = trainingLab(),
    d = details.data;
  return (
    <section className="lab-panel">
      <div className="panel-title">
        <h2>
          {p.icon} {p.name}
        </h2>
        <button
          onClick={() =>
            act(() =>
              lab.call({
                type: 'profile',
                id: p.id,
                changes: { favorite: !p.favorite },
              }),
            )
          }
        >
          {p.favorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
        </button>
      </div>
      <p>{p.description}</p>
      <label>
        Version
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setDiff(undefined);
            setDrive(undefined);
          }}
        >
          {p.versions.map((v, i) => (
            <option key={v} value={v}>
              Version {i + 1}
              {v === p.active ? ' · aktiv' : ''}
              {v === p.preferred ? ' · bevorzugt' : ''}
            </option>
          ))}
        </select>
      </label>
      {details.error && <p role="alert">{details.error}</p>}
      {d && (
        <>
          <dl className="facts">
            {[
              ['Herkunft', d.version.origin],
              ['Rolle', d.version.role],
              ['Architektur', [248, ...d.manifest.model.hidden, 3].join(' → ')],
              ['Aktivierung', d.manifest.model.activation],
              ['Fahrzeug', d.manifest.vehicle],
              ['Präzision', d.manifest.dtype],
            ].map(([a, b]) => (
              <div key={a}>
                <dt>{a}</dt>
                <dd>{b}</dd>
              </div>
            ))}
          </dl>
          <p className="technical">
            Genom <code>{d.version.genome}</code>
          </p>
          <p className="technical">
            Quelle <code>{d.version.source ?? 'Neu initialisiert'}</code>
          </p>
          <div className="toolbar">
            <button
              onClick={() =>
                openDraft({ ...d.manifest.draft, sourceVersion: selected })
              }
            >
              Weitertrainieren
            </button>
            <button
              disabled={selected === p.active}
              onClick={() =>
                act(() =>
                  lab.call({
                    type: 'profile',
                    id: p.id,
                    changes: { active: selected },
                  }),
                )
              }
            >
              Aktivieren
            </button>
            <button
              disabled={selected === p.preferred}
              onClick={() =>
                act(() =>
                  lab.call({
                    type: 'profile',
                    id: p.id,
                    changes: { preferred: selected },
                  }),
                )
              }
            >
              Bevorzugen
            </button>
            <button
              onClick={() =>
                act(async () =>
                  download(
                    await lab.call<Blob>({
                      type: 'export',
                      kind: 'model',
                      roots: [p.id],
                    }),
                    'modell.arena-model',
                  ),
                )
              }
            >
              Modell exportieren
            </button>
          </div>
          <details>
            <summary>Leistungsnachweise ({d.records.length})</summary>
            {d.records.map((r, i) => (
              <p key={i}>
                {r.purpose} · {number(r.value, 4)} · {r.track} / {r.vehicle} ·
                Seed {r.seed} · n = {r.sampleCount} ·{' '}
                {r.verified ? 'lokal nachgewiesen' : 'ungeprüfte Angabe'}{' '}
                <code>{r.contract}</code>
              </p>
            ))}
          </details>
          <div className="toolbar">
            <label>
              Name der Kopie
              <input value={clone} onChange={(e) => setClone(e.target.value)} />
            </label>
            <button
              disabled={!clone.trim()}
              onClick={() =>
                act(() =>
                  lab.call({
                    type: 'create',
                    draft: d.manifest.draft,
                    source: selected,
                    name: clone,
                  }),
                )
              }
            >
              Exakte Kopie anlegen
            </button>
            <button
              disabled={!champion}
              onClick={() =>
                act(() => lab.call({ type: 'champion', profile: p.id }))
              }
            >
              Laufchampion als Version sichern
            </button>
          </div>
          <details>
            <summary>Versionen vergleichen und Testfahrt</summary>
            <label>
              Vergleichsversion
              <select
                value={other}
                onChange={(e) => {
                  setOther(e.target.value);
                  setDiff(undefined);
                }}
              >
                <option value="">Version auswählen</option>
                {models
                  .filter((m) => !m.trashedAt)
                  .flatMap((m) =>
                    m.versions.map((v, i) => (
                      <option key={v} value={v}>
                        {m.name} · V{i + 1}
                      </option>
                    )),
                  )}
              </select>
            </label>
            <button
              disabled={!other}
              onClick={() =>
                act(async () =>
                  setDiff(
                    await lab.call({ type: 'compare', a: selected, b: other }),
                  ),
                )
              }
            >
              Parameter vergleichen
            </button>
            {diff && (
              <table>
                <thead>
                  <tr>
                    <th>Schicht</th>
                    <th>Abweichend</th>
                    <th>Maximum |Δ|</th>
                    <th>RMS</th>
                    <th>Verteilung</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.map((r) => (
                    <tr key={r.layer}>
                      <td>{r.layer}</td>
                      <td>{r.changed}</td>
                      <td>{number(r.max, 5)}</td>
                      <td>{number(r.rms, 5)}</td>
                      <td>
                        <svg
                          aria-label="Maximale Parameterdifferenz pro Intervall"
                          viewBox="0 0 96 16"
                        >
                          {r.bins.map((v, i) => (
                            <rect
                              key={i}
                              x={(96 * i) / r.bins.length}
                              width={96 / r.bins.length}
                              y={0}
                              height={16}
                              fill={
                                'rgba(255,133,81,' +
                                (r.max ? v / r.max : 0) +
                                ')'
                              }
                            />
                          ))}
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p>
              Einzelepisode mit dem gespeicherten Szenario.{' '}
              {active
                ? 'Während des Trainings ist die zusätzliche Fahrt zurückgestellt.'
                : ''}
            </p>
            <button
              disabled={active}
              onClick={() =>
                act(async () =>
                  setDrive(
                    await lab.call({
                      type: 'drive',
                      version: selected,
                      draft: d.manifest.draft,
                    }),
                  ),
                )
              }
            >
              Isolierte Testfahrt starten
            </button>
            {drive && (
              <p>
                {drive.reason} · {drive.tick} Ticks{' '}
                {drive.ok
                  ? '· Fitness ' + number(drive.fitness.F, 4)
                  : drive.message}
              </p>
            )}
          </details>
        </>
      )}
      <details>
        <summary>Profildaten bearbeiten</summary>
        <ProfileEditor p={p} act={act} />
      </details>
      <div className="toolbar">
        <button
          onClick={() =>
            act(() =>
              lab.call({
                type: 'profile',
                id: p.id,
                changes: { archived: !p.archived },
              }),
            )
          }
        >
          {p.archived ? 'Aus Archiv holen' : 'Archivieren'}
        </button>
        <button
          onClick={() =>
            act(() =>
              lab.call({
                type: 'profile',
                id: p.id,
                changes: { trashedAt: Date.now() },
              }),
            )
          }
        >
          In den Papierkorb
        </button>
      </div>
    </section>
  );
}
export function ModelLibrary(props: Props) {
  const { models, act, draft } = props,
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [order, setOrder] = useState('name'),
    [selected, setSelected] = useState(''),
    [name, setName] = useState('');
  const shown = models
      .filter(
        (p) =>
          !p.trashedAt &&
          (filter === 'archive' ? p.archived : !p.archived) &&
          (filter !== 'favorite' || p.favorite) &&
          [p.name, p.collection, p.description, ...p.tags]
            .join(' ')
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      )
      .sort((a, b) =>
        order === 'versions'
          ? b.versions.length - a.versions.length
          : a.name.localeCompare(b.name, 'de'),
      ),
    p = shown.find((x) => x.id === selected) ?? shown[0];
  return (
    <>
      <section className="lab-panel">
        <h2>Modell anlegen</h2>
        <div className="toolbar">
          <label>
            Modellname
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            className="primary"
            disabled={!name.trim()}
            onClick={() =>
              act(async () => {
                const p = await trainingLab().call<Profile>({
                  type: 'create',
                  name,
                  draft,
                });
                setSelected(p.id);
                setName('');
              })
            }
          >
            Neu initialisieren
          </button>
        </div>
        <p>
          Architektur und Seed stammen aus dem Laufentwurf. Ein freigegebenes
          Startermodell liegt noch nicht vor.
        </p>
      </section>
      <div className="library-columns">
        <section className="lab-panel">
          <h2>Bibliothek</h2>
          <label>
            Modelle suchen
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, Tag oder Sammlung"
            />
          </label>
          <div className="toolbar">
            <label>
              Ansicht
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">Aktuelle</option>
                <option value="favorite">Favoriten</option>
                <option value="archive">Archiv</option>
              </select>
            </label>
            <label>
              Sortieren
              <select value={order} onChange={(e) => setOrder(e.target.value)}>
                <option value="name">Name</option>
                <option value="versions">Versionsanzahl</option>
              </select>
            </label>
          </div>
          {shown.map((m) => (
            <button
              className="list-item"
              key={m.id}
              aria-pressed={m.id === p?.id}
              onClick={() => setSelected(m.id)}
            >
              <strong>{m.name}</strong>
              <span>
                {m.favorite ? '★ · ' : ''}
                {m.versions.length} Version(en)
              </span>
            </button>
          ))}
          {!shown.length && <p className="empty">Keine passenden Modelle.</p>}
        </section>
        {p && <VersionView {...props} key={p.id} p={p} />}
      </div>
    </>
  );
}
