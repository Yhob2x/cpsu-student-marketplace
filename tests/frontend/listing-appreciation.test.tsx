import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ListingAppreciation } from '../../resources/js/components/listings/listing-appreciation';

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

describe('per-listing appreciation UI', () => {
  test('separate products in the same store show independent counts', async () => {
    const appreciates = new Set<number>();
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/listing-appreciations?ids=')) {
        const ids = new URLSearchParams(url.split('?')[1]).get('ids')!.split(',').map(Number);
        return Response.json({ summaries: Object.fromEntries(ids.map(id => [id, {
          available: true, count: appreciates.has(id) ? 1 : 0, isAppreciated: appreciates.has(id),
        }])) });
      }
      const match = url.match(/\/listing-appreciations\/(\d+)$/);
      if (match) {
        const id = Number(match[1]);
        if (init?.method === 'PUT') appreciates.add(id);
        if (init?.method === 'DELETE') appreciates.delete(id);
        return Response.json({ available: true, count: appreciates.has(id) ? 1 : 0, isAppreciated: appreciates.has(id) });
      }
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }) as typeof fetch;
    render(<MemoryRouter>
      <ListingAppreciation listingId={101} signedIn />
      <ListingAppreciation listingId={102} signedIn />
    </MemoryRouter>);
    const [first] = await screen.findAllByRole('button', { name: 'Appreciate this listing; 0 appreciations' });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
    await act(async () => { fireEvent.click(first); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove appreciation from this listing; 1 appreciations' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' })).toBeTruthy();
    });
    await waitFor(() => expect(first.getAttribute('aria-busy')).toBe('false'));
    expect(appreciates.has(101)).toBe(true);
    expect(appreciates.has(102)).toBe(false);
    expect(calls.filter(x => x.includes('/listing-appreciations?ids=')).length).toBe(1);
  });

  test('compact appreciation stays hollow until liked and never renders a number', async () => {
    let appreciated = false;
    let committed = 0;
    const onCommitted = () => { committed++; };
    window.addEventListener('listing-appreciation-committed', onCommitted);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/listing-appreciations?ids='))
        return Response.json({ summaries: { 101: { available: true, count: appreciated ? 1 : 0, isAppreciated: appreciated } } });
      if (url.endsWith('/listing-appreciations/101')) {
        appreciated = init?.method === 'PUT';
        return Response.json({ available: true, count: appreciated ? 1 : 0, isAppreciated: appreciated });
      }
      return Response.json({}, { status: 404 });
    }) as typeof fetch;
    render(<MemoryRouter><ListingAppreciation listingId={101} signedIn compact /></MemoryRouter>);
    const unliked = await screen.findByRole('button', { name: 'Like this listing' });
    expect(unliked.textContent).toBe('');
    expect(unliked.querySelector('svg')?.getAttribute('fill')).toBe('none');
    await act(async () => { fireEvent.click(unliked); });
    const liked = await screen.findByRole('button', { name: 'Unlike this listing' });
    expect(liked.textContent).toBe('');
    expect(liked.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
    expect(liked.getAttribute('aria-pressed')).toBe('true');
    expect(committed).toBe(1);
    await act(async () => { fireEvent.click(liked); });
    await screen.findByRole('button', { name: 'Like this listing' });
    expect(committed).toBe(2);
    window.removeEventListener('listing-appreciation-committed', onCommitted);
  });

  test('unactivated appreciation database stays icon-only, not a fabricated zero', async () => {
    globalThis.fetch = (async () => Response.json({ summaries: {
      101: { available: false, count: null, isAppreciated: false },
    } })) as typeof fetch;
    render(<MemoryRouter><ListingAppreciation listingId={101} signedIn={false} compact /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('button', {
      name: 'Likes temporarily unavailable',
    })).toBeTruthy());
    const button = screen.getByRole('button', { name: 'Likes temporarily unavailable' });
    expect(button.textContent).toBe('');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.querySelector('svg')?.getAttribute('fill')).toBe('none');
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });
});
