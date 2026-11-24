import { useMemo, useState } from 'react';

import { BarChart, type BarDatum } from '@/components/analytics/bar-chart';
import { KpiCard } from '@/components/analytics/kpi-card';
import { OrderPipeline } from '@/components/analytics/order-pipeline';
import { RangePicker } from '@/components/analytics/range-picker';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { useAnalytics } from '@/hooks/use-analytics';
import { chartValue, formatCount, formatHours, formatPercent, formatPeso, formatShortCount, periodChange, RANGE_OPTIONS } from '@/lib/analytics/format';
import type { AnalyticsRangeKey, MarketplaceAnalytics as Analytics, MarketplaceTrendBucket } from '@/types/analytics';

type Metric = Exclude<keyof MarketplaceTrendBucket, 'key' | 'label'>;

const METRICS: { key: Metric; label: string }[] = [
  { key: 'ordersCompleted', label: 'Completed orders' },
  { key: 'ordersCreated', label: 'New orders' },
  { key: 'listingsApproved', label: 'Listings approved' },
];

type Props = { accountAdmin: boolean; onOpenSection: (section: string) => void };

/** Campus-scoped marketplace overview for reviewers and university admins. */
export function MarketplaceAnalytics({ accountAdmin, onOpenSection }: Props) {
  const [range, setRange] = useState<AnalyticsRangeKey>('30d');
  const [metric, setMetric] = useState<Metric>('ordersCompleted');
  const { data, loading, error, retry } = useAnalytics<Analytics>('/admin/analytics/dashboard', range);
  const rangeLabel = RANGE_OPTIONS.find(option => option.key === range)!.label.toLowerCase();
  const metricLabel = METRICS.find(item => item.key === metric)!.label;

  const chart = useMemo<BarDatum[]>(() => (data?.trend ?? []).map(bucket => ({
    key: bucket.key, label: bucket.label, value: chartValue(bucket[metric]), display: formatShortCount(bucket[metric]), hidden: bucket[metric] === '<5',
  })), [data, metric]);

  const current = data?.summary.current;
  const previous = data?.summary.previous;

  return <section className="marketplace-analytics" aria-labelledby="marketplace-analytics-heading" aria-busy={loading}>
    <div className="analytics-head">
      <div>
        <h2 id="marketplace-analytics-heading">{accountAdmin ? 'Marketplace analytics' : 'Campus analytics'}</h2>
        <p className="muted">Orders, listings and review work for {accountAdmin ? 'all campuses' : 'your campus'}.</p>
      </div>
      <RangePicker value={range} onChange={setRange} />
    </div>

    {error && <p className="err" role="alert">Analytics could not load: {error} <LegacyButton type="button" className="ghost" onClick={() => void retry()}>Retry</LegacyButton></p>}
    {!data && loading && <p className="muted" role="status">Loading analytics…</p>}
    {data && loading && <p className="analytics-updating" role="status">Updating figures…</p>}

    {data && current && previous && <>
      <div className="analytics-workload" role="group" aria-label="Review work waiting">
        <button type="button" onClick={() => onOpenSection('listings')}><strong>{formatCount(data.workload.pendingListings)}</strong><span>Listings to review</span>
          {data.workload.oldestPendingListingHours !== null && <small>Oldest waiting {formatHours(data.workload.oldestPendingListingHours)}</small>}</button>
        <button type="button" onClick={() => onOpenSection('affiliations')}><strong>{formatCount(data.workload.pendingAffiliations)}</strong><span>Verifications</span></button>
        <button type="button" onClick={() => onOpenSection('reports')}><strong>{formatCount(data.workload.openReports)}</strong><span>Open reports</span></button>
        <button type="button" onClick={() => onOpenSection('store-reviews')}><strong>{formatCount(data.workload.pendingStoreReviews)}</strong><span>Store reviews</span></button>
      </div>

      <div className="analytics-kpis">
        <KpiCard label="Completed orders" value={formatCount(current.completedOrders)} change={periodChange(current.completedOrders, previous.completedOrders)} />
        <KpiCard label="Reported sales" value={current.reportedSales === null ? 'Hidden' : formatPeso(current.reportedSales)} change={periodChange(current.reportedSales, previous.reportedSales)}
          hint={current.reportedSales === null ? 'Shown from 5 completed orders' : undefined} />
        <KpiCard label="New orders" value={formatCount(current.ordersCreated)} change={periodChange(current.ordersCreated, previous.ordersCreated)} />
        <KpiCard label="Cancellation rate" value={formatPercent(current.cancellationRate)} change={periodChange(current.cancellationRate, previous.cancellationRate)} invertChange />
        <KpiCard label="Listings approved" value={formatCount(current.listingsApproved)} change={periodChange(current.listingsApproved, previous.listingsApproved)} />
        <KpiCard label="Students verified" value={formatCount(current.studentsVerified)} change={periodChange(current.studentsVerified, previous.studentsVerified)} />
        <KpiCard label="Inquiries" value={formatCount(current.inquiries)} change={periodChange(current.inquiries, previous.inquiries)} />
        <KpiCard label="Time to complete" value={formatHours(current.averageHoursToComplete)} change={periodChange(current.averageHoursToComplete, previous.averageHoursToComplete)} invertChange />
      </div>
      <p className="analytics-note"><Icon name="shield" size={15} /> {data.privacyNote} {data.note}</p>

      <div className="analytics-section-head">
        <h3>Over time <span className="analytics-period">{rangeLabel}</span></h3>
        <label className="analytics-metric">Show
          <select value={metric} onChange={event => setMetric(event.target.value as Metric)}>
            {METRICS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <Panel><BarChart title={`${metricLabel}, ${rangeLabel}`} data={chart} format={value => formatCount(value)} /></Panel>

      <h3>Orders in progress</h3>
      <OrderPipeline counts={data.pipeline} label="Marketplace orders in progress" />

      <div className="analytics-two-col">
        <div>
          <h3>Top categories <span className="analytics-period">{rangeLabel}</span></h3>
          {data.categories.length === 0 ? <p className="muted">No listings or orders yet.</p>
            : <div className="analytics-table-wrap"><table className="analytics-table">
              <thead><tr><th scope="col">Category</th><th scope="col">Completed</th><th scope="col">Live listings</th><th scope="col">Reported sales</th></tr></thead>
              <tbody>{data.categories.map(category => <tr key={category.id}>
                <th scope="row">{category.name}</th>
                <td data-label="Completed">{formatShortCount(category.completedOrders)}</td>
                <td data-label="Live listings">{formatShortCount(category.publishedListings)}</td>
                <td data-label="Reported sales">{category.reportedSales === null ? 'Hidden' : formatPeso(category.reportedSales)}</td>
              </tr>)}</tbody>
            </table></div>}
        </div>
        <div>
          <h3>Campuses <span className="analytics-period">{rangeLabel}</span></h3>
          <div className="analytics-table-wrap"><table className="analytics-table">
            <thead><tr><th scope="col">Campus</th><th scope="col">Storefronts</th><th scope="col">Live listings</th><th scope="col">New orders</th><th scope="col">Completed</th><th scope="col">Reported sales</th></tr></thead>
            <tbody>{data.campuses.map(campus => <tr key={campus.campus}>
              <th scope="row">{campus.name}</th>
              <td data-label="Storefronts">{formatShortCount(campus.activeStorefronts)}</td>
              <td data-label="Live listings">{formatShortCount(campus.publishedListings)}</td>
              <td data-label="New orders">{formatShortCount(campus.ordersCreated)}</td>
              <td data-label="Completed">{formatShortCount(campus.completedOrders)}</td>
              <td data-label="Reported sales">{campus.reportedSales === null ? 'Hidden' : formatPeso(campus.reportedSales)}</td>
            </tr>)}</tbody>
          </table></div>
        </div>
      </div>
    </>}
  </section>;
}
