import { parentPort } from 'node:worker_threads';
import { setImmediate, setTimeout } from 'node:timers';
import { digest } from './evolution-runtime.mjs';
const { simulationWorker } = await import('../src/runtime/simulationWorker.ts');
const receive = simulationWorker(
  digest,
  (event) => parentPort.postMessage(event),
  (fn, ms) => (ms > 0 ? setTimeout(fn, ms) : setImmediate(fn)),
  () => parentPort.close(),
);
parentPort.on('message', receive);
