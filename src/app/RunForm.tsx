import { useState } from 'react';
import type { Draft, GoalMetric } from '../runtime/runConfig';
import { preflight } from '../runtime/runConfig';
import { fingerprint } from '../runtime/fingerprint';
import { standardMutation } from '../training/operators';
import { standardAdaptation } from '../training/adaptation';
import type { Profile } from '../storage/library';
import { standardTask } from '../training/episode';

export type Act = (fn: () => Promise<unknown>) => void;
export function NumberField({
  name,
  value,
  change,
  min,
  max,
  step = 1,
}: {
  name: string;
  value: number;
  change: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
}) {
  return (
    <label>
      {name}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => change(e.currentTarget.valueAsNumber)}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
export function RunForm({
  draft: d,
  setDraft,
  models,
  advanced,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  models: Profile[];
  advanced: boolean;
}) {
  const [extra, setExtra] = useState(''),
    [extraError, setExtraError] = useState('');
  const o = d.options,
    s = d.scenarios[0] ?? {},
    t = { ...standardTask, ...s.task },
    mutation = { ...standardMutation, ...o.mutation },
    adaptation = { ...standardAdaptation, ...o.adaptation };
  const opt = <K extends keyof typeof o>(k: K, v: (typeof o)[K]) =>
    setDraft({ ...d, options: { ...o, [k]: v } });
  const scen = (v: Partial<typeof s>) =>
    setDraft({ ...d, scenarios: [{ ...s, ...v }, ...d.scenarios.slice(1)] });
  const num = (
    name: string,
    value: number,
    change: (n: number) => void,
    min?: number,
    max?: number,
    step: number | 'any' = 1,
  ) => <NumberField key={name} {...{ name, value, change, min, max, step }} />;
  return (
    <div className="run-form">
      <fieldset>
        <legend>Training</legend>
        <label>
          Ausgangsmodell
          <select
            value={d.sourceVersion ?? ''}
            onChange={(e) =>
              setDraft({ ...d, sourceVersion: e.target.value || undefined })
            }
          >
            <option value="">Neu initialisieren</option>
            {models
              .filter((p) => !p.trashedAt && !p.archived)
              .flatMap((p) =>
                p.versions.map((v, i) => (
                  <option key={v} value={v}>
                    {p.name} · Version {i + 1}
                  </option>
                )),
              )}
          </select>
        </label>
        {num('Population', o.n ?? 128, (n) => opt('n', n), 8, 1024)}
        {num(
          'Generationen',
          o.generations ?? 100,
          (n) => opt('generations', n),
          1,
          4294967295,
        )}
        {num('Seed', o.master ?? 42, (n) => opt('master', n), 0, 4294967295)}
        <label>
          Fitnessprofil
          <select
            value={
              typeof s.fitness === 'string'
                ? s.fitness
                : Array.isArray(s.fitness)
                  ? 'Custom'
                  : 'Balanced'
            }
            onChange={(e) =>
              scen({
                fitness:
                  e.target.value === 'Custom'
                    ? [0.5, 0.25, 0.08, 0.07, 0.04, 0.06, 0]
                    : (e.target.value as 'Balanced'),
              })
            }
          >
            {['Balanced', 'Speed', 'Safety', 'Custom'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {Array.isArray(s.fitness) && (
          <label>
            Gewichte · Zeit / Kontakt / Gras / Stillstand / Richtung /
            Instabilität / Steuerung
            <input
              key={s.fitness.join(',')}
              defaultValue={s.fitness.join(',')}
              onBlur={(e) =>
                scen({ fitness: e.target.value.split(',').map(Number) })
              }
            />
          </label>
        )}
      </fieldset>
      <fieldset>
        <legend>Ausführung</legend>
        <label>
          Modus
          <select
            value={d.mode}
            onChange={(e) =>
              setDraft({ ...d, mode: e.target.value as Draft['mode'] })
            }
          >
            <option value="headless">Headless</option>
            <option value="accelerated">Beschleunigt</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label>
          Zieltempo
          <select
            value={
              d.rate === 'max'
                ? 'max'
                : [1, 2, 5, 10, 25, 50].includes(d.rate)
                  ? d.rate
                  : 'custom'
            }
            onChange={(e) =>
              setDraft({
                ...d,
                rate:
                  e.target.value === 'max'
                    ? 'max'
                    : e.target.value === 'custom'
                      ? 3
                      : Number(e.target.value),
              })
            }
          >
            {[1, 2, 5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
            <option value="max">Max</option>
            <option value="custom">Eigener Wert</option>
          </select>
        </label>
        {d.rate !== 'max' &&
          num(
            'Zieltempo pro Episode (×)',
            d.rate,
            (n) => setDraft({ ...d, rate: n }),
            0.001,
            10000,
            'any',
          )}
        <label>
          Rechenprofil
          <select
            value={d.profile}
            onChange={(e) =>
              setDraft({ ...d, profile: e.target.value as Draft['profile'] })
            }
          >
            {['Eco', 'Balanced', 'Performance', 'Custom'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        {d.profile === 'Custom' && (
          <>
            {num(
              'Worker',
              d.custom.workers,
              (n) => setDraft({ ...d, custom: { ...d.custom, workers: n } }),
              1,
              16,
            )}
            {num(
              'Verwalteter RAM (MiB)',
              d.custom.managedMiB,
              (n) => setDraft({ ...d, custom: { ...d.custom, managedMiB: n } }),
              1,
              4096,
            )}
          </>
        )}
        <label>
          Autosave
          <select
            value={d.autosave}
            onChange={(e) =>
              setDraft({
                ...d,
                autosave: Number(e.target.value) as Draft['autosave'],
              })
            }
          >
            {[1, 5, 10, 25].map((n) => (
              <option value={n} key={n}>
                {n === 1 ? 'Jede Generation' : 'Alle ' + n + ' Generationen'}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {advanced && (
        <>
          <fieldset>
            <legend>Aufgabe und Netz</legend>
            {num(
              'Rundenziel',
              t.laps,
              (n) => scen({ task: { ...t, laps: n } }),
              1,
              1e6,
            )}
            {num(
              'Zeitlimit (Ticks)',
              t.maxTicks,
              (n) => scen({ task: { ...t, maxTicks: n } }),
              1,
            )}
            {num(
              'Schonfrist (Ticks)',
              t.graceTicks,
              (n) => scen({ task: { ...t, graceTicks: n } }),
              0,
            )}
            {num(
              'Fortschrittsfrist (Ticks)',
              t.noProgressTicks,
              (n) => scen({ task: { ...t, noProgressTicks: n } }),
              1,
            )}
            {num(
              'Neuer Fortschritt (m)',
              t.progressM,
              (n) => scen({ task: { ...t, progressM: n } }),
              0.001,
              undefined,
              'any',
            )}
            <label>
              Verdeckte Schichten
              <input
                key={d.hidden.join(',')}
                defaultValue={d.hidden.join(', ')}
                onBlur={(e) =>
                  setDraft({
                    ...d,
                    hidden: e.target.value.split(',').map(Number),
                  })
                }
              />
            </label>
            <label>
              Aktivierung
              <select
                value={d.activation}
                onChange={(e) =>
                  setDraft({
                    ...d,
                    activation: e.target.value as Draft['activation'],
                  })
                }
              >
                {['tanh', 'relu', 'leaky'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {num(
              'Gewichtsgrenze ±',
              d.weightLimit,
              (n) => setDraft({ ...d, weightLimit: n }),
              0.001,
              1e6,
              'any',
            )}
            {num(
              'Biasgrenze ±',
              d.biasLimit,
              (n) => setDraft({ ...d, biasLimit: n }),
              0.001,
              1e6,
              'any',
            )}
            {(['sensorHz', 'decisionHz'] as const).map((k) => (
              <label key={k}>
                {k === 'sensorHz' ? 'Sensorik (Hz)' : 'Inferenz (Hz)'}
                <select
                  value={s[k] ?? 30}
                  onChange={(e) => scen({ [k]: Number(e.target.value) })}
                >
                  {[10, 15, 20, 30, 60].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Selektion und Mutation</legend>
            {num(
              'Turniergröße',
              o.tournament ?? 3,
              (n) => opt('tournament', n),
              2,
              8,
            )}
            {num(
              'Elitenanteil',
              o.eliteRate ?? 0.05,
              (n) => opt('eliteRate', n),
              0.01,
              0.2,
              0.01,
            )}
            {num(
              'Elternpool',
              o.poolFraction ?? 1,
              (n) => opt('poolFraction', n),
              0.25,
              1,
              0.01,
            )}
            {num(
              'Kreuzungswahrscheinlichkeit',
              o.crossProbability ?? 0,
              (n) => opt('crossProbability', n),
              0,
              1,
              0.01,
            )}
            <label>
              Kreuzung
              <select
                value={o.operator ?? 'neuron-wise'}
                onChange={(e) =>
                  opt('operator', e.target.value as 'uniform' | 'neuron-wise')
                }
              >
                <option value="neuron-wise">Neuronweise</option>
                <option value="uniform">Uniform</option>
              </select>
            </label>
            {(
              [
                ['p', 'Mutationswahrscheinlichkeit', 0, 1],
                ['alpha', 'Relative Stärke α', 0.01, 2],
                ['largeProbability', 'Anteil großer Schritte', 0, 0.3],
                ['largeMultiplier', 'Faktor großer Schritte', 1, 10],
                [
                  'biasProbabilityFactor',
                  'Bias-Wahrscheinlichkeitsfaktor',
                  0,
                  2,
                ],
                ['biasStrengthFactor', 'Bias-Stärkefaktor', 0, 2],
              ] as const
            ).map(([k, name, min, max]) =>
              num(
                name,
                mutation[k],
                (n) => opt('mutation', { ...o.mutation, [k]: n }),
                min,
                max,
                0.01,
              ),
            )}
            {num(
              'Stagnationsfenster',
              adaptation.window,
              (n) => opt('adaptation', { ...adaptation, window: n }),
              5,
              100,
            )}
            {num(
              'Verbesserung ε',
              adaptation.epsilon,
              (n) => opt('adaptation', { ...adaptation, epsilon: n }),
              0.001,
              100,
              0.001,
            )}
            {num(
              'Immigrantenanteil',
              adaptation.immigrantRate,
              (n) => opt('adaptation', { ...adaptation, immigrantRate: n }),
              0,
              0.25,
              0.01,
            )}
            {(
              [
                'probabilityEnabled',
                'strengthEnabled',
                'rescueEnabled',
              ] as const
            ).map((k, i) => (
              <label className="check" key={k}>
                <input
                  type="checkbox"
                  checked={adaptation[k]}
                  onChange={(e) =>
                    opt('adaptation', { ...adaptation, [k]: e.target.checked })
                  }
                />
                {
                  [
                    'Wahrscheinlichkeit anpassen',
                    'Stärke anpassen',
                    'Rettung aktivieren',
                  ][i]
                }
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Beendigung</legend>
            <label>
              Zielmetrik
              <select
                value={d.goal?.leaves[0]?.metric ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...d,
                    goal: e.target.value
                      ? {
                          logic: 'and',
                          consecutive: 1,
                          leaves: [
                            {
                              metric: e.target.value as GoalMetric,
                              threshold: 1,
                            },
                          ],
                        }
                      : undefined,
                  })
                }
              >
                <option value="">Generationsbudget</option>
                {Object.entries({
                  fitness: 'Beste Fitness',
                  laps: 'Gültige Runden',
                  successes: 'Erfolgreiche Episoden',
                  lapTime: 'Beste Rundenzeit (s)',
                  successFraction: 'Erfolgsquote',
                  plateau: 'Plateau',
                }).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {d.goal && (
              <>
                {num(
                  'Zielwert',
                  d.goal.leaves[0].threshold,
                  (n) =>
                    setDraft({
                      ...d,
                      goal: {
                        ...d.goal!,
                        leaves: [
                          { ...d.goal!.leaves[0], threshold: n },
                          ...d.goal!.leaves.slice(1),
                        ],
                      },
                    }),
                  0,
                  undefined,
                  'any',
                )}
                {num(
                  'Aufeinanderfolgende Generationen',
                  d.goal.consecutive,
                  (n) =>
                    setDraft({ ...d, goal: { ...d.goal!, consecutive: n } }),
                  1,
                )}
              </>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={!!d.time}
                onChange={(e) =>
                  setDraft({
                    ...d,
                    time: e.target.checked
                      ? { seconds: 3600, hard: false }
                      : undefined,
                  })
                }
              />
              Aktivzeit begrenzen
            </label>
            {d.time && (
              <>
                {num(
                  'Aktive Sekunden',
                  d.time.seconds,
                  (n) => setDraft({ ...d, time: { ...d.time!, seconds: n } }),
                  1,
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={d.time.hard}
                    onChange={(e) =>
                      setDraft({
                        ...d,
                        time: { ...d.time!, hard: e.target.checked },
                      })
                    }
                  />
                  Offene Generation am Limit abbrechen
                </label>
              </>
            )}
          </fieldset>
          <details>
            <summary>Vollständige Konfiguration bearbeiten</summary>
            <label className="check">
              <input
                type="checkbox"
                checked={d.volatile}
                onChange={(e) => setDraft({ ...d, volatile: e.target.checked })}
              />
              Flüchtiger Einzellauf ohne dauerhafte Checkpoints
            </label>
            {d.volatile && (
              <p>
                Beim Schließen gehen die ungesicherten Laufdaten verloren. Eine
                Fortsetzung aus einem Checkpoint ist bei diesem Lauf
                ausgeschlossen.
              </p>
            )}
            <p>
              Hier lassen sich unter anderem Szenariosätze, kombinierte Ziele,
              geschützte Schichten und schichtweise Mutationsfaktoren festlegen.
            </p>
            <button onClick={() => setExtra(JSON.stringify(d, null, 2))}>
              Aktuellen Entwurf laden
            </button>
            <textarea
              aria-label="Vollständiger Entwurf als JSON"
              rows={12}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
            <button
              onClick={() => {
                try {
                  const next = JSON.parse(extra) as Draft;
                  preflight(next, fingerprint, navigator.hardwareConcurrency);
                  setDraft(next);
                  setExtraError('');
                } catch (e) {
                  setExtraError(String(e));
                }
              }}
            >
              Entwurf prüfen und übernehmen
            </button>
            {extraError && <p role="alert">{extraError}</p>}
          </details>
        </>
      )}
    </div>
  );
}
