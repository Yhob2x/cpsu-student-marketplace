import { z } from 'zod';

/** Opt-in cursor paging for the student's conversation inbox. */
export const inboxPageInput = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  beforeId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
}).refine(q => q.beforeId === undefined || q.limit !== undefined, {
  path: ['beforeId'], message: 'beforeId requires limit',
});

export function inboxPageQuery(limit: number, beforeId?: number) {
  return {
    ...(beforeId === undefined ? {} : { id: { lt: beforeId } }),
    orderBy: { id: 'desc' as const },
    take: limit + 1,
  };
}

export function inboxPageResult<T extends { id: number }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return { items, hasMore, nextBeforeId: hasMore ? items.at(-1)?.id ?? null : null };
}
