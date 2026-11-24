import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { IconAction } from '@/components/icon-action';
import { Icon } from '@/components/icons';
import { ListingAppreciation } from '@/components/listings/listing-appreciation';
import { ExistingPhotoChoices, SelectedPhotoPreviews } from '@/components/listings/selected-photo-previews';
import { SellerAvatar } from '@/components/stores/seller-avatar';
import { StoreFollowers } from '@/components/stores/store-followers';
import { StorePerformanceSummary } from '@/components/stores/store-performance-summary';
import { ListingCardsSkeleton, OperationProgress } from '@/components/ui/async-feedback';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { api, explain, peso } from '@/lib/api';
import { categoriesForKind, categoryMatchesKind, type ListingKind } from '@/lib/listings/listing-categories';
import { MAX_LISTING_PHOTOS, selectedPhotosError, uploadListingPhotos } from '@/lib/listings/listing-photo-uploads';
import { assessListingReadability } from '@/lib/listings/listing-quality';
import { coverFirst } from '@/lib/listings/photo-cover-order';
import { useMe } from '@/providers/session-provider';

function StoreListingPhoto({ media, title, type }: { media: { id: number; position: number }[]; title: string; type: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const firstPhoto = media.slice().sort((a, b) => a.position - b.position)[0];
  const src = firstPhoto ? `/api/v1/media/${firstPhoto.id}` : null;
  return <div className="store-listing-photo">
    {src && failedSrc !== src
      ? <img src={src} alt={`Photo of ${title}`} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />
      : <span className="store-photo-placeholder"><Icon name="tag" size={28} /><span>{src ? 'Photo unavailable' : 'No photo yet'}</span></span>}
    <span className="store-listing-kind">{type === 'service' ? 'Service' : 'Product'}</span>
  </div>;
}

type RepeatListing = { id: number; type: ListingKind; categoryId: number; title: string; description: string; price: number; priceBasis?: string | null; condition?: string | null; stockQuantity?: number | null };

export function Dashboard() {
  const { me, reload } = useMe(); const [listings, setListings] = useState<any[]>([]); const [cats, setCats] = useState<any[]>([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [ownerStore, setOwnerStore] = useState<{ storeName: string; avatarUrl?: string | null; badge?: string; badgeReason?: string } | null>(null);
  const [ownerStoreLoadError, setOwnerStoreLoadError] = useState(false);
  const [pending, setPending] = useState<number | null>(null); const [editing, setEditing] = useState<any | null>(null);
  const [listingLoadError, setListingLoadError] = useState('');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [newListingKind, setNewListingKind] = useState<ListingKind | ''>('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [listingsLoading, setListingsLoading] = useState(true);
  const [creatingListing, setCreatingListing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newCoverIndex, setNewCoverIndex] = useState(0);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editCover, setEditCover] = useState<{ source: 'existing'; id: number } | { source: 'new'; index: number } | null>(null);
  const [newSelectionError, setNewSelectionError] = useState('');
  const [editSelectionError, setEditSelectionError] = useState('');
  const [photoProgress, setPhotoProgress] = useState<{ completed: number; total: number; startedAt: number; lastCompletedAt: number } | null>(null);
  const [saveStage, setSaveStage] = useState<'saving' | 'uploading' | 'refreshing'>('saving');
  const [listingQuery, setListingQuery] = useState('');
  const [listingStatus, setListingStatus] = useState('all');
  const [listingPage, setListingPage] = useState(1);
  const [repeatListing, setRepeatListing] = useState<RepeatListing | null>(null);
  const [createDirty, setCreateDirty] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const listingRequest = useRef(0);
  const createInFlight = useRef(false);
  const editInFlight = useRef(false);
  const listingsHeading = useRef<HTMLHeadingElement>(null);
  const createDetails = useRef<HTMLDetailsElement>(null);
  const createTitle = useRef<HTMLInputElement>(null);
  const load = (quiet = false) => {
    const request = ++listingRequest.current;
    if (!quiet) setListingsLoading(true);
    return api('/seller/listings')
      .then(r => { if (request === listingRequest.current) { setListings(r); setListingLoadError(''); } })
      .catch(x => { if (request === listingRequest.current) setListingLoadError(explain(x)); })
      .finally(() => { if (request === listingRequest.current) setListingsLoading(false); });
  };
  const loadCategories = () => {
    setCategoriesLoading(true); setCategoriesError('');
    return api<any[]>('/categories').then(result => { setCats(result); setCategoriesError(''); })
      .catch(x => { setCats([]); setCategoriesError(explain(x)); })
      .finally(() => setCategoriesLoading(false));
  };
  useEffect(() => {
    if (me?.storeId) void load();
    void loadCategories();
  }, [me?.storeId]);
  useEffect(() => {
    let active = true;
    setOwnerStore(null); setOwnerStoreLoadError(false);
    if (me?.storeId) void api<{ storeName: string; avatarUrl?: string | null; badge?: string; badgeReason?: string }>('/seller/store')
      .then(store => { if (active) setOwnerStore(store); })
      .catch(() => { if (active) setOwnerStoreLoadError(true); });
    return () => { active = false; };
  }, [me?.storeId]);
  // Review decisions and availability changes appear in My Store with no page refresh.
  // Quiet refreshes preserve the seller's open editor and unsaved form input.
  useForegroundRefresh(() => {
    if (pending === null && !creatingListing && !savingEdit) return load(true);
  }, 6_000, Boolean(me?.storeId));
  if (!me) return <p className="muted">Loading</p>;
  const verified = me.affiliations.some(a => a.status === 'verified');
  const visibleListings = listings.filter(l => !l.deletedAt);
  const matchingListings = visibleListings.filter(l =>
    l.title.toLocaleLowerCase().includes(listingQuery.trim().toLocaleLowerCase()) &&
    (listingStatus === 'all' || l.status === listingStatus));
  const pageSize = 6;
  const pageCount = Math.max(1, Math.ceil(matchingListings.length / pageSize));
  const currentPage = Math.min(listingPage, pageCount);
  const pageListings = matchingListings.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const changeListingPage = (nextPage: number) => {
    setListingPage(nextPage);
    requestAnimationFrame(() => listingsHeading.current?.focus());
  };
  const sellAgain = (listing: RepeatListing) => {
    if (createDirty && !window.confirm('Replace the unsaved details in your new listing form?')) return;
    setRepeatListing(listing);
    setNewListingKind(listing.type);
    setNewCategoryId(String(listing.categoryId));
    setNewFiles([]); setNewCoverIndex(0); setNewSelectionError('');
    setCreateDirty(false);
    if (createDetails.current) createDetails.current.open = true;
    requestAnimationFrame(() => createTitle.current?.focus());
  };
  const openListingComposer = () => {
    if (!createDetails.current) return;
    createDetails.current.open = true;
    requestAnimationFrame(() => {
      createDetails.current?.scrollIntoView({ block: 'start' });
      createTitle.current?.focus({ preventScroll: true });
    });
  };
  const startBlankListing = () => {
    if (createDirty && !window.confirm('Clear the unsaved details in your new listing form?')) return;
    setRepeatListing(null);
    setNewListingKind('');
    setNewCategoryId('');
    setNewFiles([]); setNewCoverIndex(0); setNewSelectionError('');
    setCreateDirty(false);
    requestAnimationFrame(() => createTitle.current?.focus());
  };
  const createStore = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); try { await api('/seller/store', { body: Object.fromEntries(new FormData(e.currentTarget)) }); await reload(); showActionFeedback({ kind: 'success', title: 'Store created', message: 'Your store details were saved.', presentation: 'center' }); } catch (x) { setErr(explain(x)); } };
  const uploadOnePhoto = async (id: number, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api<{ id: number }>(`/seller/listings/${id}/media`, { form: fd });
  };
  const createListing = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createInFlight.current) return;
    const form = e.currentTarget;
    const d: any = Object.fromEntries(new FormData(form));
    const cat = cats.find(c => c.id === Number(d.categoryId));
    const files = coverFirst(newFiles, newCoverIndex);
    const invalidPhotos = selectedPhotosError(files);
    if (invalidPhotos || !categoryMatchesKind(cat, newListingKind)) {
      setErr(invalidPhotos || (!newListingKind ? 'Choose Product or Service first.' : 'Choose a category for the selected listing type.'));
      return;
    }
    createInFlight.current = true;
    setCreatingListing(true); setSaveStage('saving'); setPhotoProgress(null); setErr(''); setOk('');
    try {
      const l = await api<{ id: number }>('/seller/listings', { body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null, stockQuantity: cat.listingType === 'physical_product' ? Number(d.stockQuantity) : undefined } });
      // Once the server creates a draft, upload failure must not suggest that nothing was saved.
      let uploadFailure = '';
      if (files.length) {
        setSaveStage('uploading');
        const result = await uploadListingPhotos(l.id, files, uploadOnePhoto,
          (done, total) => setPhotoProgress(previous => done === 0 || !previous
            ? { completed: 0, total, startedAt: Date.now(), lastCompletedAt: Date.now() } : { ...previous, completed: done, lastCompletedAt: Date.now() }));
        if (result.failedIndex !== null)
          uploadFailure = `${result.uploaded} of ${files.length} photos uploaded. ${explain(result.error)}`;
      }
      setPhotoProgress(null); setSaveStage('refreshing');
      form.reset(); setNewFiles([]); setNewCoverIndex(0); setNewSelectionError('');
      setNewCategoryId(''); setNewListingKind(''); setRepeatListing(null); setCreateDirty(false);
      await load();
      if (uploadFailure) {
        showActionFeedback({ kind: 'warning', title: 'Draft saved with missing photos', message: 'Your draft was saved, but some photos need to be uploaded again.' });
        setErr(`Draft "${d.title}" was saved. ${uploadFailure} Use Edit on that draft to select only the photos that did not upload. Do not create another draft.`);
      } else {
        showActionFeedback({ kind: 'success', title: 'Draft saved', message: 'Submit your listing for review when it is ready.' });
        setOk(files.length ? `Draft saved with ${files.length} ${files.length === 1 ? 'photo' : 'photos'}. Submit it for review when ready.` : 'Draft saved. Add at least one photo before submitting it for review.');
      }
    } catch (x) { setErr(explain(x)); }
    finally { createInFlight.current = false; setCreatingListing(false); setPhotoProgress(null); }
  };
  const changeAvailability = async (id: number, availability: 'available' | 'reserved' | 'sold'): Promise<boolean> => {
    // Sold is terminal in v1: the listing leaves public search and cannot be relisted, so a mis-picked option must not end it silently.
    if (availability === 'sold' && !window.confirm('Mark this listing as sold? Sold is final — it disappears from public search and cannot be relisted or made available again.')) return false;
    setPending(id);
    try {
      await api(`/seller/listings/${id}/availability`, { method: 'PATCH', body: { availability } });
      setErr(''); setOk(availability === 'sold' ? 'Marked as sold. A sold listing cannot be relisted.' : `Availability updated to ${availability}.`);
      showActionFeedback({ kind: 'success', title: availability === 'sold' ? 'Listing marked sold' : 'Availability updated', message: availability === 'sold' ? 'This listing is no longer available to buyers.' : `Listing is now ${availability}.` });
      await load();
    } catch (x) { setErr(explain(x)); return false; } finally { setPending(null); }
    return true;
  };
  const removeListing = async (id: number) => {
    if (!window.confirm('Remove this listing? Its conversations and review history will be kept.')) return;
    setPending(id);
    try {
      await api(`/seller/listings/${id}`, { method: 'DELETE' });
      setErr(''); setOk('Listing removed from marketplace browsing.'); showActionFeedback({ kind: 'success', title: 'Listing removed', message: 'This listing is no longer shown in the marketplace.' }); await load();
    } catch (x) { setErr(explain(x)); } finally { setPending(null); }
  };
  const submit = async (id: number) => { setPending(id); try { await api(`/seller/listings/${id}/submit`, { method: 'POST', body: {} }); setOk('Submitted. A reviewer will decide soon.'); setErr(''); showActionFeedback({ kind: 'success', title: 'Submitted for review', message: 'Your listing has been sent to a campus reviewer.', presentation: 'center' }); await load(); } catch (x) { setErr(explain(x)); } finally { setPending(null); } };
  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editInFlight.current || !editing) return;
    const form = e.currentTarget;
    const d: any = Object.fromEntries(new FormData(form));
    const cat = cats.find(c => c.id === Number(d.categoryId));
    const files = editFiles;
    const coverChoice = editCover;
    const invalidPhotos = selectedPhotosError(files, editing.media.length);
    if (invalidPhotos || !cat) { setErr(invalidPhotos || 'Choose a valid category.'); return; }
    editInFlight.current = true;
    setSavingEdit(true); setSaveStage('saving'); setPhotoProgress(null); setErr(''); setOk('');
    try {
      await api(`/seller/listings/${editing.id}`, { method: 'PATCH', body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null, stockQuantity: cat.listingType === 'physical_product' && editing.stockQuantity != null && d.stockQuantity !== '' ? Number(d.stockQuantity) : undefined } });
      let uploadFailure = '';
      let coverFailure = '';
      const uploadedIds: number[] = [];
      if (files.length) {
        setSaveStage('uploading');
        const result = await uploadListingPhotos(editing.id, files, async (id, file) => {
          const photo = await uploadOnePhoto(id, file);
          uploadedIds.push(photo.id);
        },
          (done, total) => setPhotoProgress(previous => done === 0 || !previous
            ? { completed: 0, total, startedAt: Date.now(), lastCompletedAt: Date.now() } : { ...previous, completed: done, lastCompletedAt: Date.now() }));
        if (result.failedIndex !== null)
          uploadFailure = `${result.uploaded} of ${files.length} new photos uploaded. ${explain(result.error)}`;
      }
      const coverMediaId = coverChoice?.source === 'existing' ? coverChoice.id
        : coverChoice?.source === 'new' ? uploadedIds[coverChoice.index] : null;
      if (coverMediaId) {
        try { await api(`/seller/listings/${editing.id}/media/cover`, { method: 'PATCH', body: { mediaId: coverMediaId } }); }
        catch (x) { coverFailure = `Cover photo was not changed. ${explain(x)}`; }
      }
      setPhotoProgress(null); setSaveStage('refreshing');
      setEditing(null); setEditFiles([]); setEditCover(null); setEditSelectionError(''); setEditDirty(false);
      await load();
      if (uploadFailure || coverFailure) { showActionFeedback({ kind: 'warning', title: 'Listing partially updated', message: 'Details were saved, but some photo changes need attention.' }); setErr(`Listing details were saved. ${uploadFailure ? `${uploadFailure} Select Edit to retry only the remaining photos. ` : ''}${coverFailure}`.trim()); }
      else { showActionFeedback({ kind: 'success', title: 'Listing updated', message: 'Your changes were saved successfully.' }); setOk(files.length ? `${files.length} ${files.length === 1 ? 'photo' : 'photos'} saved. Submit the listing for review again before it appears publicly.` : 'Listing updated.'); }
    } catch (x) { setErr(explain(x)); showActionFeedback({ kind: 'error', title: 'Could not save listing', message: explain(x) }); }
    finally { editInFlight.current = false; setSavingEdit(false); setPhotoProgress(null); }
  };
  const closeEditor = (restoreFocus = true) => {
    if (editDirty && !window.confirm('Discard unsaved changes to this listing?')) return false;
    setEditing(null); setEditFiles([]); setEditCover(null); setEditSelectionError(''); setEditDirty(false);
    if (restoreFocus) requestAnimationFrame(() => document.getElementById(`store-listing-${editing?.id}`)?.focus());
    return true;
  };
  const openEditor = (listing: any) => {
    if (editing && !closeEditor(false)) return;
    setEditing(listing); setEditDirty(false);
    setEditCategoryId(String(listing.categoryId)); setEditFiles([]);
    setEditCover(listing.media.length ? { source: 'existing', id: listing.media.slice().sort((a: any, b: any) => a.position - b.position || a.id - b.id)[0].id } : null);
    setEditSelectionError(''); setErr(''); setOk('');
  };
  const campus = me.affiliations.find(a => a.status === 'verified') ?? me.affiliations[0];
  return <div className="my-store">
    {me.storeId ? <section className="storefront-identity store-dashboard-identity" aria-labelledby="store-dashboard-name">
      <div className="storefront-banner" aria-hidden="true"><Icon name="store" size={32} /></div>
      <div className="storefront-identity-content">
        <div className="storefront-primary">
          <SellerAvatar name={ownerStore?.storeName ?? me.displayName} src={ownerStore?.avatarUrl} size="large" />
          <div className="storefront-primary-text">
            <h1 id="store-dashboard-name">{ownerStore?.storeName ?? 'My store'}</h1>
            {campus && <p className="storefront-campus"><Icon name="pin" size={16} /> {campus.campus.name}</p>}
            <span className="storefront-affiliation" title={ownerStore?.badgeReason}><Icon name={verified ? 'store' : 'shield'} size={14} /> {verified ? (ownerStore?.badge ?? (ownerStoreLoadError ? 'Activity unavailable' : 'Checking activity…')) : 'Verification pending'}</span>
          </div>
        </div>
        <div className="storefront-owner-actions store-dashboard-actions">
          <LegacyButton type="button" className="store-new-listing-action" onClick={openListingComposer}>
            <Icon name="plus" size={18} /> {repeatListing ? 'Continue draft' : 'New listing'}
          </LegacyButton>
          <Link className="btn ghost" to={`/stores/${me.storeId}`}>View public store</Link>
          <Link className="btn ghost" to="/profile#store-profile">Store settings</Link>
        </div>
      </div>
      <div className="storefront-facts">
        <div><span>Your listings</span><strong>{listingsLoading || listingLoadError ? '—' : visibleListings.length.toLocaleString('en-PH')}</strong></div>
        <StoreFollowers key={me.id} storeId={me.storeId} />
        {campus && <div><span>Campus</span><strong>{campus.campus.name}</strong></div>}
      </div>
    </section> : <div className="page-head store-workspace-head">
      <div className="store-workspace-title">
        <h1>My store</h1>
        <p className="muted">Manage listings and see who follows your store.</p>
      </div>
    </div>}
    {me.storeId && <StorePerformanceSummary />}
    {!me.storeId && <Panel className="store-affiliation">
      <h2 className="panel-heading-small">CPSU affiliation</h2>
      {me.affiliations.map(a => <p key={a.id}>{a.campus.name} <span className={`status ${a.status}`}>{a.status}</span></p>)}
      {!verified && <p className="muted">A campus reviewer must verify you before you can sell.</p>}
    </Panel>}
    {err && <p className="err" role="alert">{err}</p>}{ok && <p role="status">{ok}</p>}
    {verified && !me.storeId && <form className="panel stack" onSubmit={createStore}><h2>Open your store</h2>
      <Field className="">Store name<input name="storeName" placeholder="Name students will see" required minLength={2} maxLength={80} /></Field>
      <Field className="">Store description<textarea name="description" placeholder="What do you make or offer?" required minLength={10} maxLength={1000} /></Field>
      <LegacyButton className="">Open store</LegacyButton></form>}
    {me.storeId && <>
      <details className="panel store-create" ref={createDetails}><summary><span>{repeatListing ? 'Sell again' : 'New listing'}</span><span className="store-create-hint">Save a draft</span></summary>
      <form key={repeatListing?.id ?? 'new'} className="stack seller-composer listing-composer" onChange={() => setCreateDirty(true)} onSubmit={createListing}>
        <div className="listing-composer-intro"><span>YOUR NEXT LISTING</span><p>{repeatListing ? 'Create a fresh draft from this sold listing. The original stays sold.' : 'Add the details, save your draft, then submit it for campus review.'}</p></div>
        {categoriesError && <p className="err" role="alert">Could not load categories: {categoriesError} <LegacyButton type="button" className="ghost" onClick={() => { void loadCategories(); }}>Retry categories</LegacyButton></p>}
        {categoriesLoading && <p className="muted" role="status">Loading categories…</p>}
        {repeatListing && <LegacyButton type="button" className="ghost store-start-blank" onClick={startBlankListing}>Start blank instead</LegacyButton>}
        <fieldset className="listing-kind-field" disabled={creatingListing}>
          <legend>What are you listing?</legend>
          <p className="listing-kind-hint">Choose one to see the right categories.</p>
          <div className="listing-kind-options">
            <label className={`listing-kind-option ${newListingKind === 'physical_product' ? 'is-selected' : ''}`}>
              <input type="radio" name="listingKind" value="physical_product" required checked={newListingKind === 'physical_product'} onChange={() => { setNewListingKind('physical_product'); setNewCategoryId(''); }} />
              <Icon name="package" size={22} /><span><strong>Product</strong><small>Items, books, food and supplies</small></span>
            </label>
            <label className={`listing-kind-option ${newListingKind === 'service' ? 'is-selected' : ''}`}>
              <input type="radio" name="listingKind" value="service" required checked={newListingKind === 'service'} onChange={() => { setNewListingKind('service'); setNewCategoryId(''); }} />
              <Icon name="wrench" size={22} /><span><strong>Service</strong><small>Skills, lessons and creative work</small></span>
            </label>
          </div>
        </fieldset>
        <Field className="">Title<input ref={createTitle} name="title" placeholder={newListingKind === 'service' ? 'e.g. Portrait photography for graduation' : 'e.g. Used Calculus textbook, 2nd edition'} defaultValue={repeatListing?.title ?? ''} required minLength={3} maxLength={120} /></Field>
        <p className="muted listing-editor-guidance">Write the actual item or service name, not just “Product” or “Service”. Avoid placeholder text or repeated letters; include useful details to help students decide.</p>
        <Field className="">Category
          <select name="categoryId" required disabled={!newListingKind || categoriesLoading || Boolean(categoriesError) || creatingListing} value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)}>
            <option value="" disabled>{!newListingKind ? 'Choose Product or Service first' : `Select a ${newListingKind === 'service' ? 'service' : 'product'} category`}</option>
            {categoriesForKind(cats, newListingKind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {newListingKind && !categoriesLoading && !categoriesError && categoriesForKind(cats, newListingKind).length === 0 && <p className="err" role="alert">No {newListingKind === 'service' ? 'service' : 'product'} categories are available. Try reloading categories.</p>}
        {newListingKind === 'physical_product' && <Field className="">Stock available<input type="number" name="stockQuantity" min="1" max="100000" step="1" inputMode="numeric" defaultValue={Math.max(1, repeatListing?.stockQuantity ?? 1)} required disabled={creatingListing} /></Field>}
        {newListingKind === 'physical_product' && <Field className="">Product condition<select name="condition" defaultValue={repeatListing?.condition ?? ''} required disabled={creatingListing}><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></Field>}
        <Field className="">Description<textarea name="description" placeholder={newListingKind === 'service' ? 'Explain what you offer, what is included and when you are available' : 'Describe the item, its condition, size and what is included'} defaultValue={repeatListing?.description ?? ''} required minLength={10} maxLength={3000} rows={4} /></Field>
        <div className="row">
          <Field className="">Price (PHP)<input name="price" type="number" min="1" max="1000000" step="1" defaultValue={repeatListing ? Number(repeatListing.price) : ''} required /></Field>
          <Field className="">Price basis (optional)<input name="priceBasis" placeholder={newListingKind === 'service' ? 'e.g. Per hour or per project' : 'e.g. Per item or per set'} defaultValue={repeatListing?.priceBasis ?? ''} maxLength={40} /></Field>
        </div>
        <Field className="">Photos (select up to {MAX_LISTING_PHOTOS}, JPEG, PNG or WebP, 3 MB each) <input name="image" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={creatingListing} aria-describedby="new-photo-policy" onChange={e => { const photos = Array.from(e.currentTarget.files ?? []); setNewFiles(photos); setNewCoverIndex(0); setNewSelectionError(selectedPhotosError(photos)); }} /></Field>
        <p className="muted" role="status">{newFiles.length} of {MAX_LISTING_PHOTOS} photos selected</p>{newSelectionError && <p className="err" role="alert">{newSelectionError}</p>}
        {!newSelectionError && <SelectedPhotoPreviews files={newFiles} coverIndex={newCoverIndex} onCoverChange={setNewCoverIndex} disabled={creatingListing} />}
        {creatingListing && <OperationProgress stage={saveStage} progress={photoProgress} />}
        <div className="listing-photo-policy" id="new-photo-policy">
          <p><strong>Drafts do not need photos.</strong> Add 1–{MAX_LISTING_PHOTOS} photos before submitting for review. Select your cover before saving; it uploads first.</p>
          <p><Icon name="shield" size={17} /> Show the actual item or your own service work. Do not use unrelated photos or misleading promotional images. Pornography, sexual imagery, graphic violence and other prohibited content are not allowed; campus reviewers check photos before publication.</p>
        </div>
        <div className="listing-composer-footer"><p>Saving creates a private draft, not a public listing.</p><LegacyButton className="" disabled={creatingListing || categoriesLoading || Boolean(categoriesError) || (newListingKind !== '' && categoriesForKind(cats, newListingKind).length === 0)}>{creatingListing ? 'Saving draft…' : 'Save draft'}</LegacyButton></div></form></details>
      <div className="store-listings-head"><div><h2 ref={listingsHeading} tabIndex={-1}>Your listings</h2></div>{!listingsLoading && !listingLoadError && <span className="store-listing-count">{visibleListings.length} {visibleListings.length === 1 ? 'listing' : 'listings'}</span>}</div>
      {listingsLoading && <ListingCardsSkeleton />}
      {listingLoadError && <p className="err" role="alert">Could not load your listings: {listingLoadError} <LegacyButton type="button" className="ghost" onClick={() => { void load(); }}>Retry</LegacyButton></p>}
      {!listingsLoading && !listingLoadError && visibleListings.length === 0 && <Panel className="store-empty"><h3>No listings yet</h3><p className="muted">Create a draft, then submit it for campus review.</p></Panel>}
      {!listingsLoading && !listingLoadError && visibleListings.length > 0 && <>
        <div className="store-listing-filters">
          <Field className="">Find a listing<input type="search" value={listingQuery} onChange={e => { setListingQuery(e.target.value); setListingPage(1); }} placeholder="Search by title" /></Field>
          <Field className="">Status<select value={listingStatus} onChange={e => { setListingStatus(e.target.value); setListingPage(1); }}><option value="all">All statuses</option><option value="draft">Draft</option><option value="changes_requested">Changes requested</option><option value="pending_review">Pending review</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></Field>
        </div>
        {matchingListings.length === 0 ? <Panel className="store-empty"><h3>No matching listings</h3><p className="muted">Try another title or status to find your listing.</p><LegacyButton type="button" className="ghost" onClick={() => { setListingQuery(''); setListingStatus('all'); setListingPage(1); }}>Clear filters</LegacyButton></Panel> : <p className="store-listing-range" role="status">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, matchingListings.length)} of {matchingListings.length} {matchingListings.length === 1 ? 'listing' : 'listings'}</p>}
      </>}
      {!listingsLoading && !listingLoadError && pageListings.length > 0 && <div className="store-card-grid">{pageListings.map(l => editing?.id === l.id
        ? <form key={l.id} className="panel stack store-edit-form" onChange={() => setEditDirty(true)} onSubmit={saveEdit}><h2>Edit listing</h2>
            {categoriesError && <p className="err" role="alert">Could not load categories: {categoriesError} <LegacyButton type="button" className="ghost" onClick={() => { void loadCategories(); }}>Retry categories</LegacyButton></p>}
            <Field className="">Title<input name="title" defaultValue={l.title} required minLength={3} maxLength={120} /></Field>
            {assessListingReadability(l.title, l.description).length > 0 && <div className="listing-editor-guidance" role="note">
              <strong>Improve this listing before resubmitting:</strong>
              <ul>{assessListingReadability(l.title, l.description).map(issue => <li key={issue}>{issue}</li>)}</ul>
            </div>}
            <Field className="">Category
              <select name="categoryId" required disabled={categoriesLoading || Boolean(categoriesError)} value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            {l.stockQuantity != null && cats.find(c => c.id === Number((editCategoryId || l.categoryId)))?.listingType === 'physical_product' && <Field className="">Stock available<input name="stockQuantity" type="number" min="0" max="100000" step="1" inputMode="numeric" defaultValue={l.stockQuantity ?? 1} required /></Field>}
            {cats.find(c => c.id === Number((editCategoryId || l.categoryId)))?.listingType === 'physical_product' && <Field className="">Product condition<select name="condition" defaultValue={l.condition ?? ''} required><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></Field>}
            <Field className="">Description<textarea name="description" defaultValue={l.description} required minLength={10} maxLength={3000} /></Field>
            <div className="row">
              <Field className="">Price (PHP)<input name="price" type="number" min="1" max="1000000" step="1" defaultValue={Number(l.price)} required /></Field>
              <Field className="">Price basis (optional)<input name="priceBasis" defaultValue={l.priceBasis} maxLength={40} /></Field>
            </div>
            <p className="muted">{l.media.length} {l.media.length === 1 ? 'photo' : 'photos'} · {MAX_LISTING_PHOTOS} maximum{l.media.length >= MAX_LISTING_PHOTOS && ' (limit reached)'}</p>
            <ExistingPhotoChoices media={l.media} coverMediaId={editCover?.source === 'existing' ? editCover.id : null}
              onCoverChange={id => { setEditCover({ source: 'existing', id }); setEditDirty(true); }} disabled={savingEdit} />
            <Field className="">Add photos (JPEG, PNG or WebP, 3 MB each) <input name="image" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={savingEdit || l.media.length >= MAX_LISTING_PHOTOS} aria-describedby="edit-photo-policy" onChange={e => {
              const photos = Array.from(e.currentTarget.files ?? []);
              setEditFiles(photos); setEditSelectionError(selectedPhotosError(photos, l.media.length));
              setEditCover(previous => previous?.source === 'existing' ? previous : l.media.length
                ? { source: 'existing', id: l.media.slice().sort((a: any, b: any) => a.position - b.position || a.id - b.id)[0].id }
                : photos.length ? { source: 'new', index: 0 } : null);
            }} /></Field>
             <p className="muted" role="status">{editFiles.length} new {editFiles.length === 1 ? 'photo' : 'photos'} selected · {Math.max(0, MAX_LISTING_PHOTOS - l.media.length)} remaining</p>{editSelectionError && <p className="err" role="alert">{editSelectionError}</p>}
            {!editSelectionError && <SelectedPhotoPreviews files={editFiles} coverIndex={editCover?.source === 'new' ? editCover.index : -1}
              onCoverChange={index => { setEditCover({ source: 'new', index }); setEditDirty(true); }} disabled={savingEdit} />}
            {savingEdit && <OperationProgress stage={saveStage} progress={photoProgress} />}
            <p className="muted" id="edit-photo-policy">Choose a cover from existing or new photos. Explicit or harmful images are prohibited. Adding photos to a published listing sends it back for review.</p>
            <div className="row"><LegacyButton className="" disabled={savingEdit || categoriesLoading || Boolean(categoriesError)}>{savingEdit ? 'Saving…' : 'Save changes'}</LegacyButton><LegacyButton type="button" className="ghost" disabled={savingEdit} onClick={() => closeEditor()}>Cancel</LegacyButton></div></form>
        : <Panel as="article" key={l.id} id={`store-listing-${l.id}`} tabIndex={-1} className="store-listing"><StoreListingPhoto media={l.media} title={l.title} type={l.type} /><div className="store-listing-main"><div className="store-listing-title"><h3>{l.title}</h3><strong>{peso(Number(l.price))}</strong></div><p className="store-listing-category">{l.category?.name}</p>{l.type === 'physical_product' && typeof l.stockQuantity === 'number' && <p className="listing-stock-label">{l.stockQuantity} in stock{l.reservedQuantity ? ` · ${l.reservedQuantity} reserved` : ''}</p>}<div className="store-listing-meta">{l.status === 'published' && <span className="seller-listing-appreciations" title="Appreciations for this listing"><ListingAppreciation listingId={l.id} signedIn readOnly compact showCount /> <span>appreciations</span></span>}<span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span>{l.status === 'published' && <span className="status">{l.availabilityState || 'available'}</span>}</div>
            <p className="muted store-listing-help">{l.status === 'draft' ? 'Draft only · submit for campus review when ready.' : l.status === 'changes_requested' ? 'Changes requested · edit and resubmit for review.' : l.status === 'pending_review' ? 'Waiting for a campus reviewer.' : l.status === 'published' ? l.availabilityState === 'sold' ? 'Sold · use Sell again to make a new draft.' : 'Published · manage availability below.' : l.status === 'rejected' ? 'Not approved for publication.' : l.status === 'suspended' ? 'Removed from public browsing by a reviewer.' : 'Check this listing’s review status.'}</p>{l.status === 'published' && <Link className="store-listing-view" to={`/listings/${l.id}`}>View listing <Icon name="arrow" size={15} /></Link>}</div>
            <div className="store-listing-actions">{!['pending_review', 'suspended', 'rejected'].includes(l.status) && l.availabilityState !== 'sold' && <IconAction className="store-edit-action" icon="edit" label={`Edit ${l.title}`} onClick={() => openEditor(l)} />}
            {['draft', 'changes_requested'].includes(l.status) && <LegacyButton type="button" className="" disabled={pending === l.id} onClick={() => submit(l.id)}>{pending === l.id ? 'Submitting…' : 'Submit for review'}</LegacyButton>}
            {l.status === 'published' && l.availabilityState !== 'sold' && <select aria-label={`Availability for ${l.title}`} value={l.availabilityState || 'available'} disabled={pending === l.id} onChange={async e => { const next = e.target.value as 'available' | 'reserved' | 'sold'; if (!(await changeAvailability(l.id, next))) e.target.value = l.availabilityState || 'available'; }}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold (final)</option></select>}
            {l.status === 'published' && l.availabilityState === 'sold' && <LegacyButton type="button" className="" aria-label={`Sell ${l.title} again`} disabled={creatingListing} onClick={() => sellAgain(l)}>Sell again</LegacyButton>}
            <LegacyButton type="button" className="ghost store-remove" disabled={pending === l.id} onClick={() => removeListing(l.id)}>Remove</LegacyButton></div></Panel>)}</div>}
      {!listingsLoading && !listingLoadError && pageCount > 1 && <nav className="store-pagination" aria-label="Your listings pages"><IconAction className="page-nav-button" icon="chevronLeft" label="Previous listings page" disabled={currentPage === 1} onClick={() => changeListingPage(currentPage - 1)} /><span>Page {currentPage} of {pageCount}</span><IconAction className="page-nav-button" icon="chevronRight" label="Next listings page" disabled={currentPage === pageCount} onClick={() => changeListingPage(currentPage + 1)} /></nav>}
    </>}
  </div>;
}
