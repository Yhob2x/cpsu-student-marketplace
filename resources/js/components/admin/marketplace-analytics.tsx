import { useMemo, useState } from 'react';

import { BarChart, type BarDatum } from '@/components/analytics/bar-chart';
import { DonutChart } from '@/components/analytics/donut-chart';
import { HorizontalBars } from '@/components/analytics/horizontal-bars';
import { KpiCard } from '@/components/analytics/kpi-card';
import { OrderPipeline } from '@/components/analytics/order-pipeline';
import { RangePicker } from '@/components/analytics/range-picker';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { useAnalytics } from '@/hooks/use-analytics';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { chartValue, formatCount, formatHours, formatPercent, formatPeso, formatShortCount, periodChange, RANGE_OPTIONS } from '@/lib/analytics/format';
import type { AnalyticsRangeKey, MarketplaceAnalytics as Analytics, MarketplaceTrendBucket } from '@/types/analytics';

type Metric = Exclude<keyof MarketplaceTrendBucket, 'key' | 'label'>;

const METRICS: { key: Metric; label: string }[] = [
  { key: 'ordersCompleted', label: 'Completed orders' },
  { key: 'ordersCreated', label: 'New orders' },
  { key: 'listingsApproved', label: 'Listings approved' },
];

const WORKLOAD = [
  { key: 'listings', label: 'Listings to review', icon: 'package', color: 'var(--color-primary)' },
  { key: 'affiliations', label: 'Verifications', icon: 'userCheck', color: 'var(--color-info)' },
  { key: 'reports', label: 'Open reports', icon: 'flag', color: 'var(--danger)' },
  { key: 'store-reviews', label: 'Store reviews', icon: 'star', color: 'var(--mango)' },
] as const;

type Props = { heading: string; accountAdmin: boolean; onOpenSection: (section: string) => void };

/** The admin Overview: review workload, headline figures and charts for the caller's campuses. */
export function MarketplaceAnalytics({ heading, accountAdmin, onOpenSection }: Props) {
  const [range, setRange] = useState<AnalyticsRangeKey>('30d');
  const [metric, setMetric] = useState<Metric>('ordersCompleted');
  const { data, loading, error, retry } = useAnalytics<Analytics>('/admin/analytics/dashboard', range);
  // Keep workload and counts current while staff keep the dashboard open, as the old overview did.
  useForegroundRefresh(() => retry(), 30_000, true);
  const displayedRange = RANGE_OPTIONS.find(option => option.key === (data?.range.key ?? range))!.label;
  const rangeLabel = displayedRange.toLowerCase();
  const metricLabel = METRICS.find(item => item.key === metric)!.label;

  const trend = useMemo<BarDatum[]>(() => (data?.trend ?? []).map(bucket => ({
    key: bucket.key, label: bucket.label, value: chartValue(bucket[metric]), display: formatShortCount(bucket[metric]), hidden: bucket[metric] === '<5',
  })), [data, metric]);

  const workloadCounts = data ? {
    listings: data.workload.pendingListings, affiliations: data.workload.pendingAffiliations,
    reports: data.workload.openReports, 'store-reviews': data.workload.pendingStoreReviews,
  } : null;
  const waitingCount = workloadCounts ? Object.values(workloadCounts).reduce((total, value) => total + value, 0) : 0;
  const count = (value: number | '<5') => formatShortCount(value);
  const privacyHint = (value: number | '<5') => value === '<5' ? 'Hidden for privacy (1–4)' : undefined;
  const current = data?.summary.current;
  const previous = data?.summary.previous;

  return <section className="marketplace-analytics" aria-labelledby="admin-overview">
    <div className="analytics-head">
      <div>
        <h2 id="admin-overview">{heading}</h2>
        <p className="muted">Orders, listings and review work for {accountAdmin ? 'all campuses' : 'your campus'}.</p>
      </div>
    </div>

    {data && workloadCounts && <section className="analytics-overview-group" aria-labelledby="admin-review-queues">
      <div className="analytics-overview-heading">
        <h3 id="admin-review-queues">Review queues</h3>
        <p className="analytics-queue-status">
          {waitingCount ? `${formatCount(waitingCount)} waiting` : 'All caught up'}
        </p>
      </div>
      <div className="analytics-workload" role="group" aria-label="Review work waiting">
        {WORKLOAD.map(item => <button type="button" key={item.key} onClick={() => onOpenSection(item.key)}>
          <span className="analytics-workload__icon" aria-hidden="true" style={{ color: item.color }}><Icon name={item.icon} size={20} /></span>
          <span className="analytics-workload__body">
            <strong>{formatCount(workloadCounts[item.key])}</strong>
            <span className="analytics-workload__label">{item.label}</span>
            {item.key === 'listings' && data.workload.oldestPendingListingHours !== null && <small>Oldest waiting {formatHours(data.workload.oldestPendingListingHours)}</small>}
          </span>
          <span className="analytics-workload__arrow" aria-hidden="true"><Icon name="chevronRight" size={16} /></span>
        </button>)}
      </div>
    </section>}

    <section className="analytics-overview-group" aria-labelledby="admin-period-summary">
      <div className="analytics-reporting-head">
        <div className="analytics-overview-heading">
          <h3 id="admin-period-summary">Period summary</h3>
          {data && <p>{displayedRange} · Compared with the previous period</p>}
        </div>
        <RangePicker value={range} onChange={setRange} />
        <p className="analytics-updating" role="status">{data && loading && 'Updating figures…'}</p>
      </div>
      {error && <div className="analytics-feedback">
        <p role="alert">{data ? `Could not update figures. Showing ${rangeLabel}.` : `The dashboard could not load: ${error}`}</p>
        <LegacyButton type="button" className="ghost" onClick={() => void retry()}>Retry</LegacyButton>
      </div>}
      {!data && loading && <div className="analytics-skeleton" role="status" aria-label="Loading dashboard"><span /><span /><span /><span /></div>}
      {current && previous && <div className="analytics-kpis" aria-busy={loading}>
        <KpiCard label="Completed orders" value={count(current.completedOrders)} hint={privacyHint(current.completedOrders)} change={periodChange(current.completedOrders, previous.completedOrders)} />
        <KpiCard label="Reported sales" value={current.reportedSales === null ? 'Hidden' : formatPeso(current.reportedSales)} change={periodChange(current.reportedSales, previous.reportedSales)}
          hint={current.reportedSales === null ? 'Shown from 5 completed orders' : undefined} />
        <KpiCard label="New orders" value={count(current.ordersCreated)} hint={privacyHint(current.ordersCreated)} change={periodChange(current.ordersCreated, previous.ordersCreated)} />
        <KpiCard label="Cancellation rate" value={formatPercent(current.cancellationRate)} change={periodChange(current.cancellationRate, previous.cancellationRate)} invertChange />
        <KpiCard label="Listings approved" value={count(current.listingsApproved)} hint={privacyHint(current.listingsApproved)} change={periodChange(current.listingsApproved, previous.listingsApproved)} />
        <KpiCard label="Students verified" value={count(current.studentsVerified)} hint={privacyHint(current.studentsVerified)} change={periodChange(current.studentsVerified, previous.studentsVerified)} />
        <KpiCard label="Inquiries" value={count(current.inquiries)} hint={privacyHint(current.inquiries)} change={periodChange(current.inquiries, previous.inquiries)} />
        <KpiCard label="Time to complete" value={formatHours(current.averageHoursToComplete)} change={periodChange(current.averageHoursToComplete, previous.averageHoursToComplete)} invertChange />
      </div>}
    </section>

    {data && workloadCounts && <>
      <div className="analytics-dashboard-grid" aria-busy={loading}>
        <Panel className="analytics-card analytics-card--wide">
          <div className="analytics-section-head">
            <h3><Icon name="grid" size={18} /> Activity over time <span className="analytics-period">{rangeLabel}</span></h3>
            <label className="analytics-metric">Show
              <select value={metric} onChange={event => setMetric(event.target.value as Metric)}>
                {METRICS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <BarChart title={`${metricLabel}, ${rangeLabel}`} plotKey={`${data.range.key}:${metric}`} data={trend} format={formatCount} showScale />
        </Panel>

        <Panel className="analytics-card">
          <h3><Icon name="shield" size={18} /> Review workload</h3>
          <DonutChart title="Review work waiting" centerLabel="waiting" emptyText="All caught up."
            slices={WORKLOAD.map(item => ({ key: item.key, label: item.label, value: workloadCounts[item.key], color: item.color }))}
            onSelect={onOpenSection} />
        </Panel>

        <Panel className="analytics-card analytics-card--wide">
          <h3><Icon name="receipt" size={18} /> Orders in progress</h3>
          <OrderPipeline counts={data.pipeline} label="Marketplace orders in progress" />
        </Panel>

        <Panel className="analytics-card">
          <h3><Icon name="tag" size={18} /> Top categories <span className="analytics-period">by live listings</span></h3>
          <HorizontalBars title="Live listings by category" emptyText="No live listings yet."
            bars={data.categories.slice(0, 6).map(category => ({ key: String(category.id), label: category.name,
              value: chartValue(category.publishedListings), display: formatShortCount(category.publishedListings), hidden: category.publishedListings === '<5' }))} />
        </Panel>

        <Panel className="analytics-card analytics-card--wide">
          <h3><Icon name="pin" size={18} /> Campuses <span className="analytics-period">{rangeLabel}</span></h3>
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
        </Panel>

        <Panel className="analytics-card">
          <h3><Icon name="store" size={18} /> Live listings by campus</h3>
          <HorizontalBars title="Live listings by campus" emptyText="No campuses in your scope."
            bars={data.campuses.map(campus => ({ key: campus.campus, label: campus.name.replace(/\s*campus$/i, ''),
              value: chartValue(campus.publishedListings), display: formatShortCount(campus.publishedListings), hidden: campus.publishedListings === '<5' }))} />
        </Panel>
      </div>

      <p className="analytics-note"><Icon name="shield" size={15} /> {data.privacyNote} {data.note}</p>
    </>}
  </section>;
}
