import React from 'react';
import { Link, NavLink } from 'react-router-dom';

import { ActionFeedbackHost } from '@/components/action-feedback';
import { FloatingChat } from '@/components/chat/floating-chat';
import { Icon } from '@/components/icons';
import { HeaderSearch } from '@/components/layout/header-search';
import { InstallApp } from '@/components/layout/install-app';
import { PwaStatus } from '@/components/layout/pwa-status';
import { SiteFooter } from '@/components/layout/site-footer';
import { LegacyButton } from '@/components/ui/legacy-button';
import { preferredCampusName } from '@/lib/meetup/meetup-campus';
import { useMe } from '@/providers/session-provider';
import { AppRoutes } from '@/routes';

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

/** Header, primary navigation, page outlet, footer and the app-wide overlays. */
export function AppLayout() {
  const { me, ready, unread, unreadMessages, queue, syncUnread, logout, loggingOut, logoutError, isStaff, isReviewer } = useMe();

  return (
    <>
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
        <AppRoutes />
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
    </>
  );
}
