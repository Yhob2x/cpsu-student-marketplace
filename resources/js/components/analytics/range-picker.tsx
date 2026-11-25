import { RANGE_OPTIONS } from '@/lib/analytics/format';
import type { AnalyticsRangeKey } from '@/types/analytics';

/** Segmented control for the reporting window. Native radios keep keyboard and screen reader support. */
export function RangePicker({ value, onChange, disabled = false }: { value: AnalyticsRangeKey; onChange: (key: AnalyticsRangeKey) => void; disabled?: boolean }) {
  return <fieldset className="analytics-range" disabled={disabled}>
    <legend>Reporting period</legend>
    <div className="analytics-range-options">
      {RANGE_OPTIONS.map(option => <label key={option.key} className={option.key === value ? 'is-selected' : undefined}>
        <input type="radio" name="analytics-range" value={option.key} checked={option.key === value} onChange={() => onChange(option.key)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
