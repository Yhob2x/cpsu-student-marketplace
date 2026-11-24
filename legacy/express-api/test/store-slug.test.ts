import { expect, test } from 'bun:test';
import { canonicalStoreSlug, findStoreBySlug, storeNameSlug } from '../src/store-slug.js';

test('uses a readable store name and handles punctuation and accents', () => {
  expect(storeNameSlug('  Niño’s Craft & Co.  ')).toBe('ninos-craft-co');
  expect(storeNameSlug('KALABASA STORE')).toBe('kalabasa-store');
});

test('duplicate names get distinct addresses without confusing a naturally suffixed name', () => {
  const stores = [
    { id: 3, storeName: 'Campus Crafts' },
    { id: 9, storeName: 'Campus Crafts!' },
    { id: 12, storeName: 'Campus Crafts 3' },
  ];
  expect(canonicalStoreSlug(stores, stores[0])).toBe('campus-crafts');
  expect(canonicalStoreSlug(stores, stores[1])).toBe('campus-crafts--9');
  expect(canonicalStoreSlug(stores, stores[2])).toBe('campus-crafts-3');
  expect(findStoreBySlug(stores, 'campus-crafts--9')?.id).toBe(9);
  expect(findStoreBySlug(stores, 'campus-crafts')?.id).toBe(3);
  expect(findStoreBySlug(stores, 'campus-crafts--3')?.id).toBe(3);
});

test('non-Latin names remain usable and empty names get an ID-specific fallback', () => {
  const stores = [{ id: 4, storeName: '東京 店' }, { id: 5, storeName: '!!!' }];
  expect(canonicalStoreSlug(stores, stores[0])).toBe('東京-店');
  expect(canonicalStoreSlug(stores, stores[1])).toBe('store--5');
});
