import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, explain, peso, setToken, timeAgo } from './api';
import { useMe } from './main';
import { showActionFeedback } from './action-feedback';
import { assessListingReadability } from './listing-quality';
import { categoriesForKind, categoryMatchesKind, type ListingKind } from './listing-categories';
import { useForegroundRefresh } from './foreground-refresh';
import { decodeMeetupLocation, openStreetMapPinUrl } from './meetup-location';
import { ListingCard, Listing } from './pages-public';
import { ConversationListingCard } from './conversation-listing-card';
import { StoreFollowers } from './store-followers';
import { StoreAppreciation } from './store-appreciation';
import { SellerAvatar } from './seller-avatar';
import './storefront.css';
import { Icon } from './icons';
import { IconAction } from './icon-action';
import { EmptyState, ErrorState, LoadingState } from './components/ui/screen-state';
import { ListingCardsSkeleton, OperationProgress } from './components/ui/async-feedback';
import { MAX_LISTING_PHOTOS, selectedPhotosError, uploadListingPhotos } from './listing-photo-uploads';
import { coverFirst } from './photo-cover-order';
import { ExistingPhotoChoices, SelectedPhotoPreviews } from './selected-photo-previews';
import { runExclusive } from './auth-submit';
import { safeLoginReturn } from './auth-return';
import { authFieldForError, type AuthField } from './auth-field-error';
import { hasNewIncomingMessage, messageReceiveSoundEnabled, playMessageReceiveSound, prepareMessageReceiveSound, setMessageReceiveSoundEnabled, unlockMessageReceiveSound } from './message-receive-sound';

function HandoffPlace({ location }: { location: string }) {
  const { place, point } = decodeMeetupLocation(location);
  return <>{place}{point && <> · <a href={openStreetMapPinUrl(point)} target="_blank"
    rel="noopener noreferrer">Open meetup map</a></>}</>;
}

export function Login() {
  const nav = useNavigate(); const location = useLocation(); const { reload } = useMe(); const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const emailRef = useRef<HTMLInputElement>(null); const passwordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const submitLock = useRef(false);
  const next = safeLoginReturn(new URLSearchParams(location.search).get('next'));
  const clearField = (field: AuthField) => setFieldErrors(previous => ({ ...previous, [field]: '' }));
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget));
    await runExclusive(submitLock, async () => {
      setBusy(true); setErr(''); setFieldErrors({});
      try {
        const r = await api('/auth/login', { body: d }); setToken(r.accessToken);
        const current = await reload();
        const staff = current?.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
        const reviewer = current?.roles.some(role => ['campus_reviewer', 'university_admin'].includes(role.role));
        nav(next === '/' && staff ? reviewer ? '/admin' : '/profile' : next, { replace: true });
      } catch (x) {
        const field = authFieldForError('login', x);
        if (field) {
          setFieldErrors({ [field]: explain(x) });
          requestAnimationFrame(() => (field === 'password' ? passwordRef : emailRef).current?.focus());
        } else setErr(explain(x));
      }
      finally { setBusy(false); }
    });
  };
  return <form className="stack auth-form" aria-busy={busy} onSubmit={go}><h1>Sign in</h1>
    <label className="field">Email
      <input ref={emailRef} name="email" type="email" placeholder="Your email address" autoComplete="email" required
        aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, email: 'Enter a valid email address.' }))}
        onChange={() => clearField('email')} />
    </label>
    {fieldErrors.email && <p className="field-error" id="login-email-error" role="alert">{fieldErrors.email}</p>}
    <label className="field">Password
      <input ref={passwordRef} name="password" type="password" autoComplete="current-password" required
        aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, password: 'Enter your password.' }))}
        onChange={() => clearField('password')} />
    </label>
    {fieldErrors.password && <p className="field-error" id="login-password-error" role="alert">{fieldErrors.password}</p>}
    {err && <p className="err" role="alert">{err}</p>}<button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <p className="muted">New here? <Link to={next === '/' ? '/register' : `/register?next=${encodeURIComponent(next)}`}>Create an account</Link></p></form>;
}

export function Register() {
  const nav = useNavigate(); const location = useLocation(); const { reload } = useMe();
  const next = safeLoginReturn(new URLSearchParams(location.search).get('next'));
  const [err, setErr] = useState(''); const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const emailRef = useRef<HTMLInputElement>(null); const campusRef = useRef<HTMLSelectElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fullNameRef = useRef<HTMLInputElement>(null); const idNumberRef = useRef<HTMLInputElement>(null);
  const [identityStatus, setIdentityStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');
  const identityRequest = useRef(0);
  const [campusStatus, setCampusStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [campusError, setCampusError] = useState('');
  const campusRequest = useRef(0);
  const [busy, setBusy] = useState(false); const submitLock = useRef(false);
  const clearField = (field: AuthField) => setFieldErrors(previous => ({ ...previous, [field]: '' }));
  const loadCampuses = () => {
    const request = ++campusRequest.current;
    setCampusStatus('loading'); setCampusError('');
    api<{ id: number; name: string }[]>('/campuses').then(rows => {
      if (request !== campusRequest.current) return;
      setCampuses(rows);
      if (rows.length) setCampusStatus('ready');
      else { setCampusStatus('error'); setCampusError('No active campuses are available right now.'); }
    }).catch(x => {
      if (request !== campusRequest.current) return;
      setCampusStatus('error'); setCampusError(explain(x));
    });
  };
  useEffect(() => { loadCampuses(); return () => { campusRequest.current++; }; }, []);
  const loadIdentityPolicy = () => {
    const request = ++identityRequest.current;
    setIdentityStatus('checking');
    api<{ studentIdentityRequired: boolean }>('/auth/registration-policy')
      .then(policy => { if (identityRequest.current === request) setIdentityStatus(policy.studentIdentityRequired ? 'active' : 'inactive'); })
      .catch(() => { if (identityRequest.current === request) setIdentityStatus('error'); });
  };
  useEffect(() => { loadIdentityPolicy(); return () => { identityRequest.current++; }; }, []);
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (campusStatus !== 'ready' || (identityStatus !== 'active' && identityStatus !== 'inactive')) return;
    const d: any = Object.fromEntries(new FormData(e.currentTarget)); d.campusId = Number(d.campusId);
    await runExclusive(submitLock, async () => {
      setBusy(true); setErr(''); setFieldErrors({});
      try { const r = await api('/auth/register', { body: d }); setToken(r.accessToken); await reload(); nav(next === '/' ? '/dashboard' : next, { replace: true }); }
      catch (x) {
        const field = authFieldForError('register', x);
        if (field) {
          setFieldErrors({ [field]: explain(x) });
          requestAnimationFrame(() => {
            const target = field === 'campusId' ? campusRef : field === 'password' ? passwordRef
              : field === 'fullName' ? fullNameRef : field === 'studentIdNumber' ? idNumberRef : emailRef;
            target.current?.focus();
          });
        } else setErr(explain(x));
      }
      finally { setBusy(false); }
    });
  };
  return <form className="stack auth-form" aria-busy={busy} onSubmit={go}><h1>Create your account</h1>
    <label className="field">Display name
      <input name="displayName" placeholder="Name shown to others" required minLength={2} maxLength={80}
        aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={fieldErrors.displayName ? 'register-name-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, displayName: 'Enter a name with at least 2 characters.' }))}
        onChange={() => clearField('displayName')} />
    </label>
    {fieldErrors.displayName && <p className="field-error" id="register-name-error" role="alert">{fieldErrors.displayName}</p>}
    <label className="field">Email
      <input ref={emailRef} name="email" type="email" autoComplete="email" required
        aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, email: 'Enter a valid email address.' }))}
        onChange={() => clearField('email')} />
    </label>
    {fieldErrors.email && <p className="field-error" id="register-email-error" role="alert">{fieldErrors.email}</p>}
    <label className="field">Password (10 or more characters)
      <input ref={passwordRef} name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128}
        aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, password: 'Use 10 to 128 characters.' }))}
        onChange={() => clearField('password')} />
    </label>
    {fieldErrors.password && <p className="field-error" id="register-password-error" role="alert">{fieldErrors.password}</p>}
    <label className="field">Campus
      <select ref={campusRef} name="campusId" required defaultValue="" disabled={campusStatus !== 'ready'}
        aria-invalid={Boolean(fieldErrors.campusId)} aria-describedby={fieldErrors.campusId ? 'register-campus-error' : undefined}
        onInvalid={() => setFieldErrors(previous => ({ ...previous, campusId: 'Choose your campus.' }))}
        onChange={() => clearField('campusId')}><option value="" disabled>Select a campus</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </label>
    {fieldErrors.campusId && <p className="field-error" id="register-campus-error" role="alert">{fieldErrors.campusId}</p>}
    {campusStatus === 'loading' && <p className="muted" role="status">Loading campuses…</p>}
    {campusStatus === 'error' && <div className="stack" role="alert"><p className="err">Campus options could not load. {campusError}</p>
      <button type="button" className="btn ghost" onClick={loadCampuses}>Retry campuses</button></div>}
    {identityStatus === 'active' && <fieldset className="register-identity-fields" aria-describedby="register-private-identity-info">
      <legend>Private student verification details</legend>
      <p className="muted" id="register-private-identity-info">These details are kept private and do not automatically verify your CPSU affiliation.</p>
      <label className="field">Full name
        <input ref={fullNameRef} name="fullName" autoComplete="name" placeholder="Your full name for campus verification"
          required minLength={2} maxLength={120} aria-invalid={Boolean(fieldErrors.fullName)}
          aria-describedby={fieldErrors.fullName ? 'register-full-name-error register-private-identity-info' : 'register-private-identity-info'}
          onInvalid={() => setFieldErrors(previous => ({ ...previous, fullName: 'Enter your full name.' }))}
          onChange={() => clearField('fullName')} />
      </label>
      {fieldErrors.fullName && <p className="field-error" id="register-full-name-error" role="alert">{fieldErrors.fullName}</p>}
      <label className="field">Student ID number
        <input ref={idNumberRef} name="studentIdNumber" type="text" inputMode="text" autoComplete="off"
          placeholder="Enter your CPSU student ID number" required minLength={3} maxLength={48}
          aria-invalid={Boolean(fieldErrors.studentIdNumber)}
          aria-describedby={fieldErrors.studentIdNumber ? 'register-student-id-error register-private-identity-info' : 'register-private-identity-info'}
          onInvalid={() => setFieldErrors(previous => ({ ...previous, studentIdNumber: 'Enter your student ID number as printed by CPSU.' }))}
          onChange={() => clearField('studentIdNumber')} />
      </label>
      {fieldErrors.studentIdNumber && <p className="field-error" id="register-student-id-error" role="alert">{fieldErrors.studentIdNumber}</p>}
    </fieldset>}
    {identityStatus === 'error' && <div className="stack" role="alert"><p className="err">Could not check registration requirements.</p>
      <button type="button" className="btn ghost" onClick={loadIdentityPolicy}>Retry registration check</button></div>}
    <p className="muted">You can browse and message now. A campus reviewer must verify you before you can sell.</p>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn" disabled={busy || campusStatus !== 'ready' || (identityStatus !== 'active' && identityStatus !== 'inactive')}>{busy ? 'Creating account…' : 'Create account'}</button>
    {identityStatus === 'inactive' && <p className="register-identity-note"><Icon name="shield" size={17} /><span><strong>Student ID and full name aren't collected yet.</strong> Identity collection is awaiting CPSU privacy approval. You can create an account without them.</span></p>}
    {identityStatus === 'checking' && <p className="muted" role="status">Checking private registration requirements…</p>}
  </form>;
}

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

type RepeatListing = { id: number; type: ListingKind; categoryId: number; title: string; description: string; price: number; priceBasis?: string | null; condition?: string | null };

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
      const l = await api<{ id: number }>('/seller/listings', { body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null } });
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
      await api(`/seller/listings/${editing.id}`, { method: 'PATCH', body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null } });
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
          <button type="button" className="btn store-new-listing-action" onClick={openListingComposer}>
            <Icon name="plus" size={18} /> {repeatListing ? 'Continue draft' : 'New listing'}
          </button>
          <Link className="btn ghost" to={`/stores/${me.storeId}`}>View public store</Link>
          <Link className="btn ghost" to="/profile#store-profile">Store settings</Link>
        </div>
      </div>
      <div className="storefront-facts">
        <div><span>Your listings</span><strong>{listingsLoading || listingLoadError ? '—' : visibleListings.length.toLocaleString('en-PH')}</strong></div>
        <StoreFollowers key={me.id} storeId={me.storeId} />
        <StoreAppreciation storeId={me.storeId} readOnly />
        {campus && <div><span>Campus</span><strong>{campus.campus.name}</strong></div>}
      </div>
    </section> : <div className="page-head store-workspace-head">
      <div className="store-workspace-title">
        <h1>My store</h1>
        <p className="muted">Manage listings and see who follows your store.</p>
      </div>
    </div>}
    {!me.storeId && <div className="panel store-affiliation">
      <h2 className="panel-heading-small">CPSU affiliation</h2>
      {me.affiliations.map(a => <p key={a.id}>{a.campus.name} <span className={`status ${a.status}`}>{a.status}</span></p>)}
      {!verified && <p className="muted">A campus reviewer must verify you before you can sell.</p>}
    </div>}
    {err && <p className="err" role="alert">{err}</p>}{ok && <p role="status">{ok}</p>}
    {verified && !me.storeId && <form className="panel stack" onSubmit={createStore}><h2>Open your store</h2>
      <label className="field">Store name<input name="storeName" placeholder="Name students will see" required minLength={2} maxLength={80} /></label>
      <label className="field">Store description<textarea name="description" placeholder="What do you make or offer?" required minLength={10} maxLength={1000} /></label>
      <button className="btn">Open store</button></form>}
    {me.storeId && <>
      <details className="panel store-create" ref={createDetails}><summary><span>{repeatListing ? 'Sell again' : 'New listing'}</span><span className="store-create-hint">Save a draft</span></summary>
      <form key={repeatListing?.id ?? 'new'} className="stack seller-composer listing-composer" onChange={() => setCreateDirty(true)} onSubmit={createListing}>
        <div className="listing-composer-intro"><span>YOUR NEXT LISTING</span><p>{repeatListing ? 'Create a fresh draft from this sold listing. The original stays sold.' : 'Add the details, save your draft, then submit it for campus review.'}</p></div>
        {categoriesError && <p className="err" role="alert">Could not load categories: {categoriesError} <button type="button" className="btn ghost" onClick={() => { void loadCategories(); }}>Retry categories</button></p>}
        {categoriesLoading && <p className="muted" role="status">Loading categories…</p>}
        {repeatListing && <button type="button" className="btn ghost store-start-blank" onClick={startBlankListing}>Start blank instead</button>}
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
        <label className="field">Title<input ref={createTitle} name="title" placeholder={newListingKind === 'service' ? 'e.g. Portrait photography for graduation' : 'e.g. Used Calculus textbook, 2nd edition'} defaultValue={repeatListing?.title ?? ''} required minLength={3} maxLength={120} /></label>
        <p className="muted listing-editor-guidance">Write the actual item or service name, not just “Product” or “Service”. Avoid placeholder text or repeated letters; include useful details to help students decide.</p>
        <label className="field">Category
          <select name="categoryId" required disabled={!newListingKind || categoriesLoading || Boolean(categoriesError) || creatingListing} value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)}>
            <option value="" disabled>{!newListingKind ? 'Choose Product or Service first' : `Select a ${newListingKind === 'service' ? 'service' : 'product'} category`}</option>
            {categoriesForKind(cats, newListingKind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {newListingKind && !categoriesLoading && !categoriesError && categoriesForKind(cats, newListingKind).length === 0 && <p className="err" role="alert">No {newListingKind === 'service' ? 'service' : 'product'} categories are available. Try reloading categories.</p>}
        {newListingKind === 'physical_product' && <label className="field">Product condition<select name="condition" defaultValue={repeatListing?.condition ?? ''} required disabled={creatingListing}><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>}
        <label className="field">Description<textarea name="description" placeholder={newListingKind === 'service' ? 'Explain what you offer, what is included and when you are available' : 'Describe the item, its condition, size and what is included'} defaultValue={repeatListing?.description ?? ''} required minLength={10} maxLength={3000} rows={4} /></label>
        <div className="row">
          <label className="field">Price (PHP)<input name="price" type="number" min="1" max="1000000" step="1" defaultValue={repeatListing ? Number(repeatListing.price) : ''} required /></label>
          <label className="field">Price basis (optional)<input name="priceBasis" placeholder={newListingKind === 'service' ? 'e.g. Per hour or per project' : 'e.g. Per item or per set'} defaultValue={repeatListing?.priceBasis ?? ''} maxLength={40} /></label>
        </div>
        <label className="field">Photos (select up to {MAX_LISTING_PHOTOS}, JPEG, PNG or WebP, 3 MB each) <input name="image" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={creatingListing} aria-describedby="new-photo-policy" onChange={e => { const photos = Array.from(e.currentTarget.files ?? []); setNewFiles(photos); setNewCoverIndex(0); setNewSelectionError(selectedPhotosError(photos)); }} /></label>
        <p className="muted" role="status">{newFiles.length} of {MAX_LISTING_PHOTOS} photos selected</p>{newSelectionError && <p className="err" role="alert">{newSelectionError}</p>}
        {!newSelectionError && <SelectedPhotoPreviews files={newFiles} coverIndex={newCoverIndex} onCoverChange={setNewCoverIndex} disabled={creatingListing} />}
        {creatingListing && <OperationProgress stage={saveStage} progress={photoProgress} />}
        <div className="listing-photo-policy" id="new-photo-policy">
          <p><strong>Drafts do not need photos.</strong> Add 1–{MAX_LISTING_PHOTOS} photos before submitting for review. Select your cover before saving; it uploads first.</p>
          <p><Icon name="shield" size={17} /> Show the actual item or your own service work. Do not use unrelated photos or misleading promotional images. Pornography, sexual imagery, graphic violence and other prohibited content are not allowed; campus reviewers check photos before publication.</p>
        </div>
        <div className="listing-composer-footer"><p>Saving creates a private draft, not a public listing.</p><button className="btn" disabled={creatingListing || categoriesLoading || Boolean(categoriesError) || (newListingKind !== '' && categoriesForKind(cats, newListingKind).length === 0)}>{creatingListing ? 'Saving draft…' : 'Save draft'}</button></div></form></details>
      <div className="store-listings-head"><div><h2 ref={listingsHeading} tabIndex={-1}>Your listings</h2></div>{!listingsLoading && !listingLoadError && <span className="store-listing-count">{visibleListings.length} {visibleListings.length === 1 ? 'listing' : 'listings'}</span>}</div>
      {listingsLoading && <ListingCardsSkeleton />}
      {listingLoadError && <p className="err" role="alert">Could not load your listings: {listingLoadError} <button type="button" className="btn ghost" onClick={() => { void load(); }}>Retry</button></p>}
      {!listingsLoading && !listingLoadError && visibleListings.length === 0 && <div className="panel store-empty"><h3>No listings yet</h3><p className="muted">Create a draft, then submit it for campus review.</p></div>}
      {!listingsLoading && !listingLoadError && visibleListings.length > 0 && <>
        <div className="store-listing-filters">
          <label className="field">Find a listing<input type="search" value={listingQuery} onChange={e => { setListingQuery(e.target.value); setListingPage(1); }} placeholder="Search by title" /></label>
          <label className="field">Status<select value={listingStatus} onChange={e => { setListingStatus(e.target.value); setListingPage(1); }}><option value="all">All statuses</option><option value="draft">Draft</option><option value="changes_requested">Changes requested</option><option value="pending_review">Pending review</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label>
        </div>
        {matchingListings.length === 0 ? <div className="panel store-empty"><h3>No matching listings</h3><p className="muted">Try another title or status to find your listing.</p><button type="button" className="btn ghost" onClick={() => { setListingQuery(''); setListingStatus('all'); setListingPage(1); }}>Clear filters</button></div> : <p className="store-listing-range" role="status">Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, matchingListings.length)} of {matchingListings.length} {matchingListings.length === 1 ? 'listing' : 'listings'}</p>}
      </>}
      {!listingsLoading && !listingLoadError && pageListings.length > 0 && <div className="store-card-grid">{pageListings.map(l => editing?.id === l.id
        ? <form key={l.id} className="panel stack store-edit-form" onChange={() => setEditDirty(true)} onSubmit={saveEdit}><h2>Edit listing</h2>
            {categoriesError && <p className="err" role="alert">Could not load categories: {categoriesError} <button type="button" className="btn ghost" onClick={() => { void loadCategories(); }}>Retry categories</button></p>}
            <label className="field">Title<input name="title" defaultValue={l.title} required minLength={3} maxLength={120} /></label>
            {assessListingReadability(l.title, l.description).length > 0 && <div className="listing-editor-guidance" role="note">
              <strong>Improve this listing before resubmitting:</strong>
              <ul>{assessListingReadability(l.title, l.description).map(issue => <li key={issue}>{issue}</li>)}</ul>
            </div>}
            <label className="field">Category
              <select name="categoryId" required disabled={categoriesLoading || Boolean(categoriesError)} value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            {cats.find(c => c.id === Number((editCategoryId || l.categoryId)))?.listingType === 'physical_product' && <label className="field">Product condition<select name="condition" defaultValue={l.condition ?? ''} required><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>}
            <label className="field">Description<textarea name="description" defaultValue={l.description} required minLength={10} maxLength={3000} /></label>
            <div className="row">
              <label className="field">Price (PHP)<input name="price" type="number" min="1" max="1000000" step="1" defaultValue={Number(l.price)} required /></label>
              <label className="field">Price basis (optional)<input name="priceBasis" defaultValue={l.priceBasis} maxLength={40} /></label>
            </div>
            <p className="muted">{l.media.length} {l.media.length === 1 ? 'photo' : 'photos'} · {MAX_LISTING_PHOTOS} maximum{l.media.length >= MAX_LISTING_PHOTOS && ' (limit reached)'}</p>
            <ExistingPhotoChoices media={l.media} coverMediaId={editCover?.source === 'existing' ? editCover.id : null}
              onCoverChange={id => { setEditCover({ source: 'existing', id }); setEditDirty(true); }} disabled={savingEdit} />
            <label className="field">Add photos (JPEG, PNG or WebP, 3 MB each) <input name="image" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={savingEdit || l.media.length >= MAX_LISTING_PHOTOS} aria-describedby="edit-photo-policy" onChange={e => {
              const photos = Array.from(e.currentTarget.files ?? []);
              setEditFiles(photos); setEditSelectionError(selectedPhotosError(photos, l.media.length));
              setEditCover(previous => previous?.source === 'existing' ? previous : l.media.length
                ? { source: 'existing', id: l.media.slice().sort((a: any, b: any) => a.position - b.position || a.id - b.id)[0].id }
                : photos.length ? { source: 'new', index: 0 } : null);
            }} /></label>
             <p className="muted" role="status">{editFiles.length} new {editFiles.length === 1 ? 'photo' : 'photos'} selected · {Math.max(0, MAX_LISTING_PHOTOS - l.media.length)} remaining</p>{editSelectionError && <p className="err" role="alert">{editSelectionError}</p>}
            {!editSelectionError && <SelectedPhotoPreviews files={editFiles} coverIndex={editCover?.source === 'new' ? editCover.index : -1}
              onCoverChange={index => { setEditCover({ source: 'new', index }); setEditDirty(true); }} disabled={savingEdit} />}
            {savingEdit && <OperationProgress stage={saveStage} progress={photoProgress} />}
            <p className="muted" id="edit-photo-policy">Choose a cover from existing or new photos. Explicit or harmful images are prohibited. Adding photos to a published listing sends it back for review.</p>
            <div className="row"><button className="btn" disabled={savingEdit || categoriesLoading || Boolean(categoriesError)}>{savingEdit ? 'Saving…' : 'Save changes'}</button><button type="button" className="btn ghost" disabled={savingEdit} onClick={() => closeEditor()}>Cancel</button></div></form>
        : <article key={l.id} id={`store-listing-${l.id}`} tabIndex={-1} className="panel store-listing"><StoreListingPhoto media={l.media} title={l.title} type={l.type} /><div className="store-listing-main"><div className="store-listing-title"><h3>{l.title}</h3><strong>{peso(Number(l.price))}</strong></div><p className="store-listing-category">{l.category?.name}</p><div className="store-listing-meta"><span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span>{l.status === 'published' && <span className="status">{l.availabilityState || 'available'}</span>}</div>
            <p className="muted store-listing-help">{l.status === 'draft' ? 'Draft only · submit for campus review when ready.' : l.status === 'changes_requested' ? 'Changes requested · edit and resubmit for review.' : l.status === 'pending_review' ? 'Waiting for a campus reviewer.' : l.status === 'published' ? l.availabilityState === 'sold' ? 'Sold · use Sell again to make a new draft.' : 'Published · manage availability below.' : l.status === 'rejected' ? 'Not approved for publication.' : l.status === 'suspended' ? 'Removed from public browsing by a reviewer.' : 'Check this listing’s review status.'}</p>{l.status === 'published' && <Link className="store-listing-view" to={`/listings/${l.id}`}>View listing <Icon name="arrow" size={15} /></Link>}</div>
            <div className="store-listing-actions">{!['pending_review', 'suspended', 'rejected'].includes(l.status) && l.availabilityState !== 'sold' && <IconAction className="store-edit-action" icon="edit" label={`Edit ${l.title}`} onClick={() => openEditor(l)} />}
            {['draft', 'changes_requested'].includes(l.status) && <button type="button" className="btn" disabled={pending === l.id} onClick={() => submit(l.id)}>{pending === l.id ? 'Submitting…' : 'Submit for review'}</button>}
            {l.status === 'published' && l.availabilityState !== 'sold' && <select aria-label={`Availability for ${l.title}`} value={l.availabilityState || 'available'} disabled={pending === l.id} onChange={async e => { const next = e.target.value as 'available' | 'reserved' | 'sold'; if (!(await changeAvailability(l.id, next))) e.target.value = l.availabilityState || 'available'; }}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold (final)</option></select>}
            {l.status === 'published' && l.availabilityState === 'sold' && <button type="button" className="btn" aria-label={`Sell ${l.title} again`} disabled={creatingListing} onClick={() => sellAgain(l)}>Sell again</button>}
            <button type="button" className="btn ghost store-remove" disabled={pending === l.id} onClick={() => removeListing(l.id)}>Remove</button></div></article>)}</div>}
      {!listingsLoading && !listingLoadError && pageCount > 1 && <nav className="store-pagination" aria-label="Your listings pages"><IconAction className="page-nav-button" icon="chevronLeft" label="Previous listings page" disabled={currentPage === 1} onClick={() => changeListingPage(currentPage - 1)} /><span>Page {currentPage} of {pageCount}</span><IconAction className="page-nav-button" icon="chevronRight" label="Next listings page" disabled={currentPage === pageCount} onClick={() => changeListingPage(currentPage + 1)} /></nav>}
    </>}
  </div>;
}

type ReceiptState = 'sent' | 'delivered' | 'read';

function MessageReceipt({ state, compact = false }: { state: ReceiptState; compact?: boolean }) {
  const label = state === 'read' ? 'Read' : state === 'delivered' ? 'Delivered' : 'Sent';
  return <span className={`message-receipt ${state === 'read' ? 'is-read' : ''} ${compact ? 'is-compact' : ''}`}
    title={label}>
    <Icon name={state === 'sent' ? 'check' : 'checks'} size={compact ? 14 : 15} />
    <span>{label}</span>
  </span>;
}

function messageDayKey(iso: string) { return new Date(iso).toDateString(); }
function messageDayLabel(iso: string) {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

export function Inquiries() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [receiveSoundOn, setReceiveSoundOn] = useState(messageReceiveSoundEnabled);
  const knownMessageIdsRef = useRef<Set<number>>(new Set());
  const inboxLoadedRef = useRef(false);
  const foregroundRef = useRef(false);
  const requestRef = useRef(0);
  const { me } = useMe();
  // Poll only while this inbox is mounted. Do not sound on first history load,
  // own messages, repeated results, or the first catch-up after backgrounding.
  const load = async () => {
    const request = ++requestRef.current;
    try {
      const next = await api<any[]>('/inquiries');
      if (request !== requestRef.current) return;
      const focused = document.visibilityState === 'visible' && document.hasFocus();
      const latest = next.flatMap(t => t.lastMessage ? [{ id: t.lastMessage.id, mine: t.lastMessage.mine }] : []);
      if (hasNewIncomingMessage(latest, knownMessageIdsRef.current,
        inboxLoadedRef.current, focused && foregroundRef.current)) playMessageReceiveSound();
      for (const message of latest) knownMessageIdsRef.current.add(message.id);
      inboxLoadedRef.current = true;
      foregroundRef.current = focused;
      setRows(next); setError('');
    } catch (e) {
      if (request === requestRef.current) setError(explain(e));
    }
  };
  useEffect(() => {
    if (!me) return;
    knownMessageIdsRef.current.clear();
    inboxLoadedRef.current = false;
    foregroundRef.current = document.visibilityState === 'visible' && document.hasFocus();
    prepareMessageReceiveSound();
    const onBlur = () => { foregroundRef.current = false; };
    const onVisibility = () => { if (document.visibilityState !== 'visible') foregroundRef.current = false; };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 5000);
    return () => {
      requestRef.current++;
      window.clearInterval(timer);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [me?.id]);
  return <section className="messages-page"
    onPointerDownCapture={() => unlockMessageReceiveSound()}
    onKeyDownCapture={e => { if (e.key === 'Enter' || e.key === ' ') unlockMessageReceiveSound(); }}>
    <div className="page-head messages-heading">
      <div><h1>Messages</h1></div>
      <div className="messages-audio-actions">
        <button type="button" className="btn ghost conversation-sound-toggle"
          aria-label={receiveSoundOn ? 'Sound on — mute incoming message sound' : 'Sound off — enable incoming message sound'}
          aria-pressed={receiveSoundOn}
          onClick={() => {
            const enabled = !receiveSoundOn;
            setReceiveSoundOn(enabled);
            setMessageReceiveSoundEnabled(enabled);
            if (enabled) unlockMessageReceiveSound();
          }}>
          <Icon name="bell" size={17} /> {receiveSoundOn ? 'Sound on' : 'Sound off'}
        </button>
        <Link className="btn ghost" to="/explore">Browse listings</Link>
      </div>
    </div>
    {rows === null && !error && <LoadingState>Loading conversations…</LoadingState>}
    {error && rows === null && <ErrorState title="Messages could not load" retry={load} retryText="Try again">{error}</ErrorState>}
    {error && rows !== null && <ErrorState title="Could not refresh messages" retry={load} compact>{error}</ErrorState>}
    {rows?.length === 0 && !error && <EmptyState title="No conversations yet" action={<Link className="btn" to="/explore">Explore listings</Link>}>Explore listings and send a seller a question to start a conversation.</EmptyState>}
    {rows !== null && rows.length > 0 && <div className="inquiry-list">{rows.map(t => <Link key={t.id} to={`/inquiries/${t.id}`} className="inquiry-row">
      <span className="avatar" aria-hidden="true">{initials(t.otherStudentName || 'Student')}</span>
      <span className="inq-main">
        <span className="inq-top"><strong>{t.otherStudentName || 'Student'}</strong>
          {t.lastMessage && <time dateTime={t.lastMessage.createdAt}>{timeAgo(t.lastMessage.createdAt)}</time>}</span>
        <span className="inq-listing" title={t.listing.title}>About: {t.listing.title}</span>
        <span className="muted inq-preview">{t.lastMessage?.mine ? 'You: ' : ''}{t.lastMessage?.body ?? 'No messages yet.'}</span>
        <span className="inq-details"><span>{t.role === 'buyer' ? 'Buying' : 'Selling'}</span>
          {t.status === 'closed' && <span className="status closed">Closed</span>}
          {t.lastMessage?.mine && <MessageReceipt state={t.lastMessage.receipt ?? 'sent'} compact />}</span>
      </span>
      <span className="inq-open" aria-hidden="true"><Icon name="arrow" size={18} /></span>
    </Link>)}</div>}
  </section>;
}

// First letters of up to two words: "Maria Santos" -> "MS", keeps chat avatars compact.
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

export function Thread() {
  const { id } = useParams();
  const { syncUnread } = useMe();
  const [d, setD] = useState<any>(null);
  const messageIdsRef = useRef<Set<number>>(new Set());
  const newlyArrivedRef = useRef<Set<number>>(new Set());
  const firstFetchRef = useRef(false);
  const seenConfirmedRef = useRef(0);
  const seenPendingRef = useRef(0);
  const [body, setBody] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const [safetyNotice, setSafetyNotice] = useState('');
  const closeLock = useRef(false);
  const [receiveSoundOn, setReceiveSoundOn] = useState(messageReceiveSoundEnabled);
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const lastPing = useRef(0);
  const pageRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const syncKeyboardRef = useRef<() => void>(() => {});

  useEffect(() => { prepareMessageReceiveSound(); }, []);

  // On phones whose keyboard overlays (rather than resizes) the layout viewport,
  // reserve scroll space and bring the reply field above the visible keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const editing = document.activeElement?.id === 'conversation-reply';
      const keyboardSpace = editing ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      pageRef.current?.style.setProperty('--chat-keyboard-space', `${Math.round(keyboardSpace)}px`);
      // On mobile, fit the entire conversation into the visible viewport when
      // Safari overlays the keyboard. Never rely on scrolling the whole page.
      if (window.matchMedia('(max-width: 860px)').matches) {
        if (editing && keyboardSpace > 100) {
          document.body.style.setProperty('--chat-visible-height', `${Math.round(viewport.height)}px`);
        } else {
          document.body.style.removeProperty('--chat-visible-height');
        }
      } else if (editing && keyboardSpace > 100 && composerRef.current) {
        const bottom = composerRef.current.getBoundingClientRect().bottom;
        const visibleBottom = viewport.offsetTop + viewport.height;
        if (bottom > visibleBottom - 8) window.scrollBy({ top: Math.ceil(bottom - visibleBottom + 12), behavior: 'auto' });
      }
    };
    syncKeyboardRef.current = sync;
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      document.body.style.removeProperty('--chat-visible-height');
      syncKeyboardRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    let active = true;
    let newestRequest = 0;
    // Suppress catch-up ringing on first focus after the chat was backgrounded.
    let continuouslyForeground = document.visibilityState === 'visible' && document.hasFocus();
    const onBlur = () => { continuouslyForeground = false; };
    const onVisibility = () => { if (document.visibilityState !== 'visible') continuouslyForeground = false; };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    followLatest.current = true;
    firstFetchRef.current = false;
    messageIdsRef.current.clear();
    newlyArrivedRef.current.clear();
    seenConfirmedRef.current = 0;
    seenPendingRef.current = 0;
    setD(null); setLoadError(''); setSendError(''); setBody('');
    setCloseConfirm(false); setSafetyError(''); setSafetyNotice('');
    const refresh = async () => {
      const request = ++newestRequest;
      try {
        const next = await api(`/inquiries/${id}/messages`);
        if (active && request === newestRequest) {
          // Only NEW incoming messages ring: never the first history load,
          // outgoing sends, repeated polls, or background/refocus catch-up.
          const focused = document.visibilityState === 'visible' && document.hasFocus();
          if (hasNewIncomingMessage(next.messages, messageIdsRef.current,
            firstFetchRef.current, focused && continuouslyForeground)) playMessageReceiveSound();
          continuouslyForeground = focused;
          // Animate only messages arriving after the first history load.
          for (const message of next.messages) {
            if (firstFetchRef.current && !messageIdsRef.current.has(message.id)) newlyArrivedRef.current.add(message.id);
            messageIdsRef.current.add(message.id);
          }
          firstFetchRef.current = true;
          setD(next);
          setLoadError('');
        }
      } catch (e) {
        if (active && request === newestRequest) setLoadError(explain(e));
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    return () => {
      active = false; newestRequest++; clearInterval(timer);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      refreshRef.current = async () => {};
    };
  }, [id]);

  // Foreground chat presence only. A background or unfocused tab never sends a heartbeat.
  // The API expires presence after 25 seconds, and only this conversation's participants can see it.
  useEffect(() => {
    if (!id || !d?.thread?.id || d.thread.status === 'closed') return;
    let active = true;
    const heartbeat = async () => {
      if (!active || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      try {
        await api(`/inquiries/${id}/presence`, { body: {} });
        if (active) void refreshRef.current();
      } catch { /* No false online state is produced if the heartbeat fails. */ }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 10000);
    window.addEventListener('focus', heartbeat);
    document.addEventListener('visibilitychange', heartbeat);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', heartbeat);
      document.removeEventListener('visibilitychange', heartbeat);
    };
  }, [id, d?.thread?.id, d?.thread?.status]);

  // Follow the newest message AND typing state only while the student is at
  // the latest end of the chat; never pull them away from older messages.
  useEffect(() => {
    const log = logRef.current;
    if (log && followLatest.current) log.scrollTop = log.scrollHeight;
  }, [d?.thread?.id, d?.messages?.length, d?.typing]);

  // Keyboard, browser chrome and device rotation can change the log height
  // without adding a message. Keep the latest row anchored unless reading back.
  useEffect(() => {
    const log = logRef.current;
    if (!log || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followLatest.current) log.scrollTop = log.scrollHeight;
    });
    observer.observe(log);
    return () => observer.disconnect();
  }, [d?.thread?.id]);

  // Read receipts are only acknowledged for incoming messages at least half visible
  // in the active conversation. Scrolling never marks messages farther down as read.
  useEffect(() => {
    const log = logRef.current;
    if (!log || !d || !id) return;
    let active = true;
    const checkVisible = () => {
      if (!active || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const viewport = log.getBoundingClientRect();
      let highest = 0;
      for (const row of log.querySelectorAll<HTMLElement>('[data-incoming-id]')) {
        const messageId = Number(row.dataset.incomingId);
        const bounds = row.getBoundingClientRect();
        const intersection = Math.max(0, Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top));
        if (intersection >= bounds.height * 0.5) highest = Math.max(highest, messageId);
      }
      if (!highest || highest <= seenConfirmedRef.current || highest <= seenPendingRef.current) return;
      seenPendingRef.current = highest;
      void api(`/inquiries/${id}/seen`, { body: { upToId: highest } })
        .then(() => {
          if (!active) return;
          seenConfirmedRef.current = Math.max(seenConfirmedRef.current, highest);
          void syncUnread();
          const seenAt = new Date().toISOString();
          setD((prev: any) => prev?.thread?.id === Number(id) ? {
            ...prev, messages: prev.messages.map((m: any) =>
              !m.mine && m.id <= highest ? { ...m, seenAt, receipt: 'read' } : m),
          } : prev);
        })
        .catch(() => { /* Retry when messages refresh or the recipient returns to the tab. */ })
        .finally(() => {
          // A poll can replace this observer while the acknowledgment is in flight.
          // Always release its pending watermark so later visible messages can be acknowledged.
          if (seenPendingRef.current === highest) seenPendingRef.current = 0;
        });
    };
    const observer = new IntersectionObserver(checkVisible, { root: log, threshold: [0, 0.5, 1] });
    log.querySelectorAll<HTMLElement>('[data-incoming-id]').forEach(row => observer.observe(row));
    document.addEventListener('visibilitychange', checkVisible);
    window.addEventListener('focus', checkVisible);
    checkVisible();
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', checkVisible);
      window.removeEventListener('focus', checkVisible);
    };
  }, [id, d?.messages]);

  const closeConversation = async () => {
    if (closeLock.current || busy || !d || d.thread.status === 'closed') return;
    closeLock.current = true; setClosing(true); setSafetyError(''); setSafetyNotice('');
    try {
      await api(`/inquiries/${id}/close`, { body: {} });
      // Immediately remove the composer; the next refresh confirms server state.
      setD((prev: any) => prev?.thread?.id === Number(id)
        ? { ...prev, thread: { ...prev.thread, status: 'closed' }, typing: false }
        : prev);
      setCloseConfirm(false);
      setSafetyNotice('Conversation ended. Previous messages remain available.');
      await refreshRef.current();
    } catch (e) { setSafetyError(explain(e)); }
    finally { closeLock.current = false; setClosing(false); }
  };

  const send = async () => {
    const message = body.trim();
    if (busy || closing || closeConfirm || !message || !d || d.thread.status === 'closed') return;
    // Sending a message must be silent. Only newly received messages ring.
    setBusy(true); setSendError('');
    try {
      await api(`/inquiries/${id}/messages`, { body: { body: message } });
      setBody('');
      followLatest.current = true;
      await refreshRef.current();
    } catch (e) { setSendError(explain(e)); }
    finally { setBusy(false); }
  };
  const ping = () => {
    if (!d || d.thread.status === 'closed') return;
    const now = Date.now();
    if (now - lastPing.current < 2000) return;
    lastPing.current = now;
    api(`/inquiries/${id}/typing`, { body: {} }).catch(() => {});
  };

  if (loadError && !d) return <section className="conversation-page">
    <Link to="/inquiries" className="conversation-back">Back to messages</Link>
    <div className="empty" role="alert"><h1>Conversation unavailable</h1><p className="muted">{loadError}</p>
      <button className="btn" type="button" onClick={() => void refreshRef.current()}>Try again</button></div>
  </section>;
  if (!d) return <p className="muted" role="status">Loading conversation…</p>;

  const closed = d.thread.status === 'closed';
  const lastMineId = [...d.messages].reverse().find((m: any) => m.mine)?.id;
  const otherStudentName = d.thread.otherStudentName || 'Other student';
  return <section className="conversation-page" ref={pageRef}
    onPointerDownCapture={() => unlockMessageReceiveSound()}
    onKeyDownCapture={e => { if (e.key === 'Enter' || e.key === ' ') unlockMessageReceiveSound(); }}>
    <Link to="/inquiries" className="conversation-back">← Back to messages</Link>
    <div className={`conversation-heading ${closed ? 'is-closed' : ''}`}>
      <div className="conversation-heading-info">
        <h1>{otherStudentName}</h1>
        {!closed && <p className={`conversation-presence ${d.otherActiveInChat ? 'is-online' : ''}`}
          role="status" aria-label={d.otherActiveInChat ? `${otherStudentName} active in this chat` : `${otherStudentName} not currently active in this chat`}>
          <span className="presence-dot" aria-hidden="true" />
          {d.otherActiveInChat ? 'Online' : 'Not active in chat'}
        </p>}
      </div>
      <div className="conversation-actions">
        {!closed && <button type="button" className="btn ghost conversation-sound-toggle"
          aria-pressed={receiveSoundOn} aria-label={receiveSoundOn ? 'Sound on — mute incoming message sound' : 'Sound off — enable incoming message sound'}
          onClick={() => { const enabled = !receiveSoundOn; setReceiveSoundOn(enabled); setMessageReceiveSoundEnabled(enabled); if (enabled) unlockMessageReceiveSound(); }}>
          <Icon name="bell" size={17} /> {receiveSoundOn ? 'Sound on' : 'Sound off'}
        </button>}
        {closed && <span className="status closed">Closed</span>}
        {!closed && <button type="button" className="btn ghost" disabled={closing || busy}
          aria-label="End conversation" aria-expanded={closeConfirm} onClick={() => { setCloseConfirm(open => !open); setSafetyError(''); }}>
          End chat
        </button>}
        <Link className="btn ghost" to={`/listings/${d.thread.listingId}`}>View listing <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
    {closeConfirm && !closed && <div className="panel stack" role="group" aria-label="End conversation confirmation">
      <h2>End this conversation for both students?</h2>
      <p className="muted">Neither of you can send more messages in this listing's conversation. Previous messages stay readable. This does not block the student on other listings or cancel any transaction.</p>
      <div className="row"><button type="button" className="btn danger" disabled={closing || busy}
        onClick={() => void closeConversation()}>{closing ? 'Ending…' : 'Yes, end conversation'}</button>
        <button type="button" className="btn ghost" disabled={closing} onClick={() => setCloseConfirm(false)}>Keep chatting</button></div>
    </div>}
    {safetyError && <p className="err" role="alert">Could not end conversation: {safetyError}</p>}
    {safetyNotice && <p role="status">{safetyNotice}</p>}
    {loadError && <p className="err" role="alert">Could not refresh messages: {loadError}</p>}
    <div className="thread-scroll conversation-log" ref={logRef} role="log" tabIndex={0} aria-label="Conversation messages" aria-live="polite"
      onScroll={e => { const el = e.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {d.messages.length > 0 && <div className="message-day-divider"><span>{messageDayLabel(d.messages[0].createdAt)}</span></div>}
      {d.listing && <ConversationListingCard key={d.listing.id} listing={d.listing} />}
      {d.messages.length === 0 && <p className="muted">No messages yet. Start by asking a question about the listing.</p>}
      {d.messages.map((m: any, i: number) => {
        const before = d.messages[i - 1];
        const showDay = !!before && messageDayKey(before.createdAt) !== messageDayKey(m.createdAt);
        const grouped = !!before && before.mine === m.mine && !showDay;
        const showLastTime = i === d.messages.length - 1;
        const fullStamp = new Date(m.createdAt).toLocaleString('en-PH', {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        });
        return <div className="message-segment" key={m.id}>
          {showDay && <div className="message-day-divider">
            <span>{messageDayLabel(m.createdAt)}</span></div>}
          <div className={`msg-row ${m.mine ? 'mine' : ''} ${grouped ? 'is-grouped' : ''} ${newlyArrivedRef.current.has(m.id) ? 'is-new' : ''}`}
            data-incoming-id={m.mine || m.seenAt ? undefined : m.id}>
            <div className="message-stack">
              <div className={`msg ${m.mine ? 'mine' : ''}`} role="group"
                aria-label={m.mine ? `Your message, ${fullStamp}` : `Message from ${m.author}, ${fullStamp}`}
                title={fullStamp}>
                <div className="message-text">{m.body}</div>
                {showLastTime && <small className="message-time"><time dateTime={m.createdAt}>
                  {new Date(m.createdAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                </time></small>}
              </div>
              {m.mine && m.id === lastMineId && <MessageReceipt key={String(m.id) + '-' + String(m.receipt ?? 'sent')} state={m.receipt ?? 'sent'} />}
            </div>
          </div>
        </div>;
      })}
    </div>
    {d.handoff && <aside className="handoff-panel">
      <Icon name="pin" size={19} />
      <div><strong>Handoff arrangement</strong>
        <p>{d.handoff.method.replaceAll('_', ' ')} · {d.handoff.timeWindow} · <HandoffPlace location={d.handoff.generalLocation} /></p>
        <span className="status">{d.handoff.status.replaceAll('_', ' ')}</span>
      </div>
    </aside>}
    {d.typing && !closed && <div className="typing-indicator conversation-typing-dock" role="status"
      aria-label={`${otherStudentName} is typing`}>
      <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
      <span>{otherStudentName} is typing…</span>
    </div>}
    {closed ? <div className="conversation-closed" role="status">This conversation is closed. You can still read the messages above.</div>
      : <form className="chat-bar conversation-composer" ref={composerRef} onSubmit={e => { e.preventDefault(); void send(); }}>
        <label className="conversation-reply-label" htmlFor="conversation-reply">Your message</label>
        <div className="composer-row">
          <textarea id="conversation-reply" rows={2} value={body} onChange={e => { setBody(e.target.value); ping(); }}
            onFocus={() => window.requestAnimationFrame(() => syncKeyboardRef.current())}
            onBlur={() => window.requestAnimationFrame(() => syncKeyboardRef.current())}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            enterKeyHint="send" maxLength={1000} placeholder="Type a message…" />
          <button className="btn chat-send" aria-label={busy ? 'Sending message' : 'Send message'} disabled={busy || !body.trim()}><Icon name="arrow" size={19} /></button>
        </div>
        <div className="composer-help"><span>Enter to send · Shift+Enter for a new line</span>{body.length > 850 && <span>{body.length}/1000</span>}</div>
      </form>}
    {sendError && <p className="err" role="alert">{sendError}</p>}
  </section>;
}

export function Saved() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [error, setError] = useState('');
  const { me, savedIds } = useMe();
  const load = () => api<Listing[]>('/saved').then(r => { setRows(r); setError(''); }).catch(x => setError(explain(x)));
  // Render local saves immediately. Refetching on each optimistic change could race the write.
  useEffect(() => { if (me) void load(); }, [me?.id]);
  const visibleSaved = rows?.filter(listing => savedIds.includes(listing.id));
  return <><h1>Saved</h1>
    {rows === null && !error && <ListingCardsSkeleton />}
    {error && <ErrorState title="Could not load saved listings" retry={load} compact>{error}</ErrorState>}
    {visibleSaved?.length === 0 && !error && <EmptyState compact>Nothing saved yet. Use Save on a listing to keep it here.</EmptyState>}
    {!error && <div className="grid listing-grid">{visibleSaved?.map(l => <ListingCard key={l.id} l={l} />)}</div>}
  </>;
}
