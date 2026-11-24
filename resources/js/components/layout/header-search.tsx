import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';

// Search stays in the global header on every route, including Home and Explore.
// The hero is editorial-only and Explore retains its detailed filter controls.
export function HeaderSearch() {
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
