import { Link } from 'react-router-dom';

import { KpiCard } from '@/components/analytics/kpi-card';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatCount, formatPeso, periodChange, waitingTime } from '@/lib/analytics/format';
import type { SellerAnalytics } from '@/types/analytics';

/** Last-30-day snapshot and the orders waiting on the seller, shown at the top of My store. */
export function StorePerformanceSummary() {
  const { data, loading, error, retry } = useAnalytics<SellerAnalytics>('/seller/analytics', '30d');
  const current = data?.summary.current;
  const previous = data?.summary.previous;

  return <section className="store-performance" aria-labelledby="store-performance-heading" aria-busy={loading}>
    <div className="analytics-section-head">
      <div><h2 id="store-performance-heading">Store performance</h2><p className="analytics-period">Last 30 days</p></div>
      <Link className="btn ghost" to="/dashboard/insights">Store insights <Icon name="arrow" size={16} /></Link>
    </div>
    {error && <div className="analytics-feedback">
      <p role="alert">Store performance could not load. Try again to see your last 30 days.</p>
      <LegacyButton type="button" className="ghost" onClick={() => void retry()}><Icon name="refresh" size={16} /> Retry</LegacyButton>
    </div>}
    {!data && loading && <p className="muted" role="status">Loading performance…</p>}
    {data && current && previous && <>
      <div className="analytics-kpis analytics-kpis--compact">
        <KpiCard icon="receipt" label="Reported sales" value={formatPeso(current.reportedSales)} change={periodChange(current.reportedSales, previous.reportedSales)} />
        <KpiCard icon="check" label="Completed orders" value={formatCount(current.completedOrders)} change={periodChange(current.completedOrders, previous.completedOrders)} />
        <KpiCard icon="inbox" label="Orders to handle" value={formatCount(data.needsAction.length)} hint={data.waitingOnBuyer > 0 ? `${data.waitingOnBuyer} waiting for buyers` : undefined} />
        <KpiCard icon="star" label="Store rating" value={data.rating.average === null ? 'No reviews' : `${data.rating.average.toFixed(1)} / 5`} hint={data.rating.count > 0 ? `${data.rating.count} ${data.rating.count === 1 ? 'review' : 'reviews'}` : undefined} />
      </div>
      {data.needsAction.length > 0 && <ul className="analytics-actions analytics-actions--compact">
        {data.needsAction.slice(0, 3).map(order => <li key={order.id}>
          <Link to={`/transactions/${order.id}`} className="analytics-action">
            <span className="analytics-action-main"><strong>{order.action === 'decide' ? 'New request' : order.action === 'confirm_meetup' ? 'Confirm meetup' : 'Confirm completion'}: {order.listingTitle}</strong>
              <span>{order.buyerName} · {formatPeso(order.price)}</span></span>
            <span className="analytics-action-meta muted">{waitingTime(order.createdAt)}</span>
          </Link>
        </li>)}
      </ul>}
      {data.needsAction.length > 3 && <Link to="/dashboard/insights#insights-orders">See all {data.needsAction.length} orders to handle</Link>}
    </>}
  </section>;
}
