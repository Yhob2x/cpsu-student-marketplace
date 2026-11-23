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
import { storeActivityBadge } from '../store-activity-badge.js';
import { readMostFollowedStores } from '../most-followed-stores.js';
import { readPopularListingIds } from '../popular-listing-ranking.js';
import { visibleListingRows } from '../row-access.js';
import { canonicalStoreSlug, findStoreBySlug } from '../store-slug.js';
import { visibleStudentStoreWhere } from '../store-visibility.js';
import { storeListingPageInput, storeListingPageQuery, storeListingPageResult } from '../store-listing-pages.js';
import { readPublishedStoreRatings, type PublishedStoreRating } from '../store-rating-summaries.js';
import { publicAnnouncementsCache, publicCampusesCache, publicCategoriesCache, publicGuidelinesCache } from '../public-read-cache.js';
import { readListingStocks, type ListingStock } from '../listing-inventory.js';
import { readStoreListingAppreciationCount } from '../store-listing-appreciation-count.js';

const r = Router();
export const publicListing = (l: any, ratings?: ReadonlyMap<number, PublishedStoreRating>, stocks?: ReadonlyMap<number, ListingStock> | null) => ({
  id: l.id, type: l.type, title: l.title, description: l.description, price: Number(l.price), priceBasis: l.priceBasis,
  currency: l.currency, availability: l.availabilityState, condition: l.condition,
  stockQuantity: l.type === 'physical_product' ? stocks?.get(l.id)?.stockQuantity ?? null : null,
  handoffNote: l.handoffNote, createdAt: l.createdAt,
  category: l.category && { id: l.category.id, name: l.category.name },
  campus: l.campus && { id: l.campus.id, code: l.campus.code, name: l.campus.name },
  seller: l.seller && { id: l.seller.id, storeName: l.seller.storeName, sellerType: l.seller.sellerType,
    avatarUrl: sellerAvatarUrl(l.seller.id, l.seller.avatarPath),
    ...(ratings ? { rating: ratings.get(l.seller.id) ?? null } : {}) },
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

r.get('/campuses', async (_q, res) => res.json(await publicCampusesCache.read()));
r.get('/categories', async (_q, res) => res.json(await publicCategoriesCache.read()));

r.get('/guidelines', async (_req, res) => {
  try {
    res.json(await publicGuidelinesCache.read());
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return res.json({ body: DEFAULT_GUIDELINES, publishedAt: null });
    }
    throw error;
  }
});

r.get('/announcements', async (_req, res) => {
  try {
    res.json(await publicAnnouncementsCache.read());
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
    seller: { ...visibleStudentStoreWhere(), ...(q.sellerType && { sellerType: q.sellerType }) } };
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
  const [ratings, stocks] = await Promise.all([readPublishedStoreRatings(prisma, rows.map(row => row.sellerProfileId)),
    readListingStocks(prisma, rows.map(row => row.id))]);
  res.json({ total, page: q.page, pageSize: q.pageSize, items: rows.map(row => publicListing(row, ratings, stocks)) });
});

// Popular = actual per-listing appreciations and detail-page views, never saves.
// Rank globally before hydration; do not borrow engagement from a whole store.
r.get('/listings/popular', async (_q, res) => {
  const { ids, ranking } = await readPopularListingIds(prisma);
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const rows = ids.length ? await prisma.listing.findMany({
    where: { id: { in: ids }, status: 'published', availabilityState: 'available', deletedAt: null,
      seller: visibleStudentStoreWhere() },
    select,
  }) : [];
  const byId = new Map(rows.map(row => [row.id, row]));
  const [ratings, stocks] = await Promise.all([readPublishedStoreRatings(prisma, rows.map(row => row.sellerProfileId)),
    readListingStocks(prisma, rows.map(row => row.id))]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ranking, items: ids.flatMap(id => { const row = byId.get(id); return row ? [publicListing(row, ratings, stocks)] : []; }) });
});

// Home's Fresh rail follows the latest approval, when a listing becomes public.
// Legacy published rows without a review fall back to their creation time.
r.get('/listings/fresh', async (_req, res) => {
  const ranked = await prisma.$queryRaw<Array<{ id: number }>>(freshListingIdsQuery);
  const ids = ranked.map(row => row.id);
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const rows = ids.length ? await prisma.listing.findMany({
    where: { id: { in: ids }, status: 'published', availabilityState: 'available', deletedAt: null,
      seller: visibleStudentStoreWhere() },
    select,
  }) : [];
  const byId = new Map(rows.map(row => [row.id, row]));
  const [ratings, stocks] = await Promise.all([readPublishedStoreRatings(prisma, rows.map(row => row.sellerProfileId)),
    readListingStocks(prisma, rows.map(row => row.id))]);
  res.json({ items: ids.flatMap(id => { const row = byId.get(id); return row ? [publicListing(row, ratings, stocks)] : []; }) });
});

r.get('/listings/:id', async (req, res) => {
  const select = publicListingSelect(await sellerAvatarColumnExists());
  const l = await prisma.listing.findFirst({ where: { id: Number(req.params.id), ...visibleListingRows(req.user) }, select });
  if (!l) throw new HttpError(404, 'not_found');
  const u = req.user;
  const owner = u && (await prisma.sellerProfile.findFirst({ where: { id: l.sellerProfileId, ownerUserId: u.id }, select: { id: true } }));
  const reviewer = u && (() => { const c = reviewCampusIds(u); return c === 'all' || c.includes(l.campusId); })();
  const publiclyVisible = !l.deletedAt && l.status === 'published' && l.seller.approvalStatus === 'approved' && l.seller.owner.status === 'active';
  if (!publiclyVisible && !owner && !reviewer) throw new HttpError(404, 'not_found'); // drafts / deleted listings never leak
  const stocks = await readListingStocks(prisma, [l.id]);
  res.json({ ...publicListing(l, undefined, stocks), status: owner || reviewer ? l.status : undefined });
});

// Public store discovery is ranked strictly by real StoreFollow rows.
r.get('/stores/most-followed', async (_req, res) => {
  const result = await readMostFollowedStores(prisma, await sellerAvatarColumnExists());
  res.setHeader('Cache-Control', 'no-store');
  res.json(result);
});

async function visibleStoreNames() {
  return prisma.sellerProfile.findMany({ where: visibleStudentStoreWhere(), select: { id: true, storeName: true } });
}

async function sendPublicStore(req: Request, res: Response, id: number, stores?: Awaited<ReturnType<typeof visibleStoreNames>>) {
  const pageRequest = storeListingPageInput.parse(req.query);
  const paging = pageRequest.limit === undefined ? null : storeListingPageQuery(pageRequest.limit, pageRequest.beforeId);
  const avatarColumnExists = await sellerAvatarColumnExists();
  const s = await prisma.sellerProfile.findFirst({
    where: { id, ...visibleStudentStoreWhere() },
    // Explicit select keeps the store page compatible with unmigrated optional avatar storage.
    select: { id: true, storeName: true, description: true, sellerType: true, campusId: true, createdAt: true,
      ...(avatarColumnExists ? { avatarPath: true as const } : {}),
      campus: { select: { code: true, name: true } },
      listings: { where: { status: 'published', deletedAt: null, availabilityState: 'available',
        ...(paging && pageRequest.beforeId !== undefined ? { id: { lt: pageRequest.beforeId } } : {}) },
        select: publicListingSelect(avatarColumnExists),
        orderBy: paging?.orderBy ?? { createdAt: 'desc' },
        ...(paging ? { take: paging.take } : {}) } },
  });
  if (!s) throw new HttpError(404, 'not_found');
  const slug = canonicalStoreSlug(stores ?? await visibleStoreNames(), s);
  const [follow, publishedListingCount, availableListingCount, appreciationCount] = await Promise.all([
    readStoreFollowSummary(prisma, s.id, req.user?.id),
    prisma.listing.count({ where: { sellerProfileId: s.id, status: 'published', deletedAt: null } }),
    paging ? prisma.listing.count({ where: { sellerProfileId: s.id, status: 'published',
      deletedAt: null, availabilityState: 'available' } }) : Promise.resolve(s.listings.length),
    readStoreListingAppreciationCount(prisma, s.id),
  ]);
  const listingPage = paging && pageRequest.limit !== undefined
    ? storeListingPageResult(s.listings, pageRequest.limit) : null;
  const [stocks] = await Promise.all([readListingStocks(prisma, s.listings.map(row => row.id))]);
  const activity = storeActivityBadge({ publishedListingCount, followerCount: follow.count });
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ id: s.id, slug, storeName: s.storeName, description: s.description,
    sellerType: s.sellerType, campusId: s.campusId, campus: s.campus, createdAt: s.createdAt,
    listingCount: availableListingCount,
    appreciationCount,
    follow,
    avatarUrl: sellerAvatarUrl(s.id, s.avatarPath),
    badge: s.sellerType === 'student' ? activity.label : 'Campus establishment',
    badgeReason: s.sellerType === 'student' ? activity.reason : undefined,
    listings: (listingPage?.items ?? s.listings).map(row => publicListing(row, undefined, stocks)),
    ...(listingPage ? { hasMoreListings: listingPage.hasMoreListings,
      nextListingBeforeId: listingPage.nextListingBeforeId } : {}) });
}

r.get('/seller-profiles/by-slug/:slug', async (req, res) => {
  const slug = req.params.slug;
  if (!slug || slug.length > 200) throw new HttpError(404, 'not_found');
  const stores = await visibleStoreNames();
  const store = findStoreBySlug(stores, slug);
  if (!store) throw new HttpError(404, 'not_found');
  await sendPublicStore(req, res, store.id, stores);
});

r.get('/seller-profiles/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, 'not_found');
  await sendPublicStore(req, res, id);
});

// The seller's chosen, sanitized avatar is public only while the store and
// owner are active. No draft, pending image, or private storage path is exposed.
async function sendSellerAvatar(req: Request, res: Response) {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  if (!await sellerAvatarColumnExists()) throw new HttpError(404, 'not_found');
  const seller = await prisma.sellerProfile.findUnique({ where: { id }, select: {
    ownerUserId: true, approvalStatus: true, sellerType: true, avatarPath: true,
    owner: { select: { status: true, roles: { select: { id: true } }, affiliations: {
      select: { verificationStatus: true, expirationAt: true, campus: { select: { active: true } } },
    } } },
  } });
  if (!seller) throw new HttpError(404, 'not_found');
  const owner = req.user?.id === seller.ownerUserId;
  const publiclyVisible = seller.approvalStatus === 'approved' && seller.sellerType === 'student' &&
    seller.owner.status === 'active' && seller.owner.roles.length === 0 &&
    seller.owner.affiliations.some(affiliation =>
      affiliation.verificationStatus === 'verified' && affiliation.campus.active &&
      (!affiliation.expirationAt || affiliation.expirationAt > new Date()));
  if ((!publiclyVisible && !owner) || !seller.avatarPath) throw new HttpError(404, 'not_found');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (driveMediaId(seller.avatarPath)) return res.type('image/webp').send(await readDriveMedia(seller.avatarPath));
  return res.type('image/webp').sendFile(localMediaFile(seller.avatarPath));
}
r.get('/media/seller-avatar/:id', sendSellerAvatar);

r.get('/media/:id', async (req, res) => {
  const m = await prisma.listingMedia.findFirst({
    where: { id: Number(req.params.id), listing: { is: visibleListingRows(req.user) } },
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
