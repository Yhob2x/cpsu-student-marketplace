import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { api, explain } from '@/lib/api';

export type FollowTab = 'followers' | 'following';
export type StoreFollower = { displayName: string; followedAt: string };
export type FollowedStore = { storeId: number; storeName: string; campusName: string; followedAt: string };
export type StoreFollowPage = {
  total: number;
  followerCount?: number;
  followingCount: number;
  page: number;
  pageSize: number;
  items: (StoreFollower | FollowedStore)[];
};

function followDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Date unavailable'
    : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?';
}

export function StoreFollowersView({ activeTab, data, counts, loading, error, onTab, onPage, onRetry, onOpenChange, publicView = false }: {
  activeTab: FollowTab;
  data: StoreFollowPage | null;
  counts: { followers: number; following: number } | null;
  loading: boolean;
  error: string;
  onTab: (tab: FollowTab) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
  onOpenChange?: (open: boolean) => void;
  publicView?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef<Record<FollowTab, HTMLButtonElement | null>>({ followers: null, following: null });
  const [listOpen, setListOpen] = useState(false);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const openList = (tab: FollowTab, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    onTab(tab);
    dialogRef.current?.showModal();
    setListOpen(true);
    onOpenChange?.(true);
    requestAnimationFrame(() => tabRefs.current[tab]?.focus());
  };
  const closeList = () => dialogRef.current?.close();
  const switchTab = (tab: FollowTab) => { if (tab !== activeTab) onTab(tab); };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === 'ArrowRight' || event.key === 'End' ? 'following'
      : event.key === 'ArrowLeft' || event.key === 'Home' ? 'followers' : null;
    if (!next) return;
    event.preventDefault();
    switchTab(next);
    tabRefs.current[next]?.focus();
  };
  return <>
    <div className="storefront-follow-fact">
      <span>Followers</span>
      <button type="button" className="storefront-follow-count" aria-haspopup="dialog"
        aria-label={counts ? `View ${counts.followers} followers` : 'View followers'}
        onClick={event => openList('followers', event.currentTarget)}>
        {counts ? counts.followers.toLocaleString('en-PH') : '—'}
      </button>
    </div>
    <div className="storefront-follow-fact">
      <span>Following</span>
      <button type="button" className="storefront-follow-count" aria-haspopup="dialog"
        aria-label={counts ? `View ${counts.following} followed stores` : 'View followed stores'}
        onClick={event => openList('following', event.currentTarget)}>
        {counts ? counts.following.toLocaleString('en-PH') : '—'}
      </button>
    </div>
    <dialog ref={dialogRef} className="store-follow-dialog" aria-labelledby="store-follow-dialog-title"
      onClose={() => { setListOpen(false); onOpenChange?.(false); onPage(1); openerRef.current?.focus(); }}>
      <div className="store-follow-dialog-shell">
        <header className="store-follow-dialog-header">
          <div><h2 id="store-follow-dialog-title">Store connections</h2>
            <p>{publicView ? 'People following this store and stores its owner follows.'
              : 'Followers of your store and stores you follow.'}</p></div>
          <button type="button" className="store-follow-dialog-close" onClick={closeList} aria-label="Close connections">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="store-follow-tabs" role="tablist" aria-label="Store connections">
          {(['followers', 'following'] as const).map(tab => <button key={tab} type="button" role="tab"
            id={`store-follow-tab-${tab}`} aria-controls="store-follow-panel" aria-selected={activeTab === tab}
            tabIndex={activeTab === tab ? 0 : -1} ref={node => { tabRefs.current[tab] = node; }}
            onClick={() => switchTab(tab)} onKeyDown={onTabKey}>
            {tab === 'followers' ? 'Followers' : 'Following'}
            {counts && <span>{(tab === 'followers' ? counts.followers : counts.following).toLocaleString('en-PH')}</span>}
          </button>)}
        </div>
        <div id="store-follow-panel" className="store-follow-dialog-content" role="tabpanel"
          aria-labelledby={`store-follow-tab-${activeTab}`} aria-busy={loading}>
          {loading && <p className="store-follow-feedback" role="status">Loading {activeTab}…</p>}
          {error && <div className="store-follow-feedback" role="alert"><p>Could not load {activeTab}: {error}</p>
            <button type="button" className="btn ghost" onClick={onRetry}>Try again</button></div>}
          {!loading && !error && data && data.total === 0 && <p className="store-follow-feedback">
            {activeTab === 'followers' ? 'No followers yet. Students can follow this public store.'
              : publicView ? 'This store is not following any stores yet.' : 'You are not following any stores yet.'}
          </p>}
          {!loading && !error && data && data.items.length > 0 && <ul className="store-follow-list">
            {data.items.map((item, index) => activeTab === 'followers' && 'displayName' in item
              ? <li className="store-follow-row" key={`${item.followedAt}-${index}`}>
                  <span className="store-follow-avatar" aria-hidden="true">{initials(item.displayName)}</span>
                  <div className="store-follow-detail"><strong>{item.displayName}</strong>
                    <span>Following since {followDate(item.followedAt)}</span></div>
                </li>
              : activeTab === 'following' && 'storeId' in item
                ? <li className="store-follow-row" key={item.storeId}>
                    <span className="store-follow-avatar" aria-hidden="true"><Icon name="store" size={20} /></span>
                    <div className="store-follow-detail"><Link to={`/stores/${item.storeId}`}
                      onClick={closeList}>{item.storeName}</Link>
                      <span>{item.campusName} · Following since {followDate(item.followedAt)}</span></div>
                  </li>
                : null)}
          </ul>}
        </div>
        {listOpen && !error && data && pages > 1 && <nav className="store-follow-pages" aria-label={`${activeTab} pages`}>
          <button type="button" className="btn ghost" disabled={loading || data.page <= 1}
            onClick={() => onPage(data.page - 1)}>Previous</button>
          <span>Page {data.page} of {pages}</span>
          <button type="button" className="btn ghost" disabled={loading || data.page >= pages}
            onClick={() => onPage(data.page + 1)}>Next</button>
        </nav>}
      </div>
    </dialog>
  </>;
}

export function StoreFollowers({ storeId, publicView = false }: { storeId: number; publicView?: boolean }) {
  const [activeTab, setActiveTab] = useState<FollowTab>('followers');
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  const [data, setData] = useState<StoreFollowPage | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  useForegroundRefresh(() => {
    if (!dialogOpen) setRetryKey(value => value + 1);
  }, 60_000);
  useEffect(() => {
    const refresh = () => setRetryKey(value => value + 1);
    window.addEventListener('store-follow-changed', refresh);
    return () => window.removeEventListener('store-follow-changed', refresh);
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setData(null);
    const resource = publicView ? `/seller-profiles/${storeId}/connections` : '/store-follows/mine';
    const query = dialogOpen ? `?view=${activeTab}&page=${page}` : '?countsOnly=true';
    api<StoreFollowPage | { followerCount: number; followingCount: number }>(resource + query)
      .then(result => {
        if (!current) return;
        if (!dialogOpen) {
          if (typeof result.followerCount !== 'number' || typeof result.followingCount !== 'number')
            throw new Error('Store connections are not available yet.');
          setCounts({ followers: result.followerCount, following: result.followingCount });
          return;
        }
        if (!('items' in result)) throw new Error('Store connections are not available yet.');
        if (typeof result.followingCount !== 'number')
          throw new Error('Store connections are not available yet. Please try again later.');
        if (activeTab === 'following' && (typeof result.followerCount !== 'number' ||
          result.items.some(item => !('storeId' in item))))
          throw new Error('Following is not available yet. Please try again later.');
        setData(result);
        setCounts(activeTab === 'followers'
          ? { followers: result.total, following: result.followingCount }
          : { followers: result.followerCount!, following: result.total });
      })
      .catch(cause => { if (current) setError(explain(cause)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [storeId, publicView, activeTab, page, retryKey, dialogOpen]);
  const changeTab = (tab: FollowTab) => { setActiveTab(tab); setPage(1); };
  return <StoreFollowersView activeTab={activeTab} data={data} counts={counts} loading={loading} error={error}
    onTab={changeTab} onPage={setPage} onRetry={() => setRetryKey(value => value + 1)} onOpenChange={setDialogOpen} publicView={publicView} />;
}
