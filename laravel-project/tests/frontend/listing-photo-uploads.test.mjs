import { describe, expect, test } from 'bun:test';
import { MAX_LISTING_PHOTOS, selectedPhotosError, uploadListingPhotos } from '../../resources/js/listing-photo-uploads.ts';

const photo = (n = 1, type = 'image/png') => new File([new Uint8Array(n)], 'synthetic.png', { type });
const images = n => Array.from({ length: n }, () => photo());

describe('seller photo picker and sequential upload', () => {
  test('allows selecting 1 through 5 images for a new listing and zero in drafts', () => {
    expect(MAX_LISTING_PHOTOS).toBe(5);
    for (let n = 0; n <= 5; n++) expect(selectedPhotosError(images(n))).toBe('');
    expect(selectedPhotosError(images(6))).toContain('Select no more than 5');
  });

  test('caps additions by remaining slots for an existing listing', () => {
    expect(selectedPhotosError(images(2), 3)).toBe('');
    expect(selectedPhotosError(images(3), 3)).toContain('Select no more than 2');
    expect(selectedPhotosError(images(1), 5)).toContain('maximum');
    expect(selectedPhotosError(images(1), 6)).toContain('maximum');
  });

  test('validates every selected file before creating or editing a listing', () => {
    expect(selectedPhotosError([photo(), photo(3, 'application/pdf')])).toContain('JPEG');
    expect(selectedPhotosError([photo(), photo(3 * 1024 * 1024 + 1)])).toContain('3 MB');
    expect(selectedPhotosError([photo(0)])).toContain('3 MB');
  });

  test('uploads each selected photo in order, without parallel writes', async () => {
    let running = 0;
    const sent = [];
    const progress = [];
    const batch = images(5);
    const result = await uploadListingPhotos(12, batch, async (id, file) => {
      expect(id).toBe(12);
      expect(running).toBe(0);
      running++;
      await Promise.resolve();
      sent.push(file);
      running--;
    }, (done, total) => progress.push([done, total]));
    expect(result).toEqual({ uploaded: 5, failedIndex: null });
    expect(sent).toEqual(batch);
    expect(progress).toEqual([[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5]]);
  });

  test('stops after failure and reports the number already stored', async () => {
    const attempts = [];
    const result = await uploadListingPhotos(12, images(5), async (_, file) => {
      attempts.push(file);
      if (attempts.length === 3) throw new Error('Drive temporarily unavailable');
    });
    expect(attempts.length).toBe(3);
    expect(result.uploaded).toBe(2);
    expect(result.failedIndex).toBe(2);
    expect(String(result.error)).toContain('Drive temporarily unavailable');
  });
});
