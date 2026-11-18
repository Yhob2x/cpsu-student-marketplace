export type StoreSlugRow = { id: number; storeName: string };

export function storeNameSlug(name: string): string {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019']/g, '')
    .toLocaleLowerCase('en').replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'store';
}

export function canonicalStoreSlug(stores: StoreSlugRow[], store: StoreSlugRow): string {
  const base = storeNameSlug(store.storeName);
  // The earliest store keeps the readable name; later collisions get a stable ID suffix.
  const duplicate = base === 'store' || stores.some(row => row.id < store.id && storeNameSlug(row.storeName) === base);
  return duplicate ? `${base}--${store.id}` : base;
}

export function findStoreBySlug(stores: StoreSlugRow[], slug: string): StoreSlugRow | undefined {
  const canonical = stores.find(store => canonicalStoreSlug(stores, store) === slug);
  if (canonical) return canonical;
  // Keep links made by the earlier scheme, which suffixed every duplicate.
  return stores.find(store => {
    const base = storeNameSlug(store.storeName);
    return base !== 'store' && `${base}--${store.id}` === slug &&
      stores.some(other => other.id !== store.id && storeNameSlug(other.storeName) === base);
  });
}
