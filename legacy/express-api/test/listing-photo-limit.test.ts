import { describe, expect, test } from 'bun:test';
import { canAddListingPhoto, MAX_LISTING_PHOTOS } from '../src/listing-photo-limit.js';

describe('seller listing photo policy', () => {
  test('allows fewer than five photos and exactly the fifth photo', () => {
    expect(MAX_LISTING_PHOTOS).toBe(5);
    for (const count of [0, 1, 2, 3, 4]) expect(canAddListingPhoto(count)).toBe(true);
  });

  test('rejects a sixth photo and additional photos on legacy six-photo listings', () => {
    for (const count of [5, 6, 7]) expect(canAddListingPhoto(count)).toBe(false);
  });

  test('rejects invalid count input', () => {
    for (const count of [-1, 4.5, NaN, Infinity]) expect(canAddListingPhoto(count)).toBe(false);
  });
});
