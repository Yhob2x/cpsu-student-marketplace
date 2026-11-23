import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { ListingViews } from '../src/listing-views';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

describe('listing view counter presentation', () => {
  test('each card displays its own small, actual eye count with a single batched request', async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return Response.json({ views: {
        101: { available: true, count: 298 },
        102: { available: true, count: 41 },
      } });
    }) as typeof fetch;
    render(<>
      <ListingViews listingId={101} compact />
      <ListingViews listingId={102} compact />
    </>);
    expect(await screen.findByRole('img', { name: '298 listing views' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '41 listing views' })).toBeTruthy();
    expect(calls.filter(x => x.includes('/listing-views?ids='))).toHaveLength(1);
    expect(screen.queryByText('saved')).toBeNull();
  });

  test('a confirmed detail view updates only the corresponding card', async () => {
    globalThis.fetch = (async () => Response.json({ views: {
      101: { available: true, count: 2 },
      102: { available: true, count: 7 },
    } })) as typeof fetch;
    render(<>
      <ListingViews listingId={101} compact />
      <ListingViews listingId={102} compact />
    </>);
    await screen.findByRole('img', { name: '2 listing views' });
    await act(async () => {
      window.dispatchEvent(new CustomEvent('listing-view-confirmed', {
        detail: { listingId: 101, available: true, count: 3 },
      }));
    });
    expect(screen.getByRole('img', { name: '3 listing views' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '7 listing views' })).toBeTruthy();
  });

  test('not-yet-activated views display an em dash, never a fabricated zero', async () => {
    globalThis.fetch = (async () => Response.json({ views: {
      101: { available: false, count: null },
    } })) as typeof fetch;
    render(<ListingViews listingId={101} compact />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Views unavailable' })).toBeTruthy());
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });
});
