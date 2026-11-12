import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { api, setToken, tryRestoreSession } from './api';
import { Discover, Home, ListingDetail, Guidelines, StorePage } from './pages-public';
import { Icon } from './icons';
import { Login, Register, Dashboard, Inquiries, Thread, Saved } from './pages-account';
import { Profile, Notifications } from './pages-profile';
import { Admin } from './pages-admin';
import './styles.css';
import './storefront-theme.css';
import './message-motion.css';
import './notifications.css';
import './mobile-refinements.css';

export type Me = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[];
  affiliations: { id: number; campus: { id: number; name: string }; status: string }[]; storeId: number | null };

type Session = { me: Me | null; reload: () => Promise<void>; logout: () => Promise<void>; ready: boolean;
  unread: number; syncUnread: () => Promise<void>;
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

function SiteFooter() {
  return <footer className="site-foot">
    <div className="wrap foot-grid">
      <div className="foot-brand">
        <strong>CPSU Student Marketplace</strong>
        <p>A student-to-student marketplace for Central Philippines State University. Listings are reviewed by campus reviewers;
          payment and handoff are arranged directly between students.</p>
      </div>
      <nav aria-label="Marketplace"><h2>Marketplace</h2>
        <Link to="/explore">All listings</Link><Link to="/explore?type=physical_product">Products</Link>
        <Link to="/explore?type=service">Student services</Link><Link to="/explore?sort=price_asc">Lowest price first</Link></nav>
      <nav aria-label="Your account"><h2>Your account</h2>
        <Link to="/dashboard">Sell an item</Link><Link to="/saved">Saved listings</Link>
        <Link to="/inquiries">Messages</Link><Link to="/profile">Profile</Link></nav>
      <nav aria-label="Support"><h2>Support</h2>
        <Link to="/guidelines">Marketplace guidelines</Link><Link to="/guidelines">Reporting a listing</Link>
        <Link to="/register">Create an account</Link><Link to="/login">Sign in</Link></nav>
    </div>
    <div className="wrap foot-base">
      <p>© {new Date().getFullYear()} CPSU Student Marketplace</p>
      <p>Central Philippines State University · Student-built MVP</p>
    </div>
  </footer>;
}

function Shell() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const reload = async () => { try { setMe(await api<Me>('/me')); } catch { setMe(null); } };
  const syncUnread = async () => {
    try {
      const rows = await api<{ readAt: string | null }[]>('/notifications');
      setUnread(rows.filter(r => !r.readAt).length);
    } catch { /* keep the previous count rather than flashing zero */ }
  };

  useEffect(() => { (async () => { if (await tryRestoreSession()) await reload(); setReady(true); })(); }, []);
  // One shared source of saved-listing ids: fetched at sign-in, so hearts on cards and the listing page stay in sync.
  const syncSaved = async () => {
    try { const rows = await api<{ id: number }[]>('/saved'); setSavedIds(rows.map(r => r.id)); } catch { /* keep previous */ }
  };
  const toggleSaved = async (id: number, saved: boolean) => {
    try {
      await api(`/saved/${id}`, { method: saved ? 'PUT' : 'DELETE' });
      setSavedIds(prev => saved ? [...prev, id] : prev.filter(x => x !== id));
      return true;
    } catch { return false; }
  };
  useEffect(() => { if (me) { syncUnread(); syncSaved(); } else { setUnread(0); setSavedIds([]); } }, [me]);

  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }); setToken(null); setMe(null); };
  const isReviewer = me?.roles.some(r => ['campus_reviewer', 'university_admin'].includes(r.role));
  const signedOut = ready && !me;

  return (
    <Ctx.Provider value={{ me, reload, logout, ready, unread, syncUnread, savedIds, toggleSaved }}>
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
            <NavLink to="/saved"><Icon name="heart" size={22} /><span>Saved</span></NavLink>
            <NavLink to="/inquiries"><Icon name="chat" size={22} /><span>Messages</span></NavLink>
            <NavLink to="/notifications" className="alerts" aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}>
              <Icon name="bell" size={22} /><span>Alerts{unread > 0 && <span className="nav-badge">{unread}</span>}</span></NavLink>
            <NavLink to="/profile"><Icon name="user" size={22} /><span>Profile</span></NavLink>
          </nav>}
          <div className="who">
            {me ? <button className="btn ghost" onClick={logout}>Sign out</button>
              : <><NavLink className="signin" to="/login">Sign in</NavLink><Link className="btn" to="/register">Create account</Link></>}
          </div>
        </div>
        <div className="wrap navrow">
          <Link className="all-cats" to="/explore"><Icon name="grid" size={16} /> All listings</Link>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/explore">Explore</NavLink>
          <NavLink to="/dashboard">Sell</NavLink>
          <NavLink to="/inquiries">Messages</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <NavLink to="/guidelines">Guidelines</NavLink>
          {isReviewer && <NavLink to="/admin">Review</NavLink>}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}><div className="wrap">
        <Routes>
          <Route path="/" element={<Home />} /><Route path="/explore" element={<Discover />} /><Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/stores/:id" element={<StorePage />} /><Route path="/guidelines" element={<Guidelines />} />
          <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={signedOut ? <Navigate to="/login" /> : <Dashboard />} />
          <Route path="/inquiries" element={signedOut ? <Navigate to="/login" /> : <Inquiries />} />
          <Route path="/inquiries/:id" element={<Thread />} /><Route path="/saved" element={<Saved />} />
          <Route path="/profile" element={signedOut ? <Navigate to="/login" /> : <Profile />} />
          <Route path="/notifications" element={signedOut ? <Navigate to="/login" /> : <Notifications />} />
          <Route path="/admin" element={ready && !isReviewer ? <Navigate to="/" /> : <Admin />} />
        </Routes>
      </div></main>
      <SiteFooter />
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end><Icon name="home" size={19} /><span>Home</span></NavLink>
        <NavLink to="/explore"><Icon name="search" size={19} /><span>Explore</span></NavLink>
        <NavLink to="/dashboard"><Icon name="plus" size={20} /><span>Sell</span></NavLink>
        <NavLink to="/inquiries"><Icon name="chat" size={19} /><span>Messages</span></NavLink>
        <NavLink to="/profile"><Icon name="user" size={19} /><span>Profile</span></NavLink>
      </nav>
    </Ctx.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Shell /></BrowserRouter></React.StrictMode>);

// Only the production web app installs the offline fallback. API responses and student
// session data stay network-only; the service worker caches no personalized content.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Marketplace still works online if service worker registration is unavailable.
    });
  });
}
