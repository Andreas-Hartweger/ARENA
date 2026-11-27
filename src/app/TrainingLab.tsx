import { useEffect, useState } from 'react';
import { trainingLab } from './labClient';
import { bytes, number, useLabQuery } from './labData';
import { defaultDraft, preflight, type Draft } from '../runtime/runConfig';
import { fingerprint } from '../runtime/fingerprint';
import type { Phase, RunState } from '../runtime/controller';
import type { Profile } from '../storage/library';
import { RunForm } from './RunForm';
import { RunMap, Population, HistoryChart } from './RunViews';
import { ModelLibrary } from './ModelLibrary';
import { StorageCenter } from './StorageCenter';
import { QueuePanel } from './QueuePanel';
import '../styles/training.css';

const screens = {
  training: 'Training',
  models: 'Modelle',
  queue: 'Warteschlange',
  storage: 'Speicher',
};
const states: Record<Phase, string> = {
  Draft: 'Bereit',
  Initializing: 'Initialisierung',
  Running: 'Läuft',
  Pausing: 'Pause angefordert',
  Draining: 'Worker laufen aus',
  Paused: 'Pausiert',
  Stopping: 'Abschluss angefordert',
  Completed: 'Abgeschlossen',
  Cancelling: 'Abbruch läuft',
  Cancelled: 'Abgebrochen',
  Faulted: 'Fehlgeschlagen',
  Recoverable: 'Wiederherstellung möglich',
};
function initialDraft() {
  try {
    const value = sessionStorage.getItem('arena.lab.draft.v1');
    if (value) {
      const d: Draft = JSON.parse(value);
      preflight(d, fingerprint, navigator.hardwareConcurrency);
      return d;
    }
  } catch {
    /* A fresh draft is available when the saved draft is invalid. */
  }
  return defaultDraft();
}
export default function TrainingLab({ route }: { route: string }) {
  const [draft, setDraft] = useState<Draft>(initialDraft),
    [state, setState] = useState<RunState | undefined>(
      () => trainingLab().state,
    ),
    [advanced, setAdvanced] = useState(false),
    [configure, setConfigure] = useState(false),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [pending, setPending] = useState(false),
    [templateName, setTemplateName] = useState(''),
    [confirmCancel, setConfirmCancel] = useState(false);
  const models = useLabQuery<Profile[]>({ type: 'library' }, revision),
    templates = useLabQuery<{ id: string; name: string; revision: number }[]>(
      { type: 'templates' },
      revision,
    );
  const current = useLabQuery<Draft | undefined>(
    state?.sessionId ? { type: 'currentDraft' } : null,
    (state?.sessionId ?? '') + ':' + revision + ':' + state?.segment,
  );
  useEffect(() => {
    try {
      sessionStorage.setItem('arena.lab.draft.v1', JSON.stringify(draft));
    } catch {
      /* The editor remains available. */
    }
  }, [draft]);
  useEffect(() => {
    const lab = trainingLab();
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    const accept = (s: RunState) => {
      if (live)
        setState((previous) =>
          previous && previous.seq > s.seq ? previous : s,
        );
    };
    const poll = async () => {
      try {
        if (!document.hidden)
          accept(await lab.call<RunState>({ type: 'status' }));
      } catch (e) {
        if (live) setError(String(e));
      }
      if (live) timer = setTimeout(poll, 500);
    };
    const off = lab.listen((e) => {
      if (e.type === 'state') accept(e.state);
    });
    void poll();
    return () => {
      live = false;
      clearTimeout(timer);
      off();
    };
  }, []);
  const act = (fn: () => Promise<unknown>, message = '') => {
    setError('');
    setNotice('');
    setPending(true);
    void Promise.resolve()
      .then(fn)
      .then(
        () => {
          setRevision((n) => n + 1);
          setNotice(message);
        },
        (e) => setError(String(e)),
      )
      .finally(() => setPending(false));
  };
  const lab = trainingLab(),
    phase = state?.phase ?? 'Draft',
    running = phase === 'Running',
    paused = phase === 'Paused',
    active = !['Draft', 'Completed', 'Cancelled', 'Faulted'].includes(phase);
  const actual = current.data ?? draft,
    monitor = state?.monitor,
    summary = state?.summary,
    ticks = monitor?.ticks ?? 0,
    activeMs = state?.activeMs ?? 0,
    command = (
      type:
        'pause' | 'drain' | 'resume' | 'finish' | 'cancel' | 'retry' | 'save',
    ) => act(() => lab.call({ type }));
  const openDraft = (d: Draft) => {
    setDraft(structuredClone(d));
    setConfigure(true);
    location.hash = '/training';
  };
  const metric = (name: string, value: string) => (
    <div key={name}>
      <dt>{name}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <main className="lab-shell">
      <header className="lab-head">
        <a href="#/" className="wordmark" aria-label="ARENA First Drive">
          <i />
          ARENA
        </a>
        <span className="edition">TRAINING LAB</span>
        <a className="back-drive" href="#/">
          First Drive ↗
        </a>
      </header>
      <nav aria-label="Trainingslabor">
        {Object.entries(screens).map(([path, name]) => (
          <a
            key={path}
            href={'#/' + path}
            aria-current={route === path ? 'page' : undefined}
          >
            {name}
          </a>
        ))}
      </nav>
      <div className="lab-page">
        <div className="page-title">
          <h1>{screens[route as keyof typeof screens] ?? 'Training'}</h1>
          <span className={'phase phase-' + phase} role="status">
            {states[phase]}
          </span>
        </div>
        {(error || models.error || state?.error) && (
          <p role="alert" className="lab-alert">
            {error || models.error || state?.error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {route === 'training' ? (
          <>
            <div className="run-actions">
              <button
                className="primary"
                disabled={pending || active}
                onClick={() => act(() => lab.call({ type: 'start', draft }))}
              >
                Training starten
              </button>
              <button
                disabled={pending || !(running || paused)}
                onClick={() => command(paused ? 'resume' : 'pause')}
              >
                {paused ? 'Fortsetzen' : 'Pause'}
              </button>
              {advanced && (
                <button
                  disabled={pending || !running}
                  onClick={() => command('drain')}
                >
                  Worker auslaufen lassen
                </button>
              )}
              <button
                disabled={pending || !running}
                onClick={() => command('finish')}
              >
                Generation abschließen
              </button>
              <button
                disabled={pending || !active}
                onClick={() => setConfirmCancel(true)}
              >
                Abbrechen
              </button>
              {active && (
                <button disabled={pending} onClick={() => command('save')}>
                  Meilenstein speichern
                </button>
              )}
              {phase === 'Recoverable' && (
                <button onClick={() => command('retry')}>
                  Speicherung wiederholen
                </button>
              )}
            </div>
            {confirmCancel && active && (
              <div
                className="lab-alert"
                role="group"
                aria-label="Abbruch bestätigen"
              >
                Die offene Generation wird verworfen.{' '}
                <button
                  onClick={() => {
                    setConfirmCancel(false);
                    command('cancel');
                  }}
                >
                  Lauf abbrechen
                </button>
                <button onClick={() => setConfirmCancel(false)}>
                  Weiterarbeiten
                </button>
              </div>
            )}
            <dl className="metrics">
              {metric(
                'Bestätigte Generationen',
                number(state?.generation ?? 0) +
                  ' / ' +
                  number(actual.options.generations ?? 100),
              )}
              {metric('Ausgewertete Episoden', number(state?.evaluations ?? 0))}
              {metric('Beste Fitness', number(summary?.fitness.best, 3))}
              {metric(
                'Schnellste Runde',
                summary?.lapTimes
                  ? number(summary.lapTimes.worst, 3) + ' s'
                  : '–',
              )}
              {metric(
                'Worker belegt',
                number(monitor?.busy ?? 0) +
                  ' / ' +
                  number(monitor?.workers ?? 0),
              )}
            </dl>
            <div className="toolbar">
              <button
                aria-expanded={configure}
                onClick={() => setConfigure(!configure)}
              >
                {configure ? 'Konfiguration schließen' : 'Lauf konfigurieren'}
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={advanced}
                  onChange={(e) => setAdvanced(e.target.checked)}
                />
                Erweitert
              </label>
              {state?.reason && <span>Beendet durch {state.reason}</span>}
              {state?.unsaved && <strong>Speicherung ausstehend</strong>}
            </div>
            {configure && (
              <section className="lab-panel">
                <div className="panel-title">
                  <h2>Laufentwurf</h2>
                  <button onClick={() => setDraft(defaultDraft())}>
                    Entwurf zurücksetzen
                  </button>
                </div>
                <RunForm
                  {...{ draft, setDraft, advanced }}
                  models={models.data ?? []}
                />
                <div className="toolbar">
                  <label>
                    Vorlagenname
                    <input
                      value={templateName}
                      maxLength={64}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={!templateName.trim()}
                    onClick={() =>
                      act(
                        () =>
                          lab.call({
                            type: 'template',
                            name: templateName,
                            draft,
                          }),
                        'Vorlage gespeichert.',
                      )
                    }
                  >
                    Vorlage speichern
                  </button>
                  <label>
                    Vorlage laden
                    <select
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (id)
                          act(async () => {
                            const t = await lab.call<{ draft: Draft }>({
                              type: 'loadTemplate',
                              id,
                            });
                            setDraft(t.draft);
                          });
                      }}
                    >
                      <option value="">Auswählen</option>
                      {templates.data?.map((t) => (
                        <option value={t.id} key={t.id}>
                          {t.name} · Revision {t.revision}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {active && (
                  <div className="toolbar">
                    <button
                      onClick={() =>
                        act(
                          () =>
                            lab.call({
                              type: 'display',
                              settings: {
                                mode: draft.mode,
                                rate: draft.rate,
                                profile: draft.profile,
                                custom: draft.custom,
                              },
                            }),
                          'Ausführung angepasst.',
                        )
                      }
                    >
                      Ausführung übernehmen
                    </button>
                    <button
                      onClick={() => {
                        const {
                          tournament,
                          eliteRate,
                          poolFraction,
                          crossProbability,
                          operator,
                          mutation,
                          adaptation,
                        } = draft.options;
                        act(
                          () =>
                            lab.call({
                              type: 'revise',
                              learning: Object.fromEntries(
                                Object.entries({
                                  tournament,
                                  eliteRate,
                                  poolFraction,
                                  crossProbability,
                                  operator,
                                  mutation,
                                  adaptation,
                                }).filter(([, v]) => v !== undefined),
                              ),
                              scenarios:
                                JSON.stringify(draft.scenarios) ===
                                JSON.stringify(actual.scenarios)
                                  ? undefined
                                  : draft.scenarios,
                            }),
                          'Änderung für die Generationsgrenze vorgemerkt.',
                        );
                      }}
                    >
                      Lernparameter vormerken
                    </button>
                  </div>
                )}
              </section>
            )}
            <div className="lab-columns">
              <RunMap {...{ state, advanced, act }} draft={actual} />
              <HistoryChart state={state} />
            </div>
            {advanced && (
              <>
                <section className="lab-panel">
                  <h2>Laufzeit und Qualität</h2>
                  <dl className="facts">
                    {metric('Aktivzeit', number(activeMs / 1000, 1) + ' s')}
                    {metric('Ticks', number(ticks))}
                    {metric(
                      'Ticks pro aktiver Sekunde',
                      state?.sessionActiveMs
                        ? number((ticks * 1000) / state.sessionActiveMs, 1)
                        : '–',
                    )}
                    {metric(
                      'Rechenzeit aller Worker',
                      number((monitor?.computeMs ?? 0) / 1000, 2) + ' s',
                    )}
                    {metric(
                      'Letzter dauerhafter Stand',
                      number(state?.durableGeneration),
                    )}
                    {metric('Segment', number(state?.segment))}
                    {metric(
                      'Erfolgreiche Episoden',
                      number(summary?.successes),
                    )}
                    {metric('Diversität', number(summary?.diversity.D, 5))}
                    {metric(
                      'Episoden / aktive Minute',
                      state?.sessionActiveMs
                        ? number(
                            ((monitor?.evaluated ?? 0) * 60000) /
                              state.sessionActiveMs,
                            1,
                          )
                        : '–',
                    )}
                    {metric(
                      'Genomtransfer',
                      bytes(monitor?.transferredBytes ?? 0),
                    )}
                    {metric(
                      'Worker-Nachrichten',
                      number(monitor?.receivedMessages ?? 0),
                    )}
                    {metric(
                      'Bestätigte Schreibvorgänge',
                      number(state?.commits ?? 0),
                    )}
                    {metric(
                      'Schreibzeit dieser Sitzung',
                      number((state?.saveMs ?? 0) / 1000, 2) + ' s',
                    )}
                    {metric(
                      'Geschätzter verwalteter RAM',
                      state?.managedEstimate
                        ? bytes(state.managedEstimate)
                        : '–',
                    )}
                    {metric(
                      'Prozess-CPU / tatsächlicher RAM',
                      'Nicht verfügbar',
                    )}
                  </dl>
                  {summary && (
                    <details>
                      <summary>Generationsdaten und Adaption</summary>
                      <pre>{JSON.stringify(summary, null, 2)}</pre>
                    </details>
                  )}
                </section>
                <Population draft={actual} state={state} />
              </>
            )}
          </>
        ) : route === 'models' ? (
          <ModelLibrary
            {...{ draft, act, revision, openDraft, active }}
            models={models.data ?? []}
            champion={!!summary}
          />
        ) : route === 'queue' ? (
          <QueuePanel {...{ draft, act, revision, openDraft, active }} />
        ) : (
          <StorageCenter
            {...{ act, revision, active }}
            models={models.data ?? []}
          />
        )}
      </div>
    </main>
  );
}
