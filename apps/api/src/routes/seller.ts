import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { requireStudent } from '../auth.js';
import { audit, notify } from '../audit.js';
import { evaluateListing, isMaterialChange } from '../rules.js';
import { sanitizeListingImage } from '../upload-security.js';
import { storeSanitizedMedia, deleteStoredMedia } from '../media-storage.js';
import { canAddListingPhoto, MAX_LISTING_PHOTOS } from '../listing-photo-limit.js';
import { makeListingCoverHandler } from '../listing-cover-handler.js';
import { publishSellerAvatar } from '../seller-avatar-update.js';

const r = Router();
r.use(requireStudent);
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
r.get('/store', async (req, res) => {
  const store = await prisma.sellerProfile.findFirst({
    where: { ownerUserId: req.user!.id },
    select: { id: true, storeName: true, description: true, campusId: true, approvalStatus: true,
      avatarPath: true },
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(store ? {
    id: store.id, storeName: store.storeName, description: store.description, campusId: store.campusId,
    approvalStatus: store.approvalStatus,
    avatarUrl: store.avatarPath ? `/api/v1/media/seller-avatar/${store.id}` : null,
  } : null);
});

// Store settings belong to the owner. Photo media is only changed through
// explicit owner-authenticated upload endpoints, not through JSON.
r.patch('/store', async (req, res) => {
  const change = z.object({
    storeName: z.string().trim().min(2).max(80),
    description: z.string().trim().min(10).max(1000),
  }).strict().parse(req.body);
  const store = await prisma.sellerProfile.findFirst({
    where: { ownerUserId: req.user!.id, approvalStatus: 'approved' },
    select: { id: true },
  });
  if (!store) throw new HttpError(404, 'not_found');
  const updated = await prisma.$transaction(async tx => {
    const current = await tx.sellerProfile.update({
      where: { id: store.id }, data: change,
      select: { id: true, storeName: true, description: true },
    });
    await tx.auditLog.create({ data: { actorUserId: req.user!.id,
      action: 'seller.store_updated', targetType: 'seller_profile', targetId: current.id,
    } });
    return current;
  });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(updated);
});

// The seller explicitly chooses and uploads a photo. A valid sanitized image
// becomes public immediately, without reviewer approval.
r.post('/store/avatar',
  async (req, _res, next) => {
    try {
      const store = await prisma.sellerProfile.findFirst({ where: {
        ownerUserId: req.user!.id, approvalStatus: 'approved',
      }, select: { id: true } });
      if (!store) throw new HttpError(403, 'no_approved_store');
      next();
    } catch (error) { next(error); }
  },
  (req, res, next) => upload.single('image')(req, res, error => {
    if (error instanceof multer.MulterError)
      return next(new HttpError(400, 'invalid_image', 'Select one JPEG, PNG or WebP image up to 3 MB.'));
    next(error);
  }),
  async (req, res) => {
    if (!req.file) throw new HttpError(400, 'invalid_image', 'Select one JPEG, PNG or WebP image up to 3 MB.');
    const sanitized = await sanitizeListingImage(req.file, env.UPLOAD_DIR, { avatar: true });
    const stored = await storeSanitizedMedia(sanitized);
    try {
      const published = await publishSellerAvatar(prisma, req.user!.id, stored.mediaPath);
      if (published.previousPath && published.previousPath !== stored.mediaPath)
        await deleteStoredMedia(published.previousPath).catch(() => console.error('Former seller avatar cleanup failed.'));
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).json({ avatarUrl: `/api/v1/media/seller-avatar/${published.id}` });
    } catch (error) {
      await deleteStoredMedia(stored.mediaPath).catch(() => console.error('Avatar cleanup failed after database rollback.'));
      throw error;
    }
  },
);

// Removing a public profile picture is immediate and always seller-controlled.
r.delete('/store/avatar', async (req, res) => {
  const old = await prisma.$transaction(async tx => {
    const store = await tx.sellerProfile.findFirst({
      where: { ownerUserId: req.user!.id }, select: { id: true, avatarPath: true },
    });
    if (!store) throw new HttpError(404, 'not_found');
    if (!store.avatarPath) return null;
    const changed = await tx.sellerProfile.updateMany({
      where: { id: store.id, avatarPath: store.avatarPath },
      data: { avatarPath: null },
    });
    if (changed.count !== 1) throw new HttpError(409, 'avatar_changed');
    await tx.auditLog.create({ data: {
      actorUserId: req.user!.id, action: 'seller.avatar_removed',
      targetType: 'seller_profile', targetId: store.id,
    } });
    return store.avatarPath;
  });
  if (old) await deleteStoredMedia(old).catch(() => console.error('Removed avatar cleanup failed.'));
  res.status(204).end();
});

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
      if (!canAddListingPhoto(l.media.length)) throw new HttpError(409, 'too_many_images', `A listing can have up to ${MAX_LISTING_PHOTOS} photos.`);
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
    const sanitized = await sanitizeListingImage(req.file, env.UPLOAD_DIR);
    const safe = await storeSanitizedMedia(sanitized);
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
        if (!canAddListingPhoto(current.media.length)) throw new HttpError(409, 'too_many_images', `A listing can have up to ${MAX_LISTING_PHOTOS} photos.`);
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
      await deleteStoredMedia(safe.mediaPath).catch(() => {
        console.error('Photo storage cleanup failed after database rollback.');
      });
      throw error;
    }
  },
);

r.patch('/listings/:id/media/cover', makeListingCoverHandler(prisma));

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
