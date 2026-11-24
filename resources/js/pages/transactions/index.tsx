import { ArrowRight, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusPill } from '@/components/transactions/status-pill';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { api, explain, peso } from '@/lib/api';
import { transactionNextStep } from '@/lib/transactions/transaction-flow';
import { stamp } from '@/lib/transactions/transaction-format';
import { useMe } from '@/providers/session-provider';
import type { TransactionRow } from '@/types/transaction';

type RoleFilter = 'all' | 'buying' | 'selling';

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
