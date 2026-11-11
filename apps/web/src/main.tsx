import React, { createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { api, setToken, tryRestoreSession } from './api';
import { Discover, Home, ListingDetail, Guidelines, StorePage } from './pages-public';
import { Login, Register, Dashboard, Inquiries, Thread, Saved } from './pages-account';
import { Admin } from './pages-admin';
import './styles.css';

export type Me = { id: number; displayName: string; roles: { role: string; campusId: number | null }[];
  affiliations: { id: number; campus: { id: number; name: string }; status: string }[]; storeId: number | null };
const Ctx = createContext<{ me: Me | null; reload: () => Promise<void>; logout: () => Promise<void>; ready: boolean }>(null!);
export const useMe = () => useContext(Ctx);

function Shell() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const reload = async () => { try { setMe(await api<Me>('/me')); } catch { setMe(null); } };
  useEffect(() => { (async () => { if (await tryRestoreSession()) await reload(); setReady(true); })(); }, []);
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }); setToken(null); setMe(null); };
  const isReviewer = me?.roles.some(r => ['campus_reviewer', 'university_admin'].includes(r.role));
  return (
    <Ctx.Provider value={{ me, reload, logout, ready }}>
      <header className="top"><div className="wrap">
        <Link to="/" className="brand">CPSU <b>Student Marketplace</b></Link>
        <NavLink to="/explore">Explore</NavLink><NavLink to="/guidelines">Guidelines</NavLink>
        {me ? <>
          <NavLink to="/saved">Saved</NavLink><NavLink to="/inquiries">Inquiries</NavLink><NavLink to="/dashboard">My store</NavLink>
          {isReviewer && <NavLink to="/admin">Review</NavLink>}
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </> : <><NavLink to="/login">Sign in</NavLink><Link className="btn" to="/register">Create account</Link></>}
      </div></header>
      <main><div className="wrap">
        <Routes>
          <Route path="/" element={<Home />} /><Route path="/explore" element={<Discover />} /><Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/stores/:id" element={<StorePage />} /><Route path="/guidelines" element={<Guidelines />} />
          <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={ready && !me ? <Navigate to="/login" /> : <Dashboard />} />
          <Route path="/inquiries" element={ready && !me ? <Navigate to="/login" /> : <Inquiries />} />
          <Route path="/inquiries/:id" element={<Thread />} /><Route path="/saved" element={<Saved />} />
          <Route path="/admin" element={ready && !isReviewer ? <Navigate to="/" /> : <Admin />} />
        </Routes>
      </div></main>
      <nav className="tabbar" aria-label="Primary">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/explore">Explore</NavLink>
        <NavLink to="/dashboard">Sell</NavLink>
        <NavLink to="/inquiries">Messages</NavLink>
      </nav>
    </Ctx.Provider>
  );
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Shell /></BrowserRouter></React.StrictMode>);
