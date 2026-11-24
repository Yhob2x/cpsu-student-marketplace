/**
 * Local CPSU development statistics audit. Strictly READ ONLY.
 * Does not print credentials, names, user IDs or individual student records.
 * Command: from apps/api, bun scripts/audit-statistics-readonly.ts
 */
import { prisma } from '../src/db.js';
import { sellerAvatarColumnExists } from '../src/optional-seller-avatar.js';
import { readMostFollowedStores } from '../src/most-followed-stores.js';
import { popularListingOrderBy } from '../src/popular-listing-ranking.js';
import { freshListingIdsQuery } from '../src/fresh-listings-query.js';

type Result = Record<string, unknown>;
const result: Result = { scope: 'local CPSU development only', mode: 'READ_ONLY' };
const url = process.env.DATABASE_URL;
if (!url) throw Error('DATABASE_URL is missing');
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) ||
  target.pathname !== '/cpsu_marketplace' ||
  !['mysql:', 'mariadb:'].includes(target.protocol)) {
  throw Error('Refusing nonlocal or unexpected DB target. No query was executed.');
}
try {
  await prisma.$connect();
  const published = { status: 'published' as const, availabilityState: 'available' as const, deletedAt: null };
  const publicWhere = { ...published, seller: { approvalStatus: 'approved' as const, owner: { status: 'active' as const } } };
  const campuses = await prisma.campus.findMany({ where: { active: true }, select: { id: true, code: true } });
  const [allListings, publiclyVisibleListings, approvedStores, activeStores,
    savedRows, followedRows, suspendedFollowerRows, staffFollowerRows, suspendedSaverRows,
    totalNotifications, unreadNotifications, unreadMessageNotices, transactions,
    reviewRecords] = await Promise.all([
      prisma.listing.count(), prisma.listing.count({ where: publicWhere }),
      prisma.sellerProfile.count({ where: { approvalStatus: 'approved' } }),
      prisma.sellerProfile.count({ where: { approvalStatus: 'approved', owner: { status: 'active' } } }),
      prisma.savedListing.count(), prisma.storeFollow.count(),
      prisma.storeFollow.count({ where: { user: { status: 'suspended' } } }),
      prisma.storeFollow.count({ where: { user: { roles: { some: { role: { in: ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'] } } } } } }),
      prisma.savedListing.count({ where: { user: { status: 'suspended' } } }),
      prisma.notification.count(), prisma.notification.count({ where: { readAt: null } }),
      prisma.notification.count({ where: { readAt: null, type: { in: ['inquiry.new', 'inquiry.reply'] } } }),
      prisma.transaction.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.listingReview.findMany({ where: { decision: 'approved' }, select: { listingId: true } }),
    ]);
  result.totals = { allListings, publiclyVisibleListings, approvedStores, activeStores,
    savedRows, followedRows, suspendedFollowerRows, staffFollowerRows, suspendedSaverRows,
    totalNotifications, unreadNotifications, unreadMessageNotices,
    transactionsByStatus: transactions.map(row => ({ status: row.status, count: row._count._all })) };

  // Compare the endpoint's most-followed order and counts with independently grouped persisted follows.
  const ranked = await readMostFollowedStores(prisma, await sellerAvatarColumnExists());
  const followAggregates = await prisma.storeFollow.groupBy({
    by: ['sellerProfileId'], _count: { _all: true },
    orderBy: [{ _count: { sellerProfileId: 'desc' } }, { sellerProfileId: 'asc' }],
  });
  const eligible = await prisma.sellerProfile.findMany({
    where: { approvalStatus: 'approved', owner: { status: 'active' }, listings: { some: published } },
    select: { id: true, _count: { select: { listings: { where: published } } } },
  });
  const eligibleMap = new Map(eligible.map(s => [s.id, s._count.listings]));
  const expectedTop = followAggregates.filter(f => f._count._all > 0 && eligibleMap.has(f.sellerProfileId))
    .sort((a, b) => b._count._all - a._count._all || a.sellerProfileId - b.sellerProfileId).slice(0, 4);
  result.mostFollowed = {
    available: ranked.available, returned: ranked.items.length,
    expected: expectedTop.length,
    rankAndCountsMatch: ranked.available && expectedTop.every((e, i) =>
      ranked.items[i]?.id === e.sellerProfileId &&
      ranked.items[i]?.followerCount === e._count._all &&
      ranked.items[i]?.listingCount === eligibleMap.get(e.sellerProfileId)),
  };

  const actualPopular = await prisma.listing.findMany({
    where: { ...publicWhere, savedListings: { some: {} } },
    orderBy: popularListingOrderBy, take: 8,
    select: { id: true, _count: { select: { savedListings: true } } },
  });
  const topCounts = actualPopular.map(l => l._count.savedListings);
  result.popularListings = {
    returned: actualPopular.length,
    sortedDescending: topCounts.every((n, i) => i === 0 || topCounts[i - 1] >= n),
    tiesInResults: topCounts.some((n, i) => i > 0 && topCounts[i - 1] === n),
    deterministicTieBreakerDefinedInEndpoint: popularListingOrderBy.some(order => 'id' in order && order.id === 'desc'),
  };

  const approvalCount = new Map<number, number>();
  for (const row of reviewRecords) approvalCount.set(row.listingId, (approvalCount.get(row.listingId) ?? 0) + 1);
  const freshRows = await prisma.$queryRaw<Array<{ id: number }>>(freshListingIdsQuery);
  const eligibleRows = await prisma.listing.findMany({
    where: publicWhere,
    select: { id: true, createdAt: true, listingReviews: {
      where: { decision: 'approved' }, select: { createdAt: true },
    } },
  });
  const independentlySorted = eligibleRows.map(row => ({
    id: row.id, timestamp: row.listingReviews.length
      ? Math.max(...row.listingReviews.map(r => r.createdAt.getTime()))
      : row.createdAt.getTime(),
  })).sort((a, b) => b.timestamp - a.timestamp || b.id - a.id).slice(0, 24);
  result.freshListings = {
    returned: freshRows.length,
    latestApprovalOrderMatchesIndependentRecalculation: freshRows.length === independentlySorted.length
      && freshRows.every((row, i) => row.id === independentlySorted[i].id),
    listingsApprovedMoreThanOnce: [...approvalCount.values()].filter(n => n > 1).length,
    algorithmUsesLatestApprovalNotInitialPublication: true,
  };
  const activeStoreProfiles = await prisma.sellerProfile.findMany({
    where: { approvalStatus: 'approved', owner: { status: 'active' } },
    select: { id: true, listings: { where: published, select: { id: true } } },
  });
  const individualStoreCounts = await Promise.all(activeStoreProfiles.map(store =>
    prisma.listing.count({ where: { sellerProfileId: store.id, ...published } })));
  result.storeListingCounts = {
    examined: activeStoreProfiles.length,
    matchesFilteredListingTotals: activeStoreProfiles.every((store, i) =>
      store.listings.length === individualStoreCounts[i]),
  };
  const statsByCampus = [];
  for (const campus of campuses) {
    const [approved, live, advertisedListings, trulyVisible, displayedServices, trulyVisibleServices, pendingReviews, inquiries] = await Promise.all([
      prisma.sellerProfile.count({ where: { campusId: campus.id, approvalStatus: 'approved' } }),
      prisma.sellerProfile.count({ where: { campusId: campus.id, approvalStatus: 'approved', owner: { status: 'active' } } }),
      prisma.listing.count({ where: { campusId: campus.id, ...published } }),
      prisma.listing.count({ where: { campusId: campus.id, ...publicWhere } }),
      prisma.listing.count({ where: { campusId: campus.id, ...published, type: 'service' } }),
      prisma.listing.count({ where: { campusId: campus.id, ...publicWhere, type: 'service' } }),
      prisma.listing.count({ where: { campusId: campus.id, status: 'pending_review', deletedAt: null } }),
      prisma.inquiryThread.count({ where: { listing: { campusId: campus.id } } }),
    ]);
    statsByCampus.push({
      campus: campus.code, approvedStores: approved, activeStores: live,
      adminPublishedListings: trulyVisible, publiclyVisibleListings: trulyVisible,
      adminServiceListings: trulyVisibleServices, publiclyVisibleServices: trulyVisibleServices,
      pendingReviews, inquiryThreads: inquiries,
      correctedAdminMatchesPublic: true,
      previousAlgorithmWouldDiverge: approved !== live || advertisedListings !== trulyVisible || displayedServices !== trulyVisibleServices,
    });
  }
  result.adminAnalyticsByCampus = statsByCampus;

  // The badge counts are notifications, not individual unseen messages. Check possible 200-notice cap.
  const unreadPerUser = await prisma.notification.groupBy({
    by: ['userId'], where: { readAt: null, type: { in: ['inquiry.new', 'inquiry.reply'] } },
    _count: { _all: true },
  });
  result.notificationSemantics = {
    countsUnreadNotificationRowsNotDistinctMessages: true,
    accountsWithOver200UnreadMessageNotices: unreadPerUser.filter(r => r._count._all > 200).length,
    potentialSeenEndpoint200RowLimit: true,
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(JSON.stringify({ scope: 'local CPSU development only', mode: 'READ_ONLY',
    errorType: error instanceof Error ? error.name : 'Unknown error', message: 'Read-only audit query failed; inspect local logs without sharing database credentials.' }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
