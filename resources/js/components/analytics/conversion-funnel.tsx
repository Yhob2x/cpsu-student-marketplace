import { formatPercent } from '@/lib/analytics/format';

type Step = { label: string; value: number };

/** Each step shows its share of the step before it, so drop-off points stand out. */
export function ConversionFunnel({ steps, label }: { steps: Step[]; label: string }) {
  const max = Math.max(1, ...steps.map(step => step.value));
  return <ol className="analytics-funnel" aria-label={label}>
    {steps.map((step, index) => {
      const previous = index > 0 ? steps[index - 1].value : null;
      const rate = previous ? step.value / previous : null;
      return <li key={step.label}>
        <div className="analytics-funnel-head">
          <span>{step.label}</span>
          <strong>{step.value.toLocaleString('en-PH')}</strong>
        </div>
        <div className="analytics-funnel-track" aria-hidden="true"><div style={{ width: `${(step.value / max) * 100}%` }} /></div>
        {index > 0 && <span className="analytics-funnel-rate">{rate === null ? 'No earlier step to compare' : `${formatPercent(rate)} of ${steps[index - 1].label.toLowerCase()}`}</span>}
      </li>;
    })}
  </ol>;
}
