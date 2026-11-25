import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { api } from '@/lib/api';
import { filterStoreListings, type StoreFilter } from '@/lib/stores/storefront-filter';
import type { Listing } from '@/types/listing';

import { SellerAvatar } from './seller-avatar';
import { StoreFollowers } from './store-followers';
import { StoreRatingBadge } from './store-rating-badge';
import { StoreReviewEntry } from './store-review-entry';
import { StoreRatingsAndReviews, type StoreReviewSummary } from './store-review-widgets';

export type PublicStorefront = {
  id: number;
  slug: string;
  storeName: string;
  description: string;
  badge: string;
  badgeReason?: string;
  avatarUrl?: string | null;
  createdAt: string;
  listingCount: number;
  appreciationCount?: number | null;
  hasMoreListings?: boolean;
  nextListingBeforeId?: number | null;
  follow?: { count: number | null; isFollowing: boolean; available: boolean };
  campus?: { code: string; name: string };
  listings: Listing[];
};

const OPTIONS: { id: StoreFilter; name: string }[] = [
  { id: 'all', name: 'All listings' },
  { id: 'physical_product', name: 'Products' },
  { id: 'service', name: 'Services' },
];

export function StorefrontView({ store, isOwner, canFollow, onFollow, followBusy, followMessage,
  canChat, signedIn, onChatSignIn, onChat, chatBusy, chatError, renderListing, reportSellerSlot,
  onLoadMore, moreLoading, moreError }: {
  store: PublicStorefront;
  isOwner: boolean;
  canFollow: boolean;
  onFollow: () => void;
  followBusy: boolean;
  followMessage: string;
  canChat: boolean;
  signedIn: boolean;
  onChatSignIn: () => void;
  onChat: (listingId: number, message: string) => void;
  chatBusy: boolean;
  chatError: string;
  renderListing: (listing: Listing) => ReactNode;
  reportSellerSlot?: ReactNode;
  onLoadMore?: () => void;
  moreLoading?: boolean;
  moreError?: string;
}) {
  const [filter, setFilter] = useState<StoreFilter>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatListingId, setChatListingId] = useState(store.listings[0]?.id ?? 0);
  const [chatBody, setChatBody] = useState('');
  const [appreciations, setAppreciations] = useState<number | null>(store.appreciationCount ?? null);
  useEffect(() => { setAppreciations(store.appreciationCount ?? null); }, [store.id, store.appreciationCount]);
  useEffect(() => {
    let active = true;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const sync = (event: Event) => {
      const listingId = (event as CustomEvent<{ listingId: number }>).detail?.listingId;
      if (!store.listings.some(listing => listing.id === listingId)) return;
      clearTimeout(pending);
      pending = setTimeout(() => {
        void api<Pick<PublicStorefront, 'appreciationCount'>>(`/seller-profiles/${store.id}?limit=1`)
          .then(result => { if (active) setAppreciations(result.appreciationCount ?? null); })
          .catch(() => { if (active) setAppreciations(null); });
      }, 90);
    };
    window.addEventListener('listing-appreciation-changed', sync);
    return () => { active = false; clearTimeout(pending); window.removeEventListener('listing-appreciation-changed', sync); };
  }, [store.id, store.listings]);
  // Reuse the reviews section's published aggregate rather than making another request.
  const [rating, setRating] = useState<{ storeId: number; summary: StoreReviewSummary | null } | null>(null);
  const currentRating = rating?.storeId === store.id ? rating.summary : null;
  const categories = useMemo(() => Array.from(new Set(store.listings
    .filter(listing => filter === 'all' || listing.type === filter)
    .map(listing => listing.category.name))).sort((a, b) => a.localeCompare(b)), [store.listings, filter]);
  const visible = useMemo(() => filterStoreListings(store.listings, filter, category, query),
    [store.listings, query, category, filter]);
  const joined = store.createdAt
    ? new Date(store.createdAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
    : null;

  return <div className="storefront">
    <section className="storefront-identity" aria-labelledby="storefront-name">
      <div className="storefront-banner" aria-hidden="true" />
      <div className="storefront-identity-content">
        <div className="storefront-primary">
          <SellerAvatar name={store.storeName} src={store.avatarUrl} size="large" />
          <div className="storefront-primary-text">
            <div className="storefront-title-row">
              <h1 id="storefront-name">{store.storeName}</h1>
              <StoreRatingBadge summary={currentRating} />
              <div className="storefront-owner-actions">
          {isOwner && <Link className="btn storefront-edit-action" to="/profile#store-profile">Edit my store</Link>}
          {!isOwner && canFollow && <LegacyButton type="button"
            className="storefront-follow-action storefront-icon-action"
            aria-pressed={Boolean(store.follow?.isFollowing)}
            aria-label={followBusy ? 'Updating follow' : store.follow?.isFollowing ? 'Following' : 'Follow'}
            title={store.follow?.isFollowing ? 'Unfollow this store' : 'Follow this store'}
            disabled={followBusy || !store.follow?.available}
            onClick={onFollow}>
            <Icon name={store.follow?.isFollowing ? 'userCheck' : 'userPlus'} size={21} />
          </LegacyButton>}
          {canChat && <LegacyButton type="button" className="ghost storefront-icon-action"
            aria-label="Chat with seller"
            title={chatOpen && signedIn ? 'Close seller chat' : 'Chat with seller'}
            aria-expanded={signedIn && chatOpen}
            aria-controls={signedIn && chatOpen ? 'storefront-chat-form' : undefined}
            disabled={chatBusy || store.listings.length === 0}
            onClick={() => {
              if (!signedIn) { onChatSignIn(); return; }
              setChatOpen(open => !open);
            }}>
            <Icon name="chat" size={21} />
          </LegacyButton>}
              </div>
            </div>
            <p className="storefront-campus"><Icon name="pin" size={16} /> {store.campus?.name ?? store.campus?.code ?? 'CPSU campus'}</p>
            <div className="storefront-meta">
              <span className="storefront-affiliation" title={store.badgeReason}><Icon name="store" size={14} /> {store.badge}</span>
              {joined && <span className="storefront-opened">Opened {joined}</span>}
            </div>
          </div>
        </div>
        {canChat && store.listings.length === 0 &&
          <p className="storefront-chat-note muted">Messaging becomes available once this store has a published, available listing.</p>}
        {canChat && signedIn && chatOpen && store.listings.length > 0 && <form
          id="storefront-chat-form" className="storefront-chat-composer"
          onSubmit={event => {
            event.preventDefault();
            if (chatBody.trim() && chatListingId && !chatBusy)
              onChat(chatListingId, chatBody.trim());
          }}>
          <h2>Message {store.storeName}</h2>
          <p className="muted">Choose a listing to discuss.</p>
          <label htmlFor="storefront-chat-listing">About which listing?</label>
          <select id="storefront-chat-listing" value={chatListingId}
            onChange={event => setChatListingId(Number(event.target.value))}
            disabled={chatBusy}>
            {store.listings.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <label htmlFor="storefront-chat-message">Your message</label>
          <textarea id="storefront-chat-message" value={chatBody}
            placeholder="Hi! I'd like to ask about this listing."
            onChange={event => setChatBody(event.target.value)} maxLength={1000}
            rows={3} disabled={chatBusy} required />
          <div className="storefront-chat-actions">
            <LegacyButton className="" type="submit" disabled={!chatBody.trim() || chatBusy}>
              <Icon name="chat" size={17} /> {chatBusy ? 'Sending…' : 'Send message'}
            </LegacyButton>
            <LegacyButton className="ghost" type="button" disabled={chatBusy}
              onClick={() => setChatOpen(false)}>Cancel</LegacyButton>
          </div>
          {chatError && <p className="err" role="alert">{chatError}</p>}
        </form>}
      </div>
      {(followMessage || (!isOwner && canFollow && store.follow && !store.follow.available) ||
        (!isOwner && store.follow?.isFollowing)) && <div className="storefront-follow-notices">
        {followMessage && <p className="storefront-follow-feedback" role="status">{followMessage}</p>}
        {!isOwner && canFollow && store.follow && !store.follow.available &&
          <p className="storefront-follow-feedback muted">Following is being prepared for this marketplace.</p>}
        {!isOwner && store.follow?.isFollowing &&
          <p className="storefront-follow-feedback muted">New approved listings appear in Notifications. Turn on push for phone alerts.</p>}
      </div>}
      <div className="storefront-facts">
        <div><span>Listings</span><strong>{store.listingCount ?? store.listings.length}</strong></div>
        <div className="storefront-appreciations-fact" title="Total appreciations across this store's published listings">
          <span>Appreciations</span><strong>{appreciations === null ? '—' : appreciations.toLocaleString('en-PH')}</strong>
        </div>
        {store.follow?.available && <StoreFollowers key={`${store.id}-${store.follow.count}`} storeId={store.id} publicView />}
      </div>
    </section>
    <section className="storefront-products" aria-labelledby="storefront-listings">
      <div className="storefront-products-heading">
        <div><h2 id="storefront-listings" tabIndex={-1}>Listings</h2></div>
        <div className="storefront-results-group">
          <span className="storefront-results" role="status" aria-live="polite">{visible.length} {visible.length === 1 ? 'result' : 'results'}{store.hasMoreListings ? ' in loaded listings' : ''}</span>
          {visible.length > 0 && (filter !== 'all' || category !== 'all' || query.trim() !== '') &&
            <button type="button" className="storefront-clear-filters" aria-label="Clear store filters" title="Clear store filters"
              onClick={() => { setFilter('all'); setCategory('all'); setQuery(''); }}><Icon name="refresh" size={18} /></button>}
        </div>
      </div>
      <nav className="storefront-navigation" aria-label="Store listings and categories">
        <div className="storefront-toolbar">
          <div className="storefront-tabs" role="group" aria-label="Listing type">
            {OPTIONS.map(option => <button key={option.id} type="button"
              aria-pressed={filter === option.id}
              onClick={() => { setFilter(option.id); setCategory('all'); }}>
              {option.name}
            </button>)}
          </div>
          <div className="storefront-browser">
            <label className="storefront-search"><Icon name="search" size={17} /><span className="sr-only">Search this store</span>
              <input type="search" placeholder="Search this store" value={query} maxLength={80}
                onChange={event => setQuery(event.target.value)} /></label>
          </div>
        </div>
        {categories.length > 0 && <div className="storefront-category-strip">
          <span className="storefront-category-label">Categories</span>
          <div className="storefront-category-tabs" role="group" aria-label="Store categories">
            {categories.map(name => <button type="button" key={name}
              aria-pressed={category === name}
              onClick={() => setCategory(current => current === name ? 'all' : name)}>{name}</button>)}
          </div>
        </div>}
      </nav>
      {visible.length > 0
        ? <div className="grid listing-grid storefront-listings">{visible.map(listing => <Fragment key={listing.id}>{renderListing(listing)}</Fragment>)}</div>
        : <div className="storefront-empty">
          <Icon name="search" size={24} />
          <h3>{store.listings.length ? 'No listings match these filters' : 'No available listings yet'}</h3>
          <p className="muted">{store.listings.length ? 'Try another search or category.' : 'Approved items and services will appear here once available.'}</p>
          {store.listings.length > 0 && <LegacyButton type="button" className="ghost"
            onClick={() => { setFilter('all'); setQuery(''); setCategory('all'); }}>Clear filters</LegacyButton>}
        </div>}
      {store.hasMoreListings && <div className="storefront-load-more" style={{ textAlign: 'center', padding: '16px 12px' }}>
        <p className="muted">Showing {store.listings.length} of {store.listingCount} available listings. Filters search the loaded items.</p>
        {onLoadMore && <LegacyButton className="ghost" type="button" disabled={moreLoading}
          onClick={onLoadMore}>{moreLoading ? 'Loading listings…' : 'Load more listings'}</LegacyButton>}
      </div>}
      {moreError && <p className="err" role="alert">Could not load more listings: {moreError}</p>}
    </section>
    <StoreRatingsAndReviews storeId={store.id}
      onSummary={summary => setRating({ storeId: store.id, summary })}
      reviewAction={!isOwner && canFollow ? <StoreReviewEntry storeId={store.id}
        signedIn={signedIn} onSignIn={onChatSignIn} /> : undefined} />
    <section className="storefront-about" aria-label="About this store">
      <h2>About the store</h2>
      <p>{store.description}</p>
      <p className="muted">Campus verification confirms marketplace eligibility, not an endorsement of products or services.</p>
      {reportSellerSlot}
    </section>
  </div>;
}
