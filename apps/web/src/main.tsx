import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { api, setToken, tryRestoreSession } from './api';
import { Discover, Home, ListingDetail, Guidelines, StorePage } from './pages-public';
import { Login, Register, Dashboard, Inquiries, Thread, Saved } from './pages-account';
import { Profile, Notifications } from './pages-profile';
import { Admin } from './pages-admin';
import './styles.css';

export type Me = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[];
  affiliations: { id: number; campus: { id: number; name: string }; status: string }[]; storeId: number | null };

type Session = { me: Me | null; reload: () => Promise<void>; logout: () => Promise<void>; ready: boolean;
  unread: number; syncUnread: () => Promise<void> };

const Ctx = createContext<Session>(null!);
export const useMe = () => useContext(Ctx);

function Shell() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);

  const reload = async () => { try { setMe(await api<Me>('/me')); } catch { setMe(null); } };
  const syncUnread = async () => {
    try {
      const rows = await api<{ readAt: string | null }[]>('/notifications');
      setUnread(rows.filter(r => !r.readAt).length);
    } catch { /* keep the previous count rather than flashing zero */ }
  };

  useEffect(() => { (async () => { if (await tryRestoreSession()) await reload(); setReady(true); })(); }, []);
  useEffect(() => { if (me) syncUnread(); else setUnread(0); }, [me]);

  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }); setToken(null); setMe(null); };
  const isReviewer = me?.roles.some(r => ['campus_reviewer', 'university_admin'].includes(r.role));
  const signedOut = ready && !me;

  return (
    <Ctx.Provider value={{ me, reload, logout, ready, unread, syncUnread }}>
      <header className="top"><div className="wrap">
        <Link to="/" className="brand">CPSU <b>Student Marketplace</b></Link>
        <NavLink to="/explore">Explore</NavLink><NavLink to="/guidelines">Guidelines</NavLink>
        {me ? <>
          <NavLink to="/saved">Saved</NavLink><NavLink to="/inquiries">Inquiries</NavLink><NavLink to="/dashboard">My store</NavLink>
          {isReviewer && <NavLink to="/admin">Review</NavLink>}
          <NavLink to="/notifications" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}>
            Alerts{unread > 0 && <span className="nav-badge">{unread}</span>}
          </NavLink>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </> : <><NavLink to="/login">Sign in</NavLink><Link className="btn" to="/register">Create account</Link></>}
      </div></header>
      <main><div className="wrap">
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
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/explore">Explore</NavLink>
        <NavLink to="/dashboard">Sell</NavLink>
        <NavLink to="/inquiries">Messages</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>
    </Ctx.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Shell /></BrowserRouter></React.StrictMode>);
