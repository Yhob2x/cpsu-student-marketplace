import { HttpError } from './http.js';

/** A server-side human-review attestation gate, not automatic image moderation. */
export function requirePhotoReview(
  decision: 'approved' | 'changes_requested' | 'rejected',
  photosReviewed: boolean | undefined,
  photoCount: number,
) {
  if (decision !== 'approved') return;
  if (photosReviewed !== true || photoCount < 1) {
    throw new HttpError(
      422,
      'photo_review_required',
      'Inspect all listing photos and confirm they meet campus content rules before approval.',
    );
  }
}
