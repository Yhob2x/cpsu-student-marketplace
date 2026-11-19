// Activity labels describe recorded marketplace participation, never identity verification.
// Use only persisted, public-facing events; drafts, pending listings, and private messages do not count.
export type StoreActivityMetrics = {
  publishedListingCount: number;
  followerCount: number | null; // null means the follower feature is unavailable, not zero followers.
};

export function storeActivityBadge({ publishedListingCount, followerCount }: StoreActivityMetrics) {
  const listings = Math.max(0, publishedListingCount);
  const followers = followerCount === null ? null : Math.max(0, followerCount);
  const listingText = `${listings} published ${listings === 1 ? 'listing' : 'listings'}`;
  const followerText = followers === null ? '' : `, ${followers} ${followers === 1 ? 'follower' : 'followers'}`;
  const reason = `Based on ${listingText}${followerText}. This is an activity label, not a verification or safety guarantee.`;

  if (listings > 0 && followers !== null && followers >= 20) {
    return { label: 'Popular store', reason };
  }
  if (listings >= 5) return { label: 'Frequent seller', reason };
  if (listings >= 1) return { label: 'Active seller', reason };
  return { label: 'New store', reason };
}
