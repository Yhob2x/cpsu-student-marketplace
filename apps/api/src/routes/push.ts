import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { endpointHash, permittedPushEndpoint, pushDeliveryReady, pushReady } from '../push.js';

const r = Router();
r.use(requireAuth);
r.use(rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false }));

const DEFAULTS = { messages: true, listingReviews: true, accountUpdates: true };
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
  expirationTime: z.number().int().positive().nullable().optional(),
}).strict();

r.get('/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ enabled: pushReady, deliveryEnabled: pushDeliveryReady, publicKey: pushReady ? env.VAPID_PUBLIC_KEY : null });
});

r.get('/preferences', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!pushReady) return res.json(DEFAULTS);
  const row = await prisma.pushPreference.findUnique({ where: { userId: req.user!.id } });
  res.json(row ? { messages: row.messages, listingReviews: row.listingReviews,
    accountUpdates: row.accountUpdates } : DEFAULTS);
});

r.patch('/preferences', async (req, res) => {
  if (!pushReady) throw new HttpError(503, 'push_not_configured');
  const data = preferenceSchema.parse(req.body);
  const row = await prisma.pushPreference.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...DEFAULTS, ...data },
    update: data,
  });
  res.json({ messages: row.messages, listingReviews: row.listingReviews,
    accountUpdates: row.accountUpdates });
});

r.post('/subscriptions', async (req, res) => {
  if (!pushReady) throw new HttpError(503, 'push_not_configured');
  const sub = subscriptionSchema.parse(req.body);
  if (!permittedPushEndpoint(sub.endpoint)) throw new HttpError(400, 'invalid_push_endpoint');
  const hash = endpointHash(sub.endpoint);
  const existing = await prisma.pushSubscription.findUnique({ where: { endpointHash: hash } });
  if (!existing || existing.userId !== req.user!.id) {
    const count = await prisma.pushSubscription.count({ where: { userId: req.user!.id } });
    if (count >= 8) throw new HttpError(409, 'push_device_limit');
  }
  await prisma.pushSubscription.upsert({
    where: { endpointHash: hash },
    create: {
      userId: req.user!.id, endpointHash: hash, endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh, auth: sub.keys.auth,
      expiresAt: sub.expirationTime ? new Date(sub.expirationTime) : null,
    },
    update: {
      userId: req.user!.id, endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh, auth: sub.keys.auth,
      expiresAt: sub.expirationTime ? new Date(sub.expirationTime) : null,
    },
  });
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
