function reference(
  workers: number,
  small: boolean,
  benchmark?: object,
  capture = false,
) {
  const worker = new Worker(new URL('./reference.worker.ts', import.meta.url), {
    type: 'module',
  });
  const rows: { type: string }[] = [];
  worker.onerror = (e) =>
    rows.push({ type: 'fault', ...{ message: e.message } });
  worker.onmessage = (e) => {
    rows.push(e.data);
    if (e.data.type === 'end' || e.data.type === 'fault') worker.terminate();
  };
  worker.postMessage({ workers, small, benchmark, capture });
  return { poll: () => rows.splice(0) };
}
import { runtimeProbe } from '../training/runtimeProbe';
import { fingerprint } from '../../src/runtime/fingerprint';
Object.assign(window, {
  reference,
  runtimeProbe: () => runtimeProbe(fingerprint),
});
