import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/providers/session-provider';

/** Avatar button that opens account links and sign-out. A disclosure, so links keep native keyboard behavior. */
export function AccountMenu() {
  const { me, logout, loggingOut, isStaff, isReviewer } = useMe();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!me) return null;
  return <div className="account-menu" ref={rootRef}>
    <button ref={buttonRef} type="button" className="account-menu__button" aria-expanded={open} aria-controls={panelId}
      aria-label={`Account menu for ${me.displayName}`} onClick={() => setOpen(value => !value)}>
      {/* Initials are drawn by CSS so the visible text never conflicts with the accessible name (WCAG 2.5.3). */}
      <span className="account-menu__avatar" data-initials={initialsOf(me.displayName)} aria-hidden="true" />
      <Icon name="chevronDown" size={14} />
    </button>
    <div className="account-menu__panel" id={panelId} hidden={!open}>
      <p className="account-menu__who"><strong>{me.displayName}</strong><span>{me.email}</span></p>
      <ul>
        <li><Link to="/profile"><Icon name="user" size={17} /> Profile</Link></li>
        {!isStaff && <li><Link to="/saved"><Icon name="heart" size={17} /> Saved listings</Link></li>}
        {!isStaff && <li><Link to="/transactions"><Icon name="receipt" size={17} /> Transactions</Link></li>}
        {!isStaff && me.storeId && <li><Link to="/dashboard/insights"><Icon name="grid" size={17} /> Store insights</Link></li>}
        {isReviewer && <li><Link to="/admin"><Icon name="shield" size={17} /> Review workspace</Link></li>}
        <li><Link to="/notifications"><Icon name="bell" size={17} /> Notifications</Link></li>
      </ul>
      <LegacyButton type="button" className="ghost account-menu__signout" onClick={() => void logout()} disabled={loggingOut}>
        {loggingOut ? 'Signing out…' : 'Sign out'}
      </LegacyButton>
    </div>
  </div>;
}
