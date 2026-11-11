import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { reviewCampusIds } from '../auth.js';

const r = Router();
export const publicListing = (l: any) => ({
  id: l.id, type: l.type, title: l.title, description: l.description, price: Number(l.price), priceBasis: l.priceBasis,
  currency: l.currency, availability: l.availability, handoffNote: l.handoffNote, createdAt: l.createdAt,
  category: l.category && { id: l.category.id, name: l.category.name },
  campus: l.campus && { id: l.campus.id, code: l.campus.code, name: l.campus.name },
  seller: l.seller && { id: l.seller.id, storeName: l.seller.storeName, sellerType: l.seller.sellerType },
  images: (l.media ?? []).sort((a: any, b: any) => a.position - b.position).map((m: any) => `/api/v1/media/${m.id}`),
});
const include = { category: true, campus: true, seller: true, media: true };

r.get('/campuses', async (_q, res) => res.json(await prisma.campus.findMany({ where: { active: true }, select: { id: true, code: true, name: true } })));
r.get('/categories', async (_q, res) => res.json(await prisma.category.findMany({ select: { id: true, parentId: true, name: true, listingType: true } })));

r.get('/listings', async (req, res) => {
  const q = z.object({
    q: z.string().max(80).optional(), categoryId: z.coerce.number().int().optional(), campusId: z.coerce.number().int().optional(),
    type: z.enum(['physical_product', 'service']).optional(), sellerType: z.enum(['student', 'establishment']).optional(),
    minPrice: z.coerce.number().min(0).optional(), maxPrice: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where: any = { status: 'published', seller: { approvalStatus: 'approved', ...(q.sellerType && { sellerType: q.sellerType }) } };
  if (q.q) where.OR = [{ title: { contains: q.q } }, { description: { contains: q.q } }];
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.campusId) where.campusId = q.campusId;
  if (q.type) where.type = q.type;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) where.price = { gte: q.minPrice, lte: q.maxPrice };
  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({ where, include, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ total, page: q.page, pageSize: q.pageSize, items: rows.map(publicListing) });
});

// "Popular" = most saved by signed-in users; saves are the only engagement signal in v1.
r.get('/listings/popular', async (_q, res) => {
  const rows = await prisma.listing.findMany({ where: { status: 'published', savedListings: { some: {} } },
    include, orderBy: { savedListings: { _count: 'desc' } }, take: 8 });
  res.json({ items: rows.map(publicListing) });
});

r.get('/listings/:id', async (req, res) => {
  const l = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!l) throw new HttpError(404, 'not_found');
  const u = req.user;
  const owner = u && (await prisma.sellerProfile.findFirst({ where: { id: l.sellerProfileId, ownerUserId: u.id } }));
  const reviewer = u && (() => { const c = reviewCampusIds(u); return c === 'all' || c.includes(l.campusId); })();
  if (l.status !== 'published' && !owner && !reviewer) throw new HttpError(404, 'not_found'); // drafts never leak
  res.json({ ...publicListing(l), status: owner || reviewer ? l.status : undefined });
});

r.get('/seller-profiles/:id', async (req, res) => {
  const s = await prisma.sellerProfile.findFirst({
    where: { id: Number(req.params.id), approvalStatus: 'approved' },
    include: { listings: { where: { status: 'published' }, include } },
  });
  if (!s) throw new HttpError(404, 'not_found');
  res.json({ id: s.id, storeName: s.storeName, description: s.description, sellerType: s.sellerType, campusId: s.campusId,
    badge: s.sellerType === 'student' ? 'Verified CPSU community member' : 'Campus establishment', listings: s.listings.map(publicListing) });
});

r.get('/media/:id', async (req, res) => {
  const m = await prisma.listingMedia.findUnique({ where: { id: Number(req.params.id) }, include: { listing: { include: { seller: true } } } });
  if (!m) throw new HttpError(404, 'not_found');
  const u = req.user;
  const c = u ? reviewCampusIds(u) : [];
  const allowed = m.listing.status === 'published' || (u && m.listing.seller.ownerUserId === u.id) || c === 'all' || (c as number[]).includes(m.listing.campusId);
  if (!allowed) throw new HttpError(404, 'not_found');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(m.mimeType).sendFile(path.resolve(env.UPLOAD_DIR, m.mediaPath));
});
export default r;
