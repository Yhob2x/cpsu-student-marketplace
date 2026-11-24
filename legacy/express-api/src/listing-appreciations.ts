import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requireStudent } from './auth.js';
import { HttpError } from './http.js';
import { visibleStudentStoreWhere } from './store-visibility.js';
import { missingInventoryTable } from './listing-inventory.js';

type Db = Pick<PrismaClient, 'listing' | 'affiliation' | 'listingAppreciation'>;
const listingId = z.coerce.number().int().positive();
type Summary = { available: boolean; count: number | null; isAppreciated: boolean };
const inactive: Summary = { available: false, count: null, isAppreciated: false };

async function summaries(db: Db, ids: number[], viewerUserId?: number): Promise<Record<number, Summary>> {
  if (!ids.length) return {};
  if (!(db as Partial<Db>).listingAppreciation)
    return Object.fromEntries(ids.map(id => [id, inactive]));
  try {
    const [counts, own] = await Promise.all([
      db.listingAppreciation.groupBy({
        by: ['listingId'], where: { listingId: { in: ids } }, _count: { _all: true },
      }),
      viewerUserId ? db.listingAppreciation.findMany({
        where: { listingId: { in: ids }, userId: viewerUserId }, select: { listingId: true },
      }) : Promise.resolve([]),
    ]);
    const countById = new Map(counts.map(row => [row.listingId, row._count._all]));
    const ownIds = new Set(own.map(row => row.listingId));
    return Object.fromEntries(ids.map(id => [id, {
      available: true, count: countById.get(id) ?? 0, isAppreciated: ownIds.has(id),
    }]));
  } catch (error) {
    if (missingInventoryTable(error)) return Object.fromEntries(ids.map(id => [id, inactive]));
    throw error;
  }
}

export function makeListingAppreciationsRouter(db: Db) {
  const router = Router();
  const findPublic = async (id: number) => {
    const listing = await db.listing.findFirst({
      where: { id, status: 'published', deletedAt: null, seller: visibleStudentStoreWhere() },
      select: { id: true, seller: { select: { ownerUserId: true } } },
    });
    if (!listing) throw new HttpError(404, 'listing_not_available');
    return listing;
  };

  // Batch public cards to avoid a request for every listing. No student identities leave the API.
  router.get('/listing-appreciations', async (req, res) => {
    const raw = z.string().max(600).parse(req.query.ids);
    const ids = [...new Set(raw.split(',').map(s => listingId.parse(s)))];
    if (ids.length < 1 || ids.length > 50) throw new HttpError(400, 'invalid_listing_ids');
    const visible = await db.listing.findMany({
      where: { id: { in: ids }, status: 'published', deletedAt: null, seller: visibleStudentStoreWhere() },
      select: { id: true },
    });
    const result = await summaries(db, visible.map(row => row.id), req.user?.id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ summaries: result });
  });

  router.get('/listings/:id/appreciations', async (req, res) => {
    const id = listingId.parse(req.params.id);
    await findPublic(id);
    const result = await summaries(db, [id], req.user?.id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(result[id]);
  });

  router.put('/listing-appreciations/:id', requireStudent, async (req, res) => {
    const id = listingId.parse(req.params.id);
    const userId = req.user!.id;
    const listing = await findPublic(id);
    if (listing.seller.ownerUserId === userId) throw new HttpError(403, 'cannot_appreciate_own_listing');
    const affiliation = await db.affiliation.findFirst({
      where: { userId, verificationStatus: 'verified', campus: { active: true },
        OR: [{ expirationAt: null }, { expirationAt: { gt: new Date() } }] },
      select: { id: true },
    });
    if (!affiliation) throw new HttpError(403, 'verified_student_required');
    if (!(db as Partial<Db>).listingAppreciation) throw new HttpError(503, 'appreciations_not_ready');
    try {
      await db.listingAppreciation.upsert({
        where: { userId_listingId: { userId, listingId: id } },
        create: { userId, listingId: id }, update: {},
      });
      const result = (await summaries(db, [id], userId))[id];
      if (!result?.available) throw new HttpError(503, 'appreciations_not_ready');
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(result);
    } catch (error) {
      if (missingInventoryTable(error)) throw new HttpError(503, 'appreciations_not_ready');
      throw error;
    }
  });

  // Withdrawals remain possible after a student affiliation expires.
  router.delete('/listing-appreciations/:id', requireStudent, async (req, res) => {
    const id = listingId.parse(req.params.id);
    const userId = req.user!.id;
    const listing = await findPublic(id);
    if (listing.seller.ownerUserId === userId) throw new HttpError(403, 'cannot_appreciate_own_listing');
    if (!(db as Partial<Db>).listingAppreciation) throw new HttpError(503, 'appreciations_not_ready');
    try {
      await db.listingAppreciation.deleteMany({ where: { listingId: id, userId } });
      const result = (await summaries(db, [id], userId))[id];
      if (!result?.available) throw new HttpError(503, 'appreciations_not_ready');
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(result);
    } catch (error) {
      if (missingInventoryTable(error)) throw new HttpError(503, 'appreciations_not_ready');
      throw error;
    }
  });
  return router;
}
