import { describe, expect, test } from 'bun:test';
import { statusLabels, transactionNextStep, transactionPhase, type TransactionSnapshot } from '../../resources/js/transaction-flow';

const pending: TransactionSnapshot = {
  buyerUserId: 10, sellerUserId: 20, status: 'pending',
  buyerMeetupConfirmedAt: null, sellerMeetupConfirmedAt: null,
  buyerCompletionConfirmedAt: null, sellerCompletionConfirmedAt: null,
};

describe('student transaction flow presentation', () => {
  test('uses role-aware requests without implying payment has happened', () => {
    expect(transactionNextStep(pending, 10)).toBe('Waiting for the seller to respond');
    expect(transactionNextStep(pending, 20)).toBe('Review the buyer’s request');
    expect(statusLabels.pending).toBe('Awaiting seller');
  });

  test('two-student meetup state shows the correct next action', () => {
    const accepted = { ...pending, status: 'accepted' as const };
    expect(transactionNextStep(accepted, 10)).toContain('confirm the meetup');
    expect(transactionNextStep({ ...accepted, buyerMeetupConfirmedAt: '2026-11-19T00:00:00Z' }, 10))
      .toContain('Waiting for the other student');
    expect(transactionNextStep({ ...accepted, buyerMeetupConfirmedAt: '2026-11-19T00:00:00Z' }, 20))
      .toContain('confirm the meetup');
  });

  test('completion confirmation is separate for buyer and seller', () => {
    const agreed = { ...pending, status: 'for_meetup' as const };
    expect(transactionNextStep(agreed, 10)).toContain('Confirm after the exchange');
    expect(transactionNextStep({ ...agreed, sellerCompletionConfirmedAt: '2026-11-19T00:00:00Z' }, 20))
      .toContain('Waiting for the other student');
    expect(transactionNextStep({ ...agreed, sellerCompletionConfirmedAt: '2026-11-19T00:00:00Z' }, 10))
      .toContain('Confirm after the exchange');
  });

  test('progress does not confuse negotiation with a completed exchange', () => {
    expect(transactionPhase('pending')).toBe(0);
    expect(transactionPhase('accepted')).toBe(1);
    expect(transactionPhase('negotiating')).toBe(1);
    expect(transactionPhase('for_meetup')).toBe(2);
    expect(transactionPhase('completed')).toBe(3);
    expect(transactionNextStep({ ...pending, status: 'cancelled' }, 10)).toContain('closed');
  });
});
