import { LegacyButton } from './components/ui/legacy-button';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, setToken, tryRestoreSession } from './api';
import { disconnectPushOnLogout, reconcilePushForActiveAccount, updateAppBadge } from './push-client';
import { Discover, Home, ListingDetail, Guidelines, StorePage } from './pages-public';
import { Icon } from './icons';
import { ActionFeedbackHost, showActionFeedback } from './action-feedback';
import { SiteFooter } from './site-footer';
import { InstallApp } from './install-app';
import { PwaStatus } from './pwa-status';
import { FloatingChat } from './floating-chat';
import { preferredCampusName } from './meetup-campus';
import { useForegroundRefresh } from './foreground-refresh';
import { withSavedListing } from './saved-state';
import { Login, Dashboard, Inquiries, Thread, Saved } from './pages-account';
import { Profile, Notifications } from './pages-profile';
import { Admin } from './pages-admin';
import { Transactions, TransactionDetail } from './pages-transactions';
import './shadcn.css';
import './styles.css';
import './storefront-theme.css';
import './message-motion.css';
import './notifications.css';
import './mobile-refinements.css';
import './push-settings.css';
import './my-store.css';
import './listing-gallery.css';
import './image-zoom.css';
import './student-emphasis.css';
import './student-motion.css';
import './profile-refinements.css';
import './footer-refinements.css';
import './floating-chat.css';
import './icon-action.css';
import './hierarchy-polish.css';
import './editorial-redesign.css';
import './hero-artistic.css';
import './home-simplification.css';
import './header-search-polish.css';
import './student-ux-polish.css';
import './explore-direct-filters.css';
import './explore-scroll-cues.css';
import './my-store-polish.css';
import './mobile-chat-dock.css';
import './home-admin-publish.css';
import './typography.css';
import './dashboard-storefront.css';
import './p1p2-ux-fixes.css';
import './listing-composer-polish.css';
import './storefront-page-polish.css';
import './explore-page-polish.css';
import './explore-simple-filters.css';
import './action-feedback.css';
import './listing-detail-polish.css';
import './concise-controls.css';
import './storefront-hierarchy.css';
import './install-app.css';
import './ui-consistency.css';
import './guidelines-page.css';
import './home-color-polish.css';
import './async-feedback.css';
import './pwa-status.css';
import './listing-rating-polish.css';

export type Me = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[];
  affiliations: { id: number; campus: { id: number; name: string }; status: string }[]; storeId: number | null };

type Session = { me: Me | null; reload: () => Promise<Me | null>; logout: () => Promise<void>; ready: boolean;
  unread: number; syncUnread: () => Promise<void>;
  queue: number; syncQueue: (known?: number) => Promise<void>;
  savedIds: number[]; pendingSavedIds: number[]; toggleSaved: (id: number, saved: boolean) => Promise<boolean> };

const Ctx = createContext<Session>(null!);
export const useMe = () => useContext(Ctx);

// Search stays in the global header on every route, including Home and Explore.
// The hero is editorial-only and Explore retains its detailed filter controls.
function HeaderSearch() {
  const nav = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  // Keep the always-visible header search aligned with Explore's URL-driven filters.
  useEffect(() => {
    setQ(location.pathname === '/explore' ? (new URLSearchParams(location.search).get('q') ?? '') : '');
  }, [location.pathname, location.search]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
  };
  return <form className="head-search" role="search" aria-label="Header listing search" onSubmit={submit}>
    <input aria-label="Search listings" placeholder="Search listings…" maxLength={80} value={q} onChange={e => setQ(e.target.value)} />
    <LegacyButton className="" aria-label="Search"><Icon name="search" size={18} /></LegacyButton>
  </form>;
}

function NotFound() {
  return <section className="not-found-page">
    <h1>Page not found</h1>
    <p>The address may have changed, or the page may no longer be available.</p>
    <div className="row"><Link className="btn" to="/">Go home</Link><Link className="btn ghost" to="/explore">Explore listings</Link></div>
  </section>;
}

// Primary navigation should always bring the page into view, even if the tab is
// already active. Avoid re-navigating to the same route: it would discard Explore's
// query-string filters and needlessly re-render the page.
function scrollNavigationToTop(event: React.MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const sameRoute = event.currentTarget.pathname === window.location.pathname;
  if (sameRoute) event.preventDefault();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  // A smooth scroll may be canceled when the router swaps the page.
  // Reset immediately on route changes; retain smooth reselects of the active tab.
  window.scrollTo({ top: 0, left: 0, behavior: sameRoute && !reduceMotion ? 'smooth' : 'auto' });
}

function Shell() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [queue, setQueue] = useState(0);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [pendingSavedIds, setPendingSavedIds] = useState<number[]>([]);
  const savedPending = useRef(new Set<number>());
  const savedRevision = useRef(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutLock = useRef(false);

  const reload = async () => { try { const current = await api<Me>('/me'); setMe(prev => JSON.stringify(prev) === JSON.stringify(current) ? prev : current); return current; } catch { setMe(null); return null; } };
  const syncUnread = async () => {
    try {
      const counts = await api<{ total: number; messages: number }>('/notifications/unread-count');
      setUnread(counts.total);
      setUnreadMessages(counts.messages);
    } catch { /* keep the previous count rather than flashing zero */ }
  };

  useEffect(() => { (async () => { if (await tryRestoreSession()) await reload(); setReady(true); })(); }, []);
  const isStaff = me?.roles.some(r => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(r.role));
  // One shared source of saved-listing ids: fetched at sign-in, so hearts on cards and the listing page stay in sync.
  const syncSaved = async () => {
    if (isStaff) { setSavedIds([]); return; }
    const before = savedRevision.current;
    try {
      const rows = await api<{ id: number }[]>('/saved');
      // A delayed initial fetch must not undo a newer local user action.
      if (before === savedRevision.current) setSavedIds(rows.map(r => r.id));
    } catch { /* keep previous */ }
  };
  const toggleSaved = async (id: number, saved: boolean) => {
    if (isStaff || !me || savedPending.current.has(id)) return false;
    savedPending.current.add(id);
    setPendingSavedIds(previous => withSavedListing(previous, id, true));
    savedRevision.current++;
    // Update the heart immediately; only confirm success after server acknowledgement.
    setSavedIds(previous => withSavedListing(previous, id, saved));
    try {
      await api(`/saved/${id}`, { method: saved ? 'PUT' : 'DELETE' });
      showActionFeedback({ kind: 'success', title: saved ? 'Listing saved' : 'Listing removed', message: saved ? 'You can find it in Saved items.' : 'Removed from your saved items.' });
      return true;
    } catch {
      // Keep other cards' saves intact; rollback this listing alone.
      savedRevision.current++;
      setSavedIds(previous => withSavedListing(previous, id, !saved));
      showActionFeedback({ kind: 'error', title: 'Save not synced', message: 'The heart was restored. Check your connection and retry.' });
      return false;
    } finally {
      savedPending.current.delete(id);
      setPendingSavedIds(previous => withSavedListing(previous, id, false));
    }
  };
  const isReviewer = me?.roles.some(r => ['campus_reviewer', 'university_admin'].includes(r.role));
  // Pending affiliations plus listings, so reviewers see the queue depth before opening it.
  const syncQueue = async (known?: number) => {
    if (known !== undefined) { setQueue(known); return; }
    try {
      const r = await api<{ listings: unknown[]; affiliations: unknown[]; reportsPending?: number }>('/admin/review-queue');
      setQueue(r.listings.length + r.affiliations.length + (r.reportsPending ?? 0));
    } catch { /* keep the previous count */ }
  };
  useEffect(() => {
    if (!me) { savedRevision.current++; savedPending.current.clear(); setPendingSavedIds([]); setUnread(0); setUnreadMessages(0); setSavedIds([]); setQueue(0); return; }
    syncUnread(); syncSaved(); if (isReviewer) syncQueue();
  }, [me]);

  // On login/account switching, detach old browser subscriptions rather than
  // showing one student's push alerts while another student is using the device.
  useEffect(() => {
    if (!me) return;
    let active = true;
    void reconcilePushForActiveAccount(() => active).catch(() => {
      // Keep in-app notifications available when the enrollment API is offline.
    });
    return () => { active = false; };
  }, [me?.id]);

  // Do not claim to have signed out when server-side session revocation fails.
  // Keep the account visible, explain the failure, and allow a retry.
  const logout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true; setLoggingOut(true); setLogoutError('');
    try {
      const pushEndpoint = await disconnectPushOnLogout();
      // Session-authenticated fallback removes this device's subscription even if
      // the separate push DELETE failed; other signed-in devices stay enrolled.
      await api('/auth/logout', { method: 'POST', body: { pushEndpoint } });
      setToken(null); setMe(null);
      showActionFeedback({ kind: 'success', title: 'Signed out', message: 'You have safely signed out of CPSU Market.' });
    } catch {
      setLogoutError('Could not sign out. Check your connection and try again. Your session may still be active.');
      showActionFeedback({ kind: 'error', title: 'Sign-out failed', message: 'Your session may still be active. Please try again.' });
    } finally {
      logoutLock.current = false; setLoggingOut(false);
    }
  };
  useEffect(() => { void updateAppBadge(me ? unread : null); }, [me?.id, unread]);
  // Keep unread messages, followed-store alerts and review/report counts current.
  useForegroundRefresh(async () => {
    await syncUnread();
    if (isReviewer) await syncQueue();
  }, 5_000, Boolean(me));
  // Affiliation decisions also update the profile and seller permissions without navigation.
  useForegroundRefresh(async () => {
    try {
      const current = await api<Me>('/me');
      setMe(prev => JSON.stringify(prev) === JSON.stringify(current) ? prev : current);
    } catch { /* transient network failures must not sign the user out */ }
  }, 15_000, Boolean(me));
  useEffect(() => {
    if (!me) return;
    const onPush = (event: MessageEvent) => {
      if (event.data?.type === 'CPSU_PUSH_RECEIVED') void syncUnread();
    };
    navigator.serviceWorker?.addEventListener('message', onPush);
    return () => navigator.serviceWorker?.removeEventListener('message', onPush);
  }, [me?.id]);
  const signedOut = ready && !me;

  return (
    <Ctx.Provider value={{ me, reload, logout, ready, unread, syncUnread, queue, syncQueue, savedIds, pendingSavedIds, toggleSaved }}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="top">
        <div className="strip"><div className="wrap">
          <span><Icon name="shield" size={14} /> Verified CPSU students</span>
          <span><Icon name="chat" size={14} /> Chat with sellers</span>
          <span><Icon name="pin" size={14} /> Arrange payment and pickup on campus</span>
        </div></div>
        <div className="wrap masthead">
          <Link to="/" className="brand" onClick={scrollNavigationToTop} aria-label="CPSU Market — CPSU Student Marketplace home">
            <span className="brand-symbol" aria-hidden="true"><Icon name="store" size={19} /></span>
            <span className="brand-long">CPSU <b>Student Marketplace</b></span>
            <span className="brand-short" aria-hidden="true">CPSU Market</span></Link>
          <HeaderSearch />
          {me && <nav className="actions" aria-label="Your activity">
            {!isStaff && <NavLink to="/saved" onClick={scrollNavigationToTop} aria-label="Saved listings" title="Saved listings"><Icon name="heart" size={22} /></NavLink>}
            <NavLink to="/notifications" onClick={scrollNavigationToTop} className="alerts" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications">
              <Icon name="bell" size={22} /><span className="alerts-copy">{unread > 0 && <span className="nav-badge" aria-hidden="true">{unread}</span>}</span></NavLink>
            <NavLink to="/profile" onClick={scrollNavigationToTop} aria-label="Profile" title="Profile"><Icon name="user" size={22} /></NavLink>
          </nav>}
          <div className={me ? 'who' : 'who who-guest'}>
            <InstallApp />
            {me ? <LegacyButton className="ghost" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Sign out'}</LegacyButton>
              : <NavLink className="signin" to="/login">Sign in</NavLink>}
          </div>
        </div>
        <div className="wrap navrow">
          <NavLink to="/" end onClick={scrollNavigationToTop}>Home</NavLink>
          <NavLink to="/explore" onClick={scrollNavigationToTop}>Explore</NavLink>
          {!isStaff && <><NavLink to="/dashboard" onClick={scrollNavigationToTop}>Sell</NavLink>
          <NavLink to="/transactions" onClick={scrollNavigationToTop}>Transactions</NavLink></>}
          <NavLink to="/profile" onClick={scrollNavigationToTop}>Profile</NavLink>
          <NavLink to="/guidelines" onClick={scrollNavigationToTop}>Guidelines</NavLink>
          {isReviewer && <NavLink to="/admin" onClick={scrollNavigationToTop} aria-label={queue > 0 ? `Review ${queue} waiting` : undefined}>Review{queue > 0 && <> <span className="nav-badge">{queue}</span></>}</NavLink>}
        </div>
      </header>
      {logoutError && <div className="wrap"><p className="err" role="alert">{logoutError}</p></div>}
      <main id="main-content" tabIndex={-1}><div className="wrap">
        <Routes>
          <Route path="/" element={<Home />} /><Route path="/explore" element={<Discover />} /><Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/store/:slug" element={<StorePage />} /><Route path="/stores/:id" element={<StorePage />} /><Route path="/stores" element={<Navigate to="/explore" replace />} /><Route path="/guidelines" element={<Guidelines />} />
          <Route path="/login" element={<Login />} /><Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/dashboard" element={!ready ? <p role="status">Checking session…</p> : signedOut ? <Navigate to="/login?next=%2Fdashboard" replace /> : isStaff ? <Navigate to="/profile" replace /> : <Dashboard />} />
          <Route path="/inquiries" element={!ready ? <p role="status">Checking session…</p> : signedOut ? <Navigate to="/login?next=%2Finquiries" replace /> : isStaff ? <Navigate to="/profile" replace /> : <Inquiries />} />
          <Route path="/inquiries/:id" element={!ready ? <p role="status">Checking session…</p> : signedOut ? <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace /> : isStaff ? <Navigate to="/profile" replace /> : <Thread />} /><Route path="/saved" element={!ready ? <p role="status">Checking session…</p> : signedOut ? <Navigate to="/login?next=%2Fsaved" replace /> : isStaff ? <Navigate to="/profile" replace /> : <Saved />} />
          <Route path="/transactions" element={!ready ? <p role="status">Checking session…</p> : signedOut ? <Navigate to="/login?next=%2Ftransactions" replace /> : isStaff ? <Navigate to="/profile" replace /> : <Transactions />} />
          <Route path="/transactions/:id" element={!ready ? <p role="status">Checking session…</p> : signedOut ? <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname)}`} replace /> : isStaff ? <Navigate to="/profile" replace /> : <TransactionDetail />} />
          <Route path="/profile" element={signedOut ? <Navigate to="/login?next=%2Fprofile" /> : <Profile />} />
          <Route path="/notifications" element={signedOut ? <Navigate to="/login?next=%2Fnotifications" /> : <Notifications />} />
          <Route path="/admin" element={ready && !isReviewer ? <Navigate to="/" /> : <Admin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div></main>
      <PwaStatus />
      <ActionFeedbackHost />
      <SiteFooter audience={!ready ? 'checking' : !me ? 'guest' : isStaff ? 'staff' : 'student'} canReview={Boolean(isReviewer)} />
      <FloatingChat ready={ready} isStaff={Boolean(isStaff)} signedIn={Boolean(me)} unreadMessages={unreadMessages}
          campusName={preferredCampusName(me?.affiliations)} onUnreadChanged={syncUnread} />
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end onClick={scrollNavigationToTop}><Icon name="home" size={19} /><span>Home</span></NavLink>
        <NavLink to="/explore" onClick={scrollNavigationToTop}><Icon name="search" size={19} /><span>Explore</span></NavLink>
        {!isStaff && <NavLink to="/dashboard" onClick={scrollNavigationToTop}><Icon name="plus" size={20} /><span>Sell</span></NavLink>}
        {isReviewer && <NavLink to="/admin" onClick={scrollNavigationToTop}><Icon name="shield" size={19} /><span>Review</span></NavLink>}
        <NavLink to="/profile" onClick={scrollNavigationToTop}><Icon name="user" size={19} /><span>Profile</span></NavLink>
      </nav>
    </Ctx.Provider>
  );
}
// Keep the entrypoint inert when notification-formatting helpers are imported by unit tests.
if (typeof document !== 'undefined') {
  const root = document.getElementById('root');
  if (root) createRoot(root).render(<React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Shell /></BrowserRouter></React.StrictMode>);
}

// PwaStatus owns the sole production service-worker registration and update flow.
