import { describe, expect, test } from 'bun:test';
import { categoriesForExplore, cleanExploreQuery, explorePriceError, updateExploreQuery } from '../src/explore-filters';

const cats = [
  {id: 1, name: 'Handmade goods', listingType: 'physical_product' as const},
  {id: 2, name: 'Pre-loved items', listingType: 'physical_product' as const},
  {id: 3, name: 'Tutoring', listingType: 'service' as const},
  {id: 4, name: 'Photography & video', listingType: 'service' as const},
];
describe('Explore filtering rules', () => {
  test('shows only categories matching the selected type', () => {
    expect(categoriesForExplore(cats, 'service').map(c => c.name)).toEqual(['Tutoring', 'Photography & video']);
    expect(categoriesForExplore(cats, 'physical_product').length).toBe(2);
    expect(categoriesForExplore(cats, '').length).toBe(4);
  });
  test('switching to Services clears a product category and condition and resets page', () => {
    const next = updateExploreQuery(new URLSearchParams('type=physical_product&categoryId=2&condition=good&page=3&q=notes'),
      'type', 'service', cats);
    expect(next.toString()).toBe('type=service&q=notes');
  });
  test('selecting a product condition switches type and clears an incompatible category', () => {
    const next = updateExploreQuery(new URLSearchParams('type=service&categoryId=3'),
      'condition', 'new', cats);
    expect(next.get('type')).toBe('physical_product');
    expect(next.get('categoryId')).toBeNull();
    expect(next.get('condition')).toBe('new');
  });
  test('sort and filter change discard stale pagination and preserve other parameters', () => {
    const next = updateExploreQuery(new URLSearchParams('q=math&page=8&campusId=7'),
      'sort', 'price_asc', cats);
    expect(next.get('page')).toBeNull();
    expect(next.get('q')).toBe('math');
    expect(next.get('campusId')).toBe('7');
    expect(next.get('sort')).toBe('price_asc');
  });
  test('canonicalizes incompatible shared links', () => {
    expect(cleanExploreQuery(new URLSearchParams('type=service&categoryId=2&condition=good'), cats).toString())
      .toBe('type=service');
  });
  test('rejects reversed, fractional, negative and non-finite prices while allowing empty and zero', () => {
    expect(explorePriceError('1000','1')).toMatch(/Minimum price/);
    expect(explorePriceError('-1','')).toMatch(/whole numbers/);
    expect(explorePriceError('1.5','')).toMatch(/whole numbers/);
    expect(explorePriceError('Infinity','')).toMatch(/whole numbers/);
    expect(explorePriceError('','')).toBe('');
    expect(explorePriceError('0','100')).toBe('');
  });
});
