import { Icon } from '@/components/icons';

type ReceiptState = 'sent' | 'delivered' | 'read';

export function MessageReceipt({ state, compact = false }: { state: ReceiptState; compact?: boolean }) {
  const label = state === 'read' ? 'Read' : state === 'delivered' ? 'Delivered' : 'Sent';
  return <span className={`message-receipt ${state === 'read' ? 'is-read' : ''} ${compact ? 'is-compact' : ''}`}
    title={label}>
    <Icon name={state === 'sent' ? 'check' : 'checks'} size={compact ? 14 : 15} />
    <span>{label}</span>
  </span>;
}
