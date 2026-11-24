/**
 * CPSU Market -- store-follow notifications end-to-end development acceptance.
 * All data is synthetic and uniquely named, and removed after acceptance.
 * The script refuses non-loopback databases and production.
 *
 * Run from apps/api:
 *   bun scripts/store-follower-notification-http-acceptance.ts --synthetic-local-only
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { signAccess } from '../src/auth.js';
import { createApp } from '../src/app.js';
import request from 'supertest';

const assert = (value: unknown, msg: string): asserts value => {
  if (!value) throw new Error('STORE_FOLLOWER_NOTIFICATION_TEST: ' + msg);
};
assert(process.argv.length === 3 && process.argv[2] === '--synthetic-local-only'
  && process.env.NODE_ENV !== 'production', 'requires explicit local synthetic test flag');
const target = new URL(process.env.DATABASE_URL ?? 'mysql://invalid/invalid');
assert(target.protocol === 'mysql:' && target.hostname === '127.0.0.1'
  && (!target.port || target.port === '3306')
  && target.pathname === '/cpsu_marketplace', 'unsafe target database');
const prisma = new PrismaClient({ datasources: { db: { url: target.toString() } } });
const app = createApp(); // fresh in-process HTTP instance; honors the same auth, routes and limits
const marker = randomBytes(7).toString('hex');
const users: number[] = [], listingIds: number[] = [], mediaFiles: string[] = [];
let sellerProfileId: number | null = null, reviewerId: number | null = null;
let success = false;

const http = async (method: 'GET' | 'POST', path: string, token?: string, body?: object) => {
  const call = method === 'GET' ? request(app).get('/api/v1' + path)
    : request(app).post('/api/v1' + path);
  if (token) call.set('Authorization', 'Bearer ' + token);
  if (body) call.send(body);
  const response = await call;
  return { status: response.status, json: response.body as any };
};

try {
  const db = await prisma.$queryRawUnsafe<Array<{name:string}>>('SELECT DATABASE() AS name');
  assert(db[0]?.name === 'cpsu_marketplace', 'development database identity mismatch');
  const campus = await prisma.campus.findFirst({ where: { active: true }, select: { id: true } });
  const category = await prisma.category.findFirst({
    where: { listingType: 'physical_product' }, select: { id: true },
  });
  assert(campus && category, 'synthetic fixture campus/category unavailable');
  for (const kind of ['owner', 'buyerA', 'buyerB', 'unrelated', 'suspended', 'reviewer']) {
    const row = await prisma.user.create({
      data: {
        email: 'follow-notice-qa-' + kind.toLowerCase() + '-' + marker + '@example.invalid',
        displayName: 'Store Follower Notification QA ' + kind,
        passwordHash: 'synthetic-disabled-login',
        ...(kind === 'suspended' ? { status: 'suspended' as const } : {}),
      }, select: { id: true },
    });
    users.push(row.id);
  }
  const [owner, buyerA, buyerB, unrelated, suspended, reviewer] = users;
  reviewerId = reviewer;
  await prisma.userRole.create({ data: {
    userId: reviewer, role: 'campus_reviewer', campusId: campus.id,
  } });
  const store = await prisma.sellerProfile.create({
    data: {
      ownerUserId: owner, campusId: campus.id, sellerType: 'student',
      storeName: 'Follow Notification QA ' + marker,
      description: 'Local temporary test store, removed after acceptance',
      approvalStatus: 'approved',
    },
    select: { id: true },
  });
  sellerProfileId = store.id;
  for (const follower of [buyerA, buyerB, suspended]) {
    await prisma.storeFollow.create({ data: { sellerProfileId: store.id, userId: follower } });
  }

  const mediaRoot = resolve(process.env.UPLOAD_DIR ?? './uploads');
  mkdirSync(mediaRoot, { recursive: true });
  const makePendingListing = async (name: string, previousApproval = false) => {
    const listing = await prisma.listing.create({
      data: {
        sellerProfileId: store.id, campusId: campus.id, categoryId: category.id,
        type: 'physical_product', title: name + ' ' + marker,
        description: 'Synthetic notebook listing for controlled local testing',
        price: 25, priceBasis: 'per item', status: 'pending_review',
        availabilityState: 'available', condition: 'good',
      }, select: { id: true },
    });
    listingIds.push(listing.id);
    const path = join(mediaRoot, 'follow-notice-qa-' + marker + '-' + listing.id + '.webp');
    await sharp({ create: {
      width: 32, height: 32, channels: 3, background: { r: 220, g: 220, b: 220 },
    } }).webp().toFile(path);
    mediaFiles.push(path);
    await prisma.listingMedia.create({
      data: { listingId: listing.id, mediaPath: path, mimeType: 'image/webp', position: 0 },
    });
    if (previousApproval) await prisma.listingReview.create({
      data: {
        listingId: listing.id, reviewerId: reviewer,
        decision: 'approved', reason: 'Earlier synthetic approval on same listing',
      },
    });
    return listing.id;
  };
  const reviewerToken = signAccess(reviewer);
  const buyerToken = signAccess(buyerA);
  const pathFor = (listingId: number) => '/admin/listings/' + listingId + '/decision';
  const approve = (listingId: number, decision: 'approved' | 'rejected' = 'approved') =>
    http('POST', pathFor(listingId), reviewerToken,
      { decision, reason: 'Human-reviewed synthetic placeholder image only', photosReviewed: true });
  const storeNoticeCount = async (userId: number) => prisma.notification.count({
    where: { userId, type: 'store.new_listing' },
  });

  const first = await makePendingListing('Brand new synthetic product');
  assert(await storeNoticeCount(buyerA) === 0, 'draft/pending notification sent prematurely');
  const approved = await approve(first);
  assert(approved.status === 200 && approved.json.status === 'published',
    'first approval failed (' + approved.status + ')');
  const notices = await prisma.notification.findMany({
    where: { type: 'store.new_listing', userId: { in: users } },
  });
  assert(notices.length === 2, 'first approval did not notify exactly two active followers');
  assert(notices.every(n => [buyerA,buyerB].includes(n.userId)), 'wrong recipient was notified');
  const own = notices.find(n => n.userId === buyerA);
  const payload = (own?.payload ?? {}) as Record<string,unknown>;
  assert(payload.storeId === store.id && payload.listingId === first &&
    payload.listingType === 'physical_product' &&
    payload.storeName === 'Follow Notification QA ' + marker,
    'notification payload does not identify public listing/store');
  assert(await storeNoticeCount(owner) === 0 && await storeNoticeCount(unrelated) === 0 &&
    await storeNoticeCount(suspended) === 0, 'owner, unrelated or suspended account received update');
  const bell = await http('GET', '/notifications', buyerToken);
  assert(bell.status === 200 && Array.isArray(bell.json) &&
    bell.json.some((n:any) => n.type === 'store.new_listing' &&
      n.payload?.listingId === first && !n.readAt), 'follower bell did not receive unread notice');
  const unread = await http('GET', '/notifications/unread-count', buyerToken);
  assert(unread.status === 200 && unread.json.total === 1 &&
    unread.json.messages === 0, 'unread badge not updated correctly');
  const publicListing = await http('GET', '/listings/' + first);
  assert(publicListing.status === 200, 'new public listing unavailable at notification target');
  console.log(JSON.stringify({check:'firstPublicationOnly',result:'PASS',
    recipientCount:2,unreadBadge:1,publicListingLinked:true}));

  const repeated = await approve(first);
  assert(repeated.status === 409, 'repeated review succeeded');
  assert(await storeNoticeCount(buyerA) === 1, 'duplicate review created a second notice');
  const edited = await makePendingListing('Previously approved synthetic product', true);
  const reapproved = await approve(edited);
  assert(reapproved.status === 200, 'previously approved item could not be reapproved');
  assert(await storeNoticeCount(buyerA) === 1 && await storeNoticeCount(buyerB) === 1,
    're-approving an old listing produced a new-product alert');
  const rejected = await makePendingListing('Rejected synthetic item');
  assert((await approve(rejected,'rejected')).status === 200, 'synthetic rejection failed');
  assert(await storeNoticeCount(buyerA) === 1, 'rejected listing notified followers');
  console.log(JSON.stringify({check:'noDuplicateOrNonpublicAlerts',result:'PASS',
    repeatedReviewRejected:true,reapprovalExcluded:true,rejectionExcluded:true}));

  await prisma.storeFollow.deleteMany({
    where: { userId: buyerA, sellerProfileId: store.id },
  });
  const second = await makePendingListing('Second new synthetic product');
  assert((await approve(second)).status === 200, 'second public listing approval failed');
  assert(await storeNoticeCount(buyerA) === 1 && await storeNoticeCount(buyerB) === 2,
    'unfollow did not prevent future alerts, or remaining follower missed an alert');
  console.log(JSON.stringify({check:'unfollowStopsAlerts',result:'PASS',
    formerFollower:1,remainingFollower:2}));
  success = true;
} catch(error) {
  console.error('STORE_FOLLOWER_NOTIFICATION_HTTP_ACCEPTANCE_FAILED: ' +
    (error instanceof Error ? error.message : 'unexpected failure'));
} finally {
  let cleaned = false;
  try {
    if (listingIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: users } } });
      await prisma.listingReview.deleteMany({ where: { listingId: { in: listingIds } } });
      await prisma.listingMedia.deleteMany({ where: { listingId: { in: listingIds } } });
      await prisma.auditLog.deleteMany({ where: {
        actorUserId: reviewerId ?? -1, targetType: 'listing', targetId: { in: listingIds },
      } });
      await prisma.listing.deleteMany({ where: { id: { in: listingIds } } });
    }
    if (sellerProfileId !== null) await prisma.storeFollow.deleteMany({
      where: { sellerProfileId },
    });
    if (sellerProfileId !== null) await prisma.sellerProfile.deleteMany({
      where: { id: sellerProfileId },
    });
    if (users.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: users } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    for (const path of mediaFiles) if (existsSync(path)) unlinkSync(path);
    const missing = users.length ? await prisma.user.count({ where: { id: { in: users } } }) : 0;
    assert(missing === 0, 'synthetic user cleanup incomplete');
    const listingsLeft = listingIds.length ? await prisma.listing.count({
      where: { id: { in: listingIds } },
    }) : 0;
    assert(listingsLeft === 0, 'synthetic listing cleanup incomplete');
    cleaned = true;
    console.log('SYNTHETIC_NOTIFICATION_QA_CLEANUP_PASS: all test users, stores, follows, listings, images, reviews, audit records and alerts removed');
  } catch(error) {
    console.error('SYNTHETIC_NOTIFICATION_QA_CLEANUP_FAILED: ' +
      (error instanceof Error ? error.message : 'unknown'));
  } finally { await prisma.$disconnect(); }
  if (!success || !cleaned) process.exitCode = 1;
}
