import { useId } from 'react';

export type HorizontalBar = { key: string; label: string; value: number; display: string; hidden?: boolean };

/** Ranked horizontal bars with their values written out, so no reading depends on bar length alone. */
export function HorizontalBars({ title, bars, emptyText = 'Nothing to show yet.' }: { title: string; bars: HorizontalBar[]; emptyText?: string }) {
  const titleId = useId();
  const max = Math.max(1, ...bars.map(bar => bar.value));
  if (bars.length === 0) return <p className="muted analytics-chart-empty">{emptyText}</p>;
  return <figure className="analytics-hbars" aria-labelledby={titleId}>
    <figcaption id={titleId} className="sr-only">{title}</figcaption>
    <ol>
      {bars.map(bar => <li key={bar.key}>
        <span className="analytics-hbars__label" title={bar.label}>{bar.label}</span>
        <span className="analytics-hbars__track" aria-hidden="true">
          <span className={'analytics-hbars__fill' + (bar.hidden ? ' is-hidden' : '')} style={{ width: bar.hidden ? '6%' : `${Math.max(bar.value > 0 ? 4 : 0, (bar.value / max) * 100)}%` }} />
        </span>
        <strong className="analytics-hbars__value">{bar.display}</strong>
      </li>)}
    </ol>
  </figure>;
}
