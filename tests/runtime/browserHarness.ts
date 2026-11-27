import { LabClient } from '../../src/app/labClient';
import { defaultDraft } from '../../src/runtime/runConfig';
import type { RunState } from '../../src/runtime/controller';
import type { RunIndex } from '../../src/storage/checkpoint';
import type { ObjectMeta } from '../../src/storage/objects';

function probe() {
  const client = new LabClient();
  const status = async () => {
    const state = await client.call<RunState>({ type: 'status' }),
      storage = await client.call<{ status: unknown; meta: ObjectMeta[] }>({
        type: 'storage',
      });
    return { state, storage: storage.status, records: storage.meta.length };
  };
  return {
    async start(long: boolean) {
      const d = defaultDraft();
      d.profile = 'Custom';
      d.custom = {
        managedMiB: 512,
        workers: Math.min(2, Math.max(1, navigator.hardwareConcurrency - 2)),
      };
      d.options = {
        ...d.options,
        n: long ? 16 : 8,
        generations: long ? 100000 : 4,
      };
      if (!long)
        d.scenarios = [
          { task: { maxTicks: 180, graceTicks: 20, noProgressTicks: 180 } },
        ];
      await client.call({ type: 'start', draft: d });
      return (await status()).state;
    },
    status,
    pause: () => client.call({ type: 'pause' }),
    resume: () => client.call({ type: 'resume' }),
    finish: () => client.call({ type: 'finish' }),
    async verify() {
      const [run] = await client.call<RunIndex[]>({ type: 'checkpoints' }),
        storage = await client.call<{ meta: ObjectMeta[] }>({
          type: 'storage',
        });
      if (
        !run.terminal ||
        run.automatic.length !== 3 ||
        run.globalGeneration < 3
      )
        throw Error('Missing durable boundaries');
      return {
        run,
        checkpoints: storage.meta.filter((x) => x.kind === 'checkpoint').length,
      };
    },
    close: () => client.close(),
  };
}
Object.assign(window, { probe });
