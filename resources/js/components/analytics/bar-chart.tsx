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

type Props = { title: string; data: BarDatum[]; format: (value: number) => string; emptyText?: string };

/**
 * Accessible column chart: the bars are decorative, the same figures are read
 * from a summary and from a data table that sighted users can open too.
 */
export function BarChart({ title, data, format, emptyText = 'Nothing recorded in this period.' }: Props) {
  const tableId = useId();
  const max = Math.max(0, ...data.map(item => item.value));
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const peak = data.find(item => item.value === max && max > 0);
  // Long ranges label every few columns so labels never overlap on phones.
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : data.length > 8 ? 2 : 1;

  return <figure className="analytics-chart">
    <figcaption className="sr-only">{title}. {peak ? `Highest: ${peak.label}, ${peak.display}.` : emptyText}</figcaption>
    {max === 0 && !data.some(item => item.hidden)
      ? <p className="analytics-chart-empty muted">{emptyText}</p>
      : <div className="analytics-bars" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((item, index) => <div className="analytics-bar-slot" key={item.key} title={`${item.label}: ${item.display}`}>
          <div className={'analytics-bar' + (item.hidden ? ' analytics-bar--hidden' : '')}
            style={{ height: item.hidden ? '8%' : `${max > 0 ? Math.max(item.value > 0 ? 3 : 0, (item.value / max) * 100) : 0}%` }} />
          <span className="analytics-bar-label">{index % labelEvery === 0 ? item.label.replace('Week of ', '') : ''}</span>
        </div>)}
      </div>}
    <details className="analytics-chart-table">
      <summary>Show as table</summary>
      <table aria-describedby={tableId}>
        <caption id={tableId}>{title}</caption>
        <thead><tr><th scope="col">Period</th><th scope="col">Value</th></tr></thead>
        <tbody>{data.map(item => <tr key={item.key}><th scope="row">{item.label}</th><td>{item.display}</td></tr>)}</tbody>
        {total > 0 && !data.some(item => item.hidden) && <tfoot><tr><th scope="row">Total</th><td>{format(total)}</td></tr></tfoot>}
      </table>
    </details>
  </figure>;
}

