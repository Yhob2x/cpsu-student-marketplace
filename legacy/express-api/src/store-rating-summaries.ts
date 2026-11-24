/** Read published review averages once per listing batch (no per-card requests). */
export type PublishedStoreRating = { average: number; count: number };
type RatingGroup = { sellerProfileId: number; _avg: { rating: number | null }; _count: { _all: number } };
type RatingSource = { storeReview?: { groupBy(args: unknown): Promise<RatingGroup[]> } };

function unavailableReviewTable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error.code === 'P2021' || error.code === 'P2022');
}

export async function readPublishedStoreRatings(source: RatingSource, ids: readonly number[]): Promise<Map<number, PublishedStoreRating>> {
  const ratings = new Map<number, PublishedStoreRating>();
  const sellerIds = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0);
  if (sellerIds.length === 0 || !source.storeReview) return ratings;
  try {
    const groups = await source.storeReview.groupBy({
      by: ['sellerProfileId'],
      where: { sellerProfileId: { in: sellerIds }, status: 'published' },
      _avg: { rating: true }, _count: { _all: true },
    });
    for (const group of groups) {
      if (!sellerIds.includes(group.sellerProfileId) || group._count._all < 1 ||
          group._avg.rating === null || !Number.isFinite(group._avg.rating)) continue;
      ratings.set(group.sellerProfileId, {
        count: group._count._all,
        average: Math.round(group._avg.rating * 10) / 10,
      });
    }
  } catch (error) {
    // Older development/staging schemas have no review table yet.
    if (!unavailableReviewTable(error)) throw error;
  }
  return ratings;
}
