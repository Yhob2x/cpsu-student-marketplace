/**
 * Pure display rules for the "new listing from a followed store" notification.
 * Lock-screen push deliberately uses less detail; only authenticated in-app
 * notifications show public store and listing names.
 */
export const FOLLOWED_STORE_NOTICE_KIND = {
  title: 'New from a followed store', label: 'Following',
  icon: 'store' as const, tone: 'listing',
};

export type FollowedStoreNoticePayload = {
  storeName?: unknown;
  listingTitle?: unknown;
  listingType?: unknown;
  listingId?: unknown;
};

export function followedStoreNoticeText(p: FollowedStoreNoticePayload | null | undefined): string {
  const data = p ?? {};
  const store = typeof data.storeName === 'string' && data.storeName.trim()
    ? data.storeName : 'A store you follow';
  const item = typeof data.listingTitle === 'string' && data.listingTitle.trim()
    ? data.listingTitle : 'a new listing';
  return `${store} published a new ${data.listingType === 'service' ? 'service' : 'product'}: ${item}.`;
}

export function followedStoreNoticeTarget(p: FollowedStoreNoticePayload | null | undefined): string | null {
  const id = p?.listingId;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    ? `/listings/${id}` : null;
}
