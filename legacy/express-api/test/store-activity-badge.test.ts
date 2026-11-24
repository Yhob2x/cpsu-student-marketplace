import { describe, expect, test } from 'bun:test';
import { storeActivityBadge } from '../src/store-activity-badge.js';

describe('store activity badge', () => {
  test('new store has no invented experience', () => {
    expect(storeActivityBadge({ publishedListingCount: 0, followerCount: 0 }).label).toBe('New store');
  });
  test('published listings determine activity tiers', () => {
    expect(storeActivityBadge({ publishedListingCount: 1, followerCount: 0 }).label).toBe('Active seller');
    expect(storeActivityBadge({ publishedListingCount: 4, followerCount: 19 }).label).toBe('Active seller');
    expect(storeActivityBadge({ publishedListingCount: 5, followerCount: 0 }).label).toBe('Frequent seller');
  });
  test('real followers can signal popularity but not replace publishing activity', () => {
    expect(storeActivityBadge({ publishedListingCount: 1, followerCount: 20 }).label).toBe('Popular store');
    expect(storeActivityBadge({ publishedListingCount: 0, followerCount: 500 }).label).toBe('New store');
  });
  test('unavailable follower data is not treated as zero and is not shown', () => {
    const badge = storeActivityBadge({ publishedListingCount: 6, followerCount: null });
    expect(badge.label).toBe('Frequent seller');
    expect(badge.reason).not.toContain('follower');
    expect(badge.reason).toContain('not a verification or safety guarantee');
  });
});
