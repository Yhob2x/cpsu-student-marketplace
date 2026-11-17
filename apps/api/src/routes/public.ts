import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { driveMediaId, localMediaFile, readDriveMedia } from '../media-storage.js';
import { HttpError } from '../http.js';
import { reviewCampusIds } from '../auth.js';
import { DEFAULT_GUIDELINES } from '../managed-content.js';
import { freshListingIdsQuery } from '../fresh-listings-query.js';
import { sellerAvatarColumnExists } from '../optional-seller-avatar.js';
import { sellerAvatarUrl } from '../seller-avatar-url.js';
import { readStoreFollowSummary } from '../store-follows.js';
import { readMostFollowedStores } from '../most-followed-stores.js';
import { popularListingOrderBy } from '../popular-listing-ranking.js';

const r = Router();
export const publicListing = (l: any) => ({
  id: l.id, type: l.type, title: l.title, description: l.description, price: Number(l.price), priceBasis: l.priceBasis,
  currency: l.currency, availability: l.availabilityState, condition: l.condition,
  handoffNote: l.handoffNote, createdAt: l.createdAt,
  category: l.category && { id: l.category.id, name: l.category.name },
  campus: l.campus && { id: l.campus.id, code: l.campus.code, name: l.campus.name },
  seller: l.seller && { id: l.seller.id, storeName: l.seller.storeName, sellerType: l.seller.sellerType,
    avatarUrl: sellerAvatarUrl(l.seller.id, l.seller.avatarPath) },
  images: (l.media ?? []).sort((a: any, b: any) => a.position - b.position).map((m: any) => `/api/v1/media/${m.id}`),
});
// Keep public reads compatible with the development schema until the separately
// approved WP3 migration adds Listing.reservationTransactionId.
export const publicListingSelect = (avatarColumnExists: boolean) => ({
  id: true, sellerProfileId: true, campusId: true, type: true, title: true,
  description: true, price: true, priceBasis: true, currency: true,
  availabilityState: true, condition: true, deletedAt: true,
  handoffNote: true, status: true, createdAt: true,
  category: { select: { id: true, name: true } },
  campus: { select: { id: true, code: true, name: true } },
  seller: { select: { id: true, storeName: true, sellerType: true, ...(avatarColumnExists ? { avatarPath: true as const } : {}),
    approvalStatus: true, owner: { select: { status: true } } } },
  media: { select: { id: true, position: true } },
}) satisfies Prisma.ListingSelect;

r.get('/campuses', async (_q, res) => res.json(await prisma.campus.findMany({ where: { active: true }, select: { id: true, code: true, name: true } })));
r.get('/categories', async (_q, res) => res.json(await prisma.category.findMany({ select: { id: true, parentId: true, name: true, listingType: true } })));

r.get('/guidelines', async (_req, res) => {
  try {
    const content = await prisma.guidelineContent.findUnique({ where: { id: 1 }, select: { publishedBody: true, publishedAt: true } });
    res.json({ body: content?.publishedBody ?? DEFAULT_GUIDELINES, publishedAt: content?.publishedAt ?? null });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return res.json({ body: DEFAULT_GUIDELINES, publishedAt: null });
    }
    throw error;
  }
});

r.get('/announcements', async (_req, res) => {
  try {
    const items = await prisma.announcement.findMany({ where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 10,
      select: { id: true, title: true, body: true, publishedAt: true } });
    res.json({ items });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') return res.json({ items: [] });
    throw error;
  }
});

r.get('/listings', async (req, res) => {
  const q = z.object({
    q: z.string().max(80).optional(), categoryId: z.coerce.number().int().optional(), campusId: z.coerce.number().int().optional(),
    type: z.enum(['physical_product', 'service']).optional(), sellerType: z.enum(['student', 'establishment']).optional(),
    condition: z.enum(['new', 'like_new', 'good', 'fair']).optional(),
    minPrice: z.coerce.number().min(0).optional(), maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
    page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(req.query);
  const where: any = { status: 'published', availabilityState: 'available', deletedAt: null,
    seller: { approvalStatus: 'approved', owner: { status: 'active' }, ...(q.sellerType && { sellerType: q.sellerType }) } };
  if (q.q) where.OR = [{ title: { contains: q.q } }, { description: { contains: q.q } }];
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.campusId) where.campusId = q.campusId;
  if (q.type) where.type = q.type;
  if (q.condition) { where.condition = q.condition; where.type = 'physical_product'; }
  if (q.minPrice !== undefined || q.maxPrice !== undefined) where.price = { gte: q.minPrice, lte: q.maxPrice };
  // Ordering is chosen from a fixed set, never from a raw client string.
  const orderBy: Prisma.ListingOrderByWithRelationInput[] = q.sort === 'price_asc' ? [{ price: 'asc' }, { id: 'desc' }]
    : q.sort === 'price_desc' ? [{ price: 'desc' }, { id: 'desc' }]
    : [{ createdAt: 'desc' }, { id: 'desc' }];
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const [total, rows] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({ where, select, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ total, page: q.page, pageSize: q.pageSize, items: rows.map(publicListing) });
});

// "Popular" = most saved by signed-in users; saves are the only engagement signal in v1.
r.get('/listings/popular', async (_q, res) => {
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const rows = await prisma.listing.findMany({ where: {
    status: 'published', availabilityState: 'available', deletedAt: null,
    seller: { approvalStatus: 'approved', owner: { status: 'active' } }, savedListings: { some: {} },
  },
    // Stable tie-break: equal save counts must not shuffle between refreshes.
    select, orderBy: popularListingOrderBy, take: 8 });
  res.json({ items: rows.map(publicListing) });
});

// Home's Fresh rail follows the latest approval, when a listing becomes public.
// Legacy published rows without a review fall back to their creation time.
r.get('/listings/fresh', async (_req, res) => {
  const ranked = await prisma.$queryRaw<Array<{ id: number }>>(freshListingIdsQuery);
  const ids = ranked.map(row => row.id);
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const rows = ids.length ? await prisma.listing.findMany({
    where: { id: { in: ids }, status: 'published', availabilityState: 'available', deletedAt: null,
      seller: { approvalStatus: 'approved', owner: { status: 'active' } } },
    select,
  }) : [];
  const byId = new Map(rows.map(row => [row.id, row]));
  res.json({ items: ids.flatMap(id => { const row = byId.get(id); return row ? [publicListing(row)] : []; }) });
});

r.get('/listings/:id', async (req, res) => {
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const l = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, select });
  if (!l) throw new HttpError(404, 'not_found');
  const u = req.user;
  const owner = u && (await prisma.sellerProfile.findFirst({ where: { id: l.sellerProfileId, ownerUserId: u.id }, select: { id: true } }));
  const reviewer = u && (() => { const c = reviewCampusIds(u); return c === 'all' || c.includes(l.campusId); })();
  const publiclyVisible = !l.deletedAt && l.status === 'published' && l.seller.approvalStatus === 'approved' && l.seller.owner.status === 'active';
  if (!publiclyVisible && !owner && !reviewer) throw new HttpError(404, 'not_found'); // drafts / deleted listings never leak
  res.json({ ...publicListing(l), status: owner || reviewer ? l.status : undefined });
});

// Public store discovery is ranked strictly by real StoreFollow rows.
r.get('/stores/most-followed', async (_req, res) => {
  const result = await readMostFollowedStores(prisma, await sellerAvatarColumnExists());
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
});

r.get('/seller-profiles/:id', async (req, res) => {
  const avatarColumnExists = await sellerAvatarColumnExists();
  const s = await prisma.sellerProfile.findFirst({
    where: { id: Number(req.params.id), approvalStatus: 'approved', owner: { status: 'active' } },
    // Explicit select keeps the store page compatible with unmigrated optional avatar storage.
    select: { id: true, storeName: true, description: true, sellerType: true, campusId: true, createdAt: true,
      ...(avatarColumnExists ? { avatarPath: true as const } : {}),
      campus: { select: { code: true, name: true } },
      listings: { where: { status: 'published', deletedAt: null, availabilityState: 'available' },
        select: publicListingSelect(avatarColumnExists), orderBy: { createdAt: 'desc' } } },
  });
  if (!s) throw new HttpError(404, 'not_found');
  const follow = await readStoreFollowSummary(prisma, s.id, req.user?.id);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ id: s.id, storeName: s.storeName, description: s.description,
    sellerType: s.sellerType, campusId: s.campusId, campus: s.campus, createdAt: s.createdAt,
    listingCount: s.listings.length,
    follow,
    avatarUrl: sellerAvatarUrl(s.id, s.avatarPath),
    badge: s.sellerType === 'student' ? 'Verified CPSU community member' : 'Campus establishment', listings: s.listings.map(publicListing) });
});

// The seller's chosen, sanitized avatar is public only while the store and
// owner are active. No draft, pending image, or private storage path is exposed.
async function sendSellerAvatar(req: Request, res: Response) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  if (!await sellerAvatarColumnExists()) throw new HttpError(404, 'not_found');
  const seller = await prisma.sellerProfile.findUnique({ where: { id }, select: {
    ownerUserId: true, approvalStatus: true, avatarPath: true,
    owner: { select: { status: true } },
  } });
  if (!seller) throw new HttpError(404, 'not_found');
  const owner = req.user?.id === seller.ownerUserId;
  const publiclyVisible = seller.approvalStatus === 'approved' && seller.owner.status === 'active';
  if ((!publiclyVisible && !owner) || !seller.avatarPath) throw new HttpError(404, 'not_found');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (driveMediaId(seller.avatarPath)) return res.type('image/webp').send(await readDriveMedia(seller.avatarPath));
  return res.type('image/webp').sendFile(localMediaFile(seller.avatarPath));
}
r.get('/media/seller-avatar/:id', sendSellerAvatar);

r.get('/media/:id', async (req, res) => {
  const m = await prisma.listingMedia.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      listing: {
        include: {
          seller: {
            select: { ownerUserId: true, approvalStatus: true, owner: { select: { status: true } } },
          },
        },
      },
    },
  });
  if (!m) throw new HttpError(404, 'not_found');
  const u = req.user;
  const c = u ? reviewCampusIds(u) : [];
  const publicMedia = m.listing.status === 'published' && !m.listing.deletedAt &&
    m.listing.seller.approvalStatus === 'approved' && m.listing.seller.owner.status === 'active';
  const allowed = publicMedia || (u && m.listing.seller.ownerUserId === u.id) ||
    c === 'all' || (c as number[]).includes(m.listing.campusId);
  if (!allowed) throw new HttpError(404, 'not_found');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (driveMediaId(m.mediaPath)) {
    const content = await readDriveMedia(m.mediaPath);
    return res.type(m.mimeType).send(content);
  }
  res.type(m.mimeType).sendFile(localMediaFile(m.mediaPath));
});
export default r;
