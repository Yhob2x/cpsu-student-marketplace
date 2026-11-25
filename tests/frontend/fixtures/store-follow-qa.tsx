import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { StoreFollowersView, type FollowTab, type StoreFollowPage } from '../../../resources/js/components/stores/store-followers';
import '../../../resources/css/styles.css';
import '../../../resources/css/editorial-redesign.css';
import '../../../resources/css/storefront.css';
import '../../../resources/css/typography.css';
import '../../../resources/css/dashboard-storefront.css';

const followers: StoreFollowPage = { total: 3, followingCount: 2, page: 1, pageSize: 6, items: [
  { displayName: 'A Synthetic Student', followedAt: '2026-11-18T08:00:00.000Z' },
  { displayName: 'B Synthetic Student', followedAt: '2026-11-17T08:00:00.000Z' },
  { displayName: 'C Synthetic Student', followedAt: '2026-11-16T08:00:00.000Z' },
] };
const following: StoreFollowPage = { total: 2, followerCount: 3, followingCount: 2, page: 1, pageSize: 6, items: [
  { storeId: 31, storeName: 'A Synthetic Store', campusName: 'Main Campus', followedAt: '2026-11-18T08:00:00.000Z' },
  { storeId: 32, storeName: 'Another Synthetic Campus Store With a Long Name', campusName: 'Cauayan Campus', followedAt: '2026-11-17T08:00:00.000Z' },
] };

function Fixture() {
  const [tab, setTab] = useState<FollowTab>(new URLSearchParams(location.search).get('tab') === 'following' ? 'following' : 'followers');
  useEffect(() => { window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>(tab === 'following' ? '[aria-label="View 2 followed stores"]' : '[aria-label="View 3 followers"]')?.click();
  }, 100); }, []);
  return <main className="wrap"><div className="my-store"><section className="storefront-identity store-dashboard-identity">
    <div className="storefront-banner" /><div className="storefront-identity-content"><div className="storefront-primary-text"><h1>My store</h1><p>Main Campus</p></div></div>
    <div className="storefront-facts"><div><span>Your listings</span><strong>12</strong></div>
      <StoreFollowersView activeTab={tab} data={tab === 'followers' ? followers : following}
        counts={{ followers: 3, following: 2 }} loading={false} error="" onTab={setTab} onPage={() => {}} onRetry={() => {}} />
      <div><span>Campus</span><strong>Main Campus</strong></div></div>
  </section></div></main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter><Fixture /></MemoryRouter>);
