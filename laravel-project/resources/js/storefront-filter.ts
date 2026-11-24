export type StoreFilter = 'all' | 'physical_product' | 'service';
type StoreListing = { type: string; title: string; description: string; category: { name: string } };

export function filterStoreListings<T extends StoreListing>(
  listings: readonly T[], filter: StoreFilter, category: string, query: string,
): T[] {
  const search = query.trim().toLocaleLowerCase();
  return listings.filter(listing =>
    (filter === 'all' || listing.type === filter) &&
    (category === 'all' || listing.category.name === category) &&
    (!search || [listing.title, listing.description, listing.category.name]
      .some(value => value.toLocaleLowerCase().includes(search))));
}
