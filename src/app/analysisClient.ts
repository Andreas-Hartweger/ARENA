import type { AnalysisRequest, AnalysisResult } from '../runtime/analysis';
let occupied = false;
export async function analyzeVersions(input: AnalysisRequest) {
  if (occupied) throw Error('Eine Vergleichsfahrt ist bereits aktiv.');
  const worker = new Worker(
    new URL('../runtime/analysis.worker.ts', import.meta.url),
    { type: 'module' },
  );
  occupied = true;
  try {
    return await new Promise<AnalysisResult>((resolve, reject) => {
      worker.onmessage = (e) =>
        e.data.ok ? resolve(e.data.result) : reject(Error(e.data.error));
      worker.onerror = (e) => reject(Error(e.message));
      worker.onmessageerror = () =>
        reject(Error('Analyseergebnis konnte nicht gelesen werden.'));
      worker.postMessage(input);
    });
  } finally {
    worker.terminate();
    occupied = false;
  }
}
