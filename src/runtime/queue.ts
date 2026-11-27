import { preflight, type Draft } from './runConfig';
import { fingerprint } from './fingerprint';
import { decode, jsonObject, type StorePort } from '../storage/objects';

export interface QueueEntry {
  id: string;
  revision: number;
  draft: Draft;
  autoStart: boolean;
  series?: string;
}
export interface QueueState {
  enabled: boolean;
  entries: QueueEntry[];
}
const key = 'queue:main';
export async function queue(db: StorePort): Promise<QueueState> {
  const r = await db.get(key);
  return r ? decode(r) : { enabled: false, entries: [] };
}
export async function writeQueue(db: StorePort, s: QueueState, h?: number) {
  if (
    s.entries.length > 32 ||
    new Set(s.entries.map((x) => x.id)).size !== s.entries.length
  )
    throw Error('Maximal 32 wartende Läufe.');
  const refs: string[] = [];
  for (const e of s.entries) {
    preflight(e.draft, fingerprint, h);
    if (e.draft.sourceVersion) refs.push(e.draft.sourceVersion);
  }
  await db.commit([jsonObject('queue', key, s, refs, true)], {
    replace: [key],
  });
}
export function seriesDrafts(
  draft: Draft,
  axis: 'mutation.p' | 'mutation.alpha' | 'tournament',
  values: number[],
  seeds: number[],
  maxEvaluations: number,
) {
  const count = values.length * seeds.length,
    budget =
      count *
      (draft.options.n ?? 128) *
      (draft.options.generations ?? 100) *
      draft.scenarios.length;
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
