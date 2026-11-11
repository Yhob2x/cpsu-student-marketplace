import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, explain, peso } from './api';
import { useMe } from './main';
import { Icon } from './icons';

export type Listing = { id: number; type: string; title: string; description: string; price: number; priceBasis: string; availability: string; condition?: 'new' | 'like_new' | 'good' | 'fair' | null;
  handoffNote?: string; category: { name: string }; campus: { code: string; name: string }; seller: { id: number; storeName: string }; images: string[]; status?: string };

export function ListingCard({ l }: { l: Listing }) {
  const nav = useNavigate();
  const { me, savedIds, toggleSaved } = useMe();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saved = savedIds.includes(l.id);
  const isOwner = me != null && me.storeId === l.seller.id;
  const canSave = !isOwner && (l.availability === 'available' || saved);
  const saveLabel = isOwner ? 'You cannot save your own listing'
    : !canSave ? 'This listing is not available to save'
    : !me ? 'Sign in to save this listing'
    : saved ? 'Remove from saved' : 'Save for later';
  const flip = async () => {
    if (!canSave || busy) return;
    setSaveError('');
    if (!me) { nav('/login'); return; }
    setBusy(true);
    try {
      if (!await toggleSaved(l.id, !saved)) setSaveError('Could not update saved listings. Try again.');
    } catch {
      setSaveError('Could not update saved listings. Try again.');
    } finally { setBusy(false); }
  };
  // Whole-card link and a separate save control. Labels and prices reflect real listing data only.
  return (
    <article className="card product-card">
      <Link to={`/listings/${l.id}`} className="card-link" aria-label={`View ${l.title}`} />
      <div className="img product-photo">
        {l.images[0]
          ? <img src={l.images[0]} alt="" loading="lazy" decoding="async" />
          : <span className="photo-placeholder"><Icon name="tag" size={30} /><span>No photo yet</span></span>}
        <span className="listing-kind">{l.type === 'service' ? 'Service' : 'Product'}</span>
        <button type="button" className="heart-btn" aria-pressed={saved} aria-label={saveLabel}
          title={saveLabel} aria-busy={busy} disabled={busy || !canSave} onClick={flip}>
          <Icon name="heart" filled={saved} size={16} /></button>
      </div>
      <div className="body">
        <h3 title={l.title}>{l.title}</h3>
        <div className="listing-subline">
          <p className="product-category" title={l.category.name}>{l.category.name}</p>
          {l.condition && <span className="listing-condition">{l.condition.replace('_', ' ')}</span>}
        </div>
        <p className="seller" title={l.seller.storeName}>By {l.seller.storeName}</p>
        <div className="card-foot">
          <span className="price">{peso(l.price)}</span>
          {/[a-z]/i.test(l.priceBasis ?? '') && <span className="price-unit" title={l.priceBasis}>{l.priceBasis}</span>}
        </div>
        <p className="meta card-campus" title={l.campus.name}><Icon name="pin" size={13} /><span>{l.campus.name}</span></p>
        {l.availability !== 'available' && <p className="listing-availability">{l.availability.replaceAll('_', ' ')}</p>}
        {saveError && <p className="card-save-feedback" role="alert">{saveError}</p>}
      </div>
    </article>
  );
}

// Home mirrors a storefront: announcement strip and masthead live in the shell, then hero, category rail, curated
// rails, promo tiles, how-it-works, seller CTA and trust strip. Every block links to a real Explore query. There is no
// cart, discount or delivery promise because v1 has none — gold is spent on prices, not on sale stickers.
export function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [feed, setFeed] = useState<Listing[] | null>(null);
  const [services, setServices] = useState<Listing[] | null>(null);
  const [popular, setPopular] = useState<Listing[] | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [homeError, setHomeError] = useState('');
  const loadHome = () => {
    setHomeError('');
    const fail = (e: unknown) => setHomeError(explain(e));
    api('/listings?pageSize=24').then(r => setFeed(r.items)).catch(e => { setFeed([]); fail(e); });
    api('/listings?type=service&pageSize=8').then(r => setServices(r.items)).catch(e => { setServices([]); fail(e); });
    api('/listings/popular').then(r => setPopular(r.items)).catch(e => { setPopular([]); fail(e); });
    api('/categories').then(setCats).catch(fail);
  };
  useEffect(loadHome, []);
  const go = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); nav(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore'); };
  const rail = (rows: Listing[]) => <div className="rail">{rows.map(l => <ListingCard key={l.id} l={l} />)}</div>;
  const skeletons = <div className="rail">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skel card" aria-hidden="true" />)}</div>;
  // Skeletons while loading; once loaded, an empty section disappears instead of leaving a dead heading.
  const block = (title: string, to: string, rows: Listing[] | null) => rows === null
    ? <><div className="sec-head"><h2>{title}</h2></div>{skeletons}</>
    : rows.length > 0 ? <><div className="sec-head"><h2>{title}</h2><Link to={to}>See all <Icon name="arrow" size={14} /></Link></div>{rail(rows)}</> : null;
  const shots = (feed ?? []).filter(l => l.images[0]).slice(0, 3);
  const top = popular && popular.length > 0 ? popular : (feed ? feed.slice(0, 8) : null);
  const topTitle = popular?.length ? 'Popular listings' : 'Browse listings';
  // A listing appears once per page: the fresh and services rails drop whatever the first rail already showed (the services
  // rail is usually a subset of the popular one), and a section with nothing left disappears.
  const fresh = feed ? feed.filter(l => !(top ?? []).some(t => t.id === l.id)).slice(0, 8) : null;
  const shown = new Set([...(top ?? []), ...(fresh ?? [])].map(l => l.id));
  const serviceRows = services ? services.filter(l => !shown.has(l.id)) : null;
  return <>
    {homeError && <div className="panel" role="alert">Some marketplace content could not load. {homeError} <button type="button" className="btn ghost" onClick={loadHome}>Retry</button></div>}
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">THE CPSU STUDENT MARKETPLACE</span>
        <h1>Great finds.<br />Right on campus.</h1>
        <p>Discover pre-loved essentials, student-made goods and useful skills from the CPSU community. Connect directly with the students behind every listing.</p>
        <div className="hero-actions">
          <Link className="btn" to="/explore">Explore listings <Icon name="arrow" size={17} /></Link>
          <Link className="btn ghost" to="/dashboard">Start selling</Link>
        </div>
        <form className="search hero-search" role="search" onSubmit={go}>
          <input aria-label="Search listings" placeholder="Search products, services, skills…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn">Search</button>
        </form>
        <div className="hero-trust">
          <span><Icon name="shield" size={16} /> Verified students only</span>
          <span><Icon name="pin" size={16} /> Campus pickup</span>
          <span><Icon name="chat" size={16} /> No middleman</span>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        {shots.map((l, i) => <figure key={l.id} className={`shot shot-${i + 1}`}>
          <img src={l.images[0]} alt="" loading={i ? 'lazy' : 'eager'} decoding="async" /></figure>)}
        {shots.length === 0 && <div className="shot shot-1 empty-art"><Icon name="tag" size={56} /></div>}
        <span className="hero-sticker"><b>From students</b><small>for the CPSU community</small></span>
      </div>
    </section>

    <section className="category-section" aria-label="Browse by category">
      <div className="sec-head category-head"><h2>Explore by category</h2><Link to="/explore">View all <Icon name="arrow" size={15} /></Link></div>
      <div className="cat-rail">
        {cats.slice(0, 8).map(c => <Link key={c.id} className="cat" to={`/explore?categoryId=${c.id}`}>
          <span className="cat-ico"><Icon name="tag" size={24} /></span><span>{c.name}</span></Link>)}
      </div>
    </section>

    {block(topTitle, '/explore', top)}

    <section className="promos" aria-label="Quick links">
      <Link className="promo promo-a" to="/explore?type=service"><h3>Student services</h3>
        <p>Design, tutoring, printing and IT help from classmates.</p><span className="more">Browse services <Icon name="arrow" size={14} /></span></Link>
      <Link className="promo promo-b" to="/explore?type=physical_product"><h3>Pre-loved finds</h3>
        <p>Books, gadgets and dorm essentials passed on by students.</p><span className="more">Browse products <Icon name="arrow" size={14} /></span></Link>
      <Link className="promo promo-c" to="/dashboard"><h3>Have something to sell?</h3>
        <p>Set up your store and publish your first listing.</p><span className="more">Start selling <Icon name="arrow" size={14} /></span></Link>
    </section>

    {block('Fresh listings', '/explore', fresh)}
    {block('Student services', '/explore?type=service', serviceRows)}

    <section className="steps">
      <h2>How it works</h2>
      <ol>
        <li><span className="num">1</span><b>Find something</b><p>Filter by campus, category and price. Listings are reviewed before they appear.</p></li>
        <li><span className="num">2</span><b>Message the seller</b><p>Ask if it is still available and agree the details in Messages.</p></li>
        <li><span className="num">3</span><b>Meet on campus</b><p>Hand over payment and the item directly. The marketplace never holds money.</p></li>
      </ol>
    </section>

    <section className="cta-band">
      <span className="cta-icon"><Icon name="store" /></span>
      <div><span className="cta-eyebrow">YOUR CAMPUS. YOUR COMMUNITY.</span><h2>Turn what you no longer need into something useful</h2>
        <p>Students with a verified campus affiliation can open a store and publish listings.</p></div>
      <Link className="btn gold" to="/dashboard">Start selling</Link>
    </section>

    <ul className="trust">
      <li><Icon name="shield" /> Reviewer-approved listings</li>
      <li><Icon name="chat" /> No middleman, no fees</li>
      <li><Icon name="pin" /> Meet at a campus pickup spot</li>
      <li><Icon name="flag" /> Report anything that looks wrong</li>
    </ul>
  </>;
}

type Filters = { q: string; campusId: string; categoryId: string; type: string; condition: string; minPrice: string; maxPrice: string; sort: string };
const NO_FILTERS: Filters = { q: '', campusId: '', categoryId: '', type: '', condition: '', minPrice: '', maxPrice: '', sort: 'newest' };

export function Discover() {
  const [sp, setSp] = useSearchParams();
  // Filters that arrive in the URL (category chips on Home, a shared link) seed the form.
  // Filters named in the URL (header search, footer links, promo tiles) seed the form, price range and sort included.
  const seed = (p: URLSearchParams): Filters => ({ ...NO_FILTERS,
    q: p.get('q') ?? '', campusId: p.get('campusId') ?? '', categoryId: p.get('categoryId') ?? '', type: p.get('type') ?? '', condition: p.get('condition') ?? '',
    minPrice: p.get('minPrice') ?? '', maxPrice: p.get('maxPrice') ?? '', sort: p.get('sort') ?? 'newest' });
  const f = seed(sp);
  const [campuses, setCampuses] = useState<any[]>([]); const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<Listing[] | null>(null); const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState('');
  const currentPage = Math.max(1, Number(sp.get('page')) || 1);
  const pageCount = Math.ceil((total ?? 0) / 20);
  const navigatePage = (page: number) => { const next = new URLSearchParams(sp); next.set('page', String(page)); setSp(next); };

  useEffect(() => { api('/campuses').then(setCampuses).catch(() => {}); api('/categories').then(setCats).catch(() => {}); }, []);
  // URL parameters are the source of truth, including when the browser navigates back or forward.
  const query = sp.toString();
  useEffect(() => {
    let active = true;
    setItems(null); setTotal(null); setError('');
    const t = setTimeout(() => api(`/listings?${query}`)
      .then(r => { if (active) { setItems(r.items); setTotal(r.total); setError(''); } })
      .catch(e => { if (active) { setError(explain(e)); setItems([]); setTotal(null); } }), 250);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  const set = (k: keyof Filters) => (e: { target: { value: string } }) => {
    const next = { ...f, [k]: e.target.value };
    setSp(new URLSearchParams(Object.entries(next).filter(([, v]) => v && v !== 'newest') as [string, string][]), { replace: true });
  };
  const reset = () => setSp(new URLSearchParams(), { replace: true });
  const dirty = (Object.keys(NO_FILTERS) as (keyof Filters)[]).some(k => k !== 'sort' && f[k] !== '');
  const skel = <div className="grid listing-grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skel card" aria-hidden="true" />)}</div>;

  return <>
    <h1>Explore listings</h1>
    <p className="muted" style={{ marginTop: '-.25rem' }}>Find pre-loved items and student services, then message the seller directly.</p>

    <div className="explore-toolbar">
      <label className="field explore-search">Search listings
        <span className="input-icon"><Icon name="search" size={18} /><input placeholder="Title or description" value={f.q} onChange={set('q')} /></span>
      </label>
    </div>
    <div className="filters filter-panel" role="group" aria-label="Filter listings">
      <label className="field">Campus
        <select value={f.campusId} onChange={set('campusId')}><option value="">All campuses</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <label className="field">Category
        <select value={f.categoryId} onChange={set('categoryId')}><option value="">All categories</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>
      <label className="field">Type
        <select value={f.type} onChange={set('type')}><option value="">All types</option><option value="physical_product">Products</option><option value="service">Services</option></select>
      </label>
      <label className="field">Condition
        <select value={f.condition} onChange={set('condition')}><option value="">Any condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select>
      </label>
      <label className="field">Min price (₱)
        <input type="number" inputMode="numeric" min={0} step={1} placeholder="Any" value={f.minPrice} onChange={set('minPrice')} />
      </label>
      <label className="field">Max price (₱)
        <input type="number" inputMode="numeric" min={0} step={1} placeholder="Any" value={f.maxPrice} onChange={set('maxPrice')} />
      </label>
    </div>

    <div className="results">
      <p className="muted" role="status" aria-live="polite">
        {error ? 'Could not load listings' : total === null ? 'Searching…' : total === 0 ? 'No listings match' : `${total} listing${total === 1 ? '' : 's'}`}
      </p>
      {dirty && <button type="button" className="clear-inline" onClick={reset}>Reset search and filters</button>}
      <label className="field">Sort
        <select value={f.sort} onChange={set('sort')}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </label>
    </div>

    {error && <p className="err" role="alert">{error}</p>}
    {items === null && skel}
    {items !== null && items.length === 0 && !error && <div className="empty">
      <h2>No listings match</h2>
      <p className="muted">{dirty ? 'One of your filters is too narrow. Clear them and start again, or try another campus.' : 'Nothing is published yet. Check back soon — new listings appear here as soon as a reviewer approves them.'}</p>
      {dirty && <button className="btn ghost" onClick={reset}>Clear filters</button>}
    </div>}
    <div className="grid listing-grid">{items?.map(l => <ListingCard key={l.id} l={l} />)}</div>
    {pageCount > 1 && <nav className="row" aria-label="Listing pages" style={{ justifyContent: 'center', marginTop: '1rem' }}>
      <button type="button" className="btn ghost" disabled={currentPage <= 1} onClick={() => navigatePage(currentPage - 1)}>Previous</button>
      <span className="muted" role="status">Page {currentPage} of {pageCount}</span>
      <button type="button" className="btn ghost" disabled={currentPage >= pageCount} onClick={() => navigatePage(currentPage + 1)}>Next</button>
    </nav>}
  </>;
}

export function ListingDetail() {
  const { id } = useParams(); const { me, savedIds, toggleSaved } = useMe();
  const [l, setL] = useState<Listing | null>(null); const [body, setBody] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('');
  useEffect(() => { api(`/listings/${id}`).then(setL).catch(e => setErr(explain(e))); }, [id]);
  if (err && !l) return <p className="err">This listing is not available.</p>;
  if (!l) return <p className="muted">Loading</p>;
  // Saved state comes from the shell (one fetch at sign-in), shared with the hearts on every card.
  const saved = savedIds.includes(l.id);
  const isOwner = me?.storeId === l.seller.id;
  const isAvailable = l.availability === 'available';
  const send = async () => { setBusy(true); try { const r = await api('/inquiries', { body: { listingId: l.id, body } }); setBody(''); setNote(`Message sent. Continue in Inquiries (thread ${r.id}).`); setErr(''); } catch (e) { setErr(explain(e)); } finally { setBusy(false); } };
  const save = async () => {
    setBusy(true);
    try {
      if (await toggleSaved(l.id, !saved)) { setNote(saved ? 'Removed from your saved list.' : 'Saved to your list.'); setErr(''); }
      else setErr('Could not update your saved list. Check you are still signed in.');
    } finally { setBusy(false); }
  };
  const report = async () => { setBusy(true); try { await api('/reports', { body: { listingId: l.id, reason } }); setReason(''); setReporting(false); setNote('Report sent to a campus reviewer.'); setErr(''); } catch (e) { setErr(explain(e)); } finally { setBusy(false); } };
  // One button, two homes: over the first photo when there is one, in the action row when there is not.
  const heart = <button className="heart-btn" aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save for later'}
    title={saved ? 'Remove from saved' : 'Save for later'} disabled={busy} onClick={save}>
    <Icon name="heart" filled={saved} size={22} /></button>;
  return <article className="listing-detail">
    <Link className="listing-back" to="/explore">← Browse all listings</Link>
    <div className="listing-detail-layout">
      <div className="gallery listing-gallery" role={l.images.length > 1 ? 'region' : undefined}
      aria-label={l.images.length > 1 ? `Photos of ${l.title}` : undefined} tabIndex={l.images.length > 1 ? 0 : undefined}>
      {l.images.length === 0 && <div className="listing-photo-empty"><Icon name="tag" size={30} /><span>No listing photos yet</span></div>}
      {l.images.length > 0 && <span className="gallery-lead">
        <img src={l.images[0]} alt={`Photo 1 of ${l.images.length}: ${l.title}`} loading="eager" decoding="async" />
        {me && !isOwner && (isAvailable || saved) && heart}
      </span>}
      {l.images.slice(1).map((s, i) => <img key={s} src={s} alt={`Photo ${i + 2} of ${l.images.length}: ${l.title}`} loading="lazy" decoding="async" />)}
      </div>
      <div className="listing-detail-content">
    <h1 className="listing-detail-title">{l.title}</h1>
    {/* Only show a basis that carries meaning; a value like "1" would render as "₱150 1". */}
    <div className="row listing-facts"><span className="tag">{peso(l.price)}</span>{/[a-z]/i.test(l.priceBasis ?? '') && <span className="muted">{l.priceBasis}</span>}<span className="status">{l.category.name}</span>{l.condition && <span className="status">Condition: {l.condition.replace('_',' ')}</span>}<span className="status">{l.availability}</span>{l.status && <span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span>}</div>
    <p className="listing-description">{l.description}</p>
    <p className="muted listing-seller">Sold by <Link to={`/stores/${l.seller.id}`}>{l.seller.storeName}</Link> at {l.campus.name}. {l.handoffNote && `Handoff: ${l.handoffNote}.`}</p>
    <div className="panel stack">
      <h2>Ask the seller</h2>
      {!isAvailable && <p className="muted" role="status">This listing is {l.availability}. New inquiries are disabled.</p>}
      {isOwner && <p className="muted">This is your own listing.</p>}
      <p className="muted">Payment and handoff are arranged directly between you and the seller. The marketplace does not hold money or deliver items.</p>
      {me ? <><label className="field">Your message to the seller
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1000} placeholder="Is this still available? Where can we meet on campus?" />
      </label>
        <div className="row"><button className="btn" disabled={busy || !body.trim() || !isAvailable || isOwner} onClick={send}>Send inquiry</button>
          {l.images.length === 0 && !isOwner && (isAvailable || saved) && heart}
          <button className="btn ghost" disabled={busy} onClick={() => { setReporting(!reporting); setErr(''); }}>Report</button></div>
        {reporting && <div className="stack">
          <label className="field">Why are you reporting this listing?
            <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="Describe the issue (at least 10 characters)" />
          </label>
          <div className="row"><button className="btn danger" disabled={busy || reason.trim().length < 10} onClick={report}>Send report</button>
            <button className="btn ghost" disabled={busy} onClick={() => setReporting(false)}>Cancel</button></div></div>}</>
        : <p><Link to="/login">Sign in</Link> to message this seller.</p>}
      {note && <p role="status">{note}</p>}{err && <p className="err" role="alert">{err}</p>}
    </div>
      </div>
    </div>
  </article>;
}

export function StorePage() {
  const { id } = useParams(); const [s, setS] = useState<any>(null);
  useEffect(() => { api(`/seller-profiles/${id}`).then(setS).catch(() => setS(false)); }, [id]);
  if (s === false) return <p className="err">Store not found.</p>; if (!s) return <p className="muted">Loading</p>;
  return <><h1>{s.storeName}</h1><p><span className="status">{s.badge}</span></p><p style={{ maxWidth: '60ch' }}>{s.description}</p>
    <p className="muted">This badge confirms campus affiliation only. It is not an endorsement of products or services by the university.</p>
    <div className="grid listing-grid">{s.listings.map((l: Listing) => <ListingCard key={l.id} l={l} />)}</div></>;
}

export function Guidelines() {
  return <div style={{ maxWidth: '62ch' }}>
    <h1>Marketplace guidelines</h1>
    <p className="muted">Draft for discussion. Final rules are set by CPSU before launch.</p>
    <h2>What you can list</h2><p>Student-made goods, pre-loved items, and skills-based services such as design, tutoring and IT help.</p>
    <h2>What gets a closer look</h2><p>Food, drinks, printing and school supplies may overlap with campus establishments. A campus reviewer checks these before they appear, and may restrict them under the campus rules.</p>
    <h2>Not allowed</h2><p>Paid cheating or impersonation, harassment, and anything prohibited by campus or national rules.</p>
    <h2>Meeting and paying</h2><p>You and the other person agree on payment and handoff. Meet at a campus pickup spot where possible. The marketplace never holds money.</p>
    <h2>Problems</h2><p>Use Report on any listing. A reviewer looks at it and records the outcome.</p>
  </div>;
}
