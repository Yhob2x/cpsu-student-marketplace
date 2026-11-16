import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { requireAuth } from '../auth.js';
import { audit } from '../audit.js';
import { publicListing } from './public.js';

const r = Router();
r.use(['/me', '/notifications', '/saved', '/reports'], requireAuth);

r.get('/me', async (req, res) => {
  const u = req.user!;
  const aff = await prisma.affiliation.findMany({ where: { userId: u.id }, include: { campus: true } });
  const store = await prisma.sellerProfile.findFirst({ where: { ownerUserId: u.id } });
  res.json({ id: u.id, email: u.email, displayName: u.displayName, roles: u.roles,
    affiliations: aff.map(a => ({ id: a.id, campus: { id: a.campus.id, name: a.campus.name }, status: a.verificationStatus })),
    storeId: store?.id ?? null });
});
r.patch('/me', async (req, res) => {
  const b = z.object({ displayName: z.string().trim().min(2).max(80) }).parse(req.body);
  await prisma.user.update({ where: { id: req.user!.id }, data: b });
  res.json({ ok: true });
});

r.get('/notifications/unread-count', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const where = { userId: req.user!.id, readAt: null };
  const [total, messages] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, type: { in: ['inquiry.new', 'inquiry.reply'] } } }),
  ]);
  res.json({ total, messages });
});
r.get('/notifications', async (req, res) =>
  res.json(await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 })));
r.post('/notifications/read', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});
r.post('/notifications/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw new HttpError(400, 'invalid_id');
  // updateMany scoped to the owner: another student's notification simply matches nothing.
  await prisma.notification.updateMany({ where: { id, userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

r.get('/saved', async (req, res) => {
  const rows = await prisma.savedListing.findMany({
    where: { userId: req.user!.id, listing: { status: 'published', deletedAt: null,
      seller: { approvalStatus: 'approved', owner: { status: 'active' } } } },
    include: { listing: { include: { category: true, campus: true, seller: true, media: true } } }, orderBy: { createdAt: 'desc' },
  });
  res.json(rows.map(s => publicListing(s.listing)));
});
r.put('/saved/:listingId', async (req, res) => {
  const listingId = Number(req.params.listingId);
  const listing = await prisma.listing.findFirst({ where: {
    id: listingId, status: 'published', deletedAt: null, seller: { approvalStatus: 'approved', owner: { status: 'active' } },
  }, include: { seller: true } });
  if (!listing) throw new HttpError(404, 'not_found');
  if (listing.seller.ownerUserId === req.user!.id) throw new HttpError(400, 'own_listing');
  if (listing.availabilityState !== 'available') throw new HttpError(409, 'listing_unavailable');
  await prisma.savedListing.upsert({ where: { userId_listingId: { userId: req.user!.id, listingId } }, create: { userId: req.user!.id, listingId }, update: {} });
  res.status(204).end();
});
r.delete('/saved/:listingId', async (req, res) => {
  await prisma.savedListing.deleteMany({ where: { userId: req.user!.id, listingId: Number(req.params.listingId) } });
  res.status(204).end();
});

r.post('/reports', async (req, res) => {
  const b = z.object({ listingId: z.number().int().optional(), sellerProfileId: z.number().int().optional(), reason: z.string().trim().min(10).max(1000) })
    .refine(v => v.listingId || v.sellerProfileId, 'target required').parse(req.body);
  const rep = await prisma.report.create({ data: { ...b, reporterUserId: req.user!.id } });
  await audit(req.user!.id, 'report.create', 'report', rep.id);
  res.status(201).json({ id: rep.id });
});
export default r;
