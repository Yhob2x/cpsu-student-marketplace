import { describe, expect, test } from 'bun:test';
import { categoriesForKind, categoryMatchesKind } from '../../resources/js/lib/listings/listing-categories';

const categories = [
  { id: 1, name: 'Handmade goods', listingType: 'physical_product' },
  { id: 2, name: 'Tutoring', listingType: 'service' },
  { id: 3, name: 'Food & drinks', listingType: 'physical_product' },
  { id: 4, name: 'Tech & IT help', listingType: 'service' },
];

describe('new listing product/service categories', () => {
  test('requires an explicit listing kind before showing categories', () => {
    expect(categoriesForKind(categories, '')).toEqual([]);
    expect(categoryMatchesKind(categories[0], '')).toBe(false);
  });
  test('shows only categories of the selected kind', () => {
    expect(categoriesForKind(categories, 'physical_product').map(category => category.name))
      .toEqual(['Handmade goods', 'Food & drinks']);
    expect(categoriesForKind(categories, 'service').map(category => category.name))
      .toEqual(['Tutoring', 'Tech & IT help']);
  });
  test('prevents a stale category from another listing kind', () => {
    expect(categoryMatchesKind(categories[0], 'service')).toBe(false);
    expect(categoryMatchesKind(categories[1], 'service')).toBe(true);
    expect(categoryMatchesKind(null, 'service')).toBe(false);
  });
});
