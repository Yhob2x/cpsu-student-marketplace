/**
 * Publish-time notifications for students following a store.
 *
 * Important: call only within the successful pending_review -> published transaction.
 * Drafts, pending content, an already-published listing and later re-approvals
 * must never fan out as "new" items.
 */
import type { Prisma } from '@prisma/client';
import { deliverPush } from './push.js';
import { pushOutboxWritesActivated, stagePushOutbox } from './push-outbox.js';

export const FOLLOWED_STORE_NEW_LISTING = 'store.new_listing';

export type PublishedListing = {
  id: number;
  title: string;
  type: 'physical_product' | 'service';
  sellerProfileId: number;
  storeName: string;
  ownerUserId: number;
};

export type FollowerPublicationNotice = {
  id: number;
  userId: number;
  payload: {
    storeId: number;
    storeName: string;
    listingId: number;
    listingTitle: string;
    listingType: PublishedListing['type'];
  };
};

type PublicationTransaction = Pick<Prisma.TransactionClient, 'storeFollow' | 'notification'>;

export async function createFollowerPublicationNotices(
  tx: PublicationTransaction, listing: PublishedListing,
): Promise<FollowerPublicationNotice[]> {
  // Never notify sellers about their own stores or send to suspended/staff accounts.
  // Follows must exist *when the first public approval commits*.
  const followers = await tx.storeFollow.findMany({
    where: {
      sellerProfileId: listing.sellerProfileId,
      userId: { not: listing.ownerUserId },
      user: {
        status: 'active',
        roles: { none: { role: { in: ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'] } } },
      },
    },
    select: { userId: true },
  });
  const payload = {
    storeId: listing.sellerProfileId,
    storeName: listing.storeName,
    listingId: listing.id,
    listingTitle: listing.title,
    listingType: listing.type,
  };
  const notices: FollowerPublicationNotice[] = [];
  // The same approval transaction writes both the new public status and these
  // in-app notices. Failure rolls back publication rather than silently losing alerts.
  // Individual creates return IDs needed to target push alerts and app badges.
  for (const follow of followers) {
    const row = await tx.notification.create({
      data: { userId: follow.userId, type: FOLLOWED_STORE_NEW_LISTING, payload },
      select: { id: true },
    });
    await stagePushOutbox(tx, { id: row.id, userId: follow.userId, type: FOLLOWED_STORE_NEW_LISTING });
    notices.push({ id: row.id, userId: follow.userId, payload });
  }
  return notices;
}

/** Bound fan-out so a popular store cannot spawn an unlimited relay burst. */
export async function sendFollowerPushBatch(
  notices: FollowerPublicationNotice[],
  send: (notice: FollowerPublicationNotice) => Promise<void>,
  concurrency = 4,
): Promise<number> {
  let next = 0;
  let failures = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), notices.length) }, async () => {
    while (next < notices.length) {
      const notice = notices[next++];
      try { await send(notice); } catch { failures++; }
    }
  }));
  return failures;
}

/** Optional, best-effort push after the in-app transaction commits. */
export function deliverFollowerPublicationPush(notices: FollowerPublicationNotice[]): void {
  if (!notices.length || pushOutboxWritesActivated) return;
  void sendFollowerPushBatch(notices, n =>
    deliverPush(n.userId, FOLLOWED_STORE_NEW_LISTING, n.payload, n.id),
  ).then(failures => {
    if (failures > 0) console.warn('Followed-store push attempts failed', { failures });
  });
}
