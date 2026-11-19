import { type CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, api, explain, peso } from './api';
import { useMe } from './main';
import { Icon } from './icons';
import { IconAction } from './icon-action';
import { showActionFeedback } from './action-feedback';
import { InstallApp } from './install-app';
import { selectHomeListings } from './home-listings';
import { MobileBrowseControls, SwipeableListingRail } from './mobile-browse-controls';
import { ListingGallery } from './listing-gallery';
import { isPublicNotFound, publicResourceLoadMessage } from './public-resource-error';
import { SellerAvatar } from './seller-avatar';
import { StorefrontView, type PublicStorefront } from './pages-storefront';
import { StoresInResults } from './stores-in-results';
import { MostFollowedStores, type MostFollowedStore } from './most-followed-stores';
import { resolveHomePageContent, type HomePageView } from './home-page-content';
import { categoriesForExplore, cleanExploreQuery, DEFAULT_EXPLORE_FILTERS, exploreAdvancedSummary, explorePriceError, previewExploreOptions, updateExploreQuery, type ExploreCategory, type ExploreFilters } from './explore-filters';

export type Listing = { id: number; type: string; title: string; description: string; price: number; priceBasis: string; availability: string; condition?: 'new' | 'like_new' | 'good' | 'fair' | null;
  handoffNote?: string; category: { name: string }; campus: { code: string; name: string }; seller: { id: number; storeName: string; avatarUrl?: string | null }; images: string[]; status?: string };

export function ListingCard({ l, priority = false }: { l: Listing; priority?: boolean }) {
  const nav = useNavigate();
  const { me, savedIds, toggleSaved } = useMe();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const imageSrc = l.images[0];
  const showImage = Boolean(imageSrc && failedImageSrc !== imageSrc);
  const saved = savedIds.includes(l.id);
  const isOwner = me != null && me.storeId === l.seller.id;
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const canSave = !staff && !isOwner && (l.availability === 'available' || saved);
  const saveLabel = isOwner ? 'You cannot save your own listing'
    : !canSave ? 'This listing is not available to save'
    : !me ? 'Sign in to save this listing'
    : saved ? 'Remove from saved' : 'Save for later';
  const flip = async () => {
    if (!canSave || busy) return;
    setSaveError('');
    if (!me) { nav(`/login?next=${encodeURIComponent(`/listings/${l.id}`)}`); return; }
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
        {showImage
          ? <img src={imageSrc} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailedImageSrc(imageSrc)} />
          : <span className="photo-placeholder"><Icon name="tag" size={30} /><span>{imageSrc ? 'Photo unavailable' : 'No photo yet'}</span></span>}
        <span className="listing-kind">{l.type === 'service' ? 'Service' : 'Product'}</span>
        {l.images.length > 1 && <span className="product-photo-multiple">{l.images.length} photos</span>}
        {!staff && <button type="button" className="heart-btn" aria-pressed={saved} aria-label={saveLabel}
          title={saveLabel} aria-busy={busy} disabled={busy || !canSave} onClick={flip}>
          <Icon name="heart" filled={saved} size={16} /></button>}
      </div>
      <div className="body">
        <h3 title={l.title}>{l.title}</h3>
        <div className="card-foot">
          <span className="price">{peso(l.price)}</span>
          {/[a-z]/i.test(l.priceBasis ?? '') && <span className="price-unit" title={l.priceBasis}>{l.priceBasis}</span>}
        </div>
        <div className="listing-subline">
          <p className="product-category" title={l.category.name}>{l.category.name}</p>
          {l.condition && <span className="listing-condition">{l.condition.replace('_', ' ')}</span>}
        </div>
        <p className="seller seller-byline" title={l.seller.storeName}><SellerAvatar name={l.seller.storeName} src={l.seller.avatarUrl} size="small" /><span>By <Link className="seller-store-link" to={`/stores/${l.seller.id}`}>{l.seller.storeName}</Link></span></p>
        <p className="meta card-campus" title={l.campus.name}><Icon name="pin" size={13} /><span>{l.campus.name}</span></p>
        {l.availability !== 'available' && <p className="listing-availability">{l.availability.replaceAll('_', ' ')}</p>}
        {saveError && <p className="card-save-feedback" role="alert">{saveError}</p>}
        <span className="product-card-arrow" aria-hidden="true"><Icon name="arrow" size={15} /></span>
      </div>
    </article>
  );
}

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
    {homeError && <div className="panel" role="alert">Some marketplace content could not load. {homeError} <button type="button" className="btn ghost" onClick={loadHome}>Retry</button></div>}
    <section className="hero home-hero">
      <div className="hero-copy">
        <span className="hero-eyebrow">{copy.heroEyebrow}</span>
        <h1><span className="hero-line">{copy.heroLine1}</span>
          <span className="hero-line hero-line-connect"><span className="hero-amp">{copy.heroAccent}</span> {copy.heroLine2}</span>
          <em>{copy.heroLine3}</em></h1>
        <p>{copy.heroBody}</p>
        {/* Search is available in the site header on every page; this hero keeps the editorial message and approved image. */}
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
      </div>
    </section>

    <section className="category-section" aria-label="Browse by category">
      <div className="sec-head category-head"><h2>{copy.categoryHeading}</h2><Link to="/explore">View all <Icon name="arrow" size={15} /></Link></div>
      <div className="cat-rail home-category-grid" role="group" aria-label="All categories"
        style={{ '--category-count': Math.max(1, cats.length) } as CSSProperties}>
        {cats.map(c => <Link key={c.id} className="cat" to={`/explore?categoryId=${c.id}`}
          aria-label={c.name} title={c.name}>
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

    <InstallApp />
  </>;
}

type Filters = ExploreFilters;
const NO_FILTERS = DEFAULT_EXPLORE_FILTERS;

export function Discover() {
  const [sp, setSp] = useSearchParams();
  // Filters that arrive in the URL (category chips on Home, a shared link) seed the form.
  // Filters named in the URL (header search, footer links, promo tiles) seed the form, price range and sort included.
  const seed = (p: URLSearchParams): Filters => {
    const type = p.get('type') ?? '';
    const condition = type === 'service' ? '' : (p.get('condition') ?? '');
    return { ...NO_FILTERS,
      q: p.get('q') ?? '', campusId: p.get('campusId') ?? '', categoryId: p.get('categoryId') ?? '',
      type: condition ? 'physical_product' : type, condition,
      minPrice: p.get('minPrice') ?? '', maxPrice: p.get('maxPrice') ?? '', sort: p.get('sort') ?? 'newest' };
  };
  const f = seed(sp);
  const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [cats, setCats] = useState<ExploreCategory[]>([]);
  const [filterError, setFilterError] = useState(''); const [filtersLoading, setFiltersLoading] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [allCampusesOpen, setAllCampusesOpen] = useState(false);
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const [items, setItems] = useState<Listing[] | null>(null); const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [retryRequest, setRetryRequest] = useState(0);
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const [loadedSearch, setLoadedSearch] = useState('');
  const currentPage = Math.max(1, Number(sp.get('page')) || 1);
  const pageCount = Math.ceil((total ?? 0) / 20);
  const availableCats = categoriesForExplore(cats, f.type);
  const campusPreview = previewExploreOptions(campuses, f.campusId, 4);
  const categoryPreview = previewExploreOptions(availableCats, f.categoryId, 5);
  const priceError = explorePriceError(f.minPrice, f.maxPrice);
  const activeFilters = exploreAdvancedSummary(f, campuses, cats);
  // Invalid price links reveal the correction controls on small screens.
  useEffect(() => { if (priceError) setMobileFiltersOpen(true); }, [priceError]);
  const navigatePage = (page: number) => { const next = new URLSearchParams(sp); next.set('page', String(page)); setSp(next); };

  const loadFilterOptions = async () => {
    setFiltersLoading(true);
    setFilterError('');
    const [campusResult, categoryResult] = await Promise.allSettled([
      api<any[]>('/campuses'), api<any[]>('/categories'),
    ]);
    const failures: string[] = [];
    if (campusResult.status === 'fulfilled') setCampuses(campusResult.value);
    else failures.push('campus options');
    if (categoryResult.status === 'fulfilled') setCats(categoryResult.value);
    else failures.push('category options');
    if (failures.length) setFilterError(`Could not load ${failures.join(' and ')}. Check your connection and retry.`);
    setFiltersLoading(false);
  };
  useEffect(() => { void loadFilterOptions(); }, []);
  // Repair incompatible deep links once the category definitions are available.
  useEffect(() => {
    if (filtersLoading || cats.length === 0) return;
    const next = cleanExploreQuery(sp, cats);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [cats, filtersLoading, sp, setSp]);
  // URL parameters remain the single source of truth for filters and browser history.
  const query = cleanExploreQuery(sp, cats).toString();
  const requestKey = `${query}:${retryRequest}`;
  const isRefreshing = resolvedRequestKey !== requestKey;
  useEffect(() => {
    if (total === null || total === 0 || currentPage <= pageCount) return;
    const next = new URLSearchParams(sp);
    next.set('page', String(pageCount));
    setSp(next, { replace: true });
  }, [currentPage, pageCount, total, sp, setSp]);
  useEffect(() => {
    let active = true;
    setError('');
    // Keep previously rendered cards (and their <img> elements) mounted while
    // filters or sorting refresh. The media endpoint intentionally disallows caching.
    if (priceError) {
      setItems([]); setTotal(null); setResolvedRequestKey(requestKey);
      return () => { active = false; };
    }
    const t = setTimeout(() => api(`/listings?${query}`)
      .then(r => { if (active) {
        setItems(r.items); setTotal(r.total); setError('');
        setLoadedSearch(new URLSearchParams(query).get('q') ?? '');
        setResolvedRequestKey(requestKey);
      } })
      .catch(e => { if (active) {
        setError(e instanceof ApiError && e.status === 429
          ? 'Too many requests. Wait a few minutes before retrying.'
          : 'Listings are temporarily unavailable. Check your connection and try again.');
        setItems([]); setTotal(null); setResolvedRequestKey(requestKey);
      } }), 250);
    return () => { active = false; clearTimeout(t); };
  }, [query, retryRequest, priceError]);

  const set = (k: keyof Filters) => (e: { target: { value: string } }) => {
    setSp(updateExploreQuery(sp, k, e.target.value, cats), { replace: true });
  };
  const reset = () => setSp(new URLSearchParams(), { replace: true });
  const dirty = (Object.keys(NO_FILTERS) as (keyof Filters)[]).some(k => k !== 'sort' && f[k] !== '');
  const skel = <div className="grid listing-grid explore-results" role="status" aria-label="Loading listing results">
    {Array.from({ length: 8 }, (_, i) => <div key={i} className="skel card" aria-hidden="true" />)}
  </div>;

  return <>
    <div className="explore-page-heading">
      <h1>Explore listings</h1>
      <button type="button" className="explore-mobile-filter-toggle"
        aria-controls="explore-filter-sidebar" aria-expanded={mobileFiltersOpen}
        onClick={() => setMobileFiltersOpen(open => !open)}>
        <Icon name="sliders-horizontal" size={18} />
        Filters{activeFilters.count + (f.type ? 1 : 0) > 0 ? ` (${activeFilters.count + (f.type ? 1 : 0)})` : ''}
      </button>
    </div>
    <div className="explore-sidebar-layout">
      <aside id="explore-filter-sidebar" className="explore-filter-sidebar"
        data-mobile-open={mobileFiltersOpen} aria-label="Filter listings">
        <div className="explore-sidebar-title">
          <h2>Filters</h2>
          {dirty && <IconAction className="explore-sidebar-reset" icon="refresh" label="Clear all filters" onClick={reset} />}
        </div>
        {filterError && <div className="explore-sidebar-error" role="alert">
          <p>{filterError}</p>
          <button type="button" className="btn ghost" disabled={filtersLoading}
            onClick={() => void loadFilterOptions()}>{filtersLoading ? 'Retrying…' : 'Retry'}</button>
        </div>}
        <section className="explore-sidebar-section" aria-labelledby="explore-filter-type-title">
          <h3 id="explore-filter-type-title">Listing type</h3>
          <div className="explore-checkbox-options" role="radiogroup" aria-labelledby="explore-filter-type-title">
            {([['', 'All listings'], ['physical_product', 'Products'], ['service', 'Services']] as const).map(([value, label]) =>
              <label key={value} className="explore-checkbox-choice">
                <input type="radio" name="explore-listing-type" checked={f.type === value}
                  onChange={() => set('type')({ target: { value } })} />
                <span>{label}</span>
              </label>)}
          </div>
        </section>
        <section className="explore-sidebar-section" aria-labelledby="explore-filter-campus-title">
          <h3 id="explore-filter-campus-title">Campus</h3>
          <div className="explore-checkbox-options" role="radiogroup" aria-labelledby="explore-filter-campus-title">
            <label className="explore-checkbox-choice">
              <input type="radio" name="explore-campus" checked={f.campusId === ''}
                onChange={() => set('campusId')({ target: { value: '' } })} />
              <span>All campuses</span>
            </label>
            {(allCampusesOpen ? campuses : campusPreview).map(c =>
              <label key={c.id} className="explore-checkbox-choice">
                <input type="radio" name="explore-campus" checked={f.campusId === String(c.id)}
                  onChange={() => set('campusId')({ target: { value: String(c.id) } })} />
                <span>{c.name}</span>
              </label>)}
          </div>
          {campuses.length > campusPreview.length &&
            <button type="button" className="explore-sidebar-show-more"
              aria-expanded={allCampusesOpen} onClick={() => setAllCampusesOpen(open => !open)}>
              {allCampusesOpen ? 'Show fewer' : `Show all ${campuses.length} campuses`}
            </button>}
        </section>
        <section className="explore-sidebar-section" aria-labelledby="explore-filter-category-title">
          <h3 id="explore-filter-category-title">Category</h3>
          <div className="explore-checkbox-options" role="radiogroup" aria-labelledby="explore-filter-category-title">
            <label className="explore-checkbox-choice">
              <input type="radio" name="explore-category" checked={f.categoryId === ''}
                onChange={() => set('categoryId')({ target: { value: '' } })} />
              <span>All categories</span>
            </label>
            {(allCategoriesOpen ? availableCats : categoryPreview).map(c =>
              <label key={c.id} className="explore-checkbox-choice">
                <input type="radio" name="explore-category" checked={f.categoryId === String(c.id)}
                  onChange={() => set('categoryId')({ target: { value: String(c.id) } })} />
                <span>{c.name}</span>
              </label>)}
          </div>
          {availableCats.length > categoryPreview.length &&
            <button type="button" className="explore-sidebar-show-more"
              aria-expanded={allCategoriesOpen} onClick={() => setAllCategoriesOpen(open => !open)}>
              {allCategoriesOpen ? 'Show fewer' : `Show all ${availableCats.length} categories`}
            </button>}
        </section>
        {f.type !== 'service' && <section className="explore-sidebar-section" aria-labelledby="explore-filter-condition-title">
          <h3 id="explore-filter-condition-title">Condition</h3>
          <div className="explore-checkbox-options" role="radiogroup" aria-labelledby="explore-filter-condition-title">
            {([['', 'Any condition'], ['new', 'New'], ['like_new', 'Like new'], ['good', 'Good'], ['fair', 'Fair']] as const).map(([value, label]) =>
              <label key={value} className="explore-checkbox-choice">
                <input type="radio" name="explore-condition" checked={f.condition === value}
                  onChange={() => set('condition')({ target: { value } })} />
                <span>{label}</span>
              </label>)}
          </div>
        </section>}
        <section className="explore-sidebar-section" aria-labelledby="explore-filter-price-title">
          <h3 id="explore-filter-price-title">Price range (₱)</h3>
          <div className="explore-sidebar-price">
            <label><span>Minimum</span><input type="number" inputMode="numeric" min={0} step={1}
              placeholder="₱ Min" value={f.minPrice} aria-invalid={Boolean(priceError)}
              aria-describedby={priceError ? 'explore-price-error' : undefined} onChange={set('minPrice')} /></label>
            <label><span>Maximum</span><input type="number" inputMode="numeric" min={0} step={1}
              placeholder="₱ Max" value={f.maxPrice} aria-invalid={Boolean(priceError)}
              aria-describedby={priceError ? 'explore-price-error' : undefined} onChange={set('maxPrice')} /></label>
          </div>
          {priceError && <p className="explore-price-error" id="explore-price-error" role="alert">{priceError}</p>}
        </section>
        <button type="button" className="explore-mobile-filter-done"
          onClick={() => setMobileFiltersOpen(false)}>Show listings</button>
      </aside>
      <div className="explore-content">
        <section className="explore-control-header" aria-label="Explore results controls">
    <div className="results explore-results-toolbar">
      <p className="muted explore-results-count" role="status" aria-live="polite">
        {priceError ? 'Check the price range' : isRefreshing ? (items === null ? 'Searching…' : 'Updating listings…') : error ? 'Could not load listings' : total === null ? 'Searching…' : total === 0 ? 'No listings match' : `${total} listing${total === 1 ? '' : 's'}`}
      </p>
      <div className="explore-sort-control" role="group" aria-label="Sort listings by">
        <span className="explore-sort-label" aria-hidden="true">Sort by</span>
        <div className="explore-sort-options">
          {([
            ['newest', 'Newest'],
            ['price_asc', 'Lowest price'],
            ['price_desc', 'Highest price'],
          ] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={f.sort === value}
              onClick={() => set('sort')({ target: { value } })}>{label}</button>)}
        </div>
      </div>
    </div>
    </section>

    {!isRefreshing && error && <section className="panel stack explore-listing-error" role="alert" aria-label="Listing loading problem">
      <h2>Could not load listings</h2>
      <p className="muted">{error}</p>
      <div className="row"><button type="button" className="btn" onClick={() => setRetryRequest(n => n + 1)}>Retry listings</button></div>
    </section>}
    {items === null && !priceError && skel}
    {items !== null && items.length === 0 && !isRefreshing && !error && !priceError && total !== null && <div className="empty">
      <h2>No listings match</h2>
      <p className="muted">{dirty ? 'Try fewer filters or another campus.' : 'New listings will appear after review.'}</p>
    </div>}
    {items !== null && !error && !priceError && <StoresInResults listings={items} query={loadedSearch} />}
    {items !== null && !priceError && items.length > 0 && <h2 className="sr-only">Listing results</h2>}
    {items !== null && !priceError && items.length > 0 && currentPage <= pageCount && <div className="grid listing-grid explore-results" role="region" aria-label="Explore listing results" aria-busy={isRefreshing}>
      {items.map((l, index) => <ListingCard key={l.id} l={l} priority={index < 2} />)}
    </div>}
    {pageCount > 1 && <nav className="row" aria-label="Listing pages" style={{ justifyContent: 'center', marginTop: '1rem' }}>
      <IconAction className="page-nav-button" icon="chevronLeft" label="Previous page" disabled={currentPage <= 1} onClick={() => navigatePage(currentPage - 1)} />
      <span className="muted" role="status">Page {currentPage} of {pageCount}</span>
      <IconAction className="page-nav-button" icon="chevronRight" label="Next page" disabled={currentPage >= pageCount} onClick={() => navigatePage(currentPage + 1)} />
    </nav>}
      </div>
    </div>
  </>;
}

export function ListingDetail() {
  const { id } = useParams(); const { me, savedIds, toggleSaved } = useMe();
  const navigate = useNavigate();
  const [l, setL] = useState<Listing | null>(null); const [body, setBody] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const [inquiryThreadId, setInquiryThreadId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const loadRequest = useRef(0);
  const [busy, setBusy] = useState(false); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('');
  const loadListing = () => {
    const request = ++loadRequest.current;
    setL(null); setLoadError(null); setInquiryThreadId(null); setNote(''); setErr('');
    api<Listing>(`/listings/${id}`).then(row => { if (request === loadRequest.current) setL(row); })
      .catch(e => { if (request === loadRequest.current) setLoadError(e); });
  };
  useEffect(() => { loadListing(); return () => { loadRequest.current++; }; }, [id]);
  if (loadError && !l) return <section className="panel stack" role="alert">
    <h1>{isPublicNotFound(loadError) ? 'Listing unavailable' : 'Could not load this listing'}</h1>
    <p>{isPublicNotFound(loadError) ? 'This listing may have been removed or is no longer public.' : publicResourceLoadMessage(loadError)}</p>
    <div className="row">{!isPublicNotFound(loadError) && <button type="button" className="btn" onClick={loadListing}>Retry listing</button>}
      <Link className="btn ghost" to="/explore">Browse listings</Link></div>
  </section>;
  if (!l) return <p className="muted" role="status">Loading listing…</p>;
  const loginForListing = `/login?next=${encodeURIComponent(`/listings/${l.id}`)}`;
  // Saved state comes from the shell (one fetch at sign-in), shared with the hearts on every card.
  const saved = savedIds.includes(l.id);
  const isOwner = me?.storeId === l.seller.id;
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const isAvailable = l.availability === 'available';
  const canRequest = Boolean(me && me.roles.length === 0 && me.affiliations.some(a => a.status === 'verified'));
  const send = async () => { setBusy(true); try { const r = await api<{ id: number }>('/inquiries', { body: { listingId: l.id, body } }); setBody(''); setInquiryThreadId(r.id); setNote('Message sent.'); setErr(''); showActionFeedback({ kind: 'success', title: 'Message sent', message: 'Your inquiry was sent to the seller.' }); } catch (e) { setErr(explain(e)); showActionFeedback({ kind: 'error', title: 'Message not sent', message: explain(e) }); } finally { setBusy(false); } };
  const requestTransaction = async () => {
    setBusy(true); setErr('');
    try {
      const created = await api<{ id: number }>('/transactions', { body: { listingId: l.id } });
      showActionFeedback({ kind: 'success', title: 'Request created', message: 'Your request is ready for the seller to review.', presentation: 'center' });
      navigate(`/transactions/${created.id}`);
    } catch (e) {
      setErr(explain(e));
      showActionFeedback({ kind: 'error', title: 'Request not created', message: explain(e) });
    } finally { setBusy(false); }
  };
  const save = async () => {
    if (!me) { navigate(loginForListing); return; }
    setBusy(true);
    try {
      if (await toggleSaved(l.id, !saved)) { setInquiryThreadId(null); setNote(saved ? 'Removed from your saved list.' : 'Saved to your list.'); setErr(''); }
      else setErr('Could not update your saved list. Check you are still signed in.');
    } finally { setBusy(false); }
  };
  const report = async () => { setBusy(true); try { await api('/reports', { body: { listingId: l.id, reason } }); setReason(''); setReporting(false); setInquiryThreadId(null); setNote('Report sent to a campus reviewer.'); setErr(''); showActionFeedback({ kind: 'success', title: 'Report submitted', message: 'A campus reviewer will review your report.', presentation: 'center' }); } catch (e) { setErr(explain(e)); showActionFeedback({ kind: 'error', title: 'Report not submitted', message: explain(e) }); } finally { setBusy(false); } };
  // One button, two homes: over the first photo when there is one, in the action row when there is not.
  const heartLabel = !me ? 'Sign in to save this listing' : saved ? 'Remove from saved' : 'Save for later';
  const heart = <button className="heart-btn" aria-pressed={saved} aria-label={heartLabel}
    title={heartLabel} disabled={busy} onClick={save}>
    <Icon name="heart" filled={saved} size={22} /></button>;
  const isService = l.type === 'service';
  const priceBasisLabel = /[a-z]/i.test(l.priceBasis ?? '') ? l.priceBasis : '';
  const conditionLabel = l.condition ? l.condition.replaceAll('_', ' ') : '';
  return <article className="listing-detail listing-detail-refined">
    <Link className="listing-back" to="/explore"><Icon name="chevronLeft" size={17} /> Browse all listings</Link>
    <div className="listing-detail-layout">
      <ListingGallery key={l.id} photos={l.images} title={l.title}
        saveControl={!staff && !isOwner && (isAvailable || saved) ? heart : undefined} />
      <div className="listing-detail-content">
        <header className="listing-detail-intro">
          <div className="listing-detail-overline">
            <span>{isService ? 'Service' : 'Product'}</span>
            <span className="listing-detail-overline-dot" aria-hidden="true" />
            <span>{l.category.name}</span>
          </div>
          <h1 className="listing-detail-title">{l.title}</h1>
          <div className="listing-detail-price-row">
            <strong className="listing-detail-price">{peso(l.price)}</strong>
            {priceBasisLabel && <span className="listing-detail-price-basis">{priceBasisLabel}</span>}
            <span className={`listing-detail-availability ${isAvailable ? 'is-available' : 'is-unavailable'}`}>
              {isAvailable ? 'Available' : l.availability.replaceAll('_', ' ')}
            </span>
          </div>
          {conditionLabel && <p className="listing-detail-condition">Condition: <strong>{conditionLabel}</strong></p>}
        </header>

        <section className="listing-detail-seller-card" aria-label="Seller information">
          <SellerAvatar name={l.seller.storeName} src={l.seller.avatarUrl} size="medium" />
          <div className="listing-detail-seller-details">
            <span className="listing-detail-seller-kicker">{isService ? 'Service offered by' : 'Listed by'}</span>
            <Link to={`/stores/${l.seller.id}`} className="listing-detail-seller-name">{l.seller.storeName}</Link>
            <span className="listing-detail-seller-location"><Icon name="pin" size={15}/>{l.campus.name}</span>
          </div>
          <Link className="listing-detail-view-store" to={`/stores/${l.seller.id}`}>View store <Icon name="arrow" size={15}/></Link>
        </section>

        <section className="listing-detail-about" aria-labelledby="listing-about-title">
          <h2 id="listing-about-title">About this {isService ? 'service' : 'listing'}</h2>
          <p className="listing-description">{l.description?.trim() || 'No description provided.'}</p>
          {l.handoffNote && <p className="listing-detail-handoff"><Icon name="pin" size={16}/><span><strong>Handoff details:</strong> {l.handoffNote}</span></p>}
        </section>

        {isOwner ? <section className="listing-detail-action-card listing-owner-card" aria-label="Manage your listing">
          <div className="listing-detail-owner-heading"><Icon name="check" size={18}/><strong>This is your listing</strong></div>
          <p>Buyers can view this page and contact your store. To update the details, manage it from My Store.</p>
          {l.status && <span className="listing-detail-owner-status">Status: {l.status.replaceAll('_', ' ')}</span>}
          <Link className="btn listing-detail-primary-action" to="/dashboard">Manage in My Store <Icon name="arrow" size={17}/></Link>
        </section> : staff ? <section className="listing-detail-action-card" aria-label="Staff account notice">
          <h2>Viewing as staff</h2>
          <p>Student purchase and messaging features are not available to staff accounts.</p>
        </section> : <section className="listing-detail-action-card" aria-labelledby="listing-contact-heading">
          <h2 id="listing-contact-heading">{isAvailable ? 'Interested in this listing?' : 'Listing unavailable'}</h2>
          {!isAvailable
            ? <p className="listing-detail-action-help" role="status">This listing is {l.availability.replaceAll('_', ' ')}. New inquiries and requests are currently unavailable.</p>
            : !me ? <div className="listing-detail-signin">
                <p>Sign in with your CPSU account to message the seller or request this {isService ? 'service' : 'item'}.</p>
                <Link className="btn listing-detail-primary-action" to={loginForListing}>Sign in to contact seller</Link>
              </div>
            : <>
                <div className="listing-detail-request-row">
                  <div>
                    <strong>{isService ? 'Request this service' : 'Request this item'}</strong>
                    <p>Send the seller a request to review, then discuss the arrangements in chat.</p>
                  </div>
                  <button type="button" className="btn listing-detail-primary-action" disabled={busy || !canRequest}
                    onClick={() => void requestTransaction()}>{isService ? 'Request service' : 'Request item'}</button>
                </div>
                {!canRequest && <p className="listing-detail-action-help">Requests require a verified CPSU student account.</p>}
                <div className="listing-detail-message-block">
                  <h3>Message the seller</h3>
                  <label className="field listing-detail-message-field">
                    <span>Your message</span>
                    <textarea value={body} onChange={e => setBody(e.target.value)}
                      maxLength={1000} rows={3} placeholder="Hi! Is this still available?" />
                  </label>
                  <div className="listing-detail-message-actions">
                    <button type="button" className="btn ghost" disabled={busy || !body.trim()}
                      onClick={() => void send()}>{busy ? 'Sending…' : 'Send message'}</button>
                    {l.images.length === 0 && (isAvailable || saved) && heart}
                  </div>
                </div>
              </>}
          {me && <div className="listing-detail-report-area">
            <button type="button" className="listing-detail-report-toggle" disabled={busy}
              aria-expanded={reporting} onClick={() => { setReporting(!reporting); setErr(''); }}>
              <Icon name="flag" size={16}/> Report this listing
            </button>
            {reporting && <div className="listing-detail-report-form">
              <label className="field"><span>Reason for reporting</span>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  maxLength={1000} placeholder="Describe the issue (at least 10 characters)" />
              </label>
              <div className="row">
                <button type="button" className="btn danger" disabled={busy || reason.trim().length < 10}
                  onClick={() => void report()}>Send report</button>
                <button type="button" className="btn ghost" disabled={busy}
                  onClick={() => setReporting(false)}>Cancel</button>
              </div>
            </div>}
          </div>}
          {note && <p className="listing-detail-feedback" role="status">{note} {inquiryThreadId !== null &&
            <Link to={`/inquiries/${inquiryThreadId}`}>Open conversation</Link>}</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </section>}
        <p className="listing-detail-safety-note"><Icon name="shield" size={17}/>
          Payment and pickup are arranged directly between students. CPSU Market does not hold payments or deliver items.
        </p>
      </div>
    </div>
  </article>;
}

export function StorePage() {
  const { id, slug } = useParams(); const { me } = useMe(); const navigate = useNavigate();
  const [s, setS] = useState<PublicStorefront | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const loadRequest = useRef(0);
  const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false); const [reportError, setReportError] = useState(''); const [reportNotice, setReportNotice] = useState('');
  const reportLock = useRef(false);
  const followLock = useRef(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followMessage, setFollowMessage] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const chatLock = useRef(false);
  const loadStore = () => {
    const request = ++loadRequest.current;
    setS(null); setLoadError(null);
    const resource = slug ? `/seller-profiles/by-slug/${encodeURIComponent(slug)}` : `/seller-profiles/${id}`;
    api<PublicStorefront>(resource).then(row => {
      if (request !== loadRequest.current) return;
      setS(row);
      if (id || (slug && slug !== row.slug)) navigate(`/store/${encodeURIComponent(row.slug)}`, { replace: true });
    })
      .catch(e => { if (request === loadRequest.current) setLoadError(e); });
  };
  useEffect(() => { loadStore(); return () => { loadRequest.current++; }; }, [id, slug]);
  if (loadError && !s) return <section className="panel stack" role="alert">
    <h1>{isPublicNotFound(loadError) ? 'Store not found' : 'Could not load this store'}</h1>
    <p>{isPublicNotFound(loadError) ? 'This store is not available.' : publicResourceLoadMessage(loadError)}</p>
    <div className="row">{!isPublicNotFound(loadError) && <button type="button" className="btn" onClick={loadStore}>Retry store</button>}
      <Link className="btn ghost" to="/explore">Browse listings</Link></div>
  </section>;
  if (!s) return <p className="muted" role="status">Loading store…</p>;
  const staff = me?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const isOwner = me?.storeId === s.id;
  const publicStorePath = `/store/${encodeURIComponent(s.slug)}`;
  const toggleFollow = async () => {
    if (!me) { navigate(`/login?next=${encodeURIComponent(publicStorePath)}`); return; }
    if (staff || isOwner || followLock.current || !s.follow?.available) return;
    followLock.current = true;
    setFollowBusy(true); setFollowMessage('');
    try {
      const result = await api<{ count: number; isFollowing: boolean }>(`/store-follows/${s.id}`, {
        method: s.follow.isFollowing ? 'DELETE' : 'PUT',
      });
      setS(current => current?.id === s.id ? {
        ...current, follow: { count: result.count, isFollowing: result.isFollowing, available: true },
      } : current);
      setFollowMessage(result.isFollowing ? 'You are following this store.' : 'You unfollowed this store.');
      showActionFeedback({ kind: 'success', title: result.isFollowing ? 'Store followed' : 'Store unfollowed', message: result.isFollowing ? 'You will see updates from this store.' : 'You will no longer receive this store’s updates.' });
      window.dispatchEvent(new Event('store-follow-changed'));
    } catch (error) {
      setFollowMessage(explain(error));
      showActionFeedback({ kind: 'error', title: 'Follow action failed', message: explain(error) });
    } finally {
      followLock.current = false;
      setFollowBusy(false);
    }
  };
  const startStoreChat = async (listingId: number, body: string) => {
    if (!me) {
      navigate(`/login?next=${encodeURIComponent(publicStorePath)}`);
      return;
    }
    if (staff || isOwner || chatLock.current || !s.listings.some(item => item.id === listingId) ||
      !body.trim()) return;
    chatLock.current = true;
    setChatBusy(true); setChatError('');
    try {
      const thread = await api<{ id: number }>('/inquiries', {
        body: { listingId, body: body.trim() },
      });
      navigate(`/inquiries/${thread.id}`);
    } catch (error) {
      setChatError(explain(error));
    } finally {
      chatLock.current = false;
      setChatBusy(false);
    }
  };
  const reportSeller = async () => {
    if (reportLock.current || !me || staff || isOwner || reason.trim().length < 10) return;
    reportLock.current = true; setReportBusy(true); setReportError(''); setReportNotice('');
    try {
      await api('/reports', { body: { sellerProfileId: s.id, reason: reason.trim() } });
      setReason(''); setReporting(false); setReportNotice('Seller report sent to a campus reviewer.');
      showActionFeedback({ kind: 'success', title: 'Store reported', message: 'A campus reviewer will review your report.' });
    } catch (e) { setReportError(explain(e)); showActionFeedback({ kind: 'error', title: 'Report not sent', message: explain(e) }); }
    finally { reportLock.current = false; setReportBusy(false); }
  };
  return <><StorefrontView key={s.id} store={s} isOwner={isOwner}
    canFollow={!staff} onFollow={() => void toggleFollow()} followBusy={followBusy} followMessage={followMessage}
    canChat={!staff && !isOwner} signedIn={Boolean(me)}
    onChatSignIn={() => navigate(`/login?next=${encodeURIComponent(publicStorePath)}`)}
    onChat={(listingId, body) => void startStoreChat(listingId, body)}
    chatBusy={chatBusy} chatError={chatError}
    renderListing={l => <ListingCard key={l.id} l={l} />} />
    {me && !staff && !isOwner && <section className="panel stack" aria-label="Report seller" style={{ maxWidth: '42rem', marginBlock: '1rem' }}>
      <div className="row"><button type="button" className="btn ghost" aria-expanded={reporting} disabled={reportBusy}
        onClick={() => { setReporting(open => !open); setReportError(''); }}>Report this seller</button></div>
      {reporting && <>
        <p className="muted">Report suspected scams, harassment, or rule violations. Describe what happened; reports go to authorized campus reviewers.</p>
        <label className="field">Why are you reporting this seller?
          <textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={1000}
            placeholder="Describe what happened (at least 10 characters)" disabled={reportBusy} />
        </label>
        <div className="row"><button type="button" className="btn danger" disabled={reportBusy || reason.trim().length < 10}
          onClick={() => void reportSeller()}>{reportBusy ? 'Sending report…' : 'Send report'}</button>
          <button type="button" className="btn ghost" disabled={reportBusy} onClick={() => setReporting(false)}>Cancel</button></div>
      </>}
      {reportNotice && <p role="status">{reportNotice}</p>}{reportError && <p className="err" role="alert">{reportError}</p>}
    </section>}
    </>;
}

export function Guidelines() {
  const [content, setContent] = useState<{ body: string; publishedAt: string | null } | null>(null);
  const [error, setError] = useState('');
  const load = () => api<{ body: string; publishedAt: string | null }>('/guidelines').then(r => { setContent(r); setError(''); }).catch(e => setError(explain(e)));
  useEffect(() => { void load(); }, []);
  return <div className="guidelines-content">
    <h1>Marketplace guidelines</h1>
    {error && <p className="err" role="alert">Could not load guidelines: {error} <button className="btn ghost" type="button" onClick={load}>Retry</button></p>}
    {!content && !error && <p className="muted" role="status">Loading guidelines…</p>}
    {content && <><p className="muted">{content.publishedAt ? `Published ${new Date(content.publishedAt).toLocaleDateString('en-PH')}` : 'Draft for discussion. Final rules are set by CPSU before launch.'}</p>
      {content.body.split(/\n/).filter(line => line.trim()).map((line, i) => line.startsWith('# ') ? <h2 key={i}>{line.slice(2)}</h2> : <p key={i}>{line}</p>)}</>}
  </div>;
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
