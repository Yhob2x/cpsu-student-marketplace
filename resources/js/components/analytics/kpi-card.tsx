import type { ReactNode } from 'react';

import type { Change } from '@/lib/analytics/format';

type Props = {
  label: string;
  value: string;
  change?: Change;
  /** True when a rising number is bad news, such as cancellations. */
  invertChange?: boolean;
  hint?: ReactNode;
};

/** One headline figure with its change from the previous period. */
export function KpiCard({ label, value, change, invertChange = false, hint }: Props) {
  const tone = !change || change.direction === 'flat' ? 'neutral' : (change.direction === 'up') !== invertChange ? 'good' : 'bad';
  return <div className="analytics-kpi">
    <span className="analytics-kpi-label">{label}</span>
    <strong className="analytics-kpi-value">{value}</strong>
    {change && <span className={`analytics-kpi-change analytics-kpi-change--${tone}`}>
      <span aria-hidden="true">{change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '•'}</span> {change.text}
      <span className="sr-only"> compared with the previous period</span>
    </span>}
    {hint && <span className="analytics-kpi-hint">{hint}</span>}
  </div>;
}
