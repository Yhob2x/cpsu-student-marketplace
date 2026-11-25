import { type MouseEvent, useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { Icon } from '@/components/icons';

const LINKS = [
  { to: '/explore', label: 'All listings', hint: 'Everything on campus', icon: 'grid' },
  { to: '/explore?type=physical_product', label: 'Products', hint: 'Items from student stores', icon: 'bag' },
  { to: '/explore?type=service', label: 'Services & skills', hint: 'Tutoring, printing, design', icon: 'wrench' },
] as const;

/** Desktop "Explore" navigation item with quick links into filtered results. */
export function ExploreMenu({ onNavigate }: { onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const location = useLocation();
  const active = location.pathname === '/explore';

  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return <div className="explore-menu" ref={rootRef}>
    <button ref={buttonRef} type="button" className={'site-nav__link explore-menu__button' + (active ? ' active' : '')}
      aria-expanded={open} aria-controls={panelId} aria-current={active ? 'page' : undefined} onClick={() => setOpen(value => !value)}>
      Explore <Icon name="chevronDown" size={14} />
    </button>
    <div className="explore-menu__panel" id={panelId} hidden={!open}>
      {LINKS.map(link => <NavLink key={link.to} to={link.to} end onClick={onNavigate} className="explore-menu__link">
        <span className="explore-menu__icon" aria-hidden="true"><Icon name={link.icon} size={18} /></span>
        <span><strong>{link.label}</strong><small>{link.hint}</small></span>
      </NavLink>)}
    </div>
  </div>;
}
