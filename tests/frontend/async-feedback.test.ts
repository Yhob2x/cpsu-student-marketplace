import { describe, expect, test } from 'bun:test';
import { uploadEstimate, uploadPercent } from '../../resources/js/lib/listings/upload-feedback';
import { withSavedListing } from '../../resources/js/lib/listings/saved-state';

describe('truthful progress and optimistic saved items', () => {
  test('tracks only confirmed completed photos, never simulated byte progress', () => {
    expect(uploadPercent(0, 5)).toBe(0);
    expect(uploadPercent(2, 5)).toBe(40);
    expect(uploadPercent(5, 5)).toBe(100);
    expect(uploadPercent(9, 5)).toBe(100);
    expect(uploadPercent(0, 0)).toBe(0);
  });
  test('withholds ETA until measured completion and decreases it as time passes', () => {
    expect(uploadEstimate(0, 5, 0)).toContain('Estimating');
    expect(uploadEstimate(1, 5, 800)).toContain('Estimating');
    expect(uploadEstimate(1, 5, 5000, 0)).toBe('About 20s left');
    expect(uploadEstimate(1, 5, 5000, 7000)).toBe('About 13s left');
    expect(uploadEstimate(5, 5, 25000)).toBe('All photos uploaded');
  });
  test('optimistic hearts are idempotent and rollback affects only one item', () => {
    const original = [3, 7];
    const optimistic = withSavedListing(original, 11, true);
    expect(optimistic).toEqual([3, 7, 11]);
    expect(withSavedListing(optimistic, 11, true)).toEqual(optimistic);
    expect(withSavedListing(optimistic, 11, false)).toEqual(original);
    expect(withSavedListing(original, 3, false)).toEqual([7]);
    expect(original).toEqual([3, 7]);
  });
});
