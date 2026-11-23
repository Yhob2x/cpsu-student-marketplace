import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { endpointHash, permittedPushEndpoint, pushDeliveryReady, pushReady } from '../push.js';

const r = Router();
r.use(requireAuth);
// Per authenticated account: students behind one campus NAT must not share this quota.
r.use(rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: 'draft-7',
  legacyHeaders: false, keyGenerator: req => `account:${req.user!.id}` }));

const DEFAULTS = { messages: true, listingReviews: true, accountUpdates: true };
const categorySelect = { messages: true, listingReviews: true, accountUpdates: true } as const;
const preferenceSchema = z.object({
  messages: z.boolean().optional(),
  listingReviews: z.boolean().optional(),
  accountUpdates: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Select a preference');

const endpoint = z.string().url().max(2048);
const subscriptionSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: z.string().regex(/^[\w-]{60,180}$/),
    auth: z.string().regex(/^[\w-]{12,90}$/),
  }).strict(),
  expirationTime: z.number().int().positive().max(8_640_000_000_000_000).nullable().optional(),
}).strict();

r.get('/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: pushReady, deliveryEnabled: pushDeliveryReady, publicKey: pushReady ? env.VAPID_PUBLIC_KEY : null });
});

// POST avoids exposing capability URLs in browser history, proxies, and access logs.
// Identical browser subscriptions must not be treated as enrolled for other users.
r.post('/subscriptions/status', async (req, res) => {
  const { endpoint: value } = z.object({ endpoint }).strict().parse(req.body);
  res.setHeader('Cache-Control', 'no-store');
  if (!pushReady || !permittedPushEndpoint(value)) return res.json({ registered: false });
  const row = await prisma.pushSubscription.findUnique({
    where: { endpointHash: endpointHash(value) }, select: { userId: true, expiresAt: true },
  });
  res.json({ registered: row?.userId === req.user!.id
    && (!row.expiresAt || row.expiresAt > new Date()) });
});

r.get('/preferences', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!pushReady) return res.json(DEFAULTS);
  const row = await prisma.pushPreference.findUnique({ where: { userId: req.user!.id }, select: categorySelect });
  res.json(row ?? DEFAULTS);
});

r.patch('/preferences', async (req, res) => {
  if (!pushReady) throw new HttpError(503, 'push_not_configured');
  const data = preferenceSchema.parse(req.body);
  const userId = req.user!.id;
  const initial = { ...DEFAULTS, ...data };
  const row = await prisma.$transaction(async tx => {
    // Use the original columns only. Prisma's create branch can write schema defaults
    // for columns that do not exist on an enrollment-only database yet.
    await tx.$executeRaw`INSERT INTO PushPreference
      (userId, messages, listingReviews, accountUpdates, updatedAt)
      VALUES (${userId}, ${initial.messages}, ${initial.listingReviews}, ${initial.accountUpdates}, UTC_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        messages = COALESCE(${data.messages ?? null}, messages),
        listingReviews = COALESCE(${data.listingReviews ?? null}, listingReviews),
        accountUpdates = COALESCE(${data.accountUpdates ?? null}, accountUpdates),
        updatedAt = UTC_TIMESTAMP(3)`;
    return tx.pushPreference.findUniqueOrThrow({ where: { userId }, select: categorySelect });
  });
  res.json(row);
});

r.post('/subscriptions', async (req, res) => {
  if (!pushReady) throw new HttpError(503, 'push_not_configured');
  const sub = subscriptionSchema.parse(req.body);
  if (!permittedPushEndpoint(sub.endpoint)) throw new HttpError(400, 'invalid_push_endpoint');
  const hash = endpointHash(sub.endpoint);
  const userId = req.user!.id;
  const registration = { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh,
    auth: sub.keys.auth, expiresAt: sub.expirationTime ? new Date(sub.expirationTime) : null };
  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.$transaction(async tx => {
        const users = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM User WHERE id = ${userId} FOR UPDATE`;
        if (users[0]?.status !== 'active') throw new HttpError(401, 'unauthenticated');
        // Serialize enrollments for this account, including transfers into it.
        await tx.pushSubscription.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
        const existing = await tx.pushSubscription.findUnique({
          where: { endpointHash: hash }, select: { userId: true },
        });
        if (existing?.userId !== userId && await tx.pushSubscription.count({ where: { userId } }) >= 8) {
          throw new HttpError(409, 'push_device_limit');
        }
        await tx.pushSubscription.upsert({ where: { endpointHash: hash },
          create: { ...registration, endpointHash: hash }, update: registration });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
      break;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)
        || !['P2034', 'P2002'].includes(error.code) || attempt >= 3) throw error;
    }
  }
  res.status(201).json({ ok: true });
});

r.delete('/subscriptions', async (req, res) => {
  const data = z.object({ endpoint }).strict().parse(req.body);
  await prisma.pushSubscription.deleteMany({
    where: { userId: req.user!.id, endpointHash: endpointHash(data.endpoint) },
  });
  res.status(204).end();
});

export default r;
