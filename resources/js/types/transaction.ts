import type { TransactionSnapshot } from '@/lib/transactions/transaction-flow';

export type TransactionRow = TransactionSnapshot & {
  id: number; listingId: number; inquiryThreadId: number;
  price: number; currency: string; createdAt: string;
  listing: { title: string; type: string };
  buyer?: { displayName: string }; seller?: { displayName: string };
};
