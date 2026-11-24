export type ListingKind = 'physical_product' | 'service';

export function categoriesForKind<T extends { listingType: string }>(categories: T[], kind: ListingKind | ''): T[] {
  return kind ? categories.filter(category => category.listingType === kind) : [];
}

export function categoryMatchesKind(category: { listingType: string } | null | undefined, kind: ListingKind | ''): boolean {
  return Boolean(kind && category?.listingType === kind);
}
