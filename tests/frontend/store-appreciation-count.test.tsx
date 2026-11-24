import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StoreAppreciation } from '../../resources/js/components/stores/store-appreciation';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

describe('appreciation statistic alongside followers and following', () => {
  test('shows real zero, then updates the count after an appreciation', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/seller-profiles/88/appreciations'))
        return Response.json({ available: true, count: 0, isAppreciated: false });
      if (url.endsWith('/store-appreciations/88') && init?.method === 'PUT')
        return Response.json({ available: true, count: 1, isAppreciated: true });
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }) as typeof fetch;
    const view = render(<div><StoreAppreciation storeId={88} signedIn /><StoreAppreciation storeId={88} readOnly /></div>);
    expect(screen.getByText('Appreciations')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(view.container.querySelector('.store-appreciation-button .store-appreciation-count')).toBeNull();
    const button = await screen.findByRole('button', { name: 'Appreciate this store; 0 appreciations' });
    expect(screen.getByText('0')).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Remove appreciation; 1 appreciations' })
        .getAttribute('aria-pressed')).toBe('true');
    });
  });

  test('keeps a visible dash instead of inventing zero when the migration is pending', async () => {
    globalThis.fetch = (async () => Response.json({
      available: false, count: null, isAppreciated: false,
    })) as typeof fetch;
    render(<div><StoreAppreciation storeId={88} /><StoreAppreciation storeId={88} readOnly /></div>);
    expect(screen.getByText('Appreciations')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', {
      name: /Appreciate this store — Awaiting database setup/,
    })).toBeTruthy());
    expect(screen.queryByText('0')).toBeNull();
  });
});
