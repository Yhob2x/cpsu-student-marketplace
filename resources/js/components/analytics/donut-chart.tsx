import { useId } from 'react';

export type DonutSlice = { key: string; label: string; value: number; color: string };

type Props = { title: string; slices: DonutSlice[]; centerLabel: string; emptyText?: string; onSelect?: (key: string) => void };

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Donut with a legend. The ring is decorative; the legend states every value,
 * and legend items can act as shortcuts when `onSelect` is given.
 */
export function DonutChart({ title, slices, centerLabel, emptyText = 'Nothing to show yet.', onSelect }: Props) {
  const titleId = useId();
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return <figure className="analytics-donut" aria-labelledby={titleId}>
    <figcaption id={titleId} className="sr-only">{title}: {total === 0 ? emptyText : `${slices.map(slice => `${slice.label} ${slice.value}`).join(', ')}.`}</figcaption>
    <div className="analytics-donut__ring" aria-hidden="true">
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--surface-soft)" strokeWidth="12" />
        {total > 0 && slices.filter(slice => slice.value > 0).map(slice => {
          const length = (slice.value / total) * CIRCUMFERENCE;
          const circle = <circle key={slice.key} className="analytics-donut__slice" cx="50" cy="50" r={RADIUS} fill="none" stroke={slice.color} strokeWidth="12"
            strokeDasharray={`${length} ${CIRCUMFERENCE - length}`} strokeDashoffset={-offset} transform="rotate(-90 50 50)" />;
          offset += length;
          return circle;
        })}
      </svg>
      <span className="analytics-donut__center"><strong>{total.toLocaleString('en-PH')}</strong><small>{total === 0 ? emptyText : centerLabel}</small></span>
    </div>
    <ul className="analytics-donut__legend">
      {slices.map(slice => {
        const content = <><span className="analytics-donut__swatch" style={{ background: slice.color }} aria-hidden="true" />
          <span className="analytics-donut__label">{slice.label}</span><strong>{slice.value.toLocaleString('en-PH')}</strong></>;
        return <li key={slice.key}>{onSelect
          ? <button type="button" onClick={() => onSelect(slice.key)}>{content}</button>
          : <span className="analytics-donut__row">{content}</span>}</li>;
      })}
    </ul>
  </figure>;
}
