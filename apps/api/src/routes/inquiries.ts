import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { requireStudent } from '../auth.js';
import { notify } from '../audit.js';
import { inquiryAllowsMessage, appendMessageToOpenThread } from '../inquiry-safety.js';
import { rowAccess } from '../row-access.js';
import { messagePageInput, messagePageQuery, pageFromNewestFirst } from '../message-pages.js';
import { inboxPageInput, inboxPageQuery, inboxPageResult } from '../inbox-pages.js';

const r = Router();
r.use(requireStudent);
// shortcut: typing state lives in memory, so it is per API instance and resets on restart
const typing = new Map<string, number>();
const TYPING_MS = 5000;
// Presence is scoped to this conversation, not a claim about a user's global device/app status.
// A client heartbeats only when the chat tab is foreground and focused; old entries expire.
const presence = new Map<string, number>();
const PRESENCE_MS = 25000;

// A receipt represents observed server activity, not an assumed delivery or view.
const receipt = (m: { deliveredAt: Date | null; seenAt: Date | null }) =>
  m.seenAt ? 'read' : m.deliveredAt ? 'delivered' : 'sent';

// Participants only: the buyer, or the owner of the listing's store.
async function participantThread(userId: number, id: number) {
  const t = await prisma.inquiryThread.findFirst({ where: { id, ...rowAccess.inquiryParticipant(userId) }, include: {
    seller: { include: { owner: { select: { displayName: true, status: true } } } },
    buyer: { select: { displayName: true } },
    listing: { select: {
      id: true, title: true, type: true, price: true, priceBasis: true,
      condition: true, availabilityState: true, status: true, deletedAt: true,
      media: { select: { id: true, position: true } },
    } },
  } });
  if (!t) throw new HttpError(404, 'not_found');
  return t;
}

r.get('/', async (req, res) => {
  const uid = req.user!.id;
  const page = inboxPageInput.parse(req.query);
  const paging = page.limit === undefined ? null : inboxPageQuery(page.limit, page.beforeId);
  const rows = await prisma.inquiryThread.findMany({
    where: { ...rowAccess.inquiryParticipant(uid), ...(paging && page.beforeId !== undefined
      ? { id: { lt: page.beforeId } } : {}) },
    include: {
      listing: { select: { id: true, title: true } },
      buyer: { select: { displayName: true } },
      seller: { include: { owner: { select: { displayName: true, status: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: paging?.orderBy ?? { createdAt: 'desc' },
    ...(paging ? { take: paging.take } : {}),
  });
  const items = rows.map(t => ({
    id: t.id, status: t.status, listing: t.listing,
    // The authorized recipient sees the other participant's display name, never credentials.
    otherStudentName: t.buyerUserId === uid ? t.seller.owner.displayName : t.buyer.displayName,
    lastMessage: t.messages[0] ? {
      ...t.messages[0], mine: t.messages[0].authorUserId === uid, receipt: receipt(t.messages[0]),
    } : null,
    role: t.buyerUserId === uid ? 'buyer' : 'seller',
  }));
  if (!paging || page.limit === undefined) return res.json(items);
  const result = inboxPageResult(rows, page.limit);
  res.json({ items: items.slice(0, page.limit), hasMore: result.hasMore,
    nextBeforeId: result.nextBeforeId });
});

r.post('/', async (req, res) => {
  const b = z.object({ listingId: z.number().int(), body: z.string().trim().min(1).max(1000) }).parse(req.body);
  const l = await prisma.listing.findFirst({ where: {
    id: b.listingId, ...rowAccess.publicListing(),
  }, select: {
    id: true, title: true, sellerProfileId: true, availabilityState: true,
    seller: { select: { ownerUserId: true } },
  } });
  if (!l) throw new HttpError(404, 'not_found');
  if (l.seller.ownerUserId === req.user!.id) throw new HttpError(400, 'own_listing');
  if (l.availabilityState !== 'available') throw new HttpError(409, 'listing_unavailable');
  const t = await prisma.inquiryThread.upsert({
    where: { listingId_buyerUserId: { listingId: l.id, buyerUserId: req.user!.id } },
    create: { listingId: l.id, buyerUserId: req.user!.id, sellerProfileId: l.sellerProfileId }, update: {},
  });
  if (!inquiryAllowsMessage(t.status)) throw new HttpError(409, 'thread_closed');
  const message = await prisma.$transaction(tx => appendMessageToOpenThread(tx, t.id, req.user!.id, b.body), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
  await notify(l.seller.ownerUserId, 'inquiry.new', { threadId: t.id, messageId: message.id, listingTitle: l.title });
  res.status(201).json({ id: t.id });
});

r.get('/:id/messages', async (req, res) => {
  // Reject invalid IDs and pagination controls before touching the database.
  const threadId = z.coerce.number().int().positive().max(2_147_483_647).parse(req.params.id);
  const pageRequest = messagePageInput.parse(req.query);
  const t = await participantThread(req.user!.id, threadId);
  // New PWA clients request 50 recent messages, then request older pages by ID.
  // The no-limit legacy response is deliberately preserved for old clients.
  const page = pageRequest.limit === undefined ? null : pageFromNewestFirst(
    await prisma.inquiryMessage.findMany(messagePageQuery(t.id, pageRequest.limit, pageRequest.beforeId)),
    pageRequest.limit,
  );
  const deliveredAt = new Date();
  // A delivery receipt is recorded only for messages actually fetched by the
  // paginated client. The old non-paginated path preserves existing semantics.
  if (page) {
    const ids = page.messages.filter(m => m.authorUserId !== req.user!.id && !m.deliveredAt).map(m => m.id);
    if (ids.length) {
      await prisma.inquiryMessage.updateMany({
        where: { threadId: t.id, id: { in: ids }, authorUserId: { not: req.user!.id }, deliveredAt: null },
        data: { deliveredAt },
      });
      page.messages.forEach(m => { if (ids.includes(m.id) && !m.deliveredAt) m.deliveredAt = deliveredAt; });
    }
  } else {
    await prisma.inquiryMessage.updateMany({
      where: { threadId: t.id, authorUserId: { not: req.user!.id }, deliveredAt: null },
      data: { deliveredAt },
    });
  }
  const messages = page?.messages ?? await prisma.inquiryMessage.findMany({
    where: { threadId: t.id }, orderBy: { createdAt: 'asc' },
    include: { author: { select: { displayName: true } } },
  });
  const handoff = await prisma.handoff.findUnique({ where: { inquiryThreadId: t.id } });
  const transaction = await prisma.transaction.findFirst({
    where: { inquiryThreadId: t.id, ...rowAccess.transactionParticipant(req.user!.id) },
    orderBy: { id: 'desc' },
    select: {
      id: true, status: true, buyerMeetupConfirmedAt: true, sellerMeetupConfirmedAt: true,
      buyerCompletionConfirmedAt: true, sellerCompletionConfirmedAt: true,
    },
  });
  const other = t.buyerUserId === req.user!.id ? t.seller.ownerUserId : t.buyerUserId;
  const listingVisible = t.listing.status === 'published' && !t.listing.deletedAt && t.seller.approvalStatus === 'approved' && t.seller.owner.status === 'active';
  const leadPhoto = listingVisible ? [...t.listing.media].sort((a, b) => a.position - b.position)[0] : undefined;
  res.json({ thread: {
    id: t.id, status: t.status, listingId: t.listingId,
    otherStudentName: t.buyerUserId === req.user!.id ? t.seller.owner.displayName : t.buyer.displayName,
  }, listing: {
    id: t.listing.id, title: t.listing.title, type: t.listing.type,
    price: Number(t.listing.price), priceBasis: t.listing.priceBasis,
    condition: t.listing.condition,
    availability: listingVisible ? t.listing.availabilityState : 'unavailable',
    imageUrl: leadPhoto ? `/api/v1/media/${leadPhoto.id}` : null,
  }, messages: messages.map(m => ({
    id: m.id, body: m.body, createdAt: m.createdAt, mine: m.authorUserId === req.user!.id,
    author: m.author.displayName, receipt: receipt(m), seenAt: m.seenAt })), handoff, transaction,
    ...(page ? { hasEarlier: page.hasEarlier } : {}),
    // Never disclose stale heartbeats for a closed thread, even if a heartbeat races closure.
    typing: inquiryAllowsMessage(t.status) && (typing.get(`${t.id}:${other}`) ?? 0) > Date.now(),
    otherActiveInChat: inquiryAllowsMessage(t.status) && (presence.get(`${t.id}:${other}`) ?? 0) > Date.now() });
});

// Participant-only presence, in-memory, expires if the conversation is not foregrounded.
// It never reveals activity outside this particular conversation.
r.post('/:id/presence', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  if (!inquiryAllowsMessage(t.status)) throw new HttpError(409, 'thread_closed');
  presence.set(`${t.id}:${req.user!.id}`, Date.now() + PRESENCE_MS);
  res.status(204).end();
});

// Called only after the client's intersection observer sees the recipient's message in an
// active, visible thread. The upper bound prevents marking messages further down as read.
r.post('/:id/seen', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  const { upToId } = z.object({ upToId: z.number().int().positive() }).parse(req.body);
  const where = { threadId: t.id, authorUserId: { not: req.user!.id }, id: { lte: upToId } };
  const now = new Date();
  await prisma.inquiryMessage.updateMany({ where: { ...where, deliveredAt: null }, data: { deliveredAt: now } });
  await prisma.inquiryMessage.updateMany({ where: { ...where, seenAt: null }, data: { seenAt: now } });
  // A badge represents unread messages. Clear only notifications whose specific incoming
  // message was actually visible and acknowledged, not newer messages in the same thread.
  const pending = await prisma.notification.findMany({
    where: { userId: req.user!.id, readAt: null, type: { in: ['inquiry.new', 'inquiry.reply'] } },
    select: { id: true, payload: true }, orderBy: { createdAt: 'desc' }, take: 200,
  });
  const readIds = pending.filter(n => {
    const p = n.payload as { threadId?: unknown; messageId?: unknown } | null;
    return p?.threadId === t.id && typeof p.messageId === 'number' && p.messageId <= upToId;
  }).map(n => n.id);
  if (readIds.length) await prisma.notification.updateMany({
    where: { userId: req.user!.id, id: { in: readIds }, readAt: null }, data: { readAt: now },
  });
  res.status(204).end();
});

// Heartbeat while the other person is typing; expires on its own after TYPING_MS.
r.post('/:id/typing', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  if (!inquiryAllowsMessage(t.status)) throw new HttpError(409, 'thread_closed');
  typing.set(`${t.id}:${req.user!.id}`, Date.now() + TYPING_MS);
  res.status(204).end();
});

r.post('/:id/messages', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  if (!inquiryAllowsMessage(t.status)) throw new HttpError(409, 'thread_closed');
  if (t.seller.owner.status !== 'active') throw new HttpError(409, 'seller_unavailable');
  const b = z.object({ body: z.string().trim().min(1).max(1000) }).parse(req.body);
  const m = await prisma.$transaction(tx => appendMessageToOpenThread(tx, t.id, req.user!.id, b.body), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
  const other = t.buyerUserId === req.user!.id ? t.seller.ownerUserId : t.buyerUserId;
  await notify(other, 'inquiry.reply', { threadId: t.id, messageId: m.id, listingTitle: t.listing.title });
  res.status(201).json({ id: m.id });
});

// Ending a chat is participant-only and applies to this listing, not to other conversations.
// No one can reopen or post to a closed thread through the inquiry-create shortcut.
r.post('/:id/close', async (req, res) => {
  const threadId = z.coerce.number().int().positive().parse(req.params.id);
  const t = await participantThread(req.user!.id, threadId);
  await prisma.$transaction(async tx => {
    // SERIALIZABLE read locks the thread row until the close and audit commit.
    const current = await tx.inquiryThread.findUnique({ where: { id: t.id }, select: { status: true } });
    if (!current) throw new HttpError(404, 'not_found');
    if (current.status === 'closed') return; // Idempotent: audit only the first close.
    await tx.inquiryThread.update({ where: { id: t.id }, data: { status: 'closed' } });
    await tx.auditLog.create({
      data: { actorUserId: req.user!.id, action: 'inquiry.closed', targetType: 'inquiry_thread', targetId: t.id },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  typing.delete(`${t.id}:${t.buyerUserId}`);
  typing.delete(`${t.id}:${t.seller.ownerUserId}`);
  presence.delete(`${t.id}:${t.buyerUserId}`);
  presence.delete(`${t.id}:${t.seller.ownerUserId}`);
  res.status(204).end();
});

// Either party records the agreed handoff and, later, an outcome. Outcomes are self-reported, not verified sales.
r.put('/:id/handoff', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  const b = z.object({
    method: z.enum(['campus_pickup', 'scheduled_meeting', 'seller_delivery', 'off_campus', 'digital_delivery', 'appointment']),
    timeWindow: z.string().max(80), generalLocation: z.string().max(120),
    status: z.enum(['proposed', 'agreed', 'completed', 'cancelled', 'not_confirmed']).default('proposed'),
  }).parse(req.body);
  const h = await prisma.$transaction(async tx => {
    const latest = await tx.transaction.findFirst({
      where: { inquiryThreadId: t.id }, orderBy: { id: 'desc' }, select: { id: true },
    });
    if (latest) {
      // Serialize with confirm-meetup even for callers of this older handoff route.
      await tx.transaction.updateMany({ where: { id: latest.id },
        data: { updatedAt: new Date() } });
    }
    const confirmed = latest ? await tx.transaction.findUnique({
      where: { id: latest.id }, select: {
        buyerMeetupConfirmedAt: true, sellerMeetupConfirmedAt: true,
      },
    }) : null;
    const existing = await tx.handoff.findUnique({ where: { inquiryThreadId: t.id } });
    const arrangementChanged = !existing || existing.generalLocation !== b.generalLocation
      || existing.timeWindow !== b.timeWindow || existing.method !== b.method;
    if (arrangementChanged && (confirmed?.buyerMeetupConfirmedAt || confirmed?.sellerMeetupConfirmedAt))
      throw new HttpError(409, 'meetup_location_locked');
    return tx.handoff.upsert({ where: { inquiryThreadId: t.id },
      create: { ...b, inquiryThreadId: t.id }, update: b });
  });
  res.json(h);
});
export default r;
