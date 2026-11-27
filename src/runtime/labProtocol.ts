import type { Draft } from './runConfig';
import type { Learning, RunState } from './controller';
import type { QueueState } from './queue';
import type { Profile } from '../storage/library';
import type { PackageType } from '../storage/transfer';
import type { WorkerEvent } from './compute';

export type LabCommand =
  | { type: 'start'; draft: Draft }
  | {
      type:
        | 'pause'
        | 'drain'
        | 'resume'
        | 'finish'
        | 'cancel'
        | 'retry'
        | 'save'
        | 'status'
        | 'library'
        | 'officialStarter'
        | 'storage'
        | 'queue';
    }
  | { type: 'history'; metric?: 'fitness' | 'laps' | 'diversity' | 'progress' }
  | { type: 'observe'; visible: number; slot: number | null }
  | {
      type: 'display';
      settings: Pick<Draft, 'mode' | 'rate' | 'profile' | 'custom'>;
    }
  | { type: 'revise'; learning: Learning; scenarios?: Draft['scenarios'] }
  | { type: 'currentDraft' | 'dispatchQueue' | 'samples' }
  | { type: 'cloneStarter'; name: string }
  | { type: 'version'; id: string }
  | { type: 'compatibility'; version: string; other?: string; draft: Draft }
  | {
      type: 'population';
      offset: number;
      limit: number;
      filter?: string;
      sort?: 'slot' | 'fitness' | 'progress' | 'lineage';
    }
  | { type: 'brain'; slot: number }
  | { type: 'checkpointInfo'; id: string }
  | { type: 'findRecovery'; run: string }
  | {
      type: 'recover';
      id: string;
      sourceStopped?: boolean;
      additionalActiveMs?: number;
    }
  | { type: 'create'; name: string; draft: Draft; source?: string }
  | { type: 'profile'; id: string; changes: Partial<Profile> }
  | {
      type: 'champion';
      profile: string;
      role?: 'champion' | 'generationBest' | 'lapRecord';
      scenario?: number;
    }
  | { type: 'compare'; a: string; b: string }
  | { type: 'drive'; version: string; draft: Draft }
  | { type: 'writeQueue'; value: QueueState }
  | { type: 'template'; name: string; draft: Draft }
  | { type: 'templates' }
  | { type: 'loadTemplate'; id: string }
  | { type: 'diskBudget'; bytes: number }
  | { type: 'previewExpired' }
  | { type: 'previewDelete'; ids: string[] }
  | { type: 'purge'; ids: string[]; revision: number }
  | { type: 'export'; kind: PackageType; roots: string[] }
  | { type: 'previewImport'; file: Blob }
  | { type: 'import'; previewId: string; variant: boolean }
  | { type: 'checkpoints' }
  | { type: 'integrity' };
export interface Envelope {
  version: 1;
  id: string;
  seq: number;
  session: string;
  command: LabCommand;
}
export type LabEvent =
  | { type: 'ready' }
  | { type: 'state'; state: RunState }
  | { type: 'observation'; sample: Extract<WorkerEvent, { type: 'progress' }> }
  | {
      type: 'ack';
      id: string;
      ok: boolean;
      value?: unknown;
      error?: string;
      session: string;
      seq: number;
    };
