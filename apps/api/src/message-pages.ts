import { z } from 'zod';

// Opt-in pagination for both CPSU PWA chat views. The legacy response stays
// unchanged for older clients until all clients can page their history.
export const MESSAGE_PAGE_SIZE = 50;
export const messagePageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  beforeId: z.coerce.number().int().positive().max(2_147_483_647).optional(),
}).refine(q => q.beforeId === undefined || q.limit !== undefined, {
  message: 'beforeId requires limit', path: ['beforeId'],
});

export function messagePageQuery(threadId: number, limit: number, beforeId?: number) {
  return {
    where: { threadId, ...(beforeId === undefined ? {} : { id: { lt: beforeId } }) },
    orderBy: { id: 'desc' as const },
    take: limit + 1,
    include: { author: { select: { displayName: true } } },
  };
}

export function pageFromNewestFirst<T extends { id: number }>(rows: T[], limit: number) {
  return { messages: rows.slice(0, limit).reverse(), hasEarlier: rows.length > limit };
}
