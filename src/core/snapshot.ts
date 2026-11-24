export type SnapshotValue =
  | null
  | boolean
  | number
  | string
  | readonly SnapshotValue[]
  | { readonly [key: string]: SnapshotValue };

export interface SimulationSnapshot {
  readonly tickIndex: number;
  readonly discontinuity: boolean;
  readonly data: SnapshotValue;
}
