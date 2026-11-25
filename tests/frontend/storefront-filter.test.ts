import { describe, expect, test } from 'bun:test';
import { filterStoreListings } from '../../resources/js/lib/stores/storefront-filter';

const listings = [
  { id: 1, type: 'physical_product', title: 'Used physics book', description: 'A good review book', category: { name: 'Books' } },
  { id: 2, type: 'service', title: 'Graduation photography', description: 'CPSU campus portraits', category: { name: 'Photography' } },
  { id: 3, type: 'physical_product', title: 'Camera tripod', description: 'Camera accessory', category: { name: 'Accessories' } },
];
describe('seller storefront catalog filters', () => {
  test('all tab preserves only this seller\'s supplied listings', () =>
    expect(filterStoreListings(listings, 'all', 'all', '').map(x => x.id)).toEqual([1, 2, 3]));
  test('product and service tabs filter independently', () => {
    expect(filterStoreListings(listings, 'physical_product', 'all', '').map(x => x.id)).toEqual([1, 3]);
    expect(filterStoreListings(listings, 'service', 'all', '').map(x => x.id)).toEqual([2]);
  });
  test('category and case-insensitive search combine correctly', () => {
    expect(filterStoreListings(listings, 'all', 'Books', ' PHYSICS ').map(x => x.id)).toEqual([1]);
    expect(filterStoreListings(listings, 'service', 'Photography', 'portraits').map(x => x.id)).toEqual([2]);
    expect(filterStoreListings(listings, 'physical_product', 'Photography', '').map(x => x.id)).toEqual([]);
  });
  test('empty or unmatched result does not fabricate listings', () => {
    expect(filterStoreListings([], 'all', 'all', '')).toEqual([]);
    expect(filterStoreListings(listings, 'all', 'all', 'no such item')).toEqual([]);
  });
});
