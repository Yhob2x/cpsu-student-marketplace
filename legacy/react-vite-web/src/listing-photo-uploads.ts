// Keep the UI policy aligned with apps/api/src/listing-photo-limit.ts.
// Files are sent sequentially to the existing one-image-at-a-time authenticated API.
export const MAX_LISTING_PHOTOS = 5;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function selectedPhotosError(files: readonly File[], existingCount = 0): string {
  if (!Number.isSafeInteger(existingCount) || existingCount < 0) return 'Reload this listing before uploading photos.';
  const remaining = Math.max(0, MAX_LISTING_PHOTOS - existingCount);
  if (files.length > remaining) return remaining === 0
    ? 'This listing already has the maximum of 5 photos.'
    : `Select no more than ${remaining} additional ${remaining === 1 ? 'photo' : 'photos'} (${MAX_LISTING_PHOTOS} total per listing).`;
  if (files.some(file => !ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_PHOTO_BYTES))
    return 'Choose JPEG, PNG or WebP photos, each no larger than 3 MB.';
  return '';
}

export type PhotoBatchResult = { uploaded: number; failedIndex: number | null; error?: unknown };

export async function uploadListingPhotos(
  listingId: number,
  files: readonly File[],
  sendOne: (id: number, file: File) => Promise<unknown>,
  onProgress?: (completed: number, total: number) => void,
): Promise<PhotoBatchResult> {
  onProgress?.(0, files.length);
  for (let index = 0; index < files.length; index++) {
    try {
      // A single request per photo retains backend ownership, size and moderation gates.
      await sendOne(listingId, files[index]);
    } catch (error) {
      return { uploaded: index, failedIndex: index, error };
    }
    onProgress?.(index + 1, files.length);
  }
  return { uploaded: files.length, failedIndex: null };
}
