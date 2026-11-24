import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StoreReviewEntry } from '../src/store-review-entry';
import { StoreRatingsAndReviews } from '../src/store-review-widgets';

const fetchOriginal = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = fetchOriginal; });

describe('public store write-review entry (synthetic HTTP only)', () => {
  test('guest CTA starts sign-in without querying private transaction records', () => {
    let logins = 0;
    let requests = 0;
    globalThis.fetch = (async () => { requests++; return Response.json({}); }) as typeof fetch;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StoreReviewEntry storeId={88} signedIn={false}
      onSignIn={() => { logins++; }} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Write a review' }));
    expect(logins).toBe(1);
    expect(requests).toBe(0);
    expect(screen.queryByText('Review a purchase from this store')).toBeNull();
  });

  test('available but no eligible purchases explains the requirement and offers transactions', async () => {
    globalThis.fetch = (async () => Response.json({
      available: true, items: [], page: 1, pageSize: 10, hasMore: false,
      reason: 'no_eligible_completed_transaction',
    })) as typeof fetch;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StoreReviewEntry storeId={88} signedIn onSignIn={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Write a review' }));
    expect(await screen.findByText(/No completed purchases from this store/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'My transactions' }).getAttribute('href')).toBe('/transactions');
    expect(screen.queryByRole('button', { name: 'Submit store rating' })).toBeNull();
  });

  test('store empty state has concise copy and one functional write review action', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/reviews?page=')) return Response.json({
        available: true, summary: { count: 0, average: null, distribution: {} },
        items: [], page: 1, pageSize: 8,
      });
      return Response.json({
        available: true, items: [], page: 1, pageSize: 10, hasMore: false,
        reason: 'verified_student_required',
      });
    }) as typeof fetch;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StoreRatingsAndReviews storeId={88}
      reviewAction={<StoreReviewEntry storeId={88} signedIn onSignIn={() => {}} />} /></MemoryRouter>);
    expect(await screen.findByText('No reviews yet')).toBeTruthy();
    expect(screen.getByText('Approved buyer reviews will appear here.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Write a review' }));
    expect(await screen.findByText(/need a current, verified CPSU affiliation/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit store rating' })).toBeNull();
  });

  test('verified buyer selects a completed purchase and reuses moderated review form', async () => {
    const posts: Array<{ url: string; rating: number }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/seller-profiles/88/review-opportunities')) return Response.json({
        available: true, page: 1, pageSize: 10, hasMore: false, reason: null,
        items: [
          { id: 42, createdAt: '2026-11-18T00:00:00Z', listing: { title: 'Textbook' } },
          { id: 43, createdAt: '2026-11-17T00:00:00Z', listing: { title: 'School bag' } },
        ],
      });
      if (url.endsWith('/transactions/43/store-review') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        posts.push({ url, rating: body.rating });
        return Response.json({ review: { id: 91, status: 'pending' } }, { status: 201 });
      }
      if (url.endsWith('/transactions/42/store-review') ||
          url.endsWith('/transactions/43/store-review')) {
        return Response.json({ available: true, eligible: true, review: null });
      }
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }) as typeof fetch;
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StoreReviewEntry storeId={88} signedIn onSignIn={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Write a review' }));
    const chooser = await screen.findByLabelText('Completed purchase');
    fireEvent.change(chooser, { target: { value: '43' } });
    await waitFor(() => expect(screen.getByRole('radio', { name: '5 stars' })).toBeTruthy());
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit store rating' }));
    await waitFor(() => {
      expect(posts).toEqual([{ url: '/api/v1/transactions/43/store-review', rating: 5 }]);
      expect(screen.getByText('Your review was submitted for campus approval.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Submit store rating' })).toBeNull();
    });
  });
});
