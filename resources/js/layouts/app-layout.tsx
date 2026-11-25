import type { MouseEvent } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { ActionFeedbackHost } from '@/components/action-feedback';
import { FloatingChat } from '@/components/chat/floating-chat';
import { Icon } from '@/components/icons';
import { AccountMenu } from '@/components/layout/account-menu';
import { ExploreMenu } from '@/components/layout/explore-menu';
import { InstallApp } from '@/components/layout/install-app';
import { PwaStatus } from '@/components/layout/pwa-status';
import { SiteFooter } from '@/components/layout/site-footer';
import { preferredCampusName } from '@/lib/meetup/meetup-campus';
import { useMe } from '@/providers/session-provider';
import { AppRoutes } from '@/routes';

// Primary navigation should always bring the page into view, even if the tab is
// already active. Avoid re-navigating to the same route: it would discard Explore's
// query-string filters and needlessly re-render the page.
function scrollNavigationToTop(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  // A plain link to the current page keeps its filters (reselecting Explore); a link with its own
  // query, such as Explore > Products, still navigates.
  const link = event.currentTarget;
  const sameRoute = link.pathname === window.location.pathname && (link.search === '' || link.search === window.location.search);
  if (sameRoute) event.preventDefault();
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  // A smooth scroll may be canceled when the router swaps the page.
  // Reset immediately on route changes; retain smooth reselects of the active tab.
  window.scrollTo({ top: 0, left: 0, behavior: sameRoute && !reduceMotion ? 'smooth' : 'auto' });
}

/** Header, primary navigation, page outlet, footer and the app-wide overlays. */
export function AppLayout() {
  const { me, ready, unread, unreadMessages, queue, syncUnread, logoutError, isStaff, isReviewer } = useMe();
  const location = useLocation();

  const notifications = me && <NavLink to="/notifications" onClick={scrollNavigationToTop} className="site-icon-link alerts"
    aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications">
    <Icon name="bell" size={22} /><span className="alerts-copy">{unread > 0 && <span className="nav-badge" aria-hidden="true">{unread}</span>}</span></NavLink>;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="top site-header">
        <div className="strip"><div className="wrap">
          <span><Icon name="shield" size={14} /> Verified CPSU students</span>
          <span><Icon name="chat" size={14} /> Chat with sellers</span>
          <span><Icon name="pin" size={14} /> Arrange payment and pickup on campus</span>
        </div></div>
        <div className="wrap masthead site-masthead">
          <Link to="/" className="brand" onClick={scrollNavigationToTop} aria-label="CPSU Market — CPSU Student Marketplace home">
            <span className="brand-symbol" aria-hidden="true"><Icon name="store" size={22} /></span>
            <span className="brand-long">CPSU <b>Student Marketplace</b></span>
            <span className="brand-short" aria-hidden="true">CPSU Market</span></Link>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/" end onClick={scrollNavigationToTop} className="site-nav__link">Home</NavLink>
            <ExploreMenu onNavigate={scrollNavigationToTop} />
            {!isStaff && <><NavLink to="/dashboard" onClick={scrollNavigationToTop} className="site-nav__link">Sell</NavLink>
              <NavLink to="/transactions" onClick={scrollNavigationToTop} className="site-nav__link">Transactions</NavLink></>}
            <NavLink to="/profile" onClick={scrollNavigationToTop} className="site-nav__link">Profile</NavLink>
            <NavLink to="/guidelines" onClick={scrollNavigationToTop} className="site-nav__link">Guidelines</NavLink>
            {isReviewer && <NavLink to="/admin" onClick={scrollNavigationToTop} className="site-nav__link"
              aria-label={queue > 0 ? `Review ${queue} waiting` : undefined}>Review{queue > 0 && <> <span className="nav-badge">{queue}</span></>}</NavLink>}
          </nav>
          <div className={me ? 'who site-actions' : 'who who-guest site-actions'}>
            {notifications}
            <InstallApp />
            {me ? <AccountMenu /> : <NavLink className="signin" to="/login">Sign in</NavLink>}
          </div>
        </div>
      </header>
      {logoutError && <div className="wrap"><p className="err" role="alert">{logoutError}</p></div>}
      <main id="main-content" tabIndex={-1}><div className="wrap">
        {/* Keyed by path so each new page plays one short entrance; search-param changes (filters) do not. */}
        <div className="page-transition" key={location.pathname}>
          <AppRoutes />
        </div>
      </div></main>
      <PwaStatus />
      <ActionFeedbackHost />
      <SiteFooter audience={!ready ? 'checking' : !me ? 'guest' : isStaff ? 'staff' : 'student'} canReview={Boolean(isReviewer)} />
      <FloatingChat ready={ready} isStaff={Boolean(isStaff)} signedIn={Boolean(me)} unreadMessages={unreadMessages}
          campusName={preferredCampusName(me?.affiliations)} onUnreadChanged={syncUnread} />
      <nav className="tabbar site-tabbar" aria-label="Primary">
        <NavLink to="/" end onClick={scrollNavigationToTop}>{({ isActive }) => <><Icon name={isActive ? 'homeSolid' : 'home'} size={24} /><span>Home</span></>}</NavLink>
        <NavLink to="/explore" onClick={scrollNavigationToTop}><Icon name="compass" size={24} /><span>Explore</span></NavLink>
        {!isStaff && <NavLink to="/dashboard" onClick={scrollNavigationToTop} className="site-tabbar__sell">
          <span className="site-tabbar__sell-button" aria-hidden="true"><Icon name="plus" size={30} /></span><span>Sell</span></NavLink>}
        {!isStaff && <NavLink to="/inquiries" onClick={scrollNavigationToTop} className="site-tabbar__inbox"
          aria-label={unreadMessages > 0 ? `Inbox, ${unreadMessages} unread ${unreadMessages === 1 ? 'message' : 'messages'}` : 'Inbox'}>
          <span className="site-tabbar__icon"><Icon name="inbox" size={24} />{unreadMessages > 0 && <span className="site-tabbar__badge" aria-hidden="true">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}</span><span>Inbox</span></NavLink>}
        {isReviewer && <NavLink to="/admin" onClick={scrollNavigationToTop}><Icon name="shield" size={24} /><span>Review</span></NavLink>}
        <NavLink to="/profile" onClick={scrollNavigationToTop}><Icon name="user" size={24} /><span>Profile</span></NavLink>
      </nav>
    </>
  );
}
