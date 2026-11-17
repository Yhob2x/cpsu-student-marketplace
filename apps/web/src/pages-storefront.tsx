import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons';
import { SellerAvatar } from './seller-avatar';
import { filterStoreListings, type StoreFilter } from './storefront-filter';
import type { Listing } from './pages-public';
import './storefront.css';

export type PublicStorefront = {
  id: number;
  storeName: string;
  description: string;
  badge: string;
  avatarUrl?: string | null;
  createdAt: string;
  listingCount: number;
  campus?: { code: string; name: string };
  listings: Listing[];
};

const OPTIONS: { id: StoreFilter; name: string }[] = [
  { id: 'all', name: 'All listings' },
  { id: 'physical_product', name: 'Products' },
  { id: 'service', name: 'Services' },
];

export function StorefrontView({ store, isOwner, renderListing }: {
  store: PublicStorefront;
  isOwner: boolean;
  renderListing: (listing: Listing) => ReactNode;
}) {
  const [filter, setFilter] = useState<StoreFilter>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const categories = useMemo(() => Array.from(new Set(store.listings.map(l => l.category.name)))
    .sort((a, b) => a.localeCompare(b)), [store.listings]);
  const visible = useMemo(() => filterStoreListings(store.listings, filter, category, query),
    [store.listings, query, category, filter]);
  const joined = store.createdAt
    ? new Date(store.createdAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
    : null;

  return <div className="storefront">
    <section className="storefront-identity" aria-labelledby="storefront-name">
      <div className="storefront-banner" aria-hidden="true"><Icon name="store" size={32} /></div>
      <div className="storefront-identity-content">
        <div className="storefront-primary">
          <SellerAvatar name={store.storeName} src={store.avatarUrl} size="large" />
          <div className="storefront-primary-text">
            <h1 id="storefront-name">{store.storeName}</h1>
            <p className="storefront-campus"><Icon name="pin" size={16} /> {store.campus?.name ?? store.campus?.code ?? 'CPSU campus'}</p>
            <span className="storefront-affiliation"><Icon name="shield" size={14} /> {store.badge}</span>
          </div>
        </div>
        <div className="storefront-owner-actions">
          <a className="btn" href="#storefront-listings">Browse listings</a>
          {isOwner && <Link className="btn ghost" to="/dashboard#store-profile">Edit my store</Link>}
        </div>
      </div>
      <div className="storefront-facts">
        <div><span>Available listings</span><strong>{store.listingCount ?? store.listings.length}</strong></div>
        <div><span>Campus</span><strong>{store.campus?.code ?? 'CPSU'}</strong></div>
        {joined && <div><span>Store opened</span><strong>{joined}</strong></div>}
      </div>
    </section>
    <section className="storefront-about" aria-label="About this store">
      <h2>About the store</h2>
      <p>{store.description}</p>
      <p className="muted">Campus verification confirms eligibility for this marketplace, not a university endorsement of products or services. Contact sellers through individual listings.</p>
    </section>
    <section className="storefront-products" aria-labelledby="storefront-listings">
      <div className="storefront-products-heading">
        <div><h2 id="storefront-listings" tabIndex={-1}>Browse this store</h2><p className="muted">Only available, published listings appear here.</p></div>
        <span className="storefront-results">{visible.length} {visible.length === 1 ? 'result' : 'results'}</span>
      </div>
      <div className="storefront-browser">
        <div className="storefront-tabs" role="group" aria-label="Listing type">
          {OPTIONS.map(option => <button key={option.id} type="button"
            aria-pressed={filter === option.id} onClick={() => { setFilter(option.id); setCategory('all'); }}>
            {option.name}
          </button>)}
        </div>
        <div className="storefront-search-filters">
          <label className="storefront-search"><Icon name="search" size={17} /><span className="sr-only">Search this store</span>
            <input type="search" placeholder="Search this store" value={query} maxLength={80}
              onChange={event => setQuery(event.target.value)} /></label>
          <label className="storefront-category">Category
            <select value={category} onChange={event => setCategory(event.target.value)}>
              <option value="all">All categories</option>
              {categories.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>
      </div>
      {visible.length > 0
        ? <div className="grid listing-grid storefront-listings">{visible.map(renderListing)}</div>
        : <div className="storefront-empty">
          <Icon name="search" size={24} />
          <h3>{store.listings.length ? 'No listings match these filters' : 'No available listings yet'}</h3>
          <p className="muted">{store.listings.length ? 'Try another search or category.' : 'Approved items and services will appear here once available.'}</p>
          {store.listings.length > 0 && <button type="button" className="btn ghost"
            onClick={() => { setFilter('all'); setQuery(''); setCategory('all'); }}>Clear filters</button>}
        </div>}
    </section>
  </div>;
}
