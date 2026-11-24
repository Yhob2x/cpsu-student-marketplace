import { describe, expect, test } from 'bun:test';
import { storeListingPageInput, storeListingPageQuery, storeListingPageResult } from '../src/store-listing-pages.js';

describe('opt-in public store listing pagination', () => {
  test('bounded id-window query with lookahead and stable ordering', () => {
    expect(storeListingPageQuery(24)).toEqual({ orderBy: { id: 'desc' }, take: 25 });
    expect(storeListingPageQuery(24, 103)).toEqual({ id: { lt: 103 }, orderBy: { id: 'desc' }, take: 25 });
  });
  test('returns only requested results and a cursor for next page', () => {
    expect(storeListingPageResult([{ id: 50 }, { id: 48 }, { id: 46 }], 2)).toEqual({
      items: [{ id: 50 }, { id: 48 }], hasMoreListings: true, nextListingBeforeId: 48,
    });
    expect(storeListingPageResult([{ id: 8 }], 2)).toEqual({
      items: [{ id: 8 }], hasMoreListings: false, nextListingBeforeId: null,
    });
  });
  test('rejects invalid controls and preserves no-parameter legacy requests', () => {
    expect(storeListingPageInput.parse({})).toEqual({});
    expect(storeListingPageInput.parse({ limit: '24', beforeId: '10' })).toEqual({ limit: 24, beforeId: 10 });
    for (const input of [{ limit: '0' }, { limit: '49' }, { beforeId: '5' },
      { limit: '24', beforeId: '-1' }, { limit: '25', beforeId: '999999999999' }]) {
      expect(storeListingPageInput.safeParse(input).success).toBe(false);
    }
  });
});
