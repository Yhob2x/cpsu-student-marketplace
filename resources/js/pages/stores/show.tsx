import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { Icon } from '@/components/icons';
import { ListingCard } from '@/components/listings/listing-card';
import { StorefrontView, type PublicStorefront } from '@/components/stores/storefront-view';
import { StorefrontSkeleton } from '@/components/ui/async-feedback';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { api, explain } from '@/lib/api';
import { isPublicNotFound, publicResourceLoadMessage } from '@/lib/public-resource-error';
import { useMe } from '@/providers/session-provider';

export function StorePage() {
  const { id, slug } = useParams(); const { me } = useMe(); const navigate = useNavigate();
  const [s, setS] = useState<PublicStorefront | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [moreListingsLoading, setMoreListingsLoading] = useState(false);
  const [moreListingsError, setMoreListingsError] = useState('');
  const moreListingsLock = useRef(false);
  const loadRequest = useRef(0);
  const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false); const [reportError, setReportError] = useState(''); const [reportNotice, setReportNotice] = useState('');
  const reportLock = useRef(false);
  const followLock = useRef(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMessage, setFollowMessage] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatLock = useRef(false);
  const loadStore = () => {
    const request = ++loadRequest.current;
    moreListingsLock.current = false;
    setMoreListingsLoading(false); setMoreListingsError('');
    setS(null); setLoadError(null);
    const resource = slug ? `/seller-profiles/by-slug/${encodeURIComponent(slug)}` : `/seller-profiles/${id}`;
    api<PublicStorefront>(`${resource}?limit=24`).then(row => {
      if (request !== loadRequest.current) return;
      setS(row);
      if (id || (slug && slug !== row.slug)) navigate(`/store/${encodeURIComponent(row.slug)}`, { replace: true });
    })
      .catch(e => { if (request === loadRequest.current) setLoadError(e); });
  };
  useEffect(() => { loadStore(); return () => { loadRequest.current++; }; }, [id, slug]);
  const loadMoreListings = async () => {
    if (!s?.hasMoreListings || !s.nextListingBeforeId || moreListingsLock.current) return;
    const storeId = s.id;
    const request = loadRequest.current;
    moreListingsLock.current = true;
    setMoreListingsLoading(true); setMoreListingsError('');
    try {
      const page = await api<PublicStorefront>(
        `/seller-profiles/${storeId}?limit=24&beforeId=${s.nextListingBeforeId}`);
      if (request !== loadRequest.current) return;
      setS(current => {
        if (current?.id !== storeId) return current;
        const known = new Set(current.listings.map(row => row.id));
        return { ...current,
          listings: [...current.listings, ...page.listings.filter(row => !known.has(row.id))],
          listingCount: page.listingCount,
          hasMoreListings: page.hasMoreListings,
          nextListingBeforeId: page.nextListingBeforeId };
      });
    } catch (error) {
      if (request === loadRequest.current) setMoreListingsError(explain(error));
    } finally {
      if (request === loadRequest.current) {
        moreListingsLock.current = false;
        setMoreListingsLoading(false);
      }
    }
  };
  if (loadError && !s) return <Panel as="section" className="stack" role="alert">
    <h1>{isPublicNotFound(loadError) ? 'Store not found' : 'Could not load this store'}</h1>
    <p>{isPublicNotFound(loadError) ? 'This store is not available.' : publicResourceLoadMessage(loadError)}</p>
    <div className="row">{!isPublicNotFound(loadError) && <LegacyButton type="button" className="" onClick={loadStore}>Retry store</LegacyButton>}
      <Link className="btn ghost" to="/explore">Browse listings</Link></div>
  </Panel>;
  if (!s) return <StorefrontSkeleton />;
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const isOwner = me?.storeId === s.id;
  const publicStorePath = `/store/${encodeURIComponent(s.slug)}`;
  const toggleFollow = async () => {
    if (!me) { navigate(`/login?next=${encodeURIComponent(publicStorePath)}`); return; }
    if (staff || isOwner || followLock.current || !s.follow?.available) return;
    const storeId = s.id;
    const previous = s.follow;
    const following = !previous.isFollowing;
    followLock.current = true;
    setFollowBusy(true); setFollowMessage('');
    // Show the requested state before network syncing, without claiming it was saved yet.
    setS(current => current?.id === storeId ? { ...current, follow: {
      ...previous, isFollowing: following, count: typeof previous.count === 'number'
        ? Math.max(0, previous.count + (following ? 1 : -1)) : null,
    } } : current);
    try {
      const result = await api<{ count: number; isFollowing: boolean }>(`/store-follows/${storeId}`, {
        method: following ? 'PUT' : 'DELETE',
      });
      setS(current => current?.id === s.id ? {
        ...current, follow: { count: result.count, isFollowing: result.isFollowing, available: true },
      } : current);
      setFollowMessage(result.isFollowing ? 'You are following this store.' : 'You unfollowed this store.');
      showActionFeedback({ kind: 'success', title: result.isFollowing ? 'Store followed' : 'Store unfollowed', message: result.isFollowing ? 'You will see updates from this store.' : 'You will no longer receive this store’s updates.' });
      window.dispatchEvent(new Event('store-follow-changed'));
    } catch (error) {
      setS(current => current?.id === storeId ? { ...current, follow: previous } : current);
      setFollowMessage('Could not sync following. Your previous state was restored.');
      showActionFeedback({ kind: 'error', title: 'Follow action failed', message: explain(error) });
    } finally {
      followLock.current = false;
      setFollowBusy(false);
    }
  };
  const startStoreChat = async (listingId: number, body: string) => {
    if (!me) {
      navigate(`/login?next=${encodeURIComponent(publicStorePath)}`);
      return;
    }
    if (staff || isOwner || chatLock.current || !s.listings.some(item => item.id === listingId) ||
      !body.trim()) return;
    chatLock.current = true;
    setChatBusy(true); setChatError('');
    try {
      const thread = await api<{ id: number }>('/inquiries', {
        body: { listingId, body: body.trim() },
      });
      navigate(`/inquiries/${thread.id}`);
    } catch (error) {
      setChatError(explain(error));
    } finally {
      chatLock.current = false;
      setChatBusy(false);
    }
  };
  const reportSeller = async () => {
    if (reportLock.current || !me || staff || isOwner || reason.trim().length < 10) return;
    reportLock.current = true; setReportBusy(true); setReportError(''); setReportNotice('');
    try {
      await api('/reports', { body: { sellerProfileId: s.id, reason: reason.trim() } });
      setReason(''); setReporting(false); setReportNotice('Seller report sent to a campus reviewer.');
      showActionFeedback({ kind: 'success', title: 'Store reported', message: 'A campus reviewer will review your report.' });
    } catch (e) { setReportError(explain(e)); showActionFeedback({ kind: 'error', title: 'Report not sent', message: explain(e) }); }
    finally { reportLock.current = false; setReportBusy(false); }
  };
  return <><StorefrontView key={s.id} store={s} isOwner={isOwner}
    canFollow={!staff} onFollow={() => void toggleFollow()} followBusy={followBusy} followMessage={followMessage}
    canChat={!staff && !isOwner} signedIn={Boolean(me)}
    onChatSignIn={() => navigate(`/login?next=${encodeURIComponent(publicStorePath)}`)}
    onChat={(listingId, body) => void startStoreChat(listingId, body)}
    chatBusy={chatBusy} chatError={chatError}
    onLoadMore={() => void loadMoreListings()} moreLoading={moreListingsLoading} moreError={moreListingsError}
    renderListing={l => <ListingCard key={l.id} l={l} />}
    reportSellerSlot={me && !staff && !isOwner ? <div className="storefront-report stack">
      <div className="row"><LegacyButton type="button" className="ghost storefront-report-trigger"
        aria-expanded={reporting} disabled={reportBusy}
        onClick={() => { setReporting(open => !open); setReportError(''); }}>
        <Icon name="flag" size={16} /> Report this seller</LegacyButton></div>
      {reporting && <>
        <p className="muted">Report suspected scams, harassment, or rule violations. Describe what happened; reports go to authorized campus reviewers.</p>
        <Field className="">Why are you reporting this seller?
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000}
            placeholder="Describe what happened (at least 10 characters)" disabled={reportBusy} />
        </Field>
        <div className="row"><LegacyButton type="button" className="danger" disabled={reportBusy || reason.trim().length < 10}
          onClick={() => void reportSeller()}>{reportBusy ? 'Sending report…' : 'Send report'}</LegacyButton>
          <LegacyButton type="button" className="ghost" disabled={reportBusy} onClick={() => setReporting(false)}>Cancel</LegacyButton></div>
      </>}
      {reportNotice && <p role="status">{reportNotice}</p>}{reportError && <p className="err" role="alert">{reportError}</p>}
    </div> : undefined} />
    </>;
}
