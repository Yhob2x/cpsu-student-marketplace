import { Field } from './components/ui/primitives';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, explain } from './api';
import { TransactionStoreReview } from './store-review-widgets';
import { Icon } from './icons';

type Opportunity = { id: number; createdAt: string; listing: { title: string } };
type OpportunitiesPage = {
  available: boolean;
  items: Opportunity[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  reason: string | null;
};

const explanations: Record<string, string> = {
  verified_student_required: 'You need a current, verified CPSU affiliation to rate a store.',
  cannot_review_own_store: 'You cannot review your own store.',
  no_eligible_completed_transaction: 'No completed purchases from this store are available to review.',
  store_reviews_not_ready: 'Store reviews are not available right now.',
};

export function StoreReviewEntry({ storeId, signedIn, onSignIn }: {
  storeId: number;
  signedIn: boolean;
  onSignIn: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OpportunitiesPage | null>(null);
  const [selection, setSelection] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open || !signedIn) return;
    const request = ++requestId.current;
    setLoading(true);
    setError('');
    api<OpportunitiesPage>(`/seller-profiles/${storeId}/review-opportunities?page=${page}`)
      .then(result => {
        if (request !== requestId.current) return;
        setData(result);
        setSelection(current => result.items.some(row => row.id === current)
          ? current : result.items[0]?.id ?? null);
      })
      .catch(err => {
        if (request !== requestId.current) return;
        setData(null);
        setSelection(null);
        setError(explain(err));
      })
      .finally(() => { if (request === requestId.current) setLoading(false); });
    return () => { requestId.current++; };
  }, [open, signedIn, storeId, page, retry]);

  const toggle = () => {
    if (!signedIn) { onSignIn(); return; }
    if (open) { setOpen(false); return; }
    setPage(1); setSelection(null); setData(null); setNotice('');
    setOpen(true);
  };
  const selected = data?.items.find(row => row.id === selection);
  const displayDate = (date: string) =>
    new Date(date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });

  return <div className="store-review-entry">
    <button type="button" className="btn store-review-write-button"
      aria-expanded={open} aria-controls={open ? `store-review-entry-${storeId}` : undefined}
      onClick={toggle}>
      <Icon name="star" size={17} /> {open ? 'Close review' : 'Write a review'}
    </button>
    {!open && notice && <p className="store-review-entry-notice" role="status">{notice}</p>}
    {open && <div className="store-review-entry-panel" id={`store-review-entry-${storeId}`}>
      <h3>Review a purchase from this store</h3>
      {loading && <p className="muted" role="status">Checking your completed purchases…</p>}
      {error && <p className="err" role="alert">Could not check review eligibility: {error}{' '}
        <button type="button" className="btn ghost" onClick={() => setRetry(value => value + 1)}>Retry</button>
      </p>}
      {!loading && !error && data && !data.available &&
        <p className="muted">{explanations.store_reviews_not_ready}</p>}
      {!loading && !error && data?.available && data.items.length === 0 &&
        <div className="store-review-entry-empty">
          <p>{data.reason && explanations[data.reason]
            ? explanations[data.reason] : explanations.no_eligible_completed_transaction}</p>
          <Link className="btn ghost" to="/transactions">My transactions</Link>
        </div>}
      {!loading && !error && data?.available && data.items.length > 0 && <>
        <p className="muted store-review-entry-hint">Choose a completed purchase. Each transaction can be reviewed once.</p>
        {data.items.length > 1 ? <Field htmlFor={`review-transaction-${storeId}`}>
          Completed purchase
          <select id={`review-transaction-${storeId}`} value={selection ?? ''}
            onChange={event => setSelection(Number(event.target.value))}>
            {data.items.map(row => <option key={row.id} value={row.id}>
              {row.listing.title} · {displayDate(row.createdAt)}
            </option>)}
          </select>
        </Field> : selected && <p className="store-review-entry-purchase">
          <strong>{selected.listing.title}</strong> <span>{displayDate(selected.createdAt)}</span>
        </p>}
        {(page > 1 || data.hasMore) && <nav className="store-review-entry-pagination" aria-label="Eligible purchases">
          <button type="button" className="btn ghost" disabled={page === 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button>
          <span>Page {page}</span>
          <button type="button" className="btn ghost" disabled={!data.hasMore}
            onClick={() => setPage(value => value + 1)}>Next</button>
        </nav>}
        {selected && <TransactionStoreReview key={selected.id} transactionId={selected.id}
          onSubmitted={() => {
            setOpen(false);
            setNotice('Your review was submitted for campus approval.');
          }} />}
      </>}
    </div>}
  </div>;
}
