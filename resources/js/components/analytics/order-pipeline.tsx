import { formatShortCount } from '@/lib/analytics/format';
import { statusLabels } from '@/lib/transactions/transaction-flow';
import type { ActiveStatus, CountValue } from '@/types/analytics';

const STEPS: ActiveStatus[] = ['pending', 'accepted', 'negotiating', 'for_meetup'];

/** Orders in progress right now, in the order they move through. */
export function OrderPipeline({ counts, label = 'Orders in progress' }: { counts: Record<ActiveStatus, CountValue>; label?: string }) {
  return <ol className="analytics-pipeline" aria-label={label}>
    {STEPS.map(status => <li key={status} className={`analytics-pipeline-step analytics-pipeline-step--${status}`}>
      <strong>{formatShortCount(counts[status])}</strong>
      <span>{statusLabels[status]}</span>
    </li>)}
  </ol>;
}
