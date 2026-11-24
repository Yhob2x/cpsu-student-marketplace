/** Merge the refreshed newest inbox page with older pages already loaded. */
export function mergeInboxPages<T extends { id: number }>(previous: T[] | null, incoming: T[]) {
  const byId = new Map<number, T>();
  for (const row of previous ?? []) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => b.id - a.id);
}

export type InboxPage<T> = { items: T[]; hasMore: boolean; nextBeforeId: number | null };
