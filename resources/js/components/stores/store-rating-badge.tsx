import type { StoreReviewSummary } from './store-review-widgets';

/** Compact public rating; only published, moderated reviews are eligible. */
export function StoreRatingBadge({ summary }: { summary: StoreReviewSummary | null }) {
  if (!summary || summary.count < 1 || summary.average == null || !Number.isFinite(summary.average)) return null;
  const average = summary.average.toFixed(1);
  const reviews = `${summary.count} moderated ${summary.count === 1 ? 'review' : 'reviews'}`;
  return <a className="storefront-rating-badge" href="#store-review-heading"
    title={`View ${reviews}`}
    aria-label={`Store rating ${average} out of 5 from ${reviews}. View reviews`}>
    <span className="storefront-rating-star" aria-hidden="true">★</span>
    <strong>{average}</strong>
    <span className="storefront-rating-count" aria-hidden="true">({summary.count})</span>
  </a>;
}
