import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { requireAuth } from '../auth.js';
import { audit, notify } from '../audit.js';
import { evaluateListing, isMaterialChange } from '../rules.js';

const r = Router();
r.use(requireAuth);
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({ destination: env.UPLOAD_DIR, filename: (_q, f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (EXT[f.mimetype] ?? '')) }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => cb(null, f.mimetype in EXT),
});

const listingBody = z.object({
  type: z.enum(['physical_product', 'service']), categoryId: z.number().int(), title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000), price: z.number().positive().max(1_000_000), priceBasis: z.string().max(40).default('per item'),
  availability: z.string().max(40).default('available'), handoffNote: z.string().max(200).optional(),
});

async function verifiedCampus(userId: number) {
  return prisma.affiliation.findFirst({ where: { userId, verificationStatus: 'verified', OR: [{ expirationAt: null }, { expirationAt: { gt: new Date() } }] } });
}
async function ownListing(userId: number, id: number) {
  const l = await prisma.listing.findFirst({ where: { id, seller: { ownerUserId: userId } }, include: { media: true } });
  if (!l) throw new HttpError(404, 'not_found'); // not distinguishable from another seller's listing
  return l;
}

r.post('/store', async (req, res) => {
  const b = z.object({ storeName: z.string().trim().min(2).max(80), description: z.string().trim().min(10).max(1000) }).parse(req.body);
  const aff = await verifiedCampus(req.user!.id);
  if (!aff) throw new HttpError(403, 'affiliation_not_verified');
  if (await prisma.sellerProfile.findFirst({ where: { ownerUserId: req.user!.id } })) throw new HttpError(409, 'store_exists');
  const s = await prisma.sellerProfile.create({ data: { ...b, ownerUserId: req.user!.id, campusId: aff.campusId, sellerType: 'student', approvalStatus: 'approved' } });
  res.status(201).json(s);
});
r.get('/store', async (req, res) => res.json(await prisma.sellerProfile.findFirst({ where: { ownerUserId: req.user!.id } })));

r.get('/listings', async (req, res) =>
  res.json(await prisma.listing.findMany({ where: { seller: { ownerUserId: req.user!.id } }, include: { media: true, category: true }, orderBy: { updatedAt: 'desc' } })));

r.post('/listings', async (req, res) => {
  const b = listingBody.parse(req.body);
  const store = await prisma.sellerProfile.findFirst({ where: { ownerUserId: req.user!.id, approvalStatus: 'approved' } });
  if (!store) throw new HttpError(403, 'no_approved_store');
  const l = await prisma.listing.create({ data: { ...b, sellerProfileId: store.id, campusId: store.campusId, status: 'draft' } });
  res.status(201).json(l);
});

r.patch('/listings/:id', async (req, res) => {
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (['pending_review', 'suspended', 'rejected'].includes(l.status)) throw new HttpError(409, 'not_editable');
  const patch = listingBody.partial().parse(req.body);
  // Material edits to a published listing pull it back out of public view until re-reviewed.
  const status = l.status === 'published' && isMaterialChange(patch) ? 'draft' : l.status;
  res.json(await prisma.listing.update({ where: { id: l.id }, data: { ...patch, status } }));
});

r.post('/listings/:id/media', upload.single('image'), async (req, res) => {
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (!req.file) throw new HttpError(400, 'invalid_image', 'JPEG, PNG or WebP up to 3 MB');
  if (l.media.length >= 6) { fs.unlink(req.file.path, () => {}); throw new HttpError(409, 'too_many_images'); }
  const m = await prisma.listingMedia.create({ data: { listingId: l.id, mediaPath: path.basename(req.file.path), mimeType: req.file.mimetype, position: l.media.length } });
  res.status(201).json({ id: m.id });
});

r.post('/listings/:id/submit', async (req, res) => {
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (!['draft', 'changes_requested'].includes(l.status)) throw new HttpError(409, 'not_submittable');
  if (!await verifiedCampus(req.user!.id)) throw new HttpError(403, 'affiliation_not_verified');
  const { flags } = await evaluateListing(l, l.media.length);
  if (flags.includes('restricted_prohibited')) throw new HttpError(422, 'category_prohibited', 'This category is not allowed on this campus.');
  if (flags.includes('invalid_price') || flags.includes('missing_images')) throw new HttpError(422, 'incomplete_listing', flags.join(','));
  const updated = await prisma.listing.update({ where: { id: l.id }, data: { status: 'pending_review', flags } });
  await audit(req.user!.id, 'listing.submit', 'listing', l.id, { flags });
  res.json(updated);
});
export default r;
