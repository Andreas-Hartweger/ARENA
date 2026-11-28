import assert from 'node:assert/strict';
import process from 'node:process';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  caps,
  trainingCaps,
  experiment,
  matrixHash,
  hashJSON,
} from './manifest.mjs';
import { ResearchLedger, campaign } from './ledger.mjs';
import { runExperiment } from './coordinator.mjs';
import { nodeComputePort } from '../node-compute-port.mjs';
import { ActiveTime } from './campaign.mjs';
const [dir, mode] = process.argv.slice(2);
const spec = campaign('qa', matrixHash, '1'.repeat(40), [
  { id: 'test', total: caps, training: trainingCaps },
]);
const db = new ResearchLedger(join(dir, 'qa.sqlite'), spec, 'test');
db.claim({ recover: mode === 'resume' });
const clock = new ActiveTime(db, { experimentId: 'technical-recovery' });
const workers = mode === 'serial' ? 1 : 2,
  id = mode === 'serial' ? 'serial' : 'resume';
const def = globalThis.structuredClone(
  experiment('B-evolution-43', 'qa', workers, 8).definition,
);
def.experimentId = id;
def.episodeBudget = 24;
Object.assign(def.draft.options, { n: 8, generations: 3, budget: 24 });
def.draft.scenarios = [{ task: { maxTicks: 65, graceTicks: 0 } }];
def.configHash = hashJSON(def.draft);
const entry = { definition: def, hash: hashJSON(def) };
let injected = false;
const factory = () => {
  const port = nodeComputePort();
  let lose = false;
  return {
    send(msg, buffers) {
      if (mode === 'resume' && !injected && msg.type === 'assign') {
        injected = true;
        lose = true;
      }
      port.send(msg, buffers);
    },
    listen(event, fault) {
      port.listen((msg) => {
        if (lose && msg.type === 'result') {
          lose = false;
          fault(Error('test: lost response after real physics'));
        } else event(msg);
      }, fault);
    },
    close: () => port.close(),
  };
};
try {
  const state = await runExperiment(db, entry, clock, {
    hardware: 8,
    portFactory: factory,
    onState: (s) => {
      if (mode === 'crash' && s.generation === 1 && s.durableGeneration === 1)
        process.exit(73);
    },
  });
  assert.equal(state.phase, 'Completed', state.error);
  const rows = db.db.prepare(
    'SELECT generation,bytes FROM chunks WHERE experiment=? ORDER BY generation',
  );
  const scores = (id) =>
    rows.all(id).map((r) =>
      gunzipSync(r.bytes)
        .toString()
        .trim()
        .split('\n')
        .map((line) => {
          const d = JSON.parse(line);
          return [
            d.hash,
            d.score,
            d.episodes.map((e) => [e.tick, e.raw, e.fitness]),
          ];
        }),
    );
  if (mode === 'resume') {
    assert.deepEqual(scores('serial'), scores('resume'));
    assert.equal(db.usage().charged.episodes, 48);
    assert.equal(db.usage().charged.ticks, 49 * 65);
    assert(injected);
  }
  clock.finish();
  db.release();
} finally {
  db.close();
}
