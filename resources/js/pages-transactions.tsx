import { LegacyButton } from './components/ui/legacy-button';
import { Field, Panel } from './components/ui/primitives';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Clock3, MessageCircle, RefreshCw, X } from 'lucide-react';
import { api, explain, peso } from './api';
import { useMe } from './main';
import { showActionFeedback } from './action-feedback';
import { TransactionStoreReview } from './store-review-widgets';
import { useForegroundRefresh } from './foreground-refresh';
import { MeetupLocationCard, type MeetupHandoff } from './meetup-location-card';
import { preferredCampusName } from './meetup-campus';
import {
  statusLabels, transactionNextStep, transactionPhase, type TransactionSnapshot, type TransactionStatus,
} from './transaction-flow';
import '../css/transactions-polish.css';

type TransactionRow = TransactionSnapshot & {
  id: number; listingId: number; inquiryThreadId: number;
  price: number; currency: string; createdAt: string;
  listing: { title: string; type: string };
  buyer?: { displayName: string }; seller?: { displayName: string };
};
type Event = { id: number; actorUserId: number; event: string; fromStatus: TransactionStatus | null;
  toStatus: TransactionStatus; reason: string | null; createdAt: string };
type Detail = TransactionRow & { history: Event[]; handoff: MeetupHandoff | null };
type RoleFilter = 'all' | 'buying' | 'selling';

const eventName: Record<string, string> = {
  requested: 'Request sent', accepted: 'Request accepted', rejected: 'Request declined',
  negotiating: 'Arrangement discussion started', meetup_confirmed: 'Meetup confirmed',
  meetup_location_shared: 'Meetup location shared',
  meetup_location_revised: 'Meetup location changed — confirmations reset',
  completion_confirmed: 'Completion confirmed', cancelled: 'Transaction cancelled',
};
const steps = ['Requested', 'Accepted', 'Meetup agreed', 'Completed'];
const stamp = (value: string) => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

function StatusPill({ status }: { status: TransactionStatus }) {
  return <span className={'transaction-status transaction-status--' + status}>{statusLabels[status]}</span>;
}

export function Transactions() {
  const { me } = useMe();
  const [items, setItems] = useState<TransactionRow[]>([]);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const fetchPage = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    try {
      const result = await api<{ items: TransactionRow[]; total: number }>(
        '/transactions?page=' + page + '&pageSize=15&role=' + filter,
      );
      if (version !== requestVersion.current) return;
      setItems(result.items);
      setTotal(result.total);
      setError('');
    } catch (e) {
      if (version === requestVersion.current) setError(explain(e));
    } finally {
      if (version === requestVersion.current && !quiet) setLoading(false);
    }
  }, [page, filter]);
  useEffect(() => {
    void fetchPage();
    return () => { requestVersion.current += 1; };
  }, [fetchPage]);
  useForegroundRefresh(() => fetchPage(true), 7_000, Boolean(me));

  const changeFilter = (next: RoleFilter) => {
    if (next === filter) return;
    setPage(1);
    setFilter(next);
    setItems([]);
    setError('');
    setLoading(true);
  };

  return <section className="stack transaction-page" aria-labelledby="transactions-heading">
    <header className="transaction-page-head">
      <div>
        <p className="transaction-eyebrow">CPSU Market</p>
        <h1 id="transactions-heading">My transactions</h1>
        <p className="muted">Keep track of requests, meetup plans and completed exchanges.</p>
      </div>
      <Link to="/explore" className="transaction-browse-link">Browse listings <ArrowRight size={17} aria-hidden="true" /></Link>
    </header>
    <div className="transaction-filters" role="group" aria-label="Show transactions">
      {(['all', 'buying', 'selling'] as const).map(option => <button
        key={option} type="button" aria-pressed={filter === option}
        className="transaction-filter" onClick={() => changeFilter(option)}>
        {option === 'all' ? 'All' : option === 'buying' ? 'Buying' : 'Selling'}
      </button>)}
    </div>
    {error && <Panel className="transaction-error" role="alert">
      <p>Could not load transactions: {error}</p>
      <LegacyButton type="button" className="ghost" onClick={() => void fetchPage()}>Try again</LegacyButton>
    </Panel>}
    {loading && <p role="status" className="muted">Loading transactions…</p>}
    {!loading && !error && !items.length && <div className="empty transaction-empty">
      <h2>{filter === 'all' ? 'No transactions yet' : filter === 'buying' ? 'No buying requests yet' : 'No selling requests yet'}</h2>
      <p className="muted">{filter === 'all'
        ? 'Requests you send or receive will appear here.'
        : filter === 'buying' ? 'Requests for items or services you want will appear here.'
          : 'Requests from buyers for your listings will appear here.'}</p>
      {filter !== 'all'
        ? <LegacyButton type="button" className="ghost" onClick={() => changeFilter('all')}>Show all transactions</LegacyButton>
        : <Link to="/explore" className="btn">Explore listings</Link>}
    </div>}
    {!loading && !error && items.length > 0 && <div className="transaction-list">
      {items.map(t => {
        const buyer = t.buyerUserId === me?.id;
        const partner = buyer ? t.seller?.displayName : t.buyer?.displayName;
        return <article className="transaction-item" key={t.id}>
          <div className="transaction-item-main">
            <div className="transaction-item-meta">
              <span>{buyer ? 'Buying' : 'Selling'} · {t.listing.type === 'service' ? 'Service' : 'Product'}</span>
              <span><time dateTime={t.createdAt}>{stamp(t.createdAt)}</time></span>
            </div>
            <div className="transaction-item-title">
              <h2><Link to={'/transactions/' + t.id}>{t.listing.title}</Link></h2>
              <StatusPill status={t.status} />
            </div>
            <div className="transaction-item-facts">
              <strong>{peso(t.price)}</strong>
              <span>{partner ? (buyer ? 'Seller: ' : 'Buyer: ') + partner : buyer ? 'Your request' : 'Buyer request'}</span>
            </div>
            <p className="transaction-item-cue">{transactionNextStep(t, me?.id)}</p>
          </div>
          <div className="transaction-item-actions">
            <Link className="btn transaction-open" to={'/transactions/' + t.id}>
              {t.status === 'completed' && buyer ? 'View & review' : 'View details'} <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className="transaction-text-link" to={'/inquiries/' + t.inquiryThreadId}>
              <MessageCircle size={17} aria-hidden="true" /> Chat
            </Link>
          </div>
        </article>;
      })}
    </div>}
    {!loading && !error && total > 15 && <nav aria-label="Transaction pages" className="transaction-pagination">
      <LegacyButton type="button" className="ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</LegacyButton>
      <span className="muted" role="status">Page {page} of {Math.ceil(total / 15)}</span>
      <LegacyButton type="button" className="ghost" disabled={page * 15 >= total} onClick={() => setPage(p => p + 1)}>Next</LegacyButton>
    </nav>}
    <p className="transaction-disclosure">Payment and handoff are arranged directly by students. CPSU Market does not process payments or verify item condition.</p>
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
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState('');
  const requestVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const next = await api<Detail>('/transactions/' + id);
      if (version === requestVersion.current) {
        setData(next);
        setError('');
      }
    } catch (e) {
      if (version === requestVersion.current) setError(explain(e));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    setData(null); setLoading(true); setError(''); setActionError(''); setClosing(false); setRefreshNotice('');
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);
  useForegroundRefresh(() => reload(), 5_000,
    Boolean(me && data && !refreshingStatus && data.status !== 'completed' && data.status !== 'cancelled'));

  const refreshStatus = async () => {
    if (refreshingStatus || busy) return;
    setRefreshingStatus(true);
    setRefreshNotice('');
    // A manual check reports success only after the server actually returns fresh data.
    const version = ++requestVersion.current;
    try {
      const next = await api<Detail>('/transactions/' + id);
      if (version !== requestVersion.current) return;
      setData(next);
      setError('');
      setRefreshNotice('Checked just now');
    } catch (e) {
      if (version !== requestVersion.current) return;
      setError(explain(e));
      setRefreshNotice('');
    } finally {
      setRefreshingStatus(false);
    }
  };

  const act = async (suffix: string, body: unknown = {}) => {
    if (busy) return;
    setBusy(true); setActionError('');
    try {
      const updated = await api<{ status: TransactionStatus }>('/transactions/' + id + '/' + suffix, { body });
      setReason('');
      setClosing(false);
      await reload();
      void syncUnread();
      const message = suffix === 'confirm-meetup'
        ? updated.status === 'for_meetup' ? 'Both students have agreed to the meetup.' : 'Your meetup confirmation is saved. Waiting for the other student.'
        : suffix === 'confirm-completion'
          ? updated.status === 'completed' ? 'Both students confirmed the exchange is complete.' : 'Your confirmation is saved. Waiting for the other student.'
          : suffix === 'decision' && (body as { action?: string }).action === 'accept'
            ? 'The buyer has been notified. You can now arrange the meetup.'
            : updated.status === 'cancelled'
              ? 'This request is now closed. The other student has been notified.'
              : 'The updated status is visible to both students.';
      const accepted = suffix === 'decision' && (body as { action?: string }).action === 'accept';
      const title = updated.status === 'completed' ? 'Transaction completed'
        : updated.status === 'cancelled' ? 'Request closed'
          : accepted ? 'Request accepted'
            : suffix === 'confirm-meetup' ? 'Meetup confirmed'
              : suffix === 'confirm-completion' ? 'Confirmation saved'
                : 'Discussion started';
      showActionFeedback({
        kind: 'success', title, message,
        presentation: updated.status === 'completed' || updated.status === 'cancelled' || accepted ? 'center' : 'toast',
      });
    } catch (e) {
      setActionError(explain(e));
      showActionFeedback({ kind: 'error', title: 'Could not update transaction', message: explain(e) });
      await reload();
    } finally { setBusy(false); }
  };

  if (loading && !data) return <p role="status" className="muted">Loading transaction…</p>;
  if (error && !data) return <section className="empty"><h1>Transaction unavailable</h1>
    <p className="err" role="alert">{error}</p>
    <LegacyButton type="button" className="ghost" onClick={() => void reload()}>Try again</LegacyButton>
    <Link to="/transactions">Back to transactions</Link>
  </section>;
  if (!data) return null;

  const buyer = data.buyerUserId === me?.id;
  const seller = data.sellerUserId === me?.id;
  const terminal = data.status === 'completed' || data.status === 'cancelled';
  const myMeetupConfirmed = Boolean(buyer ? data.buyerMeetupConfirmedAt : data.sellerMeetupConfirmedAt);
  const otherMeetupConfirmed = Boolean(buyer ? data.sellerMeetupConfirmedAt : data.buyerMeetupConfirmedAt);
  const myCompletionConfirmed = Boolean(buyer ? data.buyerCompletionConfirmedAt : data.sellerCompletionConfirmedAt);
  const otherCompletionConfirmed = Boolean(buyer ? data.sellerCompletionConfirmedAt : data.buyerCompletionConfirmedAt);
  const canMeetup = data.status === 'accepted' || data.status === 'negotiating';
  const canComplete = data.status === 'for_meetup';
  const closeLabel = data.status === 'pending' && seller ? 'Decline request'
    : data.status === 'pending' && buyer ? 'Withdraw request' : 'Cancel transaction';
  const nextTitle = data.status === 'pending' && seller ? 'Review this request'
    : data.status === 'pending' ? 'Waiting for a response'
      : canMeetup ? 'Arrange your meetup' : canComplete ? 'Confirm the exchange' : 'Next step';

  return <article className="stack transaction-page transaction-detail-page" aria-labelledby="transaction-heading">
    <Link className="listing-back" to="/transactions">← My transactions</Link>
    <header className="transaction-detail-head">
      <div className="transaction-head-main">
        <span className="transaction-eyebrow">{buyer ? 'Buying' : seller ? 'Selling' : 'Transaction'} · #{data.id}</span>
        <h1 id="transaction-heading">{data.listing.title}</h1>
        <p className="muted">{data.listing.type === 'service' ? 'Service' : 'Product'} · Price when requested</p>
      </div>
      <div className="transaction-price-summary">
        <strong>{peso(data.price)}</strong><StatusPill status={data.status} />
      </div>
    </header>

    <Panel as="section" className="transaction-progress-card" aria-label="Transaction progress">
      <div className="transaction-section-heading">
        <h2>Progress</h2><span className="transaction-small-label">Updated by students</span>
      </div>
      {data.status === 'cancelled'
        ? <p className="transaction-closed"><X size={18} aria-hidden="true" /> This request is closed. No further action is needed.</p>
        : <ol className="transaction-progress">
          {steps.map((step, index) => {
            const phase = transactionPhase(data.status);
            const complete = index < phase || data.status === 'completed';
            return <li key={step} className={complete ? 'is-done' : index === phase ? 'is-current' : 'is-future'}
              aria-current={index === phase && data.status !== 'completed' ? 'step' : undefined}>
              <span className="transaction-step-mark">{complete ? <Check size={16} aria-hidden="true" /> : index + 1}</span>
              <span>{step}</span>
            </li>;
          })}
        </ol>}
      <p className="transaction-disclosure">Statuses are reported by students, not verified payment or delivery records.</p>
    </Panel>

    {!terminal && <Panel as="section" className="transaction-next-card" aria-label="Your next action" aria-busy={busy}>
      <div className="transaction-section-heading">
        <div><span className="transaction-eyebrow">Your next step</span><h2>{nextTitle}</h2></div>
        <Clock3 size={23} aria-hidden="true" className="transaction-next-icon" />
      </div>
      {data.status === 'pending' && buyer && <p>The seller needs to accept your request before you agree on a meetup. You can message them in the meantime.</p>}
      {data.status === 'pending' && seller && <>
        <p>Check the listing and discuss any questions before accepting. Accepting a physical product request reserves the item for this buyer.</p>
        <LegacyButton type="button" className="transaction-main-cta" disabled={busy}
          onClick={() => void act('decision', { action: 'accept' })}>{busy ? 'Updating…' : 'Accept request'}</LegacyButton>
      </>}
      {data.status === 'accepted' && <div className="transaction-soft-actions">
        <p>Agree on the time and place in chat. You can share a meetup pin below, then each student confirms the arrangement.</p>
        <button className="transaction-inline-action" type="button" disabled={busy}
          onClick={() => void act('negotiating')}>Mark as discussing details</button>
      </div>}
      {data.status === 'negotiating' && <p>Once you agree on the meetup details, each student must confirm. A shared map pin is optional.</p>}
      {canMeetup && <>
        <div className="transaction-confirm-grid" role="status" aria-label="Meetup confirmations">
          <span className={myMeetupConfirmed ? 'is-confirmed' : ''}>{myMeetupConfirmed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />} You: {myMeetupConfirmed ? 'Confirmed' : 'Not yet'}</span>
          <span className={otherMeetupConfirmed ? 'is-confirmed' : ''}>{otherMeetupConfirmed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />} Other student: {otherMeetupConfirmed ? 'Confirmed' : 'Not yet'}</span>
        </div>
        {myMeetupConfirmed ? <p className="transaction-wait-note">Your confirmation is saved. Waiting for the other student.</p>
          : <LegacyButton type="button" className="transaction-main-cta" disabled={busy}
            onClick={() => void act('confirm-meetup')}>{busy ? 'Updating…' : 'Confirm meetup arrangement'}</LegacyButton>}
      </>}
      {canComplete && <>
        <p>{buyer
          ? 'Confirm only after you receive the item or the service is finished and your arrangements are settled.'
          : 'Confirm only after you hand over the item or finish the service and your arrangements are settled.'}
          {' '}Both students must confirm to close the transaction.</p>
        <div className="transaction-confirm-grid" role="status" aria-label="Completion confirmations">
          <span className={myCompletionConfirmed ? 'is-confirmed' : ''}>{myCompletionConfirmed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />} You: {myCompletionConfirmed ? 'Confirmed' : 'Not yet'}</span>
          <span className={otherCompletionConfirmed ? 'is-confirmed' : ''}>{otherCompletionConfirmed ? <CheckCircle2 size={18} /> : <Clock3 size={18} />} Other student: {otherCompletionConfirmed ? 'Confirmed' : 'Not yet'}</span>
        </div>
        {myCompletionConfirmed ? <p className="transaction-wait-note">Your confirmation is saved. Waiting for the other student.</p>
          : <LegacyButton type="button" className="transaction-main-cta" disabled={busy}
            onClick={() => void act('confirm-completion')}>{busy ? 'Updating…' : 'Confirm my part is complete'}</LegacyButton>}
      </>}
      <div className="transaction-next-links">
        <Link to={'/inquiries/' + data.inquiryThreadId} className="transaction-text-link"><MessageCircle size={18} aria-hidden="true" /> Chat with student</Link>
      </div>
      <div className="transaction-close">
        {!closing
          ? <button type="button" className="transaction-close-toggle" disabled={busy} aria-expanded={false}
              onClick={() => { setClosing(true); setActionError(''); }}>{closeLabel}</button>
          : <div className="transaction-close-form">
            <h3>{closeLabel}</h3>
            <p>This closes the request and notifies the other student. It cannot be undone.</p>
            <Field className="" htmlFor="transaction-cancellation-reason">
              <span>Reason (10–500 characters)</span>
              <textarea id="transaction-cancellation-reason" value={reason} maxLength={500} minLength={10}
                placeholder="Briefly explain why you cannot proceed" onChange={e => setReason(e.target.value)} />
            </Field>
            <div className="transaction-close-actions">
              <LegacyButton type="button" className="danger" disabled={busy || reason.trim().length < 10}
                onClick={() => void act(data.status === 'pending' && seller ? 'decision' : 'cancel',
                  data.status === 'pending' && seller ? { action: 'reject', reason: reason.trim() } : { reason: reason.trim() })}>
                {busy ? 'Closing…' : 'Confirm ' + closeLabel.toLowerCase()}</LegacyButton>
              <LegacyButton type="button" className="ghost" disabled={busy}
                onClick={() => { setClosing(false); setReason(''); setActionError(''); }}>Keep transaction</LegacyButton>
            </div>
          </div>}
      </div>
      {actionError && <p role="alert" className="err">{actionError}</p>}
    </Panel>}

    {data.status !== 'pending' && (!terminal || data.handoff) && <MeetupLocationCard key={data.id}
      transactionId={data.id} handoff={data.handoff}
      campusName={preferredCampusName(me?.affiliations)}
      editable={(canMeetup || data.status === 'for_meetup') && !myCompletionConfirmed && !otherCompletionConfirmed}
      requiresReconfirmation={data.status === 'for_meetup' || myMeetupConfirmed || otherMeetupConfirmed}
      unavailableReason={terminal ? 'This transaction is closed. The meetup pin is read-only.'
        : 'Meetup location cannot be changed after completion starts.'}
      onSaved={reload} />}

    {terminal && <Panel as="section" className="transaction-result" role="status">
      {data.status === 'completed'
        ? <><CheckCircle2 size={24} aria-hidden="true" /><div><h2>Both students confirmed completion</h2>
          <p>This is a mutual self-report, not independent verification of the exchange.</p></div></>
        : <><X size={24} aria-hidden="true" /><div><h2>Transaction closed</h2>
          <p>Neither student can make further changes. You can still view the activity history.</p></div></>}
    </Panel>}
    {buyer && data.status === 'completed' && <TransactionStoreReview transactionId={data.id} />}
    <Panel as="section" className="transaction-tools" aria-label="Transaction options">
      <div className="transaction-section-heading"><h2>Other options</h2></div>
      <p>Arrange payment and handoff directly with the other student. CPSU Market does not handle money.</p>
      <div className="transaction-tool-links">
        {terminal && <Link to={'/inquiries/' + data.inquiryThreadId} className="transaction-text-link"><MessageCircle size={17} aria-hidden="true" /> Chat</Link>}
        <Link to={'/listings/' + data.listingId} className="transaction-text-link">View listing <ArrowRight size={16} aria-hidden="true" /></Link>
        <button type="button" className="transaction-refresh" disabled={busy || refreshingStatus}
          aria-label={refreshingStatus ? 'Checking for transaction updates' : 'Check for transaction updates'}
          onClick={() => void refreshStatus()}>
          <RefreshCw size={17} className={refreshingStatus ? 'transaction-refresh-spin' : ''} aria-hidden="true" />
          {refreshingStatus ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
      {refreshNotice && !error && <p className="transaction-refresh-note" role="status">
        <Check size={15} aria-hidden="true" /> {refreshNotice}
      </p>}
      {error && <p className="err" role="alert">Could not check for updates: {error}</p>}
    </Panel>
    <details className="panel transaction-history" >
      <summary>Activity history <span>{data.history.length} updates</span></summary>
      <ol>
        {data.history.map(event => <li key={event.id}>
          <strong>{eventName[event.event] ?? event.event}</strong>
          <span className="muted"> · {event.actorUserId === me?.id ? 'You' : 'Other student'}</span>
          <time dateTime={event.createdAt}>{stamp(event.createdAt)} · {statusLabels[event.toStatus]}</time>
          {event.reason && <p>Reason: {event.reason}</p>}
        </li>)}
      </ol>
    </details>
  </article>;
}
