import { analyze, type AnalysisRequest } from './analysis';
import { TrainingDatabase } from '../storage/database';
self.onmessage = async (event: MessageEvent<AnalysisRequest>) => {
  let db: TrainingDatabase | undefined;
  try {
    db = await TrainingDatabase.open();
    postMessage({ ok: true, result: await analyze(db, event.data) });
  } catch (error) {
    postMessage({ ok: false, error: String(error) });
  } finally {
    db?.close();
    self.close();
  }
};
