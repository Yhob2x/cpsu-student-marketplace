import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { showActionFeedback } from '@/components/action-feedback';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { api, ApiError, explain } from '@/lib/api';

type Review = { id: number; rating: number; body: string | null; createdAt: string;
  status?: string; moderationReason?: string | null };
export type StoreReviewSummary = { count: number; average: number | null; distribution?: Record<number, number> };
type PublicPage = { available: boolean; summary: StoreReviewSummary | null;
  items: Review[]; page: number; pageSize: number };

function RatingStars({ value, size = 'normal' }: { value: number; size?: 'normal' | 'large' }) {
  return <span className={`store-rating-stars store-rating-${size}`} role="img" aria-label={`${value} out of 5 stars`}>
    {Array.from({ length: 5 }, (_, i) => <span key={i} aria-hidden="true">{i < Math.round(value) ? '★' : '☆'}</span>)}
  </span>;
}

export function StoreRatingsAndReviews({ storeId, reviewAction, onSummary }: { storeId: number; reviewAction?: ReactNode;
  onSummary?: (summary: StoreReviewSummary | null) => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PublicPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const load = () => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    api<PublicPage>(`/seller-profiles/${storeId}/reviews?page=${page}`)
      .then(result => {
        if (request !== requestId.current) return;
        setData(result);
        onSummary?.(result.available ? result.summary : null);
      })
      .catch(e => {
        if (request !== requestId.current) return;
        onSummary?.(null);
        // Older development API processes have no review route yet. Do not show a false outage.
        if (e instanceof ApiError && e.status === 404) {
          setData({ available: false, summary: null, items: [], page, pageSize: 8 });
          setError('');
        } else setError(explain(e));
      })
      .finally(() => { if (request === requestId.current) setLoading(false); });
  };
  useEffect(() => { load(); return () => { requestId.current++; }; }, [storeId, page]);
  const pages = data?.summary ? Math.ceil(data.summary.count / (data.pageSize || 8)) : 1;
  return <section className="store-reviews-section" aria-labelledby="store-review-heading">
    <div className="store-reviews-heading">
      <h2 id="store-review-heading">Ratings &amp; reviews</h2>
      {data?.available && data.summary && data.summary.count > 0 && <span className="store-reviews-kicker">Published buyer feedback</span>}
    </div>
    {data?.available && data.summary && data.summary.count > 0 && <div className="store-review-overview">
      <div className="store-review-score-card" role="group" aria-label="Store's average published rating">
        <strong className="store-review-average">{data.summary.average?.toFixed(1)} <span>/ 5</span></strong>
        <RatingStars value={data.summary.average ?? 0} size="large" />
        <p>{data.summary.count} moderated {data.summary.count === 1 ? 'review' : 'reviews'}</p>
      </div>
      {data.summary.distribution && <div className="store-review-distribution" role="group" aria-label="Published rating distribution">
        <h3>Rating breakdown</h3>
        {[5, 4, 3, 2, 1].map(stars => <div key={stars} className="store-review-distribution-row">
          <span>{stars} <span aria-hidden="true">★</span></span>
          <progress aria-label={`${stars}-star reviews`} value={data.summary!.distribution?.[stars] ?? 0} max={data.summary!.count} />
          <span>{data.summary!.distribution?.[stars] ?? 0}</span>
        </div>)}
      </div>}
    </div>}
    {loading && <p className="muted" role="status">Loading store reviews…</p>}
    {error && <p className="err" role="alert">Could not load store reviews: {error} <LegacyButton type="button" className="ghost" onClick={load}>Retry</LegacyButton></p>}
    {!loading && !error && data?.available === false && <p className="muted">Store ratings and reviews are being prepared.</p>}
    {!loading && !error && data?.available && data.summary?.count === 0 &&
      <div className="store-review-empty">
        <div className="store-review-empty-intro">
          <span className="store-review-empty-icon" aria-hidden="true"><Icon name="star" size={21} /></span>
          <div className="store-review-empty-copy">
            <strong>No reviews yet</strong>
            <p>Approved buyer reviews will appear here.</p>
          </div>
        </div>
        {reviewAction}
      </div>}
    {!loading && !error && data?.available && data.items.length > 0 && <div className="store-review-list">
      {data.items.map(review => <article key={review.id} className="store-review-row">
        <div className="store-review-meta"><RatingStars value={review.rating} />
          <span>Completed-transaction buyer</span>
          <time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}</time></div>
        {review.body && <p>{review.body}</p>}
      </article>)}
    </div>}
    {!loading && !error && data?.available && data.summary?.count !== 0 && reviewAction}
    <p className="muted store-review-disclosure">Only verified buyers of completed transactions can rate stores. Reviews are student opinions, not CPSU endorsements.</p>
    {!loading && !error && data?.available && pages > 1 && <nav className="store-review-pagination" aria-label="Store review pages">
      <LegacyButton type="button" className="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</LegacyButton>
      <span>Page {page} of {pages}</span>
      <LegacyButton type="button" className="ghost" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</LegacyButton>
    </nav>}
  </section>;
}

type BuyerReviewState = { available: boolean; eligible: boolean; review: Review | null;
  reason?: string | null };
const reviewEligibilityMessages: Record<string, string> = {
  transaction_not_completed: 'Both students must confirm completion before a store review can be submitted.',
  verified_student_required: 'A current, verified CPSU affiliation is required to review this transaction.',
  store_not_available: 'This store is no longer eligible for public reviews.',
  cannot_review_own_store: 'Store owners cannot rate their own stores.',
};
export function TransactionStoreReview({ transactionId, onSubmitted }: {
  transactionId: number; onSubmitted?: () => void;
}) {
  const [data, setData] = useState<BuyerReviewState | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const requestId = useRef(0);
  const load = () => {
    const request = ++requestId.current;
    setLoading(true);
    api<BuyerReviewState>(`/transactions/${transactionId}/store-review`)
      .then(r => { if (request === requestId.current) { setData(r); setError(''); } })
      .catch(e => {
        if (request !== requestId.current) return;
        if (e instanceof ApiError && (e.status === 404 || e.code === 'store_reviews_not_ready')) {
          setData({ available: false, eligible: false, review: null }); setError('');
        } else setError(explain(e));
      }).finally(() => { if (request === requestId.current) setLoading(false); });
  };
  useEffect(() => {
    setData(null); setRating(0); setBody(''); setNotice(''); setError('');
    load(); return () => { requestId.current++; };
  }, [transactionId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || rating < 1 || rating > 5) return;
    inFlight.current = true; setSaving(true); setError(''); setNotice('');
    try {
      await api(`/transactions/${transactionId}/store-review`, { body: { rating, body: body.trim() || null } });
      setNotice('Review submitted. A campus reviewer will check it before publication.');
      showActionFeedback({ kind: 'success', title: 'Rating submitted', message: 'Your store review is awaiting campus moderation.', presentation: 'center' });
      if (onSubmitted) onSubmitted();
      else await load();
    } catch (e) {
      setError(explain(e));
      showActionFeedback({ kind: 'error', title: 'Review not submitted',
        message: explain(e) });
    } finally { setSaving(false); inFlight.current = false; }
  };
  return <Panel as="section" className="store-transaction-review" aria-labelledby="transaction-review-heading">
    <h2 id="transaction-review-heading">Rate this store</h2>
    {loading && <p role="status">Checking review eligibility…</p>}
    {!loading && data && !data.available && <p className="muted">Store ratings are not enabled yet.</p>}
    {!loading && data?.review && <div className="store-review-own-status"><RatingStars value={data.review.rating} />
      <p>Status: <strong>{data.review.status === 'pending' ? 'Awaiting campus review' : data.review.status === 'published' ? 'Published' : data.review.status === 'rejected' ? 'Not approved' : 'Hidden by a reviewer'}</strong></p>
      {data.review.body && <p>{data.review.body}</p>}
      {data.review.moderationReason && data.review.status !== 'published' && <p className="muted">Reviewer note: {data.review.moderationReason}</p>}
    </div>}
    {!loading && data?.available && data.eligible && <form className="store-rating-form" aria-busy={saving} onSubmit={submit}>
      <p className="muted">You can leave one rating for this completed transaction. Payment and delivery are self-reported, not independently verified by CPSU.</p>
      <fieldset className="store-review-picker"><legend>Your rating (required)</legend>
        {Array.from({ length: 5 }, (_, i) => <label key={i} className="store-review-star-option">
          <input type="radio" name="rating" value={i + 1} checked={rating === i + 1}
            aria-label={`${i + 1} ${i + 1 === 1 ? 'star' : 'stars'}`}
            disabled={saving} onChange={() => setRating(i + 1)} required />
          <span aria-hidden="true">{i < rating ? '★' : '☆'}</span>
        </label>)}
        <span className="store-review-picker-caption" role="status">{rating ? `${rating} of 5 stars selected` : 'Choose 1–5 stars'}</span>
      </fieldset>
      <Field>Written review (optional)
        <textarea value={body} maxLength={800} rows={3} disabled={saving}
          placeholder="Describe your experience with this store. Avoid personal contact details."
          onChange={e => setBody(e.target.value)} />
      </Field>
      <LegacyButton type="submit" className="" disabled={saving || rating < 1}>{saving ? 'Submitting…' : 'Submit store rating'}</LegacyButton>
    </form>}
    {!loading && data?.available && !data.eligible && !data.review &&
      <p className="muted">{data.reason && reviewEligibilityMessages[data.reason]
        ? reviewEligibilityMessages[data.reason]
        : 'This transaction is not currently eligible for a new review.'}</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="err" role="alert">{error} <LegacyButton type="button" className="ghost" onClick={load}>Retry</LegacyButton></p>}
  </Panel>;
}

type QueueReview = Review & { store: { storeName: string; campusId: number };
  transaction: { listing: { title: string } } };
export function StoreReviewModeration() {
  const [items, setItems] = useState<QueueReview[]>([]);
  const [mode, setMode] = useState<'pending' | 'published'>('pending');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const load = async () => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    try {
      const result = await api<{ items: QueueReview[]; hasMore: boolean }>(`/admin/store-reviews?status=${mode}&page=${page}`);
      if (request !== requestId.current) return;
      setItems(result.items); setHasMore(result.hasMore);
    } catch (e) { if (request === requestId.current) { setItems([]); setError(explain(e)); } }
    finally { if (request === requestId.current) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { requestId.current++; }; }, [mode, page]);
  const decide = async (id: number, decision: 'published' | 'rejected' | 'hidden') => {
    const reason = (reasons[id] || '').trim();
    if (reason.length < 10 || busy !== null) return;
    if (decision === 'hidden' && !window.confirm('Hide this published review? It will no longer count toward the public rating.')) return;
    setBusy(id); setError(''); setNotice('');
    try {
      await api(`/admin/store-reviews/${id}/decision`, { body: { decision, reason } });
      const action = decision === 'published' ? 'approved' : decision === 'rejected' ? 'rejected' : 'hidden';
      setNotice(`Store review #${id} ${action}. Decision recorded.`);
      showActionFeedback({ kind: 'success', title: `Review ${action}`, message: 'Your moderation decision was saved.', presentation: 'center' });
      setReasons(prev => ({ ...prev, [id]: '' }));
      await load();
    } catch (e) {
      setError(explain(e));
      showActionFeedback({ kind: 'error', title: 'Review decision not saved',
        message: explain(e) });
    } finally { setBusy(null); }
  };
  return <section className="store-review-admin" aria-labelledby="store-review-admin-heading">
    <h2 id="store-review-admin-heading">Store rating moderation</h2>
    <p className="muted">Ratings from completed transactions need review before appearing publicly. You can hide published reviews if they violate CPSU marketplace rules.</p>
    <div className="row"><LegacyButton type="button" className="ghost" disabled={busy !== null} aria-pressed={mode === 'pending'} onClick={() => { setMode('pending'); setPage(1); }}>Awaiting review</LegacyButton>
      <LegacyButton type="button" className="ghost" disabled={busy !== null} aria-pressed={mode === 'published'} onClick={() => { setMode('published'); setPage(1); }}>Published reviews</LegacyButton></div>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="err" role="alert">{error} <LegacyButton type="button" className="ghost" onClick={() => void load()}>Retry</LegacyButton></p>}
    {loading && <p role="status">Loading store ratings…</p>}
    {!loading && !error && items.length === 0 && <p className="muted">No reviews in this category.</p>}
    {!loading && !error && items.map(item => <Panel as="article" className="store-review-admin-card" key={item.id}>
      <h3>{item.store.storeName} — {item.transaction.listing.title}</h3>
      <RatingStars value={item.rating} />
      <p className="muted">Review #{item.id} · {new Date(item.createdAt).toLocaleDateString('en-PH')}</p>
      <p>{item.body || 'Star rating only — no written review.'}</p>
      <Field>Decision reason (at least 10 characters)
        <textarea value={reasons[item.id] ?? ''} maxLength={500} disabled={busy !== null}
          placeholder="Record why this review is appropriate or violates marketplace rules"
          onChange={event => setReasons(prev => ({ ...prev, [item.id]: event.target.value }))} />
      </Field>
      <div className="row">{mode === 'pending' ? <>
        <LegacyButton className="" disabled={(reasons[item.id] || '').trim().length < 10 || busy !== null}
          onClick={() => void decide(item.id, 'published')}>Approve review</LegacyButton>
        <LegacyButton className="ghost" disabled={(reasons[item.id] || '').trim().length < 10 || busy !== null}
          onClick={() => void decide(item.id, 'rejected')}>Reject review</LegacyButton>
      </> : <LegacyButton className="danger" disabled={(reasons[item.id] || '').trim().length < 10 || busy !== null}
        onClick={() => void decide(item.id, 'hidden')}>Hide review</LegacyButton>}</div>
    </Panel>)}
    {!error && !loading && (page > 1 || hasMore) && <nav className="row" aria-label="Moderated review pages">
      <LegacyButton type="button" className="ghost" disabled={page === 1 || busy !== null} onClick={() => setPage(p => p - 1)}>Previous</LegacyButton>
      <span>Page {page}</span>
      <LegacyButton type="button" className="ghost" disabled={!hasMore || busy !== null} onClick={() => setPage(p => p + 1)}>Next</LegacyButton>
    </nav>}
  </section>;
}
