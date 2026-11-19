import { z } from 'zod';

/** Optional window for published, available listings on a public store. */
export const storeListingPageInput = z.object({
  limit: z.coerce.number().int().min(1).max(48).optional(),
  beforeId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
}).refine(p => p.beforeId === undefined || p.limit !== undefined, {
  path: ['beforeId'], message: 'beforeId requires limit',
});

export function storeListingPageQuery(limit: number, beforeId?: number) {
  return {
    ...(beforeId === undefined ? {} : { id: { lt: beforeId } }),
    orderBy: { id: 'desc' as const },
    take: limit + 1,
  };
}

export function storeListingPageResult<T extends { id: number }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const hasMoreListings = rows.length > limit;
  return { items, hasMoreListings, nextListingBeforeId: hasMoreListings ? items.at(-1)?.id ?? null : null };
}
