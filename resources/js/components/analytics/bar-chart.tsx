import { useId } from 'react';

export type BarDatum = {
  key: string;
  label: string;
  value: number;
  /** Text shown for the bar, such as "₱1,200" or "<5". */
  display: string;
  /** Hidden values are drawn as a faint placeholder bar. */
  hidden?: boolean;
};

type Props = { title: string; data: BarDatum[]; format: (value: number) => string; emptyText?: string; plotKey?: string; showScale?: boolean };

/**
 * Accessible column chart: the bars are decorative, the same figures are read
 * from a summary and from a data table that sighted users can open too.
 */
export function BarChart({ title, data, format, emptyText = 'Nothing recorded in this period.', plotKey, showScale = false }: Props) {
  const tableId = useId();
  const max = Math.max(0, ...data.map(item => item.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const peak = data.find(item => item.value === max && max > 0);
  const hasHidden = data.some(item => item.hidden);
  const privacyLabel = 'Small counts are hidden for privacy.';
  const summary = peak ? `Peak${hasHidden ? ' among visible counts' : ''}: ${peak.display} (${peak.label})` : hasHidden ? privacyLabel : emptyText;
  const tickStep = Math.ceil(max / 4);
  const hasScale = showScale && tickStep > 0;
  const axisMax = hasScale ? tickStep * 4 : max;
  // Long ranges label every few columns so labels never overlap on phones.
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 8 ? 2 : 1;
  const axisLabelCount = Math.min(5, data.length);
  const axisLabels = Array.from({ length: axisLabelCount }, (_, index) =>
    Math.round(index * (data.length - 1) / Math.max(1, axisLabelCount - 1)));

  return <figure className={`analytics-chart${showScale ? ' analytics-chart--scaled' : ''}`}>
    <figcaption className="sr-only">{title}{showScale ? '' : `. ${summary}`}</figcaption>
    {showScale && peak && <p className="analytics-chart-insight">{summary}</p>}
    {max === 0 && !hasHidden
      ? <p className="analytics-chart-empty muted">{emptyText}</p>
      : <div className={`analytics-chart-plot${hasScale ? ' analytics-chart-plot--with-axis' : ''}`} aria-hidden="true">
        {hasScale && <div className="analytics-chart-axis">
          {[4, 3, 2, 1, 0].map(tick => <span key={tick}>{format(tick * tickStep)}</span>)}
        </div>}
        <div key={plotKey} className="analytics-bars" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((item, index) => {
            const tick = axisLabels.indexOf(index);
            const labelVisible = showScale ? tick !== -1 : index % labelEvery === 0;
            const secondary = showScale && tick % 2 === 1 && index !== data.length - 1;
            const height = axisMax > 0 ? (item.value / axisMax) * 100 : 0;
            return <div className="analytics-bar-slot" key={item.key} title={`${item.label}: ${item.display}`}>
              <div className={'analytics-bar' + (item.hidden ? ' analytics-bar--hidden' : '')}
                style={{ height: item.hidden ? (showScale ? '7px' : '8%') : `${showScale || height === 0 ? height : Math.max(3, height)}%` }} />
              {labelVisible && <span className={`analytics-bar-label${secondary ? ' analytics-bar-label--secondary' : ''}`}>{item.label.replace('Week of ', '')}</span>}
            </div>;
          })}
        </div>
      </div>}
    {showScale && hasHidden && <p className="analytics-chart-key"><span aria-hidden="true" />{privacyLabel}</p>}
    <details className="analytics-chart-table">
      <summary>Show as table</summary>
      <table aria-describedby={tableId}>
        <caption id={tableId}>{title}</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Value</th></tr></thead>
        <tbody>{data.map(item => <tr key={item.key}><th scope="row">{item.label}</th><td>{item.display}</td></tr>)}</tbody>
        {total > 0 && !hasHidden && <tfoot><tr><th scope="row">Total</th><td>{format(total)}</td></tr></tfoot>}
      </table>
    </details>
  </figure>;
}

