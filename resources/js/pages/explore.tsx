import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { IconAction } from '@/components/icon-action';
import { Icon } from '@/components/icons';
import { ExploreSearch } from '@/components/listings/explore-search';
import { ListingCard } from '@/components/listings/listing-card';
import { StoresInResults } from '@/components/stores/stores-in-results';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { ApiError, api } from '@/lib/api';
import { categoriesForExplore, cleanExploreQuery, DEFAULT_EXPLORE_FILTERS, exploreAdvancedSummary, explorePriceError, previewExploreOptions, updateExploreQuery, type ExploreCategory, type ExploreFilters } from '@/lib/listings/explore-filters';
import type { Listing } from '@/types/listing';

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
    {Array.from({ length: 8 }, (_, i) => <div key={i} className="listing-card-placeholder" aria-hidden="true">
      <div className="skeleton-block listing-card-placeholder-photo" />
      <div className="listing-card-body">
        <div className="skeleton-block listing-card-placeholder-title" />
        <div className="skeleton-block listing-card-placeholder-detail" />
        <div className="skeleton-block listing-card-placeholder-detail" />
      </div>
    </div>)}
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
    <ExploreSearch />
    <div className="explore-sidebar-layout">
      <aside id="explore-filter-sidebar" className="explore-filter-sidebar"
        data-mobile-open={mobileFiltersOpen} aria-label="Filter listings">
        <div className="explore-sidebar-title">
          <h2>Filters</h2>
          {dirty && <IconAction className="explore-sidebar-reset" icon="refresh" label="Clear all filters" onClick={reset} />}
        </div>
        {filterError && <div className="explore-sidebar-error" role="alert">
          <p>{filterError}</p>
          <LegacyButton type="button" className="ghost" disabled={filtersLoading}
            onClick={() => void loadFilterOptions()}>{filtersLoading ? 'Retrying…' : 'Retry'}</LegacyButton>
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

    {!isRefreshing && error && <Panel as="section" className="stack explore-listing-error" role="alert" aria-label="Listing loading problem">
      <h2>Could not load listings</h2>
      <p className="muted">{error}</p>
      <div className="row"><LegacyButton type="button" className="" onClick={() => setRetryRequest(n => n + 1)}>Retry listings</LegacyButton></div>
    </Panel>}
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
