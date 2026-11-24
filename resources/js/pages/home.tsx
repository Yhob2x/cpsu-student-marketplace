import { type CSSProperties, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

// Home is discovery-first: a concise hero, categories and uninterrupted listing sections come first.
// Supporting information and optional installation follow the marketplace content.
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
  const shortCategoryName = (name: string) => ({
    'Handmade goods': 'Hand-made',
    'Pre-loved items': 'Pre-loved',
    'Books & notes (pre-loved)': 'Books',
    'Food & drinks': 'Food',
    'Printing & school supplies': 'Printing',
    'Design & creative': 'Design',
    'Tutoring': 'Tutoring',
    'Tech & IT help': 'Tech help',
    'Photography & video': 'Photo & video',
  } as Record<string, string>)[name] ?? name;
  // Keep category discovery scannable without changing the existing category IDs or links.
  const categoryIcon = (name: string) => {
    const label = name.toLowerCase();
    if (/print/.test(label)) return 'printer';
    if (/book|notes|school supplies/.test(label)) return 'book';
    if (/food|drink|snack|coffee/.test(label)) return 'utensils';
    if (/design|creativ|\barts?\b/.test(label)) return 'palette';
    if (/tutor|lesson|educat/.test(label)) return 'graduation';
    if (/tech|digital|gadget|computer|it help/.test(label)) return 'laptop';
    if (/photo|video/.test(label)) return 'camera';
    if (/cloth|fashion|accessor/.test(label)) return 'shirt';
    if (/handmade|craft|pre-loved|second.hand/.test(label)) return 'package';
    if (/service|repair/.test(label)) return 'wrench';
    return 'tag';
  };
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
    {rows.map((l, index) => <ListingCard key={l.id} l={l} priority={label === 'Fresh listings' && index < 2} />)}
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
  return <>
    {homeError && <Panel className="" role="alert">Some marketplace content could not load. {homeError} <LegacyButton type="button" className="ghost" onClick={loadHome}>Retry</LegacyButton></Panel>}
    <section className="hero home-hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">{copy.heroEyebrow}</span>
        <h1><span className="hero-line">{copy.heroLine1}</span>
          <span className="hero-line hero-line-connect"><span className="hero-amp">{copy.heroAccent}</span> {copy.heroLine2}</span>
          <em>{copy.heroLine3}</em></h1>
        <p>{copy.heroBody}</p>
        <div className="home-hero-actions">
          <Link to="/explore" className="home-hero-explore">Explore listings <span aria-hidden="true"><Icon name="arrow" size={17} /></span></Link>
          <Link to="/guidelines" className="home-hero-guide">How it works <Icon name="arrow" size={15} /></Link>
        </div>
        {/* Search stays in the global header; these links use existing routes. */}
      </div>
      <div className="hero-art" aria-hidden="true">
        {/* Scale-independent asymmetric crop; the admin-managed image remains unchanged. */}
        <svg className="hero-photo-mask-definition" width="0" height="0" focusable="false" aria-hidden="true">
          <defs>
            <clipPath id="cpsu-hero-organic-clip" clipPathUnits="objectBoundingBox">
              <path d="M .50 .035 C .67 .005 .82 .045 .91 .085 C .985 .125 .975 .23 .965 .355 C .955 .525 .99 .735 .93 .855 C .865 .985 .765 .99 .625 .95 C .49 .905 .405 .905 .29 .965 C .16 1 .065 .895 .045 .78 C .005 .625 .02 .395 .11 .255 C .205 .12 .34 .055 .50 .035 Z" />
            </clipPath>
          </defs>
        </svg>
        <figure className="shot shot-1 home-custom-hero">
          <img src={homeContent.images.hero ?? '/illustrations/campus-abstract.svg'} alt="" decoding="async"
            onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/illustrations/campus-abstract.svg'; }} />
        </figure>
        <div className="home-hero-photo-signature" aria-hidden="true">
          <span className="home-hero-photo-symbol"><Icon name="store" size={19} /></span>
          <span><strong>CPSU Student Marketplace</strong><small>Our campus community</small></span>
        </div>
      </div>
    </section>

    <section className="category-section" aria-label="Browse by category">
      <div className="sec-head category-head"><h2>{copy.categoryHeading}</h2><Link to="/explore">View all <Icon name="arrow" size={15} /></Link></div>
      <div className="cat-rail home-category-grid" role="group" aria-label="All categories"
        style={{ '--category-count': Math.max(1, cats.length) } as CSSProperties}>
        {cats.map(c => <Link key={c.id} className="cat" to={`/explore?categoryId=${c.id}`}
          aria-label={shortCategoryName(c.name) === c.name ? c.name : `${shortCategoryName(c.name)} — ${c.name}`} title={c.name}>
          <span className="cat-ico" aria-hidden="true"><Icon name={categoryIcon(c.name)} size={20} /></span>
          <span className="category-label-full" aria-hidden="true">{c.name}</span>
          <span className="category-label-short" aria-hidden="true">{shortCategoryName(c.name)}</span>
        </Link>)}
      </div>
    </section>

    <div className="home-discovery-flow">
      {block('Fresh listings', '/explore', fresh)}
      {block('Popular listings', '/explore', top)}
      {block('Student services', '/explore?type=service', serviceRows)}
    </div>

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
