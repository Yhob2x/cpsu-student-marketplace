import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { CategoryChips } from '@/components/home/category-chips';
import { ExploreWays, QuickActions } from '@/components/home/explore-ways';
import { HomeHero } from '@/components/home/home-hero';
import { HomeSearch } from '@/components/home/home-search';
import { Icon } from '@/components/icons';
import { ListingCard } from '@/components/listings/listing-card';
import { SwipeableListingRail } from '@/components/listings/mobile-browse-controls';
import { MostFollowedStores, type MostFollowedStore } from '@/components/stores/most-followed-stores';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { api, explain } from '@/lib/api';
import { resolveHomePageContent, type HomePageView } from '@/lib/content/home-page-content';
import { selectHomeListings } from '@/lib/listings/home-listings';
import { useMe } from '@/providers/session-provider';
import type { Listing } from '@/types/listing';

// Home follows the approved "Concept 2" layout: hero, search and categories, trending listings,
// then ways to explore. Supporting information follows the marketplace content.
export function Home() {
  const { me } = useMe();
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const [feed, setFeed] = useState<Listing[] | null>(null);
  const [services, setServices] = useState<Listing[] | null>(null);
  const [popular, setPopular] = useState<Listing[] | null>(null);
  const [mostFollowed, setMostFollowed] = useState<MostFollowedStore[]>([]);
  const [managedContent, setManagedContent] = useState<HomePageView | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [homeError, setHomeError] = useState('');
  const loadHome = () => {
    setHomeError('');
    const fail = (e: unknown) => setHomeError(explain(e));
    api('/listings/fresh').then(r => setFeed(r.items)).catch(e => { setFeed([]); fail(e); });
    api('/listings?type=service&pageSize=8').then(r => setServices(r.items)).catch(e => { setServices([]); fail(e); });
    api('/listings/popular').then(r => setPopular(r.items)).catch(e => { setPopular([]); fail(e); });
    api<{ available: boolean; items: MostFollowedStore[] }>('/stores/most-followed')
      .then(r => setMostFollowed(r.available ? r.items : []))
      .catch(e => { setMostFollowed([]); fail(e); });
    api('/categories').then(setCats).catch(fail);
    api<HomePageView>('/home-page').then(setManagedContent).catch(() => setManagedContent(null));
  };
  useEffect(loadHome, []);
  useEffect(() => {
    const refreshPopular = () => {
      api<{ items: Listing[] }>('/listings/popular')
        .then(result => setPopular(result.items))
        // Preserve the last successful rail during an intermittent refresh failure.
        .catch(() => {});
    };
    window.addEventListener('listing-appreciation-committed', refreshPopular);
    return () => window.removeEventListener('listing-appreciation-committed', refreshPopular);
  }, []);
  const rail = (rows: Listing[], label: string) => <SwipeableListingRail itemCount={rows.length} label={label}>
    {rows.map((l, index) => <ListingCard key={l.id} l={l} priority={label === 'Trending on Campus' && index < 2} />)}
  </SwipeableListingRail>;
  const skeletons = <div className="rail">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skel card" aria-hidden="true" />)}</div>;
  // Skeletons while loading; once loaded, an empty section disappears instead of leaving a dead heading.
  const block = (title: string, to: string, rows: Listing[] | null) => rows === null
    ? <section className="home-listing-section" aria-label={title}><div className="sec-head"><h2>{title}</h2></div>{skeletons}</section>
    : rows.length > 0 ? <section className="home-listing-section" aria-label={title}><div className="sec-head"><h2>{title}</h2><Link to={to}>See all <Icon name="arrow" size={14} /></Link></div>{rail(rows, title)}</section> : null;
  const homeContent = resolveHomePageContent(managedContent);
  const copy = homeContent.copy;
  // Fresh listings always show the newest public listings, even when one is also popular.
  const { popular: top, fresh, services: serviceRows } = selectHomeListings(feed, popular, services);
  const canSell = Boolean(me) ? !staff : true;
  // Trending prefers popular listings and falls back to the newest ones until likes accumulate.
  const trending = top && top.length > 0 ? top : (fresh ?? []);
  return <>
    {homeError && <Panel className="" role="alert">Some marketplace content could not load. {homeError} <LegacyButton type="button" className="ghost" onClick={loadHome}>Retry</LegacyButton></Panel>}
    <div className="home-top">
      <HomeHero content={homeContent} canSell={canSell} />
      <QuickActions canSell={canSell} />
      <div className="home-discover">
        <HomeSearch categories={cats} />
        <CategoryChips categories={cats} />
      </div>
    </div>

    <div className="home-discovery-flow">
      {feed === null || popular === null
        ? <section className="home-listing-section trending" aria-label="Trending on Campus"><div className="sec-head"><h2>Trending on Campus</h2></div>{skeletons}</section>
        : trending.length > 0 && <section className="home-listing-section trending" aria-labelledby="trending-title">
          <div className="sec-head">
            <div><h2 id="trending-title">Trending on Campus <span className="trending__flame" aria-hidden="true"><Icon name="flame" size={22} filled /></span></h2>
              <p className="sec-sub">Popular items, services, and skills among CPSU students.</p></div>
            <Link to="/explore">View more <Icon name="arrow" size={14} /></Link>
          </div>
          {rail(trending, 'Trending on Campus')}
        </section>}
      {top && top.length > 0 && block('Fresh listings', '/explore', fresh?.filter(item => !trending.some(shown => shown.id === item.id)) ?? null)}
      {block('Student services', '/explore?type=service', serviceRows)}
    </div>

    <ExploreWays />
    <MostFollowedStores stores={mostFollowed} />
    <StudentAnnouncements />

    <section className="home-trust" aria-labelledby="home-trust-heading">
      <h2 id="home-trust-heading">{copy.trustHeading} <em>{copy.trustAccent}</em></h2>
      <ul className="trust">
        {copy.trustItems.map((item, index) => <li key={index}><Icon name={(['shield', 'chat', 'pin', 'flag'] as const)[index]} /> {item}</li>)}
      </ul>
    </section>

    <section className="steps">
      <div className="steps-art" aria-hidden="true">
        <img src={homeContent.images.steps ?? '/illustrations/campus-market.svg'} alt="" loading="lazy"
          onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/illustrations/campus-market.svg'; }} />
      </div>
      <div className="steps-content">
        <span className="steps-eyebrow">{copy.stepsEyebrow}</span>
        <h2>{copy.stepsHeading} <em>{copy.stepsAccent}</em></h2>
        <ol>
          {copy.steps.map((step, index) => <li key={index}><span className="num">{index + 1}</span><b>{step.title}</b><p>{step.body}</p></li>)}
        </ol>
        <Link className="btn ghost steps-link" to="/guidelines">Read marketplace guidelines <Icon name="arrow" size={17} /></Link>
      </div>
    </section>

    {!staff && <section className="cta-band" style={homeContent.images.cta
      ? { '--home-cta-image': `url("${homeContent.images.cta}")` } as CSSProperties : undefined}>
      <span className="cta-icon"><Icon name="store" /></span>
      <div><h2>{copy.ctaHeading}</h2>
        <p>{copy.ctaBody}</p></div>
      <Link className="btn gold" to="/dashboard">Start selling</Link>
    </section>}

  </>;
}

function StudentAnnouncements() {
  const [items, setItems] = useState<{ id: number; title: string; body: string; publishedAt: string }[]>([]);
  useEffect(() => { api<{ items: typeof items }>('/announcements').then(r => setItems(r.items)).catch(() => {}); }, []);
  if (items.length === 0) return null;
  return <section className="student-announcements" aria-labelledby="student-announcements-title">
    <h2 id="student-announcements-title">Campus announcements</h2>
    <div className="student-announcement-list">{items.map(item => <article key={item.id}>
      <h3>{item.title}</h3><p>{item.body}</p><time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString('en-PH')}</time>
    </article>)}</div>
  </section>;
}
