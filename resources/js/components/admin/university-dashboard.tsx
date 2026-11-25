import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { formatPeso, formatShortCount } from '@/lib/analytics/format';
import type { AnalyticsRangeKey, CountValue } from '@/types/analytics';
import type { UniversityDashboardData } from '@/types/university-dashboard';

type DashboardProps = {
  data: UniversityDashboardData | null;
  period: AnalyticsRangeKey;
  loading: boolean;
  error: string;
  onPeriodChange: (period: AnalyticsRangeKey) => void;
  onRetry: () => void;
  onOpenSection: (section: string) => void;
};

const periods: Record<AnalyticsRangeKey, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  '12m': '12 months',
};

const periodMetrics = {
  newOrders: 'New orders',
  completedOrders: 'Completed orders',
  inquiries: 'Inquiries',
  listingsApproved: 'Listings approved',
  studentsVerified: 'Students verified',
} as const;

const numberFormat = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });
const seriesIntervals = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;

export function PeriodSwitcher({ value, onChange }: { value: AnalyticsRangeKey; onChange: DashboardProps['onPeriodChange'] }) {
  return <div className="university-dashboard-period" role="group" aria-label="Reporting period">
    {(Object.keys(periods) as AnalyticsRangeKey[]).map(period => <button key={period} type="button" aria-pressed={value === period}
      onClick={() => onChange(period)}>{periods[period]}</button>)}
  </div>;
}

export function StatusBar({ queue, onOpenSection }: {
  queue: UniversityDashboardData['reviewQueue'];
  onOpenSection: DashboardProps['onOpenSection'];
}) {
  const { listings, verifications } = queue;
  const caughtUp = listings === 0 && verifications === 0;
  const total = typeof listings === 'number' && typeof verifications === 'number' ? listings + verifications : null;
  const message = caughtUp ? 'All caught up. Nothing is waiting for review.'
    : total === null ? 'Items need review'
      : total === 1 ? '1 item needs review' : `${formatShortCount(total)} items need review`;

  return <div className={`university-dashboard-status${caughtUp ? '' : ' is-pending'}`}>
    <p role="status"><span className="university-dashboard-status-icon"><Icon name={caughtUp ? 'check' : 'inbox'} size={17} /></span>{message}</p>
    {!caughtUp && <div className="university-dashboard-status-actions">
      {listings !== 0 && <LegacyButton type="button" className="ghost" onClick={() => onOpenSection('listings')}>
        {formatShortCount(listings)} {listings === 1 ? 'listing review' : 'listing reviews'} <Icon name="arrow" size={15} />
      </LegacyButton>}
      {verifications !== 0 && <LegacyButton type="button" className="ghost" onClick={() => onOpenSection('affiliations')}>
        {formatShortCount(verifications)} {verifications === 1 ? 'verification' : 'verifications'} <Icon name="arrow" size={15} />
      </LegacyButton>}
    </div>}
  </div>;
}

export function KpiCard({ label, value, comparison, hint }: {
  label: string;
  value: string;
  comparison?: { change: number | null; previousPeriodLabel: string };
  hint?: string;
}) {
  const change = comparison?.change;
  const direction = change && change < 0 ? 'down' : change && change > 0 ? 'up' : 'flat';
  return <div className="university-dashboard-kpi">
    <dt>{label}</dt>
    <dd className="university-dashboard-kpi-value">{value}</dd>
    {hint && <dd className="university-dashboard-kpi-hint">{hint}</dd>}
    {comparison && <dd className="university-dashboard-kpi-hint">
      {change == null ? 'Too few to compare' : <>
        <span className={`university-dashboard-change is-${direction}`}>
          {direction !== 'flat' && <>
            <span aria-hidden="true">{direction === 'up' ? '▲' : '▼'} </span>
            <span className="sr-only">{direction === 'up' ? 'Up ' : 'Down '}</span>
          </>}{numberFormat.format(Math.abs(change))}%
        </span> vs {comparison.previousPeriodLabel}
      </>}
    </dd>}
  </div>;
}

function HorizontalBars({ entries }: { entries: { label: string; value: CountValue }[] }) {
  const maximum = Math.max(1, ...entries.map(({ value }) => typeof value === 'number' ? value : 0));
  return <ul className="university-dashboard-horizontal">
    {entries.map(({ label, value }) => <li className="university-dashboard-horizontal-row" key={label}>
      <span>{label}</span>
      <strong>{formatShortCount(value)}</strong>
      <span className="university-dashboard-track" aria-hidden="true">
        {value === '<5'
          ? <span className="university-dashboard-masked-mark" />
          : value > 0 && <span className="university-dashboard-fill" style={{ width: `${value / maximum * 100}%` }} />}
      </span>
    </li>)}
  </ul>;
}

export function Funnel({ counts }: { counts: UniversityDashboardData['funnel'] }) {
  const headingId = useId();
  return <Panel as="section" className="university-dashboard-panel university-dashboard-funnel" aria-labelledby={headingId}>
    <h3 id={headingId}><Icon name="sliders" size={18} /> From listing to sale</h3>
    <HorizontalBars entries={[
      { label: 'Live listings', value: counts.liveListings },
      { label: 'Inquiries', value: counts.inquiries },
      { label: 'New orders', value: counts.orders },
      { label: 'Completed orders', value: counts.completed },
    ]} />
  </Panel>;
}

const stages = {
  awaitingSeller: 'Awaiting seller',
  accepted: 'Accepted',
  arrangingMeetup: 'Arranging meetup',
  meetupAgreed: 'Meetup agreed',
} as const;

export function StageChips({ counts }: { counts: UniversityDashboardData['ordersInProgress'] }) {
  const headingId = useId();
  const active = (Object.keys(stages) as (keyof typeof stages)[]).filter(stage => counts[stage] !== 0);
  return <Panel as="section" className="university-dashboard-panel university-dashboard-in-progress" aria-labelledby={headingId}>
    <h3 id={headingId}><Icon name="receipt" size={18} /> Orders in progress</h3>
    {active.length ? <ul className="university-dashboard-chips">
      {active.map(stage => <li key={stage}><span>{stages[stage]}</span><strong>{formatShortCount(counts[stage])}</strong></li>)}
    </ul> : <p className="university-dashboard-empty">No orders in progress.</p>}
  </Panel>;
}

function CompletedSeriesPlot({ points }: { points: UniversityDashboardData['series']['points'] }) {
  const instructionsId = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ index: number; source: 'keyboard' | 'touch' } | null>(null);
  const highlighted = hovered ?? selection?.index;
  const activePoint = highlighted === undefined ? undefined : points[highlighted];
  const keyboardPoint = selection?.source === 'keyboard' ? points[selection.index] : undefined;
  const max = Math.max(0, ...points.map(point => typeof point.completed === 'number' ? point.completed : 0));
  const hasMasked = points.some(point => point.completed === '<5');
  const step = Math.max(1, Math.ceil(max / 4));
  const plotWidth = 800;
  const plotHeight = 160;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(88, slotWidth * 0.62);
  const labelCount = Math.min(5, points.length);
  const labelIndexes = Array.from({ length: labelCount }, (_, index) =>
    Math.round(index * (points.length - 1) / Math.max(1, labelCount - 1)));

  useEffect(() => {
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHovered(null);
        setSelection(null);
      }
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, []);

  function inspectPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left) / bounds.width;
    return Math.max(0, Math.min(points.length - 1, Math.floor(fraction * points.length)));
  }

  function navigatePoints(event: KeyboardEvent<HTMLDivElement>) {
    const current = selection?.index ?? hovered;
    let index: number;
    switch (event.key) {
      case 'ArrowLeft': index = current === null ? points.length - 1 : Math.max(0, current - 1); break;
      case 'ArrowRight': index = current === null ? 0 : Math.min(points.length - 1, current + 1); break;
      case 'Home': index = 0; break;
      case 'End': index = points.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setHovered(null);
    setSelection({ index, source: 'keyboard' });
  }

  return <figure className="university-dashboard-figure">
    <figcaption className="sr-only">Completed orders over time, with a data table below.</figcaption>
    <p id={instructionsId} className="sr-only">Use Left and Right Arrow to move between periods, Home and End to jump to the first and last periods, and Escape to dismiss the selected period.</p>
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {keyboardPoint && `${keyboardPoint.label}, ${keyboardPoint.completed === '<5' ? 'fewer than 5' : formatShortCount(keyboardPoint.completed)} completed ${keyboardPoint.completed === 1 ? 'order' : 'orders'}`}
    </p>
    <div className="university-dashboard-chart">
      {max > 0 && <div className="university-dashboard-chart-axis" aria-hidden="true">
        {[4, 3, 2, 1, 0].map(tick => <span key={tick}>{formatShortCount(tick * step)}</span>)}
      </div>}
      <div className="university-dashboard-chart-plot" onPointerLeave={() => setHovered(null)}>
        <svg viewBox={`0 0 ${plotWidth} ${plotHeight}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {(max > 0 ? [0, 1, 2, 3, 4] : [4]).map(tick => <line key={tick} x1="0" x2={plotWidth}
            y1={tick * plotHeight / 4} y2={tick * plotHeight / 4} vectorEffect="non-scaling-stroke" />)}
          {highlighted !== undefined && <line className="university-dashboard-chart-guide" vectorEffect="non-scaling-stroke"
            x1={slotWidth * (highlighted + 0.5)} x2={slotWidth * (highlighted + 0.5)} y1={0} y2={plotHeight} />}
          {points.map(({ completed, label }, index) => {
            if (typeof completed !== 'number' || completed === 0) return null;
            const height = completed / (step * 4) * plotHeight;
            return <rect key={`${label}-${index}`} className={highlighted === index ? 'is-highlighted' : undefined}
              x={slotWidth * (index + 0.5) - barWidth / 2} y={plotHeight - height} width={barWidth} height={height} rx={3} />;
          })}
        </svg>
        <div className="university-dashboard-chart-points" tabIndex={0} role="group" aria-label="Inspect completed orders"
          aria-describedby={instructionsId} onKeyDown={navigatePoints}
          onBlur={() => setSelection(current => current?.source === 'keyboard' ? null : current)}
          onPointerMove={event => { if (event.pointerType !== 'touch') setHovered(inspectPointer(event)); }}
          onPointerUp={event => { if (event.pointerType === 'touch') setSelection({ index: inspectPointer(event), source: 'touch' }); }}>
          {points.map(({ completed, label }, index) => completed === '<5' && <span key={`${label}-${index}`}
            className="university-dashboard-masked-mark" aria-hidden="true"
            style={{ '--point-position': `${(index + 0.5) / points.length * 100}%` } as CSSProperties} />)}
        </div>
        {highlighted !== undefined && activePoint && <div className="university-dashboard-chart-tooltip" aria-hidden="true"
          style={{ '--point-position': `${(highlighted + 0.5) / points.length * 100}%` } as CSSProperties}>
          <span>{activePoint.label}</span><strong>{formatShortCount(activePoint.completed)} completed</strong>
        </div>}
      </div>
      <div className="university-dashboard-chart-labels" aria-hidden="true">
        {labelIndexes.map((index, labelIndex) => <span key={index} className={labelIndex !== 0 && labelIndex !== labelCount - 1 && labelIndex % 2 === 1 ? 'is-optional' : undefined}
          style={{ '--point-position': `${(index + 0.5) / points.length * 100}%` } as CSSProperties}>
          {points[index].label.replace(/^Week of /i, '')}
        </span>)}
      </div>
    </div>
    <div className="university-dashboard-chart-caption">
      {hasMasked && <span><i className="university-dashboard-masked-mark" aria-hidden="true" /> Fewer than 5 completed</span>}
      <details className="university-dashboard-chart-data">
        <summary>Show chart data</summary>
        <table>
          <thead><tr><th scope="col">Period</th><th scope="col">Completed orders</th></tr></thead>
          <tbody>{points.map(({ label, completed }, index) => <tr key={`${label}-${index}`}>
            <th scope="row">{label}</th><td>{formatShortCount(completed)}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </div>
  </figure>;
}

export function BarChart({ series, period }: { series: UniversityDashboardData['series']; period: AnalyticsRangeKey }) {
  const headingId = useId();
  const hasActivity = series.points.some(point => point.completed !== 0);
  return <Panel as="section" className="university-dashboard-panel university-dashboard-trend" aria-labelledby={headingId}>
    <div className="university-dashboard-panel-heading">
      <h3 id={headingId}><Icon name="grid" size={18} /> Completed orders over time</h3>
      {hasActivity && <p>{seriesIntervals[series.granularity]} totals</p>}
    </div>
    {hasActivity
      ? <CompletedSeriesPlot key={period} points={series.points} />
      : <p className="university-dashboard-empty">No completed orders in this period. This chart fills in as students confirm sales.</p>}
  </Panel>;
}

function QualityMetrics({ quality }: { quality: UniversityDashboardData['quality'] }) {
  const headingId = useId();
  return <section className="university-dashboard-quality" aria-labelledby={headingId}>
    <h3 id={headingId}>Sales and order quality</h3>
    {quality ? <dl className="university-dashboard-kpis university-dashboard-kpis--quality">
      <KpiCard label="Reported sales" value={formatPeso(quality.reportedSales)} />
      <KpiCard label="Cancellation rate" value={quality.cancellationRatePct === null ? '—' : `${numberFormat.format(quality.cancellationRatePct)}%`}
        hint={quality.cancellationRatePct === null ? 'Too few to report' : undefined} />
      <KpiCard label="Average time to complete" value={quality.avgDaysToComplete === null ? '—'
        : `${numberFormat.format(quality.avgDaysToComplete)} ${quality.avgDaysToComplete === 1 ? 'day' : 'days'}`} />
    </dl> : <p className="university-dashboard-unlock">Sales, cancellation rate and time to complete unlock after 5 completed orders.</p>}
  </section>;
}

export function CategoryBars({ categories }: { categories: UniversityDashboardData['categories'] }) {
  const headingId = useId();
  return <Panel as="section" className="university-dashboard-panel" aria-labelledby={headingId}>
    <h3 id={headingId}><Icon name="tag" size={18} /> Live listings by category</h3>
    {categories.length ? <HorizontalBars entries={categories.map(category => ({ label: category.name, value: category.liveListings }))} />
      : <p className="university-dashboard-empty">No live listings yet.</p>}
  </Panel>;
}

export function CampusTable({ campuses, inactiveCampusCount }: {
  campuses: UniversityDashboardData['campuses'];
  inactiveCampusCount: CountValue;
}) {
  const headingId = useId();
  return <Panel as="section" className="university-dashboard-panel" aria-labelledby={headingId}>
    <h3 id={headingId}><Icon name="pin" size={18} /> Campuses</h3>
    {campuses.length > 0 && <div className="university-dashboard-table-wrap" tabIndex={0} role="region" aria-label="Campus activity table">
      <table>
        <thead><tr><th scope="col">Campus</th><th scope="col">Stores</th><th scope="col">Live listings</th>
          <th scope="col">New</th><th scope="col">Done</th><th scope="col">Sales</th></tr></thead>
        <tbody>{campuses.map(campus => <tr key={campus.name}>
          <th scope="row">{campus.name}</th>
          <td>{formatShortCount(campus.storefronts)}</td><td>{formatShortCount(campus.liveListings)}</td>
          <td>{formatShortCount(campus.newOrders)}</td><td>{formatShortCount(campus.completed)}</td>
          <td>{campus.reportedSales === null ? '—' : formatPeso(campus.reportedSales)}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {inactiveCampusCount !== 0 && <details className="university-dashboard-inactive">
      <summary>{formatShortCount(inactiveCampusCount)} {inactiveCampusCount === 1 ? 'campus has' : 'campuses have'} no activity yet</summary>
      <p>Campuses appear in the table when they have a storefront, a live listing or an order in the selected period.</p>
    </details>}
    {!campuses.length && inactiveCampusCount === 0 && <p className="university-dashboard-empty">No campus activity to show.</p>}
  </Panel>;
}

function DashboardSkeleton() {
  return <div className="university-dashboard-skeleton" role="status" aria-label="Loading dashboard">
    <span />
    <div className="university-dashboard-kpis">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</div>
    <span />
  </div>;
}

export function DashboardPage({ data, period, loading, error, onPeriodChange, onRetry, onOpenSection }: DashboardProps) {
  const headingId = useId();
  const displayedData = data?.period === period ? data : null;
  return <section className="university-dashboard" aria-labelledby={headingId}>
    <header className="university-dashboard-header">
      <div>
        <h2 id={headingId}>University dashboard</h2>
        <p>Orders, listings and reviews across all campuses</p>
      </div>
      <PeriodSwitcher value={period} onChange={onPeriodChange} />
    </header>
    {error && <Panel className="university-dashboard-error">
      <p role="alert">{displayedData ? 'Could not update the dashboard.' : 'Could not load the university dashboard.'}</p>
      <LegacyButton className="ghost" type="button" onClick={onRetry}>Retry</LegacyButton>
    </Panel>}
    {!displayedData && loading && <DashboardSkeleton />}
    {displayedData && <div className="university-dashboard-content" aria-busy={loading}>
      <StatusBar queue={displayedData.reviewQueue} onOpenSection={onOpenSection} />
      <dl className="university-dashboard-kpis" aria-label="Marketplace metrics">
        <KpiCard label="Live listings" value={formatShortCount(displayedData.kpis.liveListings)} hint="Current snapshot" />
        {(Object.keys(periodMetrics) as (keyof typeof periodMetrics)[]).map(metric => <KpiCard key={metric}
          label={periodMetrics[metric]} value={formatShortCount(displayedData.kpis[metric])}
          comparison={{ change: displayedData.kpis.changes[metric], previousPeriodLabel: displayedData.previousPeriodLabel }} />)}
      </dl>
      <div className="university-dashboard-flow">
        <Funnel counts={displayedData.funnel} />
        <StageChips counts={displayedData.ordersInProgress} />
      </div>
      <BarChart period={displayedData.period} series={displayedData.series} />
      <QualityMetrics quality={displayedData.quality} />
      <div className="university-dashboard-breakdown">
        <CategoryBars categories={displayedData.categories} />
        <CampusTable campuses={displayedData.campuses} inactiveCampusCount={displayedData.inactiveCampusCount} />
      </div>
      <p className="university-dashboard-note"><Icon name="shield" size={16} />
        <span>Counts of 1–4 show as &lt;5. Peso totals appear from 5 completed orders. Payments happen between students and are not processed by the marketplace.</span>
      </p>
    </div>}
  </section>;
}
