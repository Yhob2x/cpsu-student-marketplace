import type { RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from './http.js';

/** Production mounts this after requireStudent; the transaction rechecks ownership. */
export const makeListingCoverHandler = (db: Pick<PrismaClient, '$transaction'>): RequestHandler => async (req, res) => {
  const { mediaId } = z.object({ mediaId: z.number().int().positive() }).strict().parse(req.body);
  const listingId = Number(req.params.id);
  if (!Number.isSafeInteger(listingId) || listingId <= 0) throw new HttpError(404, 'not_found');

  const result = await db.$transaction(async tx => {
    const listing = await tx.listing.findFirst({
      where: { id: listingId, seller: { ownerUserId: req.user!.id } },
      select: { id: true, status: true, deletedAt: true, reservationTransactionId: true,
        media: { select: { id: true, position: true } } },
    });
    if (!listing) throw new HttpError(404, 'not_found');
    if (listing.deletedAt) throw new HttpError(409, 'listing_deleted');
    if (listing.reservationTransactionId !== null) throw new HttpError(409, 'transaction_reservation_active');
    if (!['draft', 'changes_requested', 'published'].includes(listing.status)) throw new HttpError(409, 'not_editable');

    const media = listing.media.slice().sort((a, b) => a.position - b.position || a.id - b.id);
    const chosen = media.find(photo => photo.id === mediaId);
    if (!chosen) throw new HttpError(404, 'not_found');
    if (media[0]?.id === mediaId) return { coverMediaId: mediaId };

    const ordered = [chosen, ...media.filter(photo => photo.id !== mediaId)];
    for (const [position, photo] of ordered.entries()) {
      const updated = await tx.listingMedia.updateMany({ where: { id: photo.id, listingId }, data: { position } });
      if (updated.count !== 1) throw new HttpError(409, 'listing_changed');
    }
    await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'listing.cover_changed',
      targetType: 'listing', targetId: listingId, metadata: { coverMediaId: mediaId } } });
    return { coverMediaId: mediaId };
  }, { isolationLevel: 'Serializable' });
  res.json(result);
};
