import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { BarChart } from '../../resources/js/components/analytics/bar-chart';
import { ConversionFunnel } from '../../resources/js/components/analytics/conversion-funnel';
import { KpiCard } from '../../resources/js/components/analytics/kpi-card';
import { OrderPipeline } from '../../resources/js/components/analytics/order-pipeline';
import { formatCount, formatPeso } from '../../resources/js/lib/analytics/format';

describe('analytics components', () => {
  test('bar chart exposes its figures as a summary and a data table', () => {
    const html = renderToStaticMarkup(<BarChart title="Reported sales, last 7 days" format={formatPeso} data={[
      { key: 'a', label: 'Nov 23', value: 0, display: '₱0' },
      { key: 'b', label: 'Nov 24', value: 1250, display: '₱1,250' },
    ]} />);
    expect(html).toContain('Highest: Nov 24, ₱1,250.');
    expect(html).toContain('<caption');
    expect(html).toContain('<th scope="row">Nov 24</th><td>₱1,250</td>');
    expect(html).toContain('<th scope="row">Total</th><td>₱1,250</td>');
    expect(html).toContain('class="analytics-bars" aria-hidden="true"');
  });

  test('hidden small counts are drawn as placeholders and never totalled', () => {
    const html = renderToStaticMarkup(<BarChart title="Completed orders" format={value => formatCount(value)} data={[
      { key: 'a', label: 'Nov 23', value: 0, display: '<5', hidden: true },
      { key: 'b', label: 'Nov 24', value: 6, display: '6' },
    ]} />);
    expect(html).toContain('analytics-bar analytics-bar--hidden');
    expect(html).not.toContain('Total');
  });

  test('empty periods say so instead of drawing flat bars', () => {
    const html = renderToStaticMarkup(<BarChart title="Views" format={value => formatCount(value)} data={[{ key: 'a', label: 'Nov 24', value: 0, display: '0' }]} />);
    expect(html).toContain('Nothing recorded in this period.');
    expect(html).not.toContain('analytics-bars');
  });

  test('KPI change is coloured by meaning, not by direction alone', () => {
    const sales = renderToStaticMarkup(<KpiCard label="Reported sales" value="₱500" change={{ direction: 'up', text: '+20%' }} />);
    const cancellations = renderToStaticMarkup(<KpiCard label="Cancellation rate" value="30%" change={{ direction: 'up', text: '+20%' }} invertChange />);
    expect(sales).toContain('analytics-kpi-change--good');
    expect(cancellations).toContain('analytics-kpi-change--bad');
    expect(sales).toContain('compared with the previous period');
  });

  test('pipeline and funnel list every step with readable counts', () => {
    const pipeline = renderToStaticMarkup(<OrderPipeline counts={{ pending: 2, accepted: '<5', negotiating: 0, for_meetup: 7 }} />);
    expect(pipeline).toContain('aria-label="Orders in progress"');
    expect(pipeline).toContain('<strong>&lt;5</strong>');
    const funnel = renderToStaticMarkup(<ConversionFunnel label="Conversion" steps={[{ label: 'Listing views', value: 200 }, { label: 'Inquiries', value: 20 }]} />);
    expect(funnel).toContain('10% of listing views');
  });
});
