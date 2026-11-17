import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, explain, peso } from './api';
import { useMe } from './main';
import { useForegroundRefresh } from './foreground-refresh';

type Status = 'pending' | 'accepted' | 'negotiating' | 'for_meetup' | 'completed' | 'cancelled';
type TransactionRow = {
  id: number; listingId: number; inquiryThreadId: number;
  buyerUserId: number; sellerUserId: number; status: Status;
  price: number; currency: string; createdAt: string;
  buyerMeetupConfirmedAt: string | null; sellerMeetupConfirmedAt: string | null;
  buyerCompletionConfirmedAt: string | null; sellerCompletionConfirmedAt: string | null;
  listing: { title: string; type: string };
  buyer?: { displayName: string }; seller?: { displayName: string };
};
type Event = { id: number; actorUserId: number; event: string; fromStatus: Status | null;
  toStatus: Status; reason: string | null; createdAt: string };
type Detail = TransactionRow & { history: Event[]; handoff: { method: string; timeWindow: string; generalLocation: string; status: string } | null };

const names: Record<Status, string> = {
  pending: 'Pending seller decision',
  accepted: 'Accepted',
  negotiating: 'Discussing arrangements',
  for_meetup: 'Meetup agreed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const eventName: Record<string, string> = {
  requested: 'Request submitted', accepted: 'Seller accepted', rejected: 'Seller rejected',
  negotiating: 'Discussion started', meetup_confirmed: 'Meetup confirmed',
  completion_confirmed: 'Completion confirmed', cancelled: 'Request cancelled',
};
const stamp = (value: string) => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export function Transactions() {
  const { me } = useMe();
  const [items, setItems] = useState<TransactionRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fetchPage = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const result = await api<{ items: TransactionRow[]; total: number }>(`/transactions?page=${page}&pageSize=15`);
      setItems(result.items); setTotal(result.total); setError('');
    } catch (e) { setError(explain(e)); } finally { if (!quiet) setLoading(false); }
  }, [page]);
  useEffect(() => { void fetchPage(); }, [fetchPage]);
  useForegroundRefresh(() => fetchPage(true), 7_000, Boolean(me));

  return <section className="stack" aria-labelledby="transactions-heading">
    <div className="page-head"><div><h1 id="transactions-heading">My transactions</h1>
      <p className="muted">Requests, meetup agreements and outcomes. Payments are arranged between students, never through CPSU Market.</p>
    </div></div>
    {error && <p role="alert" className="err">Transactions could not load: {error} <button type="button" className="btn ghost" onClick={() => void fetchPage()}>Retry</button></p>}
    {loading && <p role="status" className="muted">Loading transactions…</p>}
    {!loading && !error && !items.length && <div className="empty">
      <h2>No transactions yet</h2>
      <p className="muted">A transaction appears when you request a product or service, or when someone requests your listing.</p>
      <Link to="/explore" className="btn">Explore listings</Link>
    </div>}
    {!error && items.map(t => <article className="panel stack" key={t.id}>
      <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div><h2 style={{ margin: 0, fontSize: '1.15rem' }}>
          <Link to={`/transactions/${t.id}`}>{t.listing.title}</Link>
        </h2><p className="muted" style={{ margin: '.25rem 0 0' }}>
          {t.buyerUserId === me?.id ? 'Your purchase request' : 'Request from a buyer'} · {stamp(t.createdAt)}
        </p></div>
        <span className="tag">{names[t.status]}</span>
      </div>
      <p style={{ margin: 0 }}>{peso(t.price)} <span className="muted">· {t.listing.type === 'service' ? 'Service' : 'Product'}</span></p>
      <div className="row"><Link className="btn" to={`/transactions/${t.id}`}>View transaction</Link>
        <Link className="btn ghost" to={`/inquiries/${t.inquiryThreadId}`}>Open conversation</Link></div>
    </article>)}
    {!loading && !error && total > 15 && <nav aria-label="Transaction pages" className="row" style={{ justifyContent: 'center' }}>
      <button type="button" className="btn ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
      <span className="muted" role="status">Page {page} of {Math.ceil(total / 15)}</span>
      <button type="button" className="btn ghost" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
    </nav>}
  </section>;
}

export function TransactionDetail() {
  const { id } = useParams();
  const { me, syncUnread } = useMe();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    try {
      const next = await api<Detail>(`/transactions/${id}`);
      setData(next); setError('');
    } catch (e) { setError(explain(e)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { setData(null); setLoading(true); setError(''); void reload(); }, [reload]);
  // When the other student confirms, refresh status without requiring a full page reload.
  // Foreground-only polling never caches the participant's private transaction data.
  useForegroundRefresh(() => reload(), 5_000,
    Boolean(me && data && data.status !== 'completed' && data.status !== 'cancelled'));

  const act = async (suffix: string, body: unknown = {}) => {
    if (busy) return;
    setBusy(true); setActionError(''); setNotice('');
    try {
      await api(`/transactions/${id}/${suffix}`, { body });
      setReason('');
      await reload();
      void syncUnread();
      setNotice('Transaction updated. The other student has been notified.');
    } catch (e) { setActionError(explain(e)); await reload(); }
    finally { setBusy(false); }
  };
  if (loading && !data) return <p role="status" className="muted">Loading transaction…</p>;
  if (error && !data) return <section className="empty"><h1>Transaction unavailable</h1>
    <p className="err" role="alert">{error}</p><Link to="/transactions">Back to my transactions</Link></section>;
  if (!data) return null;

  const buyer = data.buyerUserId === me?.id;
  const seller = data.sellerUserId === me?.id;
  const terminal = data.status === 'completed' || data.status === 'cancelled';
  const myMeetupConfirmed = Boolean(buyer ? data.buyerMeetupConfirmedAt : data.sellerMeetupConfirmedAt);
  const otherMeetupConfirmed = Boolean(buyer ? data.sellerMeetupConfirmedAt : data.buyerMeetupConfirmedAt);
  const myCompletionConfirmed = Boolean(buyer ? data.buyerCompletionConfirmedAt : data.sellerCompletionConfirmedAt);
  const otherCompletionConfirmed = Boolean(buyer ? data.sellerCompletionConfirmedAt : data.buyerCompletionConfirmedAt);
  const canMeetup = ['accepted', 'negotiating'].includes(data.status);
  const canComplete = data.status === 'for_meetup';

  return <article className="stack" aria-labelledby="transaction-heading">
    <Link className="listing-back" to="/transactions">← My transactions</Link>
    <div className="page-head"><div>
      <h1 id="transaction-heading">{data.listing.title}</h1>
      <p className="muted">Transaction #{data.id} · {buyer ? 'You are the buyer' : seller ? 'You are the seller' : 'Transaction'}
        · {peso(data.price)} (price when requested)</p>
    </div></div>
    <section className="panel stack" aria-label="Transaction status">
      <div className="row"><h2 style={{ margin: 0 }}>Current status</h2><span className="tag">{names[data.status]}</span></div>
      <p className="muted" style={{ margin: 0 }}>This status is student-reported. CPSU Market does not verify payments, deliveries, or item condition.</p>
    </section>
    {!terminal && <section className="panel stack" aria-label="Update this transaction">
      <h2>Next action</h2>
      {data.status === 'pending' && buyer && <p className="muted">Waiting for the seller to accept or reject your request. You may withdraw with a reason.</p>}
      {data.status === 'pending' && seller && <div className="stack">
        <p className="muted">Review the request before accepting. For a physical product, accepting reserves the item for this buyer.</p>
        <button className="btn" disabled={busy} onClick={() => void act('decision', { action: 'accept' })}>Accept request</button>
        <p className="muted">To reject, explain why below.</p>
      </div>}
      {data.status === 'accepted' && <button className="btn ghost" disabled={busy}
        onClick={() => void act('negotiating')}>Mark as discussing terms</button>}
      {canMeetup && <div className="stack">
        <p className="muted">Each student must independently confirm the meetup arrangement. One confirmation does not finalize it.</p>
        <p role="status" className="muted">Your confirmation: {myMeetupConfirmed ? 'Confirmed' : 'Not yet'} · Other student: {otherMeetupConfirmed ? 'Confirmed' : 'Not yet'}</p>
        <button className="btn" disabled={busy || myMeetupConfirmed} onClick={() => void act('confirm-meetup')}>
          {myMeetupConfirmed ? 'Waiting for the other student' : 'Confirm meetup arrangement'}
        </button>
      </div>}
      {canComplete && <div className="stack">
        <p className="muted">Only confirm completion after you have fulfilled your side of the agreement. Both students must confirm.</p>
        <p role="status" className="muted">Your completion: {myCompletionConfirmed ? 'Confirmed' : 'Not yet'} · Other student: {otherCompletionConfirmed ? 'Confirmed' : 'Not yet'}</p>
        <button className="btn" disabled={busy || myCompletionConfirmed} onClick={() => void act('confirm-completion')}>
          {myCompletionConfirmed ? 'Waiting for the other student' : 'Confirm transaction completed'}
        </button>
      </div>}
      <div className="stack">
        <label className="field" htmlFor="transaction-cancellation-reason">Reason for rejection or cancellation (required, 10–500 characters)
          <textarea id="transaction-cancellation-reason" value={reason} maxLength={500} minLength={10}
            placeholder="Briefly explain what changed or why you cannot proceed"
            onChange={e => setReason(e.target.value)} />
        </label>
        <div className="row">
          {data.status === 'pending' && seller && <button type="button" className="btn ghost"
            disabled={busy || reason.trim().length < 10}
            onClick={() => void act('decision', { action: 'reject', reason })}>Reject request</button>}
          <button type="button" className="btn danger" disabled={busy || reason.trim().length < 10}
            onClick={() => void act('cancel', { reason })}>Cancel transaction</button>
        </div>
      </div>
      {actionError && <p role="alert" className="err">{actionError}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>}
    {terminal && <p role="status">{data.status === 'completed'
      ? 'Both students confirmed completion. This is a mutual self-report, not an independently verified sale.'
      : 'This transaction is closed. The history below remains available to both students.'}</p>}
    <section className="panel stack" aria-label="Transaction options">
      <h2 style={{ margin: 0 }}>More options</h2>
      <p className="muted" style={{ margin: 0 }}>Payment and handoff are arranged directly between students.</p>
      <div className="row">
        <Link to={`/inquiries/${data.inquiryThreadId}`} className="btn ghost">Discuss arrangements</Link>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => void reload()}>Refresh status</button>
        <Link to={`/listings/${data.listingId}`} className="btn ghost">View listing</Link>
      </div>
    </section>
    {data.handoff && <aside className="panel stack" aria-label="Previous handoff arrangements">
      <h2>Handoff details (self-reported)</h2>
      <p>{data.handoff.generalLocation} · {data.handoff.timeWindow}</p>
      <p className="muted">Recorded separately in your conversation; this does not prove transaction completion.</p>
    </aside>}
    <section className="panel stack" aria-labelledby="transaction-history-heading">
      <h2 id="transaction-history-heading">Activity history</h2>
      <ol className="stack" style={{ paddingInlineStart: '1.25rem' }}>
        {data.history.map(event => <li key={event.id}>
          <strong>{eventName[event.event] ?? event.event}</strong>
          <span className="muted"> · {event.actorUserId === me?.id ? 'You' : 'Other student'}</span>
          <p className="muted" style={{ margin: '.15rem 0' }}><time dateTime={event.createdAt}>{stamp(event.createdAt)}</time>
            {' · '}{names[event.toStatus]}</p>
          {event.reason && <p style={{ overflowWrap: 'anywhere' }}>Reason: {event.reason}</p>}
        </li>)}
      </ol>
    </section>
  </article>;
}
