import { useEffect, useState } from 'react';
import { uploadEstimate, uploadPercent } from '../../upload-feedback';

type PhotoProgress = { completed: number; total: number; startedAt: number; lastCompletedAt: number };

export function OperationProgress({ stage, progress }: {
  stage: 'saving' | 'uploading' | 'refreshing';
  progress: PhotoProgress | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stage !== 'uploading') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stage, progress?.startedAt]);
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? 0;
  const percent = uploadPercent(completed, total);
  const label = stage === 'saving' ? 'Saving listing details…'
    : stage === 'refreshing' ? 'Updating your listings…'
    : completed === total ? 'Finishing photo upload…'
    : `Uploading photo ${Math.min(completed + 1, total)} of ${total}…`;
  return <div className="operation-progress" role="group" aria-label="Listing save progress">
    <div className="operation-progress-head">
      <strong role="status">{label}</strong>
      {stage === 'uploading' && <span className="operation-progress-percent">{percent}%</span>}
    </div>
    {stage === 'uploading'
      ? <progress aria-label="Photos uploaded" value={completed} max={total} />
      : <div className="operation-progress-indeterminate" aria-hidden="true"><span /></div>}
    <p className="operation-progress-detail">
      {stage === 'uploading'
        ? <><span>{completed} of {total} photos saved</span><span aria-hidden="true">{uploadEstimate(completed, total, (progress?.lastCompletedAt ?? now) - (progress?.startedAt ?? now), now - (progress?.lastCompletedAt ?? now))}</span></>
        : stage === 'saving' ? 'Preparing your private draft. Time remaining will appear when photos begin uploading.'
        : 'Your changes were received. Refreshing the list.'}
    </p>
  </div>;
}

/** Preserves the content geometry while real records are loading. */
export function ListingCardsSkeleton({ count = 3, decorative = false }: { count?: number; decorative?: boolean }) {
  return <div className="listing-skeleton-wrap" role={decorative ? undefined : 'status'}
    aria-label={decorative ? undefined : 'Loading listings'} aria-hidden={decorative || undefined}>
    {!decorative && <span className="sr-only">Loading listings…</span>}
    <div className="store-card-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <div className="listing-skeleton panel" key={index}>
        <div className="skeleton-block listing-skeleton-image" />
        <div className="listing-skeleton-body">
          <div className="skeleton-block listing-skeleton-title" />
          <div className="skeleton-block listing-skeleton-short" />
          <div className="skeleton-block listing-skeleton-line" />
          <div className="skeleton-block listing-skeleton-action" />
        </div>
      </div>)}
    </div>
  </div>;
}

export function ListingDetailSkeleton() {
  return <section className="detail-skeleton" role="status" aria-label="Loading listing details">
    <span className="sr-only">Loading listing details…</span>
    <div className="detail-skeleton-layout" aria-hidden="true">
      <div className="skeleton-block detail-skeleton-photo" />
      <div className="detail-skeleton-content">
        <div className="skeleton-block detail-skeleton-title" />
        <div className="skeleton-block detail-skeleton-price" />
        <div className="skeleton-block detail-skeleton-description" />
        <div className="skeleton-block detail-skeleton-description" />
        <div className="skeleton-block detail-skeleton-description short" />
        <div className="skeleton-block detail-skeleton-button" />
      </div>
    </div>
  </section>;
}

export function StorefrontSkeleton() {
  return <section className="storefront-skeleton" role="status" aria-label="Loading store">
    <span className="sr-only">Loading store…</span>
    <div aria-hidden="true">
      <div className="skeleton-block storefront-skeleton-cover" />
      <div className="storefront-skeleton-identity">
        <div className="skeleton-block storefront-skeleton-avatar" />
        <div className="storefront-skeleton-heading">
          <div className="skeleton-block listing-skeleton-title" />
          <div className="skeleton-block listing-skeleton-short" />
        </div>
      </div>
    </div>
    <ListingCardsSkeleton count={3} decorative />
  </section>;
}
