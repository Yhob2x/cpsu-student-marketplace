import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';

import { SellerAvatar } from './seller-avatar';

export type MostFollowedStore = {
  id: number;
  storeName: string;
  avatarUrl?: string | null;
  campus: { name: string; code: string };
  followerCount: number;
  listingCount: number;
};

export function MostFollowedStores({ stores }: { stores: MostFollowedStore[] }) {
  if (stores.length === 0) return null;
  return <section className="most-followed-stores" aria-labelledby="most-followed-stores-heading">
    <div className="sec-head most-followed-stores__heading">
      <div>
        <h2 id="most-followed-stores-heading">Most followed stores</h2>
        <p>Student shops the CPSU community follows</p>
      </div>
    </div>
    <div className="most-followed-stores__grid">
      {stores.map(store => <article className="most-followed-stores__card" key={store.id}>
        <div className="most-followed-stores__identity">
          <SellerAvatar name={store.storeName} src={store.avatarUrl} size="large" />
          <div className="most-followed-stores__details">
            <h3>{store.storeName}</h3>
            <span className="most-followed-stores__campus"><Icon name="pin" size={14} /> {store.campus.name}</span>
          </div>
        </div>
        <div className="most-followed-stores__meta">
          <span><Icon name="user" size={15} /> {store.followerCount.toLocaleString('en-PH')} {store.followerCount === 1 ? 'follower' : 'followers'}</span>
          <span>{store.listingCount} {store.listingCount === 1 ? 'listing' : 'listings'}</span>
        </div>
        <Link className="most-followed-stores__link" to={`/stores/${store.id}`}>
          Visit store <Icon name="arrow" size={16} />
        </Link>
      </article>)}
    </div>
  </section>;
}
