import type { Capability } from '../research/validation';
import type { ModelFreeze, PromotionReview } from './capabilities';

export interface ReleasedModel {
  freeze: ModelFreeze;
  review: PromotionReview;
  packageUrl: string;
  packageSHA256: string;
  evidenceUrl: string;
  evidenceSHA256: string;
}

// Release entries are reviewed repository assets. User-imported metadata cannot add an entry.
export const releaseCatalog: Readonly<
  Partial<Record<Capability, ReleasedModel>>
> = Object.freeze({});
