import { fingerprint } from './fingerprint';
import { simulationWorker } from './simulationWorker';
import { taskQueue } from './taskQueue';
import type { WorkerCommand } from './compute';
const receive = simulationWorker(
  fingerprint,
  (event) => postMessage(event),
  taskQueue(),
  () => self.close(),
);
self.onmessage = (message: MessageEvent<WorkerCommand>) =>
  receive(message.data);
