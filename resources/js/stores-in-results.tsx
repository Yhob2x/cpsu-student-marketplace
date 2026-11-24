import { Link } from 'react-router-dom';
import { SellerAvatar } from './seller-avatar';
import { Icon } from './icons';
import type { Listing } from './pages-public';
import '../css/stores-in-results.css';

export function StoresInResults({ listings, query }: { listings: Listing[]; query: string }) {
  const search = query.trim();
  if (!search || listings.length === 0) return null;
  const stores = new Map<number, { seller: Listing['seller']; campus: string; products: Listing[] }>();
  for (const listing of listings) {
    const found = stores.get(listing.seller.id);
    if (found) {
      if (found.products.length < 3) found.products.push(listing);
    } else {
      stores.set(listing.seller.id, { seller: listing.seller, campus: listing.campus.name, products: [listing] });
    }
  }
  return <section className="stores-in-results" aria-labelledby="related-stores-heading">
    <div className="stores-in-results__heading">
      <h2 id="related-stores-heading">Stores in these results</h2>
      <p className="muted">Sellers with matching listings on this page</p>
    </div>
    <div className="stores-in-results__grid">
      {Array.from(stores.values()).slice(0, 3).map(({ seller, campus, products }) =>
        <article className="stores-in-results__card" key={seller.id}>
          <div className="stores-in-results__identity">
            <SellerAvatar name={seller.storeName} src={seller.avatarUrl} size="medium" />
            <div><h3>{seller.storeName}</h3><span className="muted"><Icon name="pin" size={13} />{campus}</span></div>
          </div>
          <div className="stores-in-results__previews" aria-label={`Listings by ${seller.storeName}`}>
            {products.map(listing => <Link key={listing.id} to={`/listings/${listing.id}`}
              aria-label={`View ${listing.title}`} className="stores-in-results__preview">
              {listing.images[0]
                ? <img src={listing.images[0]} alt="" loading="lazy" decoding="async" />
                : <Icon name="tag" size={22} />}
            </Link>)}
          </div>
          <Link to={`/stores/${seller.id}`} className="stores-in-results__visit">
            Visit store <Icon name="arrow" size={16} />
          </Link>
        </article>)}
    </div>
  </section>;
}
