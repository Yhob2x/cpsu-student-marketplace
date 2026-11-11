import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { requireAuth } from '../auth.js';
import { notify } from '../audit.js';

const r = Router();
r.use(requireAuth);
// shortcut: typing state lives in memory, so it is per API instance and resets on restart
const typing = new Map<string, number>();
const TYPING_MS = 5000;

// Participants only: the buyer, or the owner of the listing's store.
async function participantThread(userId: number, id: number) {
  const t = await prisma.inquiryThread.findUnique({ where: { id }, include: { seller: true, listing: { include: { media: true } } } });
  if (!t || (t.buyerUserId !== userId && t.seller.ownerUserId !== userId)) throw new HttpError(404, 'not_found');
  return t;
}

r.get('/', async (req, res) => {
  const uid = req.user!.id;
  const rows = await prisma.inquiryThread.findMany({
    where: { OR: [{ buyerUserId: uid }, { seller: { ownerUserId: uid } }] },
    include: { listing: { select: { id: true, title: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(t => ({ id: t.id, status: t.status, listing: t.listing, lastMessage: t.messages[0] ?? null, role: t.buyerUserId === uid ? 'buyer' : 'seller' })));
});

r.post('/', async (req, res) => {
  const b = z.object({ listingId: z.number().int(), body: z.string().trim().min(1).max(1000) }).parse(req.body);
  const l = await prisma.listing.findFirst({ where: {
    id: b.listingId, status: 'published', deletedAt: null, seller: { approvalStatus: 'approved' },
  }, include: { seller: true } });
  if (!l) throw new HttpError(404, 'not_found');
  if (l.seller.ownerUserId === req.user!.id) throw new HttpError(400, 'own_listing');
  if (l.availabilityState !== 'available') throw new HttpError(409, 'listing_unavailable');
  const t = await prisma.inquiryThread.upsert({
    where: { listingId_buyerUserId: { listingId: l.id, buyerUserId: req.user!.id } },
    create: { listingId: l.id, buyerUserId: req.user!.id, sellerProfileId: l.sellerProfileId }, update: {},
  });
  await prisma.inquiryMessage.create({ data: { threadId: t.id, authorUserId: req.user!.id, body: b.body } });
  await notify(l.seller.ownerUserId, 'inquiry.new', { threadId: t.id, listingTitle: l.title });
  res.status(201).json({ id: t.id });
});

r.get('/:id/messages', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  const messages = await prisma.inquiryMessage.findMany({ where: { threadId: t.id }, orderBy: { createdAt: 'asc' }, include: { author: { select: { displayName: true } } } });
  const handoff = await prisma.handoff.findUnique({ where: { inquiryThreadId: t.id } });
  const other = t.buyerUserId === req.user!.id ? t.seller.ownerUserId : t.buyerUserId;
  res.json({ thread: { id: t.id, status: t.status, listingId: t.listingId }, messages: messages.map(m => ({
    id: m.id, body: m.body, createdAt: m.createdAt, mine: m.authorUserId === req.user!.id, author: m.author.displayName })), handoff,
    typing: (typing.get(`${t.id}:${other}`) ?? 0) > Date.now() });
});

// Heartbeat while the other person is typing; expires on its own after TYPING_MS.
r.post('/:id/typing', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  typing.set(`${t.id}:${req.user!.id}`, Date.now() + TYPING_MS);
  res.status(204).end();
});

r.post('/:id/messages', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  if (t.status === 'closed') throw new HttpError(409, 'thread_closed');
  const b = z.object({ body: z.string().trim().min(1).max(1000) }).parse(req.body);
  const m = await prisma.inquiryMessage.create({ data: { threadId: t.id, authorUserId: req.user!.id, body: b.body } });
  const other = t.buyerUserId === req.user!.id ? t.seller.ownerUserId : t.buyerUserId;
  await notify(other, 'inquiry.reply', { threadId: t.id, listingTitle: t.listing.title });
  res.status(201).json({ id: m.id });
});

// Either party records the agreed handoff and, later, an outcome. Outcomes are self-reported, not verified sales.
r.put('/:id/handoff', async (req, res) => {
  const t = await participantThread(req.user!.id, Number(req.params.id));
  const b = z.object({
    method: z.enum(['campus_pickup', 'scheduled_meeting', 'seller_delivery', 'off_campus', 'digital_delivery', 'appointment']),
    timeWindow: z.string().max(80), generalLocation: z.string().max(120),
    status: z.enum(['proposed', 'agreed', 'completed', 'cancelled', 'not_confirmed']).default('proposed'),
  }).parse(req.body);
  const h = await prisma.handoff.upsert({ where: { inquiryThreadId: t.id }, create: { ...b, inquiryThreadId: t.id }, update: b });
  res.json(h);
});
export default r;
