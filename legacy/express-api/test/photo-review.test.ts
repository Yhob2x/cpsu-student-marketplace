import { describe, expect, test } from 'bun:test';
import { requirePhotoReview } from '../src/photo-review.js';

describe('server human-photo-review gate', () => {
  test('approval fails without a reviewer attestation', () => {
    expect(() => requirePhotoReview('approved', undefined, 2))
      .toThrow('Inspect all listing photos');
  });
  test('approval fails if attestation is false', () => {
    expect(() => requirePhotoReview('approved', false, 2))
      .toThrow('Inspect all listing photos');
  });
  test('approval fails if a listing has no photos', () => {
    expect(() => requirePhotoReview('approved', true, 0))
      .toThrow('Inspect all listing photos');
  });
  test('approval accepts an explicit true and at least one photo', () => {
    expect(() => requirePhotoReview('approved', true, 1)).not.toThrow();
  });
  test('request changes and reject never require an approval attestation', () => {
    expect(() => requirePhotoReview('changes_requested', undefined, 0)).not.toThrow();
    expect(() => requirePhotoReview('rejected', undefined, 0)).not.toThrow();
  });
});
