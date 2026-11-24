import { statusLabels, type TransactionStatus } from '@/lib/transactions/transaction-flow';

export function StatusPill({ status }: { status: TransactionStatus }) {
  return <span className={'transaction-status transaction-status--' + status}>{statusLabels[status]}</span>;
}
