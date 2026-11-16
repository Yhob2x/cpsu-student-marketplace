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
import { sanitizeListingImage } from '../upload-security.js';

const r = Router();
r.use(requireAuth);
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  // Incoming bytes are temporary and never served; only re-encoded WebP is retained.
  storage: multer.diskStorage({ destination: env.UPLOAD_DIR, filename: (_q, _f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + '.upload') }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_q, f, cb) => cb(null, ALLOWED_IMAGE_TYPES.has(f.mimetype)),
});

const listingBody = z.object({
  type: z.enum(['physical_product', 'service']), categoryId: z.number().int(), title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000), price: z.number().positive().max(1_000_000), priceBasis: z.string().max(40).default('per item'),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).nullable().optional(),
  handoffNote: z.string().max(200).optional(),
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
  if (b.type === 'service' && b.condition != null) throw new HttpError(400, 'condition_not_applicable');
  if (req.body && ('availability' in req.body || 'availabilityState' in req.body || 'deletedAt' in req.body))
    throw new HttpError(400, 'invalid_availability_update');
  const store = await prisma.sellerProfile.findFirst({ where: { ownerUserId: req.user!.id, approvalStatus: 'approved' } });
  if (!store) throw new HttpError(403, 'no_approved_store');
  const l = await prisma.listing.create({ data: { ...b, sellerProfileId: store.id, campusId: store.campusId, status: 'draft' } });
  res.status(201).json(l);
});

r.patch('/listings/:id', async (req, res) => {
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (l.deletedAt) throw new HttpError(409, 'listing_deleted');
  if (l.reservationTransactionId !== null) throw new HttpError(409, 'transaction_reservation_active');
  if (['pending_review', 'suspended', 'rejected'].includes(l.status)) throw new HttpError(409, 'not_editable');
  if (req.body && ('availability' in req.body || 'availabilityState' in req.body || 'deletedAt' in req.body))
    throw new HttpError(400, 'invalid_availability_update');
  const patch = listingBody.partial().parse(req.body);
  const type = patch.type ?? l.type;
  if (type === 'service' && patch.condition != null) throw new HttpError(400, 'condition_not_applicable');
  // Product condition is a material detail; changes to approved listings require review again.
  const status = l.status === 'published' && isMaterialChange(patch) ? 'draft' : l.status;
  const changed = await prisma.listing.updateMany({ where: {
    id: l.id, reservationTransactionId: null, deletedAt: null, status: l.status,
  }, data: { ...patch, ...(type === 'service' && { condition: null }), status } });
  if (!changed.count) throw new HttpError(409, 'listing_changed');
  res.json(await prisma.listing.findUniqueOrThrow({ where: { id: l.id } }));
});

// Authorize and check the quota BEFORE accepting any file bytes to avoid
// unauthorized uploads filling storage with orphan files.
r.post('/listings/:id/media',
  async (req, _res, next) => {
    try {
      const l = await ownListing(req.user!.id, Number(req.params.id));
      if (l.deletedAt) throw new HttpError(409, 'listing_deleted');
      if (l.reservationTransactionId !== null) throw new HttpError(409, 'transaction_reservation_active');
      if (!['draft', 'changes_requested', 'published'].includes(l.status))
        throw new HttpError(409, 'not_editable');
      if (l.media.length >= 6) throw new HttpError(409, 'too_many_images');
      next();
    } catch (error) { next(error); }
  },
  (req, res, next) => upload.single('image')(req, res, error => {
    if (error instanceof multer.MulterError)
      return next(new HttpError(400, 'invalid_image', 'Upload one JPEG, PNG or WebP photo up to 3 MB.'));
    next(error);
  }),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'invalid_image', 'Upload a JPEG, PNG or WebP photo up to 3 MB.');
    const safe = await sanitizeListingImage(req.file, env.UPLOAD_DIR);
    try {
      const media = await prisma.$transaction(async tx => {
        const current = await tx.listing.findFirst({
          where: { id: Number(req.params.id), seller: { ownerUserId: req.user!.id } },
          include: { media: true },
        });
        if (!current) throw new HttpError(404, 'not_found');
        if (current.deletedAt) throw new HttpError(409, 'listing_deleted');
        if (current.reservationTransactionId !== null) throw new HttpError(409, 'transaction_reservation_active');
        if (!['draft', 'changes_requested', 'published'].includes(current.status))
          throw new HttpError(409, 'not_editable');
        if (current.media.length >= 6) throw new HttpError(409, 'too_many_images');
        // Adding any new photo to an already approved listing requires a fresh
        // campus review. No new, unreviewed image may inherit published status.
        if (current.status === 'published') {
          await tx.listing.update({ where: { id: current.id }, data: { status: 'draft' } });
        }
        const record = await tx.listingMedia.create({ data: {
          listingId: current.id, mediaPath: safe.mediaPath, mimeType: safe.mimeType,
          position: current.media.length,
        } });
        await tx.auditLog.create({ data: {
          actorUserId: req.user!.id, action: 'listing.photo_added', targetType: 'listing',
          targetId: current.id, metadata: { photoId: record.id, requiresReview: current.status === 'published' },
        } });
        return record;
      });
      res.status(201).json({ id: media.id });
    } catch (error) {
      await fs.promises.unlink(path.join(env.UPLOAD_DIR, safe.mediaPath)).catch(() => {});
      throw error;
    }
  },
);

r.post('/listings/:id/submit', async (req, res) => {
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (l.deletedAt) throw new HttpError(409, 'listing_deleted');
  if (!['draft', 'changes_requested'].includes(l.status)) throw new HttpError(409, 'not_submittable');
  if (!await verifiedCampus(req.user!.id)) throw new HttpError(403, 'affiliation_not_verified');
  const { flags } = await evaluateListing(l, l.media.length);
  if (flags.includes('restricted_prohibited')) throw new HttpError(422, 'category_prohibited', 'This category is not allowed on this campus.');
  if (flags.includes('invalid_price') || flags.includes('missing_images')) throw new HttpError(422, 'incomplete_listing', flags.join(','));
  if (l.type === 'physical_product' && !l.condition) throw new HttpError(422, 'condition_required', 'Choose an item condition before submitting for review.');
  if (l.availabilityState !== 'available') throw new HttpError(409, 'listing_unavailable');
  const updated = await prisma.listing.update({ where: { id: l.id }, data: { status: 'pending_review', flags } });
  await audit(req.user!.id, 'listing.submit', 'listing', l.id, { flags });
  res.json(updated);
});

// Change availability without changing moderation status. Sold is terminal: a
// new product listing must be created if a distinct item is later offered.
r.patch('/listings/:id/availability', async (req, res) => {
  const { availability } = z.object({
    availability: z.enum(['available', 'reserved', 'sold']),
  }).strict().parse(req.body);
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (l.deletedAt) throw new HttpError(409, 'listing_deleted');
  if (l.status !== 'published') throw new HttpError(409, 'not_published');
  if (l.availabilityState === 'sold' && availability !== 'sold') throw new HttpError(409, 'sold_is_final');
  if (l.reservationTransactionId !== null && availability !== l.availabilityState) throw new HttpError(409, 'transaction_reservation_active');
  if (l.availabilityState === availability) return res.json(l);

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.listing.updateMany({ where: {
      id: l.id, deletedAt: null, status: 'published', availabilityState: l.availabilityState,
      reservationTransactionId: null,
    }, data: { availabilityState: availability, availability } });
    if (result.count !== 1) throw new HttpError(409, 'listing_changed');
    await tx.auditLog.create({ data: {
      actorUserId: req.user!.id, action: 'listing.availability_changed', targetType: 'listing',
      targetId: l.id, metadata: { from: l.availabilityState, to: availability },
    } });
    return tx.listing.findUniqueOrThrow({ where: { id: l.id } });
  });
  const saves = await prisma.savedListing.findMany({
    where: { listingId: l.id, userId: { not: req.user!.id } }, select: { userId: true },
  });
  if (saves.length) await prisma.notification.createMany({
    data: saves.map(s => ({ userId: s.userId, type: 'listing.availability_changed',
      payload: { listingId: l.id, title: l.title, availability } })),
  });
  res.json(updated);
});

// Soft deletion hides a listing but retains media, reports, reviews, saved
// references, audit records, and existing conversation history.
r.delete('/listings/:id', async (req, res) => {
  const l = await ownListing(req.user!.id, Number(req.params.id));
  if (l.deletedAt) return res.status(204).end();
  if (l.reservationTransactionId !== null) throw new HttpError(409, 'transaction_reservation_active');
  await prisma.$transaction(async tx => {
    const updated = await tx.listing.updateMany({
      where: { id: l.id, deletedAt: null, reservationTransactionId: null }, data: { deletedAt: new Date() },
    });
    if (updated.count !== 1) throw new HttpError(409, 'listing_changed');
    await tx.auditLog.create({ data: {
      actorUserId: req.user!.id, action: 'listing.soft_deleted', targetType: 'listing',
      targetId: l.id, metadata: { status: l.status, availability: l.availabilityState },
    } });
  });
  res.status(204).end();
});

export default r;
