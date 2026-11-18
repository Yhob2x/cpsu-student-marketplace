import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requireReviewer, requireStudent } from './auth.js';
import { HttpError } from './http.js';
import { reviewCampusIds } from './permissions.js';
import { visibleStudentStoreWhere } from './store-visibility.js';

/**
 * Staged feature: StoreReview Prisma schema and additive migration are prepared,
 * but its database table and generated Prisma client must be separately activated.
 * Do not fake zero ratings when its table is missing.
 */
type ModerationStatus = 'pending' | 'published' | 'rejected' | 'hidden';
type StoreReviewData = {
  id: number; transactionId: number; sellerProfileId: number; buyerUserId: number;
  rating: number; body: string | null; status: ModerationStatus;
  createdAt: Date; moderatedAt: Date | null; moderationReason: string | null;
};
type ReviewModel = {
  findFirst(args: any): Promise<StoreReviewData | null>;
  findMany(args: any): Promise<any[]>;
  aggregate(args: any): Promise<{ _avg: { rating: number | null }; _count: { _all: number } }>;
  create(args: any): Promise<StoreReviewData>;
  updateMany(args: any): Promise<{ count: number }>;
};
type Db = Pick<PrismaClient, 'sellerProfile' | 'transaction' | 'affiliation' | '$transaction'> & {
  // The feature stays optional until its migration is activated. Narrow only at the route boundary.
  storeReview?: unknown;
};
const notReady = (e: unknown) => typeof e === 'object' && e !== null && 'code' in e &&
  ['P2021', 'P2022'].includes(String((e as { code: unknown }).code));
const requireModel = (db: Db): ReviewModel => {
  if (!db.storeReview) throw new HttpError(503, 'store_reviews_not_ready');
  return db.storeReview as ReviewModel;
};
const clampPage = z.coerce.number().int().min(1).max(10000).default(1);
const reviewInput = z.object({ rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(800).optional().nullable() }).strict();
const publicFields = { id: true, rating: true, body: true, createdAt: true } as const;

export function makeStoreReviewsRouter(db: Db) {
  const router = Router();

  // Public: only approved reviews of currently eligible, visible stores.
  // No buyer names, email addresses, student IDs or transaction identifiers.
  router.get('/seller-profiles/:id/reviews', async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const page = clampPage.parse(req.query.page);
    const pageSize = 8;
    const store = await db.sellerProfile.findFirst({
      where: { id, ...visibleStudentStoreWhere() }, select: { id: true },
    });
    if (!store) throw new HttpError(404, 'not_found');
    try {
      const reviews = requireModel(db);
      const where = { sellerProfileId: id, status: 'published' as const };
      const [stats, items] = await Promise.all([
        reviews.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
        reviews.findMany({ where, select: publicFields,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ available: true, summary: { count: stats._count._all,
        average: stats._avg.rating === null ? null : Math.round(stats._avg.rating * 10) / 10 },
        items, page, pageSize });
    } catch (error) {
      if (notReady(error) || error instanceof HttpError && error.status === 503) {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ available: false, summary: null, items: [], page, pageSize });
        return;
      }
      throw error;
    }
  });

  // Only the purchasing student may inspect review eligibility or review state.
  router.get('/transactions/:id/store-review', requireStudent, async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const transaction = await db.transaction.findFirst({ where: { id, buyerUserId: req.user!.id },
      select: { id: true, status: true, sellerUserId: true } });
    if (!transaction) throw new HttpError(404, 'not_found');
    try {
      const reviews = requireModel(db);
      const review = await reviews.findFirst({ where: { transactionId: id, buyerUserId: req.user!.id },
        select: { id: true, rating: true, body: true, status: true, createdAt: true,
          moderationReason: true } });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ available: true,
        eligible: transaction.status === 'completed' && transaction.sellerUserId !== req.user!.id && !review,
        review });
    } catch (error) {
      if (notReady(error) || error instanceof HttpError && error.status === 503) {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ available: false, eligible: false, review: null }); return;
      }
      throw error;
    }
  });

  router.post('/transactions/:id/store-review', requireStudent, async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = reviewInput.parse(req.body);
    const userId = req.user!.id;
    const reviews = requireModel(db);
    const affiliation = await db.affiliation.findFirst({ where: {
      userId, verificationStatus: 'verified', campus: { active: true },
      OR: [{ expirationAt: null }, { expirationAt: { gt: new Date() } }],
    }, select: { id: true } });
    if (!affiliation) throw new HttpError(403, 'verified_student_required');
    const transaction = await db.transaction.findFirst({
      where: { id, buyerUserId: userId, status: 'completed' },
      select: { id: true, sellerUserId: true, listing: { select: { sellerProfileId: true } } },
    });
    if (!transaction) throw new HttpError(404, 'completed_transaction_required');
    if (transaction.sellerUserId === userId) throw new HttpError(403, 'cannot_review_own_store');
    const store = await db.sellerProfile.findFirst({ where: {
      id: transaction.listing.sellerProfileId, ...visibleStudentStoreWhere(),
    }, select: { id: true, ownerUserId: true } });
    if (!store || store.ownerUserId !== transaction.sellerUserId || store.ownerUserId === userId)
      throw new HttpError(404, 'store_not_available');
    try {
      const saved = await db.$transaction(async tx => {
        const current = await tx.transaction.findFirst({ where: {
          id, buyerUserId: userId, sellerUserId: transaction.sellerUserId, status: 'completed',
        }, select: { id: true, listing: { select: { sellerProfileId: true } } } });
        if (!current || current.listing.sellerProfileId !== store.id)
          throw new HttpError(409, 'transaction_changed');
        const delegate = (tx as unknown as { storeReview?: ReviewModel }).storeReview;
        if (!delegate) throw new HttpError(503, 'store_reviews_not_ready');
        const created = await delegate.create({ data: {
          transactionId: id, sellerProfileId: store.id, buyerUserId: userId,
          rating: body.rating, body: body.body || null, status: 'pending',
        }, select: { id: true, rating: true, status: true, createdAt: true } });
        await tx.auditLog.create({ data: {
          actorUserId: userId, action: 'store_review.submit',
          targetType: 'store_review', targetId: created.id,
        } });
        return created;
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(201).json({ review: saved, message: 'Review submitted for campus moderation.' });
    } catch (error) {
      if (notReady(error)) throw new HttpError(503, 'store_reviews_not_ready');
      if (typeof error === 'object' && error !== null && 'code' in error &&
        (error as { code: unknown }).code === 'P2002') throw new HttpError(409, 'already_reviewed');
      throw error;
    }
  });

  router.get('/admin/store-reviews', requireReviewer, async (req, res) => {
    const status = z.enum(['pending', 'published']).default('pending').parse(req.query.status);
    const page = clampPage.parse(req.query.page);
    const campusIds = reviewCampusIds(req.user!);
    const where = { status, ...(campusIds === 'all' ? {} : { store: { campusId: { in: campusIds } } }) };
    try {
      const reviews = requireModel(db);
      const items = await reviews.findMany({ where, take: 21, skip: (page - 1) * 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, rating: true, body: true, status: true, createdAt: true,
          store: { select: { storeName: true, campusId: true } },
          transaction: { select: { listing: { select: { title: true } } } },
        } });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ available: true, items: items.slice(0, 20), page, pageSize: 20, hasMore: items.length > 20 });
    } catch (error) {
      if (notReady(error) || error instanceof HttpError && error.status === 503) {
        res.status(503).json({ code: 'store_reviews_not_ready' }); return;
      }
      throw error;
    }
  });

  router.post('/admin/store-reviews/:id/decision', requireReviewer, async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { decision, reason } = z.object({
      decision: z.enum(['published', 'rejected', 'hidden']),
      reason: z.string().trim().min(10).max(500),
    }).strict().parse(req.body);
    const campusIds = reviewCampusIds(req.user!);
    const filter = { id, ...(campusIds === 'all' ? {} : { store: { campusId: { in: campusIds } } }) };
    try {
      requireModel(db);
      await db.$transaction(async tx => {
        const delegate = (tx as unknown as { storeReview?: ReviewModel }).storeReview;
        if (!delegate) throw new HttpError(503, 'store_reviews_not_ready');
        const review = await delegate.findFirst({ where: filter,
          select: { id: true, status: true } });
        if (!review) throw new HttpError(404, 'not_found');
        if (decision === 'hidden' && review.status !== 'published' ||
            decision !== 'hidden' && review.status !== 'pending')
          throw new HttpError(409, 'invalid_review_state');
        const updated = await delegate.updateMany({ where: { ...filter, status: review.status },
          data: { status: decision, moderationReason: reason, moderatedAt: new Date() } });
        if (updated.count !== 1) throw new HttpError(409, 'review_changed');
        await tx.auditLog.create({ data: {
          actorUserId: req.user!.id, action: `store_review.${decision}`,
          targetType: 'store_review', targetId: id, metadata: { reason },
        } });
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ ok: true });
    } catch (error) {
      if (notReady(error)) throw new HttpError(503, 'store_reviews_not_ready');
      throw error;
    }
  });
  return router;
}
