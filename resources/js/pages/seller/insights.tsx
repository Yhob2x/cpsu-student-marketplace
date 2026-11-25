import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { BarChart, type BarDatum } from '@/components/analytics/bar-chart';
import { ConversionFunnel } from '@/components/analytics/conversion-funnel';
import { KpiCard } from '@/components/analytics/kpi-card';
import { OrderPipeline } from '@/components/analytics/order-pipeline';
import { RangePicker } from '@/components/analytics/range-picker';
import { Icon } from '@/components/icons';
import { StatusPill } from '@/components/transactions/status-pill';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { useAnalytics } from '@/hooks/use-analytics';
import { formatCount, formatHours, formatPercent, formatPeso, periodChange, RANGE_OPTIONS, waitingTime } from '@/lib/analytics/format';
import { useMe } from '@/providers/session-provider';
import type { AnalyticsRangeKey, SellerAnalytics, SellerOrderAction, SellerTrendBucket } from '@/types/analytics';

type Metric = Exclude<keyof SellerTrendBucket, 'key' | 'label'>;

const METRICS: { key: Metric; label: string; money?: boolean }[] = [
  { key: 'reportedSales', label: 'Reported sales', money: true },
  { key: 'ordersCompleted', label: 'Completed orders' },
  { key: 'ordersCreated', label: 'New orders' },
  { key: 'inquiries', label: 'Inquiries' },
  { key: 'views', label: 'Listing views' },
];

const ACTION_TEXT: Record<SellerOrderAction, string> = {
  decide: 'Accept or decline the request',
  confirm_meetup: 'Confirm the meetup',
  confirm_completion: 'Confirm the handoff is complete',
};

const RANGE_KEYS = RANGE_OPTIONS.map(option => option.key);

export function StoreInsights() {
  const { me } = useMe();
  const [params, setParams] = useSearchParams();
  const requested = params.get('range') as AnalyticsRangeKey | null;
  const range: AnalyticsRangeKey = requested && RANGE_KEYS.includes(requested) ? requested : '30d';
  const [metric, setMetric] = useState<Metric>('reportedSales');
  const hasStore = Boolean(me?.storeId);
  const { data, loading, error, errorCode, retry } = useAnalytics<SellerAnalytics>('/seller/analytics', range, hasStore);
  const rangeLabel = RANGE_OPTIONS.find(option => option.key === range)!.label.toLowerCase();

  const chart = useMemo<BarDatum[]>(() => {
    const money = METRICS.find(item => item.key === metric)?.money;
    return (data?.trend ?? []).map(bucket => ({ key: bucket.key, label: bucket.label, value: bucket[metric], display: money ? formatPeso(bucket[metric]) : formatCount(bucket[metric]) }));
  }, [data, metric]);

  const changeRange = (key: AnalyticsRangeKey) => setParams(previous => { const next = new URLSearchParams(previous); next.set('range', key); return next; }, { replace: true });

  if (!hasStore || errorCode === 'no_store') {
    return <div className="store-insights">
      <div className="page-head"><div><h1>Store insights</h1><p className="muted">Open a store to track orders and sales.</p></div></div>
      <Panel className="analytics-empty"><p>You do not have a store yet.</p><Link className="btn" to="/dashboard">Go to My store</Link></Panel>
    </div>;
  }

  const current = data?.summary.current;
  const previous = data?.summary.previous;
  const metricInfo = METRICS.find(item => item.key === metric)!;

  return <div className="store-insights" aria-busy={loading}>
    <div className="page-head analytics-head">
      <div>
        <Link className="analytics-back" to="/dashboard"><Icon name="chevronLeft" size={16} /> My store</Link>
        <h1>Store insights</h1>
        <p className="muted">Track orders, reported sales and how students find your listings.</p>
      </div>
      <RangePicker value={range} onChange={changeRange} />
    </div>

    {error && <p className="err" role="alert">Store insights could not load: {error} <LegacyButton type="button" className="ghost" onClick={() => void retry()}>Retry</LegacyButton></p>}
    {!data && loading && <p className="muted" role="status">Loading store insights…</p>}
    {data && loading && <p className="analytics-updating" role="status">Updating figures…</p>}

    {data && current && previous && <>
      <section className="analytics-section" aria-labelledby="insights-overview">
        <h2 id="insights-overview">Overview <span className="analytics-period">{rangeLabel}</span></h2>
        <div className="analytics-kpis">
          <KpiCard label="Reported sales" value={formatPeso(current.reportedSales)} change={periodChange(current.reportedSales, previous.reportedSales)} />
          <KpiCard label="Completed orders" value={formatCount(current.completedOrders)} change={periodChange(current.completedOrders, previous.completedOrders)} />
          <KpiCard label="Average order" value={formatPeso(current.averageOrderValue)} change={periodChange(current.averageOrderValue, previous.averageOrderValue)} />
          <KpiCard label="New orders" value={formatCount(current.ordersCreated)} change={periodChange(current.ordersCreated, previous.ordersCreated)} />
          <KpiCard label="Cancellation rate" value={formatPercent(current.cancellationRate)} change={periodChange(current.cancellationRate, previous.cancellationRate)} invertChange
            hint={`${formatCount(current.cancelledOrders)} cancelled or declined`} />
          <KpiCard label="Time to complete" value={formatHours(current.averageHoursToComplete)} change={periodChange(current.averageHoursToComplete, previous.averageHoursToComplete)} invertChange
            hint="From request to both confirmations" />
        </div>
        <p className="analytics-note"><Icon name="shield" size={15} /> {data.note}</p>
      </section>

      <section className="analytics-section" aria-labelledby="insights-orders">
        <div className="analytics-section-head">
          <h2 id="insights-orders">Orders to handle</h2>
          <Link className="btn ghost" to="/transactions">All transactions</Link>
        </div>
        <OrderPipeline counts={data.pipeline} />
        {data.needsAction.length === 0
          ? <Panel className="analytics-empty"><Icon name="checks" size={22} /><p>Nothing is waiting for you.{data.waitingOnBuyer > 0 ? ` ${data.waitingOnBuyer} ${data.waitingOnBuyer === 1 ? 'order is' : 'orders are'} waiting for the buyer.` : ''}</p></Panel>
          : <>
            <ul className="analytics-actions">{data.needsAction.map(order => <li key={order.id}>
              <Link to={`/transactions/${order.id}`} className="analytics-action">
                <span className="analytics-action-main">
                  <strong>{ACTION_TEXT[order.action]}</strong>
                  <span>{order.listingTitle} · {order.buyerName} · {formatPeso(order.price)}</span>
                </span>
                <span className="analytics-action-meta"><StatusPill status={order.status} /><span className="muted">{waitingTime(order.createdAt)}</span></span>
              </Link>
            </li>)}</ul>
            {data.waitingOnBuyer > 0 && <p className="muted">{data.waitingOnBuyer} more {data.waitingOnBuyer === 1 ? 'order is' : 'orders are'} waiting for the buyer.</p>}
          </>}
      </section>

      <section className="analytics-section" aria-labelledby="insights-trend">
        <div className="analytics-section-head">
          <h2 id="insights-trend">Over time</h2>
          <label className="analytics-metric">Show
            <select value={metric} onChange={event => setMetric(event.target.value as Metric)}>
              {METRICS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <Panel><BarChart title={`${metricInfo.label}, ${rangeLabel}`} data={chart} format={metricInfo.money ? formatPeso : formatCount} /></Panel>
      </section>

      <div className="analytics-two-col">
        <section className="analytics-section" aria-labelledby="insights-funnel">
          <h2 id="insights-funnel">From view to sale</h2>
          <Panel>
            <ConversionFunnel label={`Conversion, ${rangeLabel}`} steps={[
              { label: 'Listing views', value: current.views },
              { label: 'Inquiries', value: current.inquiries },
              { label: 'Orders', value: current.ordersCreated },
              { label: 'Completed', value: current.completedOrders },
            ]} />
            <p className="muted analytics-small">{data.viewsTrackedSince ? `Daily views are counted from ${new Date(data.viewsTrackedSince + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.` : 'Daily views are counted from now on.'} Each student counts once per listing per day.</p>
          </Panel>
        </section>
        <section className="analytics-section" aria-labelledby="insights-rating">
          <h2 id="insights-rating">Store rating</h2>
          <Panel className="analytics-rating">
            {data.rating.count === 0 ? <p className="muted">No published reviews yet. Buyers can review your store after a completed order.</p> : <>
              <p className="analytics-rating-score"><strong>{data.rating.average?.toFixed(1)}</strong><span> out of 5 · {data.rating.count} {data.rating.count === 1 ? 'review' : 'reviews'}</span></p>
              <ul className="analytics-rating-bars">{(['5', '4', '3', '2', '1'] as const).map(stars => <li key={stars}>
                <span>{stars} star</span>
                <div className="analytics-funnel-track" aria-hidden="true"><div style={{ width: `${(data.rating.distribution[stars] / data.rating.count) * 100}%` }} /></div>
                <span>{data.rating.distribution[stars]}</span>
              </li>)}</ul>
            </>}
          </Panel>
        </section>
      </div>

      {data.lowStock.length > 0 && <section className="analytics-section" aria-labelledby="insights-stock">
        <h2 id="insights-stock">Low stock</h2>
        <ul className="analytics-stock">{data.lowStock.map(listing => <li key={listing.id}>
          <Link to={`/dashboard#store-listing-${listing.id}`}>{listing.title}</Link>
          <span className={listing.stock === 0 ? 'analytics-stock-out' : 'analytics-stock-low'}>{listing.stock === 0 ? 'Sold out' : `${listing.stock} left`}</span>
        </li>)}</ul>
      </section>}

      <section className="analytics-section" aria-labelledby="insights-listings">
        <h2 id="insights-listings">Listing performance <span className="analytics-period">{rangeLabel}</span></h2>
        {data.listings.length === 0 ? <Panel className="analytics-empty"><p>No listings yet.</p><Link className="btn" to="/dashboard">Create a listing</Link></Panel>
          : <div className="analytics-table-wrap"><table className="analytics-table">
            <thead><tr><th scope="col">Listing</th><th scope="col">Views</th><th scope="col">Inquiries</th><th scope="col">Orders</th><th scope="col">Completed</th><th scope="col">Reported sales</th><th scope="col">Stock</th></tr></thead>
            <tbody>{data.listings.map(listing => <tr key={listing.id}>
              <th scope="row"><Link to={`/listings/${listing.id}`}>{listing.title}</Link><span className="analytics-table-sub">{listing.type === 'service' ? 'Service' : 'Product'} · {formatPeso(listing.price)}</span></th>
              <td data-label="Views">{formatCount(listing.views)}</td>
              <td data-label="Inquiries">{formatCount(listing.inquiries)}</td>
              <td data-label="Orders">{formatCount(listing.orders)}</td>
              <td data-label="Completed">{formatCount(listing.completedOrders)}</td>
              <td data-label="Reported sales">{formatPeso(listing.reportedSales)}</td>
              <td data-label="Stock">{listing.stock === null ? '—' : listing.stock === 0 ? 'Sold out' : formatCount(listing.stock)}</td>
            </tr>)}</tbody>
          </table></div>}
      </section>
    </>}
  </div>;
}
