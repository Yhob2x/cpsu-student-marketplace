import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreReviewModeration, TransactionStoreReview } from '../../resources/js/store-review-widgets';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

describe('store review workflow (synthetic HTTP only)', () => {
  test('buyer selects stars, submits once and sees pending moderation', async () => {
    let status: 'none' | 'pending' = 'none';
    const written: Array<{ rating: number; body: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/transactions/42/store-review')) {
        if (init?.method === 'POST') {
          written.push(JSON.parse(String(init.body)));
          status = 'pending';
          return Response.json({ review: { id: 3, status }, message: 'Review submitted' }, { status: 201 });
        }
        return Response.json(status === 'none'
          ? { available: true, eligible: true, reason: null, review: null }
          : { available: true, eligible: false, reason: 'already_reviewed',
            review: { id: 3, rating: 5, body: 'Helpful seller', status: 'pending' } });
      }
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }) as typeof fetch;

    render(<TransactionStoreReview transactionId={42} />);
    expect(await screen.findByRole('radio', { name: '5 stars' })).toBeTruthy();
    const submit = screen.getByRole('button', { name: 'Submit store rating' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    fireEvent.change(screen.getByPlaceholderText(/Describe your experience/), {
      target: { value: '  Helpful seller  ' },
    });
    expect(screen.getByText('5 of 5 stars selected')).toBeTruthy();
    fireEvent.click(submit);
    await waitFor(() => {
      expect(written).toEqual([{ rating: 5, body: 'Helpful seller' }]);
      expect(screen.getByText('Awaiting campus review')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Submit store rating' })).toBeNull();
    });
  });

  test('explains why an ineligible buyer cannot submit a review', async () => {
    globalThis.fetch = (async () => Response.json({
      available: true, eligible: false, reason: 'verified_student_required', review: null,
    })) as typeof fetch;
    render(<TransactionStoreReview transactionId={42} />);
    expect(await screen.findByText(/current, verified CPSU affiliation is required/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit store rating' })).toBeNull();
  });

  test('reviewer approves a pending rating and it leaves their queue', async () => {
    let decided = false;
    const actions: Array<{decision: string; reason: string}> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/admin/store-reviews?')) return Response.json({
        available: true, items: decided ? [] : [{
          id: 7, rating: 4, body: 'Good service', status: 'pending',
          createdAt: '2026-11-18T03:00:00Z',
          store: { storeName: 'Synthetic Seller', campusId: 3 },
          transaction: { listing: { title: 'Books' } },
        }], page: 1, pageSize: 20, hasMore: false,
      });
      if (url.endsWith('/admin/store-reviews/7/decision') && init?.method === 'POST') {
        const action = JSON.parse(String(init.body));
        actions.push(action); decided = true;
        return Response.json({ ok: true });
      }
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }) as typeof fetch;
    render(<StoreReviewModeration />);
    expect(await screen.findByText('Synthetic Seller — Books')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Record why this review/), {
      target: { value: 'Reviewed under marketplace quality standards.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve review' }));
    await waitFor(() => {
      expect(actions).toEqual([{
        decision: 'published', reason: 'Reviewed under marketplace quality standards.',
      }]);
      expect(screen.getByText('No reviews in this category.')).toBeTruthy();
    });
  });
});
