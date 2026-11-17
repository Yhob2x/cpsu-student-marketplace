import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { api, setToken, tryRestoreSession } from './api';
import { disconnectPushOnLogout, updateAppBadge } from './push-client';
import { Discover, Home, ListingDetail, Guidelines, StorePage } from './pages-public';
import { Icon } from './icons';
import { SiteFooter } from './site-footer';
import { FloatingChat } from './floating-chat';
import { Login, Register, Dashboard, Inquiries, Thread, Saved } from './pages-account';
import { Profile, Notifications } from './pages-profile';
import { Admin } from './pages-admin';
import { Transactions, TransactionDetail } from './pages-transactions';
import './styles.css';
import './storefront-theme.css';
import './message-motion.css';
import './notifications.css';
import './mobile-refinements.css';
import './install-app.css';
import './push-settings.css';
import './my-store.css';
import './listing-gallery.css';
import './image-zoom.css';
import './student-emphasis.css';
import './student-motion.css';
import './profile-refinements.css';
import './footer-refinements.css';
import './floating-chat.css';

export type Me = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[];
  affiliations: { id: number; campus: { id: number; name: string }; status: string }[]; storeId: number | null };

type Session = { me: Me | null; reload: () => Promise<Me | null>; logout: () => Promise<void>; ready: boolean;
  unread: number; syncUnread: () => Promise<void>;
  queue: number; syncQueue: (known?: number) => Promise<void>;
  savedIds: number[]; toggleSaved: (id: number, saved: boolean) => Promise<boolean> };

const Ctx = createContext<Session>(null!);
export const useMe = () => useContext(Ctx);

// The masthead search submits to Explore; it stays out of the way on phones, where the hero search and the
// Explore filters are the primary way in.
function HeaderSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    nav(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
  };
  return <form className="head-search" role="search" aria-label="Header listing search" onSubmit={submit}>
    <input aria-label="Search listings" placeholder="Search products, services and skills…" maxLength={80} value={q} onChange={e => setQ(e.target.value)} />
    <button className="btn" aria-label="Search"><Icon name="search" size={18} /></button>
  </form>;
}

function NotFound() {
  return <section className="not-found-page">
    <h1>Page not found</h1>
    <p>The address may have changed, or the page may no longer be available.</p>
    <div className="row"><Link className="btn" to="/">Go home</Link><Link className="btn ghost" to="/explore">Explore listings</Link></div>
  </section>;
}

function Shell() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [queue, setQueue] = useState(0);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutLock = useRef(false);

  const reload = async () => { try { const current = await api<Me>('/me'); setMe(current); return current; } catch { setMe(null); return null; } };
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
    try { const rows = await api<{ id: number }[]>('/saved'); setSavedIds(rows.map(r => r.id)); } catch { /* keep previous */ }
  };
  const toggleSaved = async (id: number, saved: boolean) => {
    if (isStaff) return false;
    try {
      await api(`/saved/${id}`, { method: saved ? 'PUT' : 'DELETE' });
      setSavedIds(prev => saved ? [...prev, id] : prev.filter(x => x !== id));
      return true;
    } catch { return false; }
  };
  const isReviewer = me?.roles.some(r => ['campus_reviewer', 'university_admin'].includes(r.role));
  // Pending affiliations plus listings, so reviewers see the queue depth before opening it.
  const syncQueue = async (known?: number) => {
    if (known !== undefined) { setQueue(known); return; }
    try {
      const r = await api<{ listings: unknown[]; affiliations: unknown[] }>('/admin/review-queue');
      setQueue(r.listings.length + r.affiliations.length);
    } catch { /* keep the previous count */ }
  };
  useEffect(() => {
    if (!me) { setUnread(0); setUnreadMessages(0); setSavedIds([]); setQueue(0); return; }
    syncUnread(); syncSaved(); if (isReviewer) syncQueue();
  }, [me]);

  // Do not claim to have signed out when server-side session revocation fails.
  // Keep the account visible, explain the failure, and allow a retry.
  const logout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true; setLoggingOut(true); setLogoutError('');
    try {
      await disconnectPushOnLogout();
      await api('/auth/logout', { method: 'POST', body: {} });
      setToken(null); setMe(null);
    } catch {
      setLogoutError('Could not sign out. Check your connection and try again. Your session may still be active.');
    } finally {
      logoutLock.current = false; setLoggingOut(false);
    }
  };
  useEffect(() => { void updateAppBadge(me ? unread : null); }, [me?.id, unread]);
  useEffect(() => {
    if (!me) return;
    const refresh = () => { if (document.visibilityState === 'visible') void syncUnread(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const sw = (event: MessageEvent) => { if (event.data?.type === 'CPSU_PUSH_RECEIVED') refresh(); };
    navigator.serviceWorker?.addEventListener('message', sw);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      navigator.serviceWorker?.removeEventListener('message', sw);
    };
  }, [me?.id]);
  const signedOut = ready && !me;

  return (
    <Ctx.Provider value={{ me, reload, logout, ready, unread, syncUnread, queue, syncQueue, savedIds, toggleSaved }}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="top">
        <div className="strip"><div className="wrap">
          <span><Icon name="shield" size={14} /> Verified CPSU students only</span>
          <span><Icon name="chat" size={14} /> Message sellers directly</span>
          <span><Icon name="pin" size={14} /> Payment and pickup arranged on campus</span>
        </div></div>
        <div className="wrap masthead">
          <Link to="/" className="brand">
            <span className="brand-symbol" aria-hidden="true"><Icon name="store" size={19} /></span>
            <span>CPSU <b>Student Marketplace</b><small>Buy, sell and offer</small></span></Link>
          <HeaderSearch />
          {me && <nav className="actions" aria-label="Your activity">
            {!isStaff && <NavLink to="/saved"><Icon name="heart" size={22} /><span>Saved</span></NavLink>}
            <NavLink to="/notifications" className="alerts" aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}>
              <Icon name="bell" size={22} /><span>Alerts{unread > 0 && <span className="nav-badge">{unread}</span>}</span></NavLink>
            <NavLink to="/profile"><Icon name="user" size={22} /><span>Profile</span></NavLink>
          </nav>}
          <div className="who">
            {me ? <button className="btn ghost" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Sign out'}</button>
              : <><NavLink className="signin" to="/login">Sign in</NavLink><Link className="btn" to="/register">Create account</Link></>}
          </div>
        </div>
        <div className="wrap navrow">
          <Link className="all-cats" to="/explore"><Icon name="grid" size={16} /> All listings</Link>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/explore">Explore</NavLink>
          {!isStaff && <><NavLink to="/dashboard">Sell</NavLink>
          <NavLink to="/transactions">Transactions</NavLink></>}
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/guidelines">Guidelines</NavLink>
          {isReviewer && <NavLink to="/admin" aria-label={queue > 0 ? `Review, ${queue} waiting` : undefined}>Review{queue > 0 && <span className="nav-badge">{queue}</span>}</NavLink>}
        </div>
      </header>
      {logoutError && <div className="wrap"><p className="err" role="alert">{logoutError}</p></div>}
      <main id="main-content" tabIndex={-1}><div className="wrap">
        <Routes>
          <Route path="/" element={<Home />} /><Route path="/explore" element={<Discover />} /><Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/stores/:id" element={<StorePage />} /><Route path="/guidelines" element={<Guidelines />} />
          <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
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
      <SiteFooter audience={!ready ? 'checking' : !me ? 'guest' : isStaff ? 'staff' : 'student'} canReview={Boolean(isReviewer)} />
      <FloatingChat ready={ready} isStaff={Boolean(isStaff)} signedIn={Boolean(me)} unreadMessages={unreadMessages} onUnreadChanged={syncUnread} />
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end><Icon name="home" size={19} /><span>Home</span></NavLink>
        <NavLink to="/explore"><Icon name="search" size={19} /><span>Explore</span></NavLink>
        {!isStaff && <NavLink to="/dashboard"><Icon name="plus" size={20} /><span>Sell</span></NavLink>}
        {isReviewer && <NavLink to="/admin"><Icon name="shield" size={19} /><span>Review</span></NavLink>}
        <NavLink to="/profile"><Icon name="user" size={19} /><span>Profile</span></NavLink>
      </nav>
    </Ctx.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Shell /></BrowserRouter></React.StrictMode>);

// Only the production web app installs the offline fallback. API responses and student
// session data stay network-only; the service worker caches no personalized content.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Marketplace still works online if service worker registration is unavailable.
    });
  });
}
