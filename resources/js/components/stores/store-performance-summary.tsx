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
      <h2 id="store-performance-heading">Store performance <span className="analytics-period">last 30 days</span></h2>
      <Link className="btn ghost" to="/dashboard/insights"><Icon name="grid" size={16} /> Store insights</Link>
    </div>
    {error && <p className="err" role="alert">Performance could not load: {error} <LegacyButton type="button" className="ghost" onClick={() => void retry()}>Retry</LegacyButton></p>}
    {!data && loading && <p className="muted" role="status">Loading performance…</p>}
    {data && current && previous && <>
      <div className="analytics-kpis analytics-kpis--compact">
        <KpiCard label="Reported sales" value={formatPeso(current.reportedSales)} change={periodChange(current.reportedSales, previous.reportedSales)} />
        <KpiCard label="Completed orders" value={formatCount(current.completedOrders)} change={periodChange(current.completedOrders, previous.completedOrders)} />
        <KpiCard label="Orders to handle" value={formatCount(data.needsAction.length)} hint={data.waitingOnBuyer > 0 ? `${data.waitingOnBuyer} waiting for buyers` : undefined} />
        <KpiCard label="Store rating" value={data.rating.average === null ? 'No reviews' : `${data.rating.average.toFixed(1)} / 5`} hint={data.rating.count > 0 ? `${data.rating.count} ${data.rating.count === 1 ? 'review' : 'reviews'}` : undefined} />
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
