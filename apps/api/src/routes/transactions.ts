import { Router } from 'express';
import { Prisma, type Transaction, type TransactionStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { requireStudent } from '../auth.js';
import { deliverPush } from '../push.js';

const r = Router();
r.use(requireStudent);
const idOf = (s: string) => z.coerce.number().int().positive().parse(s);
const reasonBody = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
const terminal = ['completed', 'cancelled'] as const;

// C1a: Staff and establishment roles cannot act as student buyer/seller, even when
// their account also has an active affiliation. Authentication itself already rejects suspended users.
async function eligibleStudent(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId },
    include: { roles: true, affiliations: { include: { campus: { select: { active: true } } } } } });
  if (!user || user.status !== 'active' || user.roles.length ||
    !user.affiliations.some(a => a.verificationStatus === 'verified' && a.campus.active &&
      (!a.expirationAt || a.expirationAt > new Date()))) {
    throw new HttpError(403, 'student_verification_required');
  }
  return user;
}

async function participant(userId: number, id: number) {
  const t = await prisma.transaction.findUnique({ where: { id },
    include: { listing: { include: { seller: { select: { approvalStatus: true, ownerUserId: true } } } } } });
  if (!t || (t.buyerUserId !== userId && t.sellerUserId !== userId)) throw new HttpError(404, 'not_found');
  return t;
}

const ensureListingNotModerated = (listing: { status: string; deletedAt: Date | null }) => {
  if (listing.status !== 'published' || listing.deletedAt !== null)
    throw new HttpError(409, 'listing_under_review');
};

type Tx = Prisma.TransactionClient;
type TransactionPushNotice = {
  userId: number; type: string;
  payload: { transactionId: number; listingId: number; status: TransactionStatus };
  notificationId: number;
};
function dispatchCommittedTransactionPush(notice: TransactionPushNotice | null) {
  if (!notice) return;
  // Side effect only after the database transaction commits successfully.
  void deliverPush(notice.userId, notice.type, notice.payload, notice.notificationId)
    .catch(() => console.warn('Transaction Web Push delivery skipped'));
}
async function logEvent(tx: Tx, t: Transaction, actor: number, event: string,
                        previous: TransactionStatus | null, next: TransactionStatus,
                        reason?: string): Promise<TransactionPushNotice> {
  await tx.transactionStatusLog.create({ data: {
    transactionId: t.id, actorUserId: actor, fromStatus: previous,
    toStatus: next, event, reason,
  } });
  await tx.auditLog.create({ data: {
    actorUserId: actor, targetType: 'transaction', targetId: t.id,
    action: 'transaction.' + event,
    metadata: { fromStatus: previous, toStatus: next, ...(reason ? { reason } : {}) },
  } });
  const recipientId = actor === t.buyerUserId ? t.sellerUserId : t.buyerUserId;
  const payload = { transactionId: t.id, listingId: t.listingId, status: next };
  const type = 'transaction.' + event;
  const notification = await tx.notification.create({
    data: { userId: recipientId, type, payload }, select: { id: true },
  });
  return { userId: recipientId, type, payload, notificationId: notification.id };
}

const response = (t: Transaction) => ({ ...t, price: Number(t.price) });

r.post('/', async (req, res) => {
  const buyerId = req.user!.id;
  await eligibleStudent(buyerId);
  const { listingId } = z.object({ listingId: z.number().int().positive() }).strict().parse(req.body);
  const listing = await prisma.listing.findUnique({ where: { id: listingId },
    include: { seller: { include: { owner: { select: {
      status: true, roles: { select: { id: true } },
      affiliations: { select: {
        verificationStatus: true, expirationAt: true, campus: { select: { active: true } },
      } },
    } } } } } });
  if (!listing || listing.status !== 'published' || listing.deletedAt ||
    listing.seller.approvalStatus !== 'approved' || listing.seller.sellerType !== 'student' ||
    listing.seller.owner.status !== 'active' || listing.seller.owner.roles.length > 0 ||
    !listing.seller.owner.affiliations.some(a => a.verificationStatus === 'verified' && a.campus.active &&
      (!a.expirationAt || a.expirationAt > new Date()))) throw new HttpError(404, 'not_found');
  if (listing.seller.ownerUserId === buyerId) throw new HttpError(400, 'own_listing');

  // Replays of the same request return the existing active order, including after reservation.
  const existing = await prisma.transaction.findFirst({
    where: { listingId, buyerUserId: buyerId, activeThreadId: { not: null } },
  });
  if (existing) return res.status(200).json(response(existing));
  if (listing.availabilityState !== 'available') throw new HttpError(409, 'listing_unavailable');

  try {
    const created = await prisma.$transaction(async tx => {
      const liveListing = await tx.listing.findFirst({ where: {
        id: listingId, status: 'published', deletedAt: null, availabilityState: 'available',
        seller: { approvalStatus: 'approved', sellerType: 'student', owner: {
          status: 'active', roles: { none: {} }, affiliations: { some: {
            verificationStatus: 'verified', campus: { active: true },
            OR: [{ expirationAt: null }, { expirationAt: { gt: new Date() } }],
          } },
        } },
      } });
      if (!liveListing) throw new HttpError(409, 'listing_unavailable');
      const thread = await tx.inquiryThread.upsert({
        where: { listingId_buyerUserId: { listingId, buyerUserId: buyerId } },
        create: { listingId, buyerUserId: buyerId, sellerProfileId: listing.sellerProfileId },
        update: {},
      });
      const prior = await tx.transaction.findUnique({ where: { activeThreadId: thread.id } });
      if (prior) return { transaction: prior, wasCreated: false, pushNotice: null };
      const t = await tx.transaction.create({ data: {
        inquiryThreadId: thread.id, activeThreadId: thread.id, listingId,
        buyerUserId: buyerId, sellerUserId: listing.seller.ownerUserId,
        status: 'pending', price: liveListing.price, currency: liveListing.currency,
      } });
      const pushNotice = await logEvent(tx, t, buyerId, 'requested', null, 'pending');
      return { transaction: t, wasCreated: true, pushNotice };
    });
    dispatchCommittedTransactionPush(created.pushNotice);
    return res.status(created.wasCreated ? 201 : 200).json(response(created.transaction));
  } catch (e) {
    // Concurrent duplicate submissions race on the nullable activeThreadId unique index.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const retry = await prisma.transaction.findFirst({
        where: { listingId, buyerUserId: buyerId, activeThreadId: { not: null } },
      });
      if (retry) return res.status(200).json(response(retry));
      throw new HttpError(409, 'request_changed');
    }
    throw e;
  }
});

r.get('/', async (req, res) => {
  await eligibleStudent(req.user!.id);
  const { page, pageSize } = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(30).default(20),
  }).strict().parse(req.query);
  const where = { OR: [{ buyerUserId: req.user!.id }, { sellerUserId: req.user!.id }] };
  const [items, total] = await prisma.$transaction([
    prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' },
      include: { listing: { select: { title: true, type: true } },
        buyer: { select: { displayName: true } }, seller: { select: { displayName: true } } },
      skip: (page - 1) * pageSize, take: pageSize }),
    prisma.transaction.count({ where }),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items: items.map(t => ({ ...t, price: Number(t.price) })), total, page, pageSize });
});

r.get('/:id', async (req, res) => {
  await eligibleStudent(req.user!.id);
  const t = await participant(req.user!.id, idOf(req.params.id));
  const history = await prisma.transactionStatusLog.findMany({ where: { transactionId: t.id },
    orderBy: { id: 'asc' }, select: {
      id: true, event: true, fromStatus: true, toStatus: true, actorUserId: true,
      reason: true, createdAt: true,
    } });
  const handoff = await prisma.handoff.findUnique({ where: { inquiryThreadId: t.inquiryThreadId } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ...response(t), history, handoff });
});

r.post('/:id/decision', async (req, res) => {
  const userId = req.user!.id;
  await eligibleStudent(userId);
  const t = await participant(userId, idOf(req.params.id));
  if (t.sellerUserId !== userId) throw new HttpError(404, 'not_found');
  if (t.status !== 'pending') throw new HttpError(409, 'invalid_transaction_state');
  if (t.listing.seller.approvalStatus !== 'approved') throw new HttpError(409, 'seller_unavailable');
  const b = z.discriminatedUnion('action', [
    z.object({ action: z.literal('accept') }).strict(),
    z.object({ action: z.literal('reject'), reason: z.string().trim().min(10).max(500) }).strict(),
  ]).parse(req.body);
  const result = await prisma.$transaction(async tx => {
    let pushNotice: TransactionPushNotice;
    if (b.action === 'accept') {
      // The buyer may have been suspended or lost CPSU verification after submitting.
      // A seller must not accept a request for an ineligible student.
      const eligibleBuyer = await tx.user.count({ where: {
        id: t.buyerUserId, status: 'active', roles: { none: {} },
        affiliations: { some: {
          verificationStatus: 'verified', campus: { active: true },
          OR: [{ expirationAt: null }, { expirationAt: { gt: new Date() } }],
        } },
      } });
      if (!eligibleBuyer) throw new HttpError(409, 'buyer_unavailable');
      const updated = await tx.transaction.updateMany({ where: { id: t.id, status: 'pending', activeThreadId: t.inquiryThreadId },
        data: { status: 'accepted' } });
      if (!updated.count) throw new HttpError(409, 'invalid_transaction_state');
      // Guard inventory with one row-level conditional UPDATE: two accepted requests
      // for a one-off physical item can never share its reservation.
      if (t.listing.type === 'physical_product') {
        const reserve = await tx.listing.updateMany({ where: {
          id: t.listingId, status: 'published', deletedAt: null,
          availabilityState: 'available', reservationTransactionId: null,
        }, data: { availabilityState: 'reserved', availability: 'reserved', reservationTransactionId: t.id } });
        if (!reserve.count) throw new HttpError(409, 'listing_unavailable');
      } else {
        const active = await tx.listing.count({ where: { id: t.listingId, status: 'published',
          deletedAt: null, availabilityState: 'available' } });
        if (!active) throw new HttpError(409, 'listing_unavailable');
      }
      pushNotice = await logEvent(tx, t, userId, 'accepted', 'pending', 'accepted');
    } else {
      const updated = await tx.transaction.updateMany({ where: { id: t.id, status: 'pending', activeThreadId: t.inquiryThreadId },
        data: { status: 'cancelled', activeThreadId: null } });
      if (!updated.count) throw new HttpError(409, 'invalid_transaction_state');
      pushNotice = await logEvent(tx, t, userId, 'rejected', 'pending', 'cancelled', b.reason);
    }
    return { transaction: await tx.transaction.findUniqueOrThrow({ where: { id: t.id } }), pushNotice };
  });
  dispatchCommittedTransactionPush(result.pushNotice);
  res.json(response(result.transaction));
});

r.post('/:id/negotiating', async (req, res) => {
  const userId = req.user!.id;
  await eligibleStudent(userId);
  z.object({}).strict().parse(req.body ?? {});
  const t = await participant(userId, idOf(req.params.id));
  if (t.status !== 'accepted') throw new HttpError(409, 'invalid_transaction_state');
  ensureListingNotModerated(t.listing);
  const result = await prisma.$transaction(async tx => {
    const changed = await tx.transaction.updateMany({ where: { id: t.id, status: 'accepted' }, data: { status: 'negotiating' } });
    if (!changed.count) throw new HttpError(409, 'invalid_transaction_state');
    const pushNotice = await logEvent(tx, t, userId, 'negotiating', 'accepted', 'negotiating');
    return { transaction: await tx.transaction.findUniqueOrThrow({ where: { id: t.id } }), pushNotice };
  });
  dispatchCommittedTransactionPush(result.pushNotice);
  res.json(response(result.transaction));
});

r.post('/:id/confirm-meetup', async (req, res) => {
  const userId = req.user!.id;
  await eligibleStudent(userId);
  z.object({}).strict().parse(req.body ?? {});
  const t = await participant(userId, idOf(req.params.id));
  if (!['accepted', 'negotiating'].includes(t.status)) throw new HttpError(409, 'invalid_transaction_state');
  ensureListingNotModerated(t.listing);
  const field = t.buyerUserId === userId ? 'buyerMeetupConfirmedAt' : 'sellerMeetupConfirmedAt';
  const result = await prisma.$transaction(async tx => {
    const changed = await tx.transaction.updateMany({ where: {
      id: t.id, status: { in: ['accepted', 'negotiating'] }, [field]: null,
    }, data: { [field]: new Date() } });
    if (!changed.count) throw new HttpError(409, 'already_confirmed_or_changed');
    const updated = await tx.transaction.findUniqueOrThrow({ where: { id: t.id } });
    const both = !!updated.buyerMeetupConfirmedAt && !!updated.sellerMeetupConfirmedAt;
    if (both) {
      const advanced = await tx.transaction.updateMany({ where: {
        id: t.id, status: { in: ['accepted', 'negotiating'] },
      }, data: { status: 'for_meetup' } });
      if (!advanced.count) throw new HttpError(409, 'invalid_transaction_state');
    }
    const next = both ? 'for_meetup' : updated.status;
    const pushNotice = await logEvent(tx, t, userId, 'meetup_confirmed', updated.status, next);
    return { transaction: await tx.transaction.findUniqueOrThrow({ where: { id: t.id } }), pushNotice };
  });
  dispatchCommittedTransactionPush(result.pushNotice);
  res.json(response(result.transaction));
});

r.post('/:id/confirm-completion', async (req, res) => {
  const userId = req.user!.id;
  await eligibleStudent(userId);
  z.object({}).strict().parse(req.body ?? {});
  const t = await participant(userId, idOf(req.params.id));
  if (t.status !== 'for_meetup') throw new HttpError(409, 'invalid_transaction_state');
  ensureListingNotModerated(t.listing);
  const field = t.buyerUserId === userId ? 'buyerCompletionConfirmedAt' : 'sellerCompletionConfirmedAt';
  const result = await prisma.$transaction(async tx => {
    const changed = await tx.transaction.updateMany({ where: {
      id: t.id, status: 'for_meetup', [field]: null,
    }, data: { [field]: new Date() } });
    if (!changed.count) throw new HttpError(409, 'already_confirmed_or_changed');
    const updated = await tx.transaction.findUniqueOrThrow({ where: { id: t.id } });
    const both = !!updated.buyerCompletionConfirmedAt && !!updated.sellerCompletionConfirmedAt;
    if (both) {
      if (t.listing.type === 'physical_product') {
        const sold = await tx.listing.updateMany({ where: {
          id: t.listingId, availabilityState: 'reserved', reservationTransactionId: t.id,
        }, data: { availabilityState: 'sold', availability: 'sold', reservationTransactionId: null } });
        if (!sold.count) throw new HttpError(409, 'reservation_changed');
      }
      const finish = await tx.transaction.updateMany({ where: { id: t.id, status: 'for_meetup', activeThreadId: t.inquiryThreadId },
        data: { status: 'completed', activeThreadId: null } });
      if (!finish.count) throw new HttpError(409, 'invalid_transaction_state');
    }
    const pushNotice = await logEvent(tx, t, userId, 'completion_confirmed', updated.status, both ? 'completed' : 'for_meetup');
    return { transaction: await tx.transaction.findUniqueOrThrow({ where: { id: t.id } }), pushNotice };
  });
  dispatchCommittedTransactionPush(result.pushNotice);
  res.json(response(result.transaction));
});

r.post('/:id/cancel', async (req, res) => {
  const userId = req.user!.id;
  await eligibleStudent(userId);
  const b = reasonBody.parse(req.body);
  const t = await participant(userId, idOf(req.params.id));
  if (terminal.includes(t.status as typeof terminal[number])) throw new HttpError(409, 'invalid_transaction_state');
  const result = await prisma.$transaction(async tx => {
    const cancelled = await tx.transaction.updateMany({ where: {
      id: t.id, status: { notIn: ['completed', 'cancelled'] }, activeThreadId: t.inquiryThreadId,
    }, data: { status: 'cancelled', activeThreadId: null } });
    if (!cancelled.count) throw new HttpError(409, 'invalid_transaction_state');
    if (t.listing.type === 'physical_product' && t.status !== 'pending') {
      const released = await tx.listing.updateMany({ where: {
        id: t.listingId, reservationTransactionId: t.id, availabilityState: 'reserved',
      }, data: { reservationTransactionId: null, availabilityState: 'available', availability: 'available' } });
      if (!released.count) throw new HttpError(409, 'reservation_changed');
    }
    const pushNotice = await logEvent(tx, t, userId, 'cancelled', t.status, 'cancelled', b.reason);
    return { transaction: await tx.transaction.findUniqueOrThrow({ where: { id: t.id } }), pushNotice };
  });
  dispatchCommittedTransactionPush(result.pushNotice);
  res.json(response(result.transaction));
});

export default r;
