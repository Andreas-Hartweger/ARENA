import { Worker } from 'node:worker_threads';
export function nodeComputePort() {
  const worker = new Worker(new URL('./episode-worker.mjs', import.meta.url), {
    execArgv: [],
  });
  let closed = false;
  return {
    send: (msg, buffers = []) => worker.postMessage(msg, buffers),
    close: () => {
      closed = true;
      void worker.terminate();
    },
    listen: (event, fault) => {
      worker.on('message', event);
      worker.on('error', fault);
      worker.on('exit', (code) => {
        if (!closed) fault(Error('Worker exited with code ' + code));
      });
    },
  };
}
import { URL } from 'node:url';
