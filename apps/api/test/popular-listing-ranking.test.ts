import { expect, test } from 'bun:test';
import { popularListingOrderBy } from '../src/popular-listing-ranking.js';

test('popular ranking uses genuine saved count, then stable listing ID on ties', () => {
  expect(popularListingOrderBy).toEqual([
    { savedListings: { _count: 'desc' } },
    { id: 'desc' },
  ]);
});
