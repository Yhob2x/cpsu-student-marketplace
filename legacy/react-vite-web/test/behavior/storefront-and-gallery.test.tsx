import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontView, type PublicStorefront } from '../../src/pages-storefront';
import { ListingGallery } from '../../src/listing-gallery';
import { FloatingChat } from '../../src/floating-chat';
import type { Listing } from '../../src/pages-public';

const listing = {
  id: 91, type: 'physical_product', title: 'Synthetic textbook',
  category: { name: 'Books' }, images: [],
} as Listing;
const service = {
  id: 92, type: 'service', title: 'Synthetic tutoring',
  category: { name: 'Tutoring' }, images: [],
} as Listing;
const store: PublicStorefront = {
  id: 30, slug: 'synthetic-store', storeName: 'Synthetic Student Store',
  description: 'Synthetic testing only.', badge: 'Verified CPSU community member',
  createdAt: '2026-11-18T00:00:00Z', listingCount: 2,
  follow: { count: 1, isFollowing: false, available: true },
  campus: { code: 'MAIN', name: 'CPSU Main Campus' }, listings: [listing, service],
};

const originalFetch = globalThis.fetch;
const oldMatchMedia = window.matchMedia;
const oldScrollTo = HTMLElement.prototype.scrollTo;

beforeEach(() => {
  window.matchMedia = () => ({ matches: false, media: '(prefers-reduced-motion: reduce)', onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true });
  HTMLElement.prototype.scrollTo = function () {};
  // These assertions exercise local UI state. Keep unrelated review/follow
  // requests pending to avoid asynchronous updates outside the test's act scope.
  globalThis.fetch = () => new Promise<Response>(() => {});
});
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.matchMedia = oldMatchMedia;
  HTMLElement.prototype.scrollTo = oldScrollTo;
});

function InteractiveStore() {
  const [following, setFollowing] = useState(false);
  return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><StorefrontView
    store={{ ...store, follow: { count: following ? 2 : 1, isFollowing: following, available: true } }}
    isOwner={false} canFollow onFollow={() => setFollowing(value => !value)}
    followBusy={false} followMessage="" canChat={false} signedIn
    onChatSignIn={() => {}} onChat={() => {}} chatBusy={false} chatError=""
    renderListing={item => <article data-testid={'listing-' + item.id}>{item.title}</article>} /></MemoryRouter>;
}

describe('Phase 2: real storefront interaction', () => {
  test('Follow/Following keeps the same action position and changes pressed state', () => {
    render(<InteractiveStore />);
    const follow = screen.getByRole('button', { name: 'Follow', exact: true });
    const parent = follow.parentElement;
    fireEvent.click(follow);
    const following = screen.getByRole('button', { name: 'Following', exact: true });
    expect(following.parentElement).toBe(parent);
    expect(following.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(following);
    const restored = screen.getByRole('button', { name: 'Follow', exact: true });
    expect(restored.parentElement).toBe(parent);
    expect(restored.getAttribute('aria-pressed')).toBe('false');
  });

  test('product and service filters show only the selected type and can reset', () => {
    render(<InteractiveStore />);
    expect(screen.getByTestId('listing-91')).toBeTruthy();
    expect(screen.getByTestId('listing-92')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Services', exact: true }));
    expect(screen.queryByTestId('listing-91')).toBeNull();
    expect(screen.getByTestId('listing-92')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'All listings' }));
    expect(screen.getByTestId('listing-91')).toBeTruthy();
    expect(screen.getByTestId('listing-92')).toBeTruthy();
  });
});

describe('Phase 2: real gallery and chat interactions', () => {
  test('gallery next, previous and thumbnail buttons update the active photo', () => {
    render(<ListingGallery title="Synthetic textbook" photos={['/one.png', '/two.png', '/three.png']} />);
    expect(screen.getByRole('status').textContent).toContain('Photo 1 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('status').textContent).toContain('Photo 2 of 3');
    fireEvent.click(screen.getByRole('button', { name: 'Show photo 3 of 3' }));
    expect(screen.getByRole('status').textContent).toContain('Photo 3 of 3');
    expect((screen.getByRole('button', { name: 'Next photo' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(screen.getByRole('status').textContent).toContain('Photo 2 of 3');
  });

  test('floating chat caps unread badge at 99+ and opens with keyboard activation', async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FloatingChat ready isStaff={false} signedIn unreadMessages={125} /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: /Chat, 125 unread messages/ });
    expect(trigger.textContent).toContain('99+');
    await act(async () => fireEvent.click(trigger, { detail: 0 }));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
