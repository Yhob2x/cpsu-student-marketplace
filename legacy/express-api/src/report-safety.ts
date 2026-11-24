import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from './http.js';
import { rowAccess } from './row-access.js';
import { visibleStudentStoreWhere } from './store-visibility.js';

/**
 * Public reports target exactly one known listing OR seller profile.
 * Private conversations and user IDs require a separate approved evidence policy.
 */
export const reportRequestSchema = z.object({
  listingId: z.number().int().positive().optional(),
  sellerProfileId: z.number().int().positive().optional(),
  reason: z.string().trim().min(10).max(1000),
}).strict().refine(v => Number(v.listingId !== undefined) + Number(v.sellerProfileId !== undefined) === 1, {
  message: 'Specify exactly one public report target.',
});

export type PublicReportRequest = z.infer<typeof reportRequestSchema>;
export type PublicReportTarget = { listingId: number } | { sellerProfileId: number };

/** Ensure only existing, public, third-party marketplace content can be reported. */
export async function resolvePublicReportTarget(
  db: Pick<PrismaClient, 'listing' | 'sellerProfile'>, reporterUserId: number, request: PublicReportRequest,
): Promise<PublicReportTarget> {
  if (request.listingId !== undefined) {
    const listing = await db.listing.findFirst({
      where: { id: request.listingId, ...rowAccess.publicListing() },
      select: { id: true, seller: { select: { ownerUserId: true } } },
    });
    if (!listing) throw new HttpError(404, 'not_found');
    if (listing.seller.ownerUserId === reporterUserId) throw new HttpError(400, 'own_listing');
    return { listingId: listing.id };
  }
  if (request.sellerProfileId !== undefined) {
    const seller = await db.sellerProfile.findFirst({
      where: { id: request.sellerProfileId, ...visibleStudentStoreWhere() },
      select: { id: true, ownerUserId: true },
    });
    if (!seller) throw new HttpError(404, 'not_found');
    if (seller.ownerUserId === reporterUserId) throw new HttpError(400, 'own_store');
    return { sellerProfileId: seller.id };
  }
  throw new HttpError(400, 'validation_error');
}

/** Caller wraps this in prisma.$transaction so an audit failure rolls back the report. */
export async function createAuditedPublicReport(
  tx: Prisma.TransactionClient, reporterUserId: number, target: PublicReportTarget, reason: string,
) {
  const report = await tx.report.create({ data: { reporterUserId, ...target, reason } });
  await tx.auditLog.create({ data: { actorUserId: reporterUserId, action: 'report.create',
    targetType: 'report', targetId: report.id } });
  return { id: report.id };
}
