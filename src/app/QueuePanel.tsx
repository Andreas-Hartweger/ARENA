import { useState } from 'react';
import { trainingLab } from './labClient';
import { number, useLabQuery } from './labData';
import { NumberField, type Act } from './RunForm';
import type { Draft } from '../runtime/runConfig';
import { seriesDrafts, type QueueState } from '../runtime/queue';
type Props = {
  draft: Draft;
  act: Act;
  revision: number;
  active: boolean;
  openDraft: (draft: Draft) => void;
};
export function QueuePanel({ draft, act, revision, active, openDraft }: Props) {
  const { data: q, error } = useLabQuery<
      QueueState & { queueError: string | null }
    >({ type: 'queue' }, revision + ':' + active),
    [axis, setAxis] =
      useState<Parameters<typeof seriesDrafts>[1]>('mutation.p'),
    [values, setValues] = useState('0.03, 0.05, 0.08'),
    [seeds, setSeeds] = useState('41, 42, 43'),
    [budget, setBudget] = useState(115200);
  const list = (s: string) =>
      s.trim()
        ? s.split(',').map((t) => (t.trim() === '' ? NaN : Number(t.trim())))
        : [],
    vs = list(values),
    ss = list(seeds),
    count = vs.length * ss.length,
    unit = (draft.options.n ?? 128) * draft.scenarios.length,
    steps = Math.min(
      draft.options.generations ?? 100,
      Math.floor((draft.options.budget ?? Number.MAX_SAFE_INTEGER) / unit),
    ),
    cost = count * unit * steps;
  const write = (value: QueueState) =>
    act(() =>
      trainingLab().call({
        type: 'writeQueue',
        value: {
          version: value.version,
          entries: value.entries,
          enabled: value.enabled,
        },
      }),
    );
  if (!q)
    return (
      <p role={error ? 'alert' : 'status'}>
        {error || 'Warteschlange wird geladen …'}
      </p>
    );
  const entries = q.entries,
    move = (i: number, to: number) => {
      const next = [...entries];
      [next[i], next[to]] = [next[to], next[i]];
      write({ ...q, entries: next });
    };
  return (
    <>
      <section className="lab-panel">
        <div className="panel-title">
          <h2>Geplante Läufe</h2>
          <span>{entries.length} / 32</span>
        </div>
        <div className="toolbar">
          <button
            className="primary"
            disabled={entries.length >= 32}
            onClick={() =>
              write({
                ...q,
                entries: [
                  ...entries,
                  {
                    id: crypto.randomUUID(),
                    revision: 1,
                    draft,
                    autoStart: false,
                  },
                ],
              })
            }
          >
            Laufentwurf einreihen
          </button>
          <button
            disabled={active || !entries.length}
            onClick={() =>
              act(() => trainingLab().call({ type: 'dispatchQueue' }))
            }
          >
            Ersten Lauf starten
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={q.enabled}
              onChange={(e) => write({ ...q, enabled: e.target.checked })}
            />
            Automatischen Folgestart zulassen
          </label>
        </div>
        {q.queueError && (
          <p role="alert">Folgestart angehalten. {q.queueError}</p>
        )}
        {entries.length ? (
          <ol className="queue-list">
            {entries.map((row, i) => (
              <li key={row.id}>
                <div>
                  <strong>Seed {row.draft.options.master ?? 42}</strong> ·{' '}
                  {row.draft.options.n ?? 128} Individuen ·{' '}
                  {row.draft.options.generations ?? 100} Generationen · Revision{' '}
                  {row.revision}
                </div>
                {row.series && <small>Serie {row.series}</small>}
                <div className="toolbar">
                  <button disabled={!i} onClick={() => move(i, i - 1)}>
                    Früher
                  </button>
                  <button
                    disabled={i === entries.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    Später
                  </button>
                  <button onClick={() => openDraft(row.draft)}>
                    Im Entwurf öffnen
                  </button>
                  <button
                    onClick={() =>
                      write({
                        ...q,
                        entries: entries.map((x, j) =>
                          j === i
                            ? { ...x, revision: x.revision + 1, draft }
                            : x,
                        ),
                      })
                    }
                  >
                    Durch Laufentwurf ersetzen
                  </button>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={row.autoStart}
                      onChange={(e) =>
                        write({
                          ...q,
                          entries: entries.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  autoStart: e.target.checked,
                                  revision: x.revision + 1,
                                }
                              : x,
                          ),
                        })
                      }
                    />
                    Automatisch starten
                  </label>
                  <button
                    onClick={() =>
                      write({
                        ...q,
                        entries: entries.filter((x) => x.id !== row.id),
                      })
                    }
                  >
                    Entfernen
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">Es warten keine Läufe.</p>
        )}
      </section>
      <section className="lab-panel">
        <h2>Versuchsserie</h2>
        <fieldset>
          <legend>Parameter und Budget</legend>
          <label>
            Parameter
            <select
              value={axis}
              onChange={(e) => setAxis(e.target.value as typeof axis)}
            >
              <option value="mutation.p">Mutationswahrscheinlichkeit</option>
              <option value="mutation.alpha">Relative Mutationsstärke</option>
              <option value="tournament">Turniergröße</option>
            </select>
          </label>
          <label>
            Parameterwerte
            <input value={values} onChange={(e) => setValues(e.target.value)} />
          </label>
          <label>
            Seeds
            <input value={seeds} onChange={(e) => setSeeds(e.target.value)} />
          </label>
          <NumberField
            name="Gemeinsames Episodenbudget"
            value={budget}
            change={setBudget}
            min={1}
          />
        </fieldset>
        <p>
          {number(count)} Läufe · höchstens {number(cost)} logische Episoden
        </p>
        <button
          disabled={!count || count + entries.length > 32 || cost > budget}
          onClick={() =>
            act(async () => {
              const result = seriesDrafts(draft, axis, vs, ss, budget);
              await trainingLab().call({
                type: 'writeQueue',
                value: { ...q, entries: [...entries, ...result.entries] },
              });
            })
          }
        >
          Serie einreihen
        </button>
      </section>
    </>
  );
}
