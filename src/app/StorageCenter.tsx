import { useEffect, useRef, useState } from 'react';
import { trainingLab } from './labClient';
import { bytes, download, number, useLabQuery } from './labData';
import { NumberField, type Act } from './RunForm';
import type { Profile } from '../storage/library';
import type { ObjectMeta } from '../storage/objects';
import type { RunIndex } from '../storage/checkpoint';
import type { PackageType } from '../storage/transfer';
type Storage = {
  status: { revision: number; total: number; budget: number };
  meta: ObjectMeta[];
  quota: StorageEstimate;
  persistent: boolean;
};
type Preview = {
  id: string;
  type: string;
  objects: number;
  conflicts: string[];
  size: number;
  roots: string[];
};
type Removal = { bytes: number; remove: string[]; revision: number };
function RecoveryControls({
  id,
  active,
  act,
  fork,
}: {
  id: string;
  active: boolean;
  act: Act;
  fork: boolean;
}) {
  const { data, error } = useLabQuery<{
    phase: string;
    reason: string | null;
    generation: number;
    activeMs: number;
    time?: { seconds: number };
    imported: boolean;
    sameRuntime: boolean;
    parent?: string;
  }>({ type: 'checkpointInfo', id });
  const [sourceStopped, confirmSource] = useState(false),
    [extra, setExtra] = useState('');
  if (error) return <p role="alert">{error} Einen früheren Stand auswählen.</p>;
  if (!data) return <p>Speicherstand wird gelesen …</p>;
  const allowed = data.phase === 'readyToEvaluate' && data.sameRuntime;
  return (
    <>
      <p>
        {data.generation} bestätigte Generationen ·{' '}
        {number(data.activeMs / 1000, 1)} s gesicherte Aktivzeit ·{' '}
        {data.phase === 'terminal'
          ? 'Abgeschlossen (' + data.reason + ')'
          : fork
            ? 'Eigenständiger Laufzweig'
            : 'Fortsetzbarer Stand'}
      </p>
      {!data.sameRuntime && (
        <p>
          Die Laufzeitumgebung weicht vom gespeicherten Stand ab. Exakte
          Fortsetzung ist nicht verfügbar.
        </p>
      )}
      {data.parent && (
        <p>
          Eltern-Checkpoint <code>{data.parent}</code>
        </p>
      )}
      {allowed && (
        <>
          {data.imported && (
            <label className="check">
              <input
                type="checkbox"
                checked={sourceStopped}
                onChange={(e) => confirmSource(e.target.checked)}
              />
              Der Lauf auf dem Ursprungsgerät ist angehalten.
            </label>
          )}
          {data.time && (
            <label>
              Konservative zusätzliche Aktivzeit seit dem Checkpoint in Sekunden
              (unbekannt nach Absturz)
              <input
                type="number"
                min="0"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </label>
          )}
          <button
            disabled={
              active ||
              (data.imported && !sourceStopped) ||
              !!(data.time && (!extra.trim() || Number(extra) < 0))
            }
            onClick={() =>
              act(async () => {
                await trainingLab().call({
                  type: 'recover',
                  id,
                  sourceStopped,
                  additionalActiveMs: extra ? Number(extra) * 1000 : undefined,
                });
                location.hash = '/training';
              })
            }
          >
            {fork ? 'Neuen Laufzweig pausiert öffnen' : 'Stand pausiert öffnen'}
          </button>
        </>
      )}
    </>
  );
}
export function StorageCenter({
  act,
  revision,
  models,
  active,
}: {
  act: Act;
  revision: number;
  models: Profile[];
  active: boolean;
}) {
  const modelImport =
    new URLSearchParams(location.hash.split('?')[1]).get('import') === 'model';
  const fileInput = useRef<HTMLInputElement>(null);
  const lab = trainingLab(),
    [refresh, setRefresh] = useState(0),
    counter = revision + refresh;
  const { data: s, error } = useLabQuery<Storage>({ type: 'storage' }, counter),
    runs = useLabQuery<RunIndex[]>({ type: 'checkpoints' }, counter);
  const [budget, setBudget] = useState<number>(),
    [preview, setPreview] = useState<Preview>(),
    [variant, setVariant] = useState(false),
    [removal, setRemoval] = useState<{ ids: string[]; value: Removal }>(),
    [ck, setCk] = useState(''),
    [info, setInfo] = useState('');
  const exp = (kind: PackageType, roots: string[]) =>
    act(async () =>
      download(
        await lab.call<Blob>({ type: 'export', kind, roots }),
        'training.arena-' + kind,
      ),
    );
  const ready = !!s;
  useEffect(() => {
    if (modelImport && ready) fileInput.current?.focus();
  }, [modelImport, ready]);
  if (!s)
    return (
      <p role={error ? 'alert' : 'status'}>
        {error || 'Speicher wird gelesen …'}
      </p>
    );
  const cps = s.meta
      .filter((m) => m.kind === 'checkpoint')
      .sort((a, b) => b.created - a.created),
    selected = cps.find((x) => x.id === ck) ?? cps[0],
    owner = runs.data?.find(
      (r) =>
        selected &&
        (r.latest === selected.id ||
          r.milestones.includes(selected.id) ||
          r.automatic.includes(selected.id)),
    );
  const trash = models.filter((p) => p.trashedAt),
    roots = s.meta.filter((m) => m.root && m.kind !== 'pin').map((m) => m.id);
  const categories = new Map<string, number>();
  for (const m of s.meta)
    categories.set(m.kind, (categories.get(m.kind) ?? 0) + m.size);
  return (
    <>
      <section className="lab-panel">
        <div className="panel-title">
          <h2>Lokaler Speicher</h2>
          <button onClick={() => setRefresh((n) => n + 1)}>
            Aktualisieren
          </button>
        </div>
        <dl className="metrics">
          <div>
            <dt>Verwaltete Objekte</dt>
            <dd>{number(s.meta.length)}</dd>
          </div>
          <div>
            <dt>Objektdaten</dt>
            <dd>{bytes(s.status.total)}</dd>
          </div>
          <div>
            <dt>ARENA-Budget</dt>
            <dd>{bytes(s.status.budget)}</dd>
          </div>
          <div>
            <dt>Browserbelegung</dt>
            <dd>{s.quota.usage === undefined ? '–' : bytes(s.quota.usage)}</dd>
          </div>
          <div>
            <dt>Browserquote</dt>
            <dd>{s.quota.quota === undefined ? '–' : bytes(s.quota.quota)}</dd>
          </div>
        </dl>
        <p>
          Ursprung <code>{location.origin}</code> ·{' '}
          {s.persistent
            ? 'dauerhafter Browserspeicher'
            : 'Browserspeicher unterliegt der Freigabe durch den Browser'}
        </p>
        <details>
          <summary>Belegung nach Objektart</summary>
          <dl className="facts">
            {[...categories]
              .sort((a, b) => b[1] - a[1])
              .map(([kind, size]) => (
                <div key={kind}>
                  <dt>{kind}</dt>
                  <dd>{bytes(size)}</dd>
                </div>
              ))}
          </dl>
        </details>
        <div className="toolbar">
          <NumberField
            name="Festplattenbudget (MiB)"
            min={1}
            value={budget ?? s.status.budget / 1048576}
            change={setBudget}
          />
          <button
            disabled={budget === undefined}
            onClick={() =>
              act(() =>
                lab.call({
                  type: 'diskBudget',
                  bytes: Math.floor(budget! * 1048576),
                }),
              )
            }
          >
            Budget speichern
          </button>
          <button
            onClick={() =>
              act(async () => {
                setInfo(
                  (await navigator.storage.persist())
                    ? 'Dauerhafte Speicherung bestätigt.'
                    : 'Der Browser hat die dauerhafte Speicherung nicht zugesagt.',
                );
              })
            }
          >
            Dauerhafte Speicherung anfordern
          </button>
          <button
            onClick={() =>
              act(async () => {
                await lab.call({ type: 'integrity' });
                setInfo('Integritätsprüfung abgeschlossen.');
              })
            }
          >
            Integrität prüfen
          </button>
        </div>
        {info && <p role="status">{info}</p>}
      </section>
      <section className="lab-panel">
        <div className="panel-title">
          <h2>Checkpoints</h2>
          <span>{cps.length} gespeichert</span>
        </div>
        {selected ? (
          <>
            <label>
              Speicherstand
              <select
                value={selected.id}
                onChange={(e) => setCk(e.target.value)}
              >
                {cps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {new Date(m.created).toLocaleString('de-AT')} · {m.id}
                  </option>
                ))}
              </select>
            </label>
            {owner && (
              <p>
                Lauf <code>{owner.id}</code> · {owner.globalGeneration}{' '}
                bestätigte Generationen ·{' '}
                {owner.latest === selected.id
                  ? 'Letzter Stand'
                  : 'Älterer Stand'}
              </p>
            )}
            <div className="toolbar">
              <RecoveryControls
                key={selected.id}
                id={selected.id}
                active={active}
                act={act}
                fork={!owner || owner.latest !== selected.id || owner.terminal}
              />
              <button onClick={() => exp('checkpoint', [selected.id])}>
                Checkpoint exportieren
              </button>
              {owner && (
                <button
                  disabled={active}
                  onClick={() =>
                    act(async () => {
                      const found = await lab.call<{
                        id: string;
                        failures: { id: string; reason: string }[];
                      }>({ type: 'findRecovery', run: owner.id });
                      setCk(found.id);
                      setInfo(
                        found.failures.length
                          ? 'Früherer lesbarer Stand gewählt. Übersprungene Stände: ' +
                              found.failures
                                .map((f) => f.id + ' ' + f.reason)
                                .join(', ')
                          : 'Letzter Stand vollständig geprüft.',
                      );
                    })
                  }
                >
                  Letzten lesbaren Stand suchen
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="empty">Noch keine dauerhaften Checkpoints.</p>
        )}
      </section>
      <div className="lab-columns">
        <section className="lab-panel">
          <h2>Datentransfer</h2>
          <button disabled={!roots.length} onClick={() => exp('backup', roots)}>
            Vollständiges Backup exportieren
          </button>
          <label>
            Paket zur Prüfung öffnen
            <input
              ref={fileInput}
              type="file"
              accept={
                modelImport
                  ? '.arena-model'
                  : '.arena-model,.arena-checkpoint,.arena-backup,.zip'
              }
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(undefined);
                setVariant(false);
                if (file)
                  act(async () => {
                    const result = await lab.call<Preview>({
                      type: 'previewImport',
                      file,
                    });
                    if (modelImport && result.type !== 'model')
                      throw Error(
                        'Für diesen Einstieg ein Modellpaket auswählen.',
                      );
                    setPreview(result);
                  });
                e.target.value = '';
              }}
            />
          </label>
          {preview && (
            <>
              <p>
                {preview.type} · {number(preview.objects)} Objekte ·{' '}
                {bytes(preview.size)} · {preview.conflicts.length} ID-Konflikte
              </p>
              <label className="check">
                <input
                  type="checkbox"
                  checked={variant}
                  onChange={(e) => setVariant(e.target.checked)}
                />
                Als eigenständige Variante importieren
              </label>
              <button
                disabled={!!preview.conflicts.length && !variant}
                onClick={() =>
                  act(async () => {
                    await lab.call({
                      type: 'import',
                      previewId: preview.id,
                      variant,
                    });
                    setPreview(undefined);
                    setInfo('Import abgeschlossen.');
                  })
                }
              >
                Geprüftes Paket importieren
              </button>
            </>
          )}
        </section>
        <section className="lab-panel">
          <h2>Papierkorb</h2>
          {!!trash.length && (
            <button
              onClick={() =>
                act(async () => {
                  const result = await lab.call<{
                    ids: string[];
                    value: Removal | null;
                  }>({ type: 'previewExpired' });
                  setRemoval(
                    result.value
                      ? { ids: result.ids, value: result.value }
                      : undefined,
                  );
                  setInfo(
                    result.value
                      ? 'Löschvorschau für abgelaufene Modelle geöffnet.'
                      : 'Keine abgelaufenen, freigegebenen Modelle.',
                  );
                })
              }
            >
              Abgelaufene Modelle prüfen
            </button>
          )}
          {trash.length ? (
            trash.map((p) => (
              <div key={p.id}>
                <strong>{p.name}</strong>
                <p>
                  Im Papierkorb seit{' '}
                  {new Date(p.trashedAt!).toLocaleDateString('de-AT')}. Reguläre
                  Aufbewahrung bis{' '}
                  {new Date(p.trashedAt! + 30 * 86400000).toLocaleDateString(
                    'de-AT',
                  )}
                  .
                </p>
                <div className="toolbar">
                  <button
                    onClick={() =>
                      act(() =>
                        lab.call({
                          type: 'profile',
                          id: p.id,
                          changes: { trashedAt: null },
                        }),
                      )
                    }
                  >
                    Wiederherstellen
                  </button>
                  <button
                    onClick={() =>
                      act(async () =>
                        setRemoval({
                          ids: [p.id],
                          value: await lab.call({
                            type: 'previewDelete',
                            ids: [p.id],
                          }),
                        }),
                      )
                    }
                  >
                    Löschumfang prüfen
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="empty">Der Papierkorb ist leer.</p>
          )}
          {removal && (
            <div className="lab-alert">
              <p>
                {number(removal.value.remove.length)} Objekte,{' '}
                {bytes(removal.value.bytes)} freigebbar.
              </p>
              <details>
                <summary>Betroffene Objekte</summary>
                <pre>{removal.value.remove.join('\n')}</pre>
              </details>
              <button
                onClick={() =>
                  act(async () => {
                    await lab.call({
                      type: 'purge',
                      ids: removal.ids,
                      revision: removal.value.revision,
                    });
                    setRemoval(undefined);
                  })
                }
              >
                Endgültig löschen
              </button>
              <button onClick={() => setRemoval(undefined)}>Behalten</button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
