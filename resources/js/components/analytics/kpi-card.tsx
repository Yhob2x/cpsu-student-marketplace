import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/icons';
import type { Change } from '@/lib/analytics/format';

type Props = {
  label: string;
  value: string;
  icon?: IconName;
  change?: Change;
  /** True when a rising number is bad news, such as cancellations. */
  invertChange?: boolean;
  hint?: ReactNode;
};

/** One headline figure with its change from the previous period. */
export function KpiCard({ label, value, icon, change, invertChange = false, hint }: Props) {
  const tone = !change || change.direction === 'flat' ? 'neutral' : (change.direction === 'up') !== invertChange ? 'good' : 'bad';
  return <div className="analytics-kpi">
    <span className="analytics-kpi-label">{icon && <span className="analytics-kpi-icon"><Icon name={icon} size={17} /></span>}{label}</span>
    <strong className={'analytics-kpi-value' + (value === '<5' || value === 'Hidden' ? ' analytics-kpi-value--hidden' : '')}>{value}</strong>
    {change && <span className={`analytics-kpi-change analytics-kpi-change--${tone}`}>
      <span aria-hidden="true">{change.direction === 'up' ? '▲' : change.direction === 'down' ? '▼' : '•'}</span> {change.text}
      <span className="sr-only"> compared with the previous period</span>
    </span>}
    {hint && <span className="analytics-kpi-hint">{hint}</span>}
  </div>;
}
