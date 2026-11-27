import { preflight, type Draft } from './runConfig';
import { fingerprint } from './fingerprint';
import { describeVersion } from '../storage/library';
import { decode, jsonObject, type StorePort } from '../storage/objects';

export interface QueueEntry {
  id: string;
  revision: number;
  draft: Draft;
  autoStart: boolean;
  series?: string;
}
export interface QueueState {
  version?: number;
  enabled: boolean;
  entries: QueueEntry[];
}
const key = 'queue:main';
export async function queue(db: StorePort): Promise<QueueState> {
  const r = await db.get(key);
  return r ? decode(r) : { enabled: false, entries: [] };
}
export async function writeQueue(db: StorePort, s: QueueState, h?: number) {
  const obj = await prepareQueue(db, s, h);
  await db.commit([obj], { replace: [key] });
}
export async function prepareQueue(db: StorePort, s: QueueState, h?: number) {
  const previous = await queue(db);
  if ((s.version ?? 0) !== (previous.version ?? 0))
    throw Error(
      'Warteschlange wurde inzwischen geändert. Neu laden und erneut bearbeiten.',
    );
  const refs = validateQueue(s, h);
  for (const e of s.entries)
    if (e.draft.sourceVersion) {
      const { manifest } = await describeVersion(db, e.draft.sourceVersion),
        { m } = preflight(e.draft, fingerprint, h);
      if (
        manifest.modelKey !== m.key ||
        manifest.model.weightLimit !== m.weightLimit ||
        manifest.model.biasLimit !== m.biasLimit
      )
        throw Error('Wartender Auftrag hat einen inkompatiblen Modellvertrag.');
    }
  return jsonObject(
    'queue',
    key,
    { ...s, version: (previous.version ?? 0) + 1 },
    refs,
    true,
  );
}
export function validateQueue(s: QueueState, h?: number) {
  if (
    typeof s.enabled !== 'boolean' ||
    !Array.isArray(s.entries) ||
    s.entries.length > 32 ||
    new Set(s.entries.map((x) => x.id)).size !== s.entries.length
  )
    throw Error('Maximal 32 wartende Läufe.');
  const refs: string[] = [];
  for (const e of s.entries) {
    if (
      typeof e.id !== 'string' ||
      !e.id ||
      !Number.isSafeInteger(e.revision) ||
      e.revision < 1 ||
      typeof e.autoStart !== 'boolean'
    )
      throw Error('Ungültiger Warteschlangeneintrag.');
    preflight(e.draft, fingerprint, h);
    if (e.draft.sourceVersion) refs.push(e.draft.sourceVersion);
  }
  return refs;
}
export function seriesDrafts(
  draft: Draft,
  axis: 'mutation.p' | 'mutation.alpha' | 'tournament',
  values: number[],
  seeds: number[],
  maxEvaluations: number,
) {
  const count = values.length * seeds.length,
    perGeneration = (draft.options.n ?? 128) * draft.scenarios.length,
    budget =
      count *
      perGeneration *
      Math.min(
        draft.options.generations ?? 100,
        Math.floor(
          (draft.options.budget ?? Number.MAX_SAFE_INTEGER) / perGeneration,
        ),
      );
  if (
    !count ||
    !Number.isSafeInteger(budget) ||
    count > 32 ||
    !Number.isSafeInteger(maxEvaluations) ||
    budget > maxEvaluations
  )
    throw Error('Serienbudget überschritten.');
  const series = crypto.randomUUID();
  return {
    count,
    budget,
    entries: values.flatMap((value) =>
      seeds.map((master) => {
        const next = structuredClone(draft);
        next.options.master = master;
        if (axis === 'tournament') next.options.tournament = value;
        else if (axis === 'mutation.p' || axis === 'mutation.alpha')
          next.options.mutation = {
            ...next.options.mutation,
            [axis === 'mutation.p' ? 'p' : 'alpha']: value,
          };
        else throw Error('Unbekannte Serienachse.');
        return {
          id: crypto.randomUUID(),
          series,
          revision: 1,
          draft: next,
          autoStart: false,
        };
      }),
    ),
  };
}
