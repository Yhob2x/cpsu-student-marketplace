/** Stable idempotent updates for optimistic saves and network-error rollback. */
export function withSavedListing(ids: readonly number[], id: number, saved: boolean): number[] {
  if (saved) return ids.includes(id) ? [...ids] : [...ids, id];
  return ids.filter(current => current !== id);
}
