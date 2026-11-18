export type ExploreListingType = '' | 'physical_product' | 'service';
export type ExploreCategory = { id: number; name: string; listingType: 'physical_product' | 'service' };
export type ExploreFilters = {
  q: string; campusId: string; categoryId: string; type: string;
  condition: string; minPrice: string; maxPrice: string; sort: string;
};
export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  q: '', campusId: '', categoryId: '', type: '', condition: '',
  minPrice: '', maxPrice: '', sort: 'newest',
};

export function categoriesForExplore(categories: readonly ExploreCategory[], type: string): ExploreCategory[] {
  return categories.filter(category => !type || category.listingType === type);
}

/** Validate without silently applying a different search than the entered prices. */
export function explorePriceError(minimum: string, maximum: string): string {
  const parse = (value: string) => value.trim() === '' ? null : Number(value);
  const min = parse(minimum);
  const max = parse(maximum);
  if ([min, max].some(value => value !== null &&
    (!Number.isSafeInteger(value) || value < 0))) {
    return 'Enter prices as whole numbers of pesos (0 or greater).';
  }
  if (min !== null && max !== null && min > max) {
    return 'Minimum price cannot exceed maximum price.';
  }
  return '';
}

export function updateExploreQuery(
  current: URLSearchParams, key: keyof ExploreFilters, value: string,
  categories: readonly ExploreCategory[],
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (!value || (key === 'sort' && value === 'newest')) next.delete(key);
  else next.set(key, value);
  // Changing filters or sort returns to the first page rather than an empty stale page.
  next.delete('page');
  if (key === 'type') {
    if (value !== 'physical_product') next.delete('condition');
    const chosen = categories.find(category => String(category.id) === next.get('categoryId'));
    if (chosen && (!value || chosen.listingType !== value)) next.delete('categoryId');
  }
  if (key === 'categoryId' && value) {
    const chosen = categories.find(category => String(category.id) === value);
    if (chosen && next.get('type') && chosen.listingType !== next.get('type')) {
      next.set('type', chosen.listingType);
    }
    if (chosen?.listingType === 'service') next.delete('condition');
  }
  if (key === 'condition' && value) {
    next.set('type', 'physical_product');
    const chosen = categories.find(category => String(category.id) === next.get('categoryId'));
    if (chosen && chosen.listingType !== 'physical_product') next.delete('categoryId');
  }
  return next;
}

/** Read-only canonicalization for incoming shared links or browser history. */
export function cleanExploreQuery(
  current: URLSearchParams, categories: readonly ExploreCategory[],
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (next.get('type') === 'service') next.delete('condition');
  const chosen = categories.find(category => String(category.id) === next.get('categoryId'));
  if (chosen && next.get('type') && chosen.listingType !== next.get('type')) next.delete('categoryId');
  if (chosen?.listingType === 'service' && next.get('condition')) next.delete('condition');
  return next;
}
