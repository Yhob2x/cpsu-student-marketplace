/** Maximum photos per marketplace listing (product or service). */
export const MAX_LISTING_PHOTOS = 5;

/** Existing legacy listings above this limit remain readable but cannot add photos. */
export function canAddListingPhoto(existingPhotoCount: number): boolean {
  return Number.isSafeInteger(existingPhotoCount) && existingPhotoCount >= 0 && existingPhotoCount < MAX_LISTING_PHOTOS;
}
