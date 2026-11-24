export type TransactionStatus = 'pending' | 'accepted' | 'negotiating' | 'for_meetup' | 'completed' | 'cancelled';

export const statusLabels: Record<TransactionStatus, string> = {
  pending: 'Awaiting seller',
  accepted: 'Accepted',
  negotiating: 'Arranging meetup',
  for_meetup: 'Meetup agreed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export type TransactionSnapshot = {
  buyerUserId: number;
  sellerUserId: number;
  status: TransactionStatus;
  buyerMeetupConfirmedAt: string | null;
  sellerMeetupConfirmedAt: string | null;
  buyerCompletionConfirmedAt: string | null;
  sellerCompletionConfirmedAt: string | null;
};

export function transactionNextStep(t: TransactionSnapshot, viewerId: number | undefined): string {
  const buyer = t.buyerUserId === viewerId;
  if (t.status === 'pending') return buyer
    ? 'Waiting for the seller to respond'
    : 'Review the buyer’s request';
  if (t.status === 'accepted' || t.status === 'negotiating') {
    const confirmed = buyer ? t.buyerMeetupConfirmedAt : t.sellerMeetupConfirmedAt;
    return confirmed ? 'Waiting for the other student to confirm the meetup' : 'Agree on details and confirm the meetup';
  }
  if (t.status === 'for_meetup') {
    const confirmed = buyer ? t.buyerCompletionConfirmedAt : t.sellerCompletionConfirmedAt;
    return confirmed ? 'Waiting for the other student to confirm completion' : 'Confirm after the exchange or service is done';
  }
  return t.status === 'completed' ? 'Both students confirmed completion' : 'This request is closed';
}

export function transactionPhase(status: TransactionStatus): number {
  if (status === 'pending') return 0;
  if (status === 'accepted' || status === 'negotiating') return 1;
  if (status === 'for_meetup') return 2;
  return 3;
}
