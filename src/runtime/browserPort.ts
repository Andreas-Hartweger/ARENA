import type { ComputePort, WorkerEvent } from './compute';
export function browserPort(): ComputePort {
  const worker = new Worker(new URL('./episode.worker.ts', import.meta.url), {
    type: 'module',
  });
  return {
    send: (msg, buffers = []) => worker.postMessage(msg, buffers),
    close: () => worker.terminate(),
    listen: (event, fault) => {
      worker.onmessage = (msg: MessageEvent<WorkerEvent>) => event(msg.data);
      worker.onerror = (error) => fault(Error(error.message));
      worker.onmessageerror = () =>
        fault(Error('Cannot decode worker message'));
    },
  };
}
