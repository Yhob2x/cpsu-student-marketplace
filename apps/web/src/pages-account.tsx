import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, explain, peso, setToken, timeAgo } from './api';
import { useMe } from './main';
import { ListingCard, Listing } from './pages-public';
import { Icon } from './icons';

export function Login() {
  const nav = useNavigate(); const location = useLocation(); const { reload } = useMe(); const [err, setErr] = useState('');
  // Deep links from push notifications return only to explicitly allowed in-app paths.
  const requested = new URLSearchParams(location.search).get('next') ?? '';
  const next = /^\/(inquiries\/\d+|transactions(?:\/\d+)?|notifications|profile)$/.test(requested) ? requested : '/';
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget));
    try { const r = await api('/auth/login', { body: d }); setToken(r.accessToken); await reload(); nav(next, { replace: true }); } catch (x) { setErr(explain(x)); }
  };
  return <form className="stack auth-form" onSubmit={go}><h1>Sign in</h1>
    <label className="field">Email
      <input name="email" type="email" placeholder="Your email address" autoComplete="email" required />
    </label>
    <label className="field">Password
      <input name="password" type="password" autoComplete="current-password" required />
    </label>
    {err && <p className="err" role="alert">{err}</p>}<button className="btn">Sign in</button>
    <p className="muted">New here? <Link to="/register">Create an account</Link></p></form>;
}

export function Register() {
  const nav = useNavigate(); const { reload } = useMe(); const [err, setErr] = useState(''); const [campuses, setCampuses] = useState<any[]>([]);
  useEffect(() => { api('/campuses').then(setCampuses).catch(x => setErr(explain(x))); }, []);
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d: any = Object.fromEntries(new FormData(e.currentTarget)); d.campusId = Number(d.campusId);
    try { const r = await api('/auth/register', { body: d }); setToken(r.accessToken); await reload(); nav('/dashboard'); } catch (x) { setErr(explain(x)); }
  };
  return <form className="stack auth-form" onSubmit={go}><h1>Create your account</h1>
    <label className="field">Display name
      <input name="displayName" placeholder="Name shown to others" required minLength={2} maxLength={80} />
    </label>
    <label className="field">Email
      <input name="email" type="email" autoComplete="email" required />
    </label>
    <label className="field">Password (10 or more characters)
      <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
    </label>
    <label className="field">Campus
      <select name="campusId" required defaultValue=""><option value="" disabled>Select a campus</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </label>
    <p className="muted">A campus reviewer confirms you are part of the CPSU community before you can sell. Browsing and messaging work right away.</p>
    {err && <p className="err" role="alert">{err}</p>}<button className="btn">Create account</button></form>;
}

export function Dashboard() {
  const { me, reload } = useMe(); const [listings, setListings] = useState<any[]>([]); const [cats, setCats] = useState<any[]>([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [pending, setPending] = useState<number | null>(null); const [editing, setEditing] = useState<any | null>(null);
  const [listingLoadError, setListingLoadError] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [listingsLoading, setListingsLoading] = useState(false);
  const [creatingListing, setCreatingListing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const createInFlight = useRef(false);
  const editInFlight = useRef(false);
  const load = () => {
    setListingsLoading(true);
    return api('/seller/listings')
      .then(r => { setListings(r); setListingLoadError(''); })
      .catch(x => setListingLoadError(explain(x)))
      .finally(() => setListingsLoading(false));
  };
  useEffect(() => {
    if (me?.storeId) load();
    api('/categories').then(setCats).catch(x => setErr(explain(x)));
  }, [me?.storeId]);
  if (!me) return <p className="muted">Loading</p>;
  const verified = me.affiliations.some(a => a.status === 'verified');
  const createStore = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); try { await api('/seller/store', { body: Object.fromEntries(new FormData(e.currentTarget)) }); await reload(); } catch (x) { setErr(explain(x)); } };
  const photoError = (file?: File) => file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024)
    ? 'Choose a JPEG, PNG or WebP photo no larger than 3 MB.' : '';
  const createListing = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createInFlight.current) return;
    const form = e.currentTarget;
    const d: any = Object.fromEntries(new FormData(form));
    const cat = cats.find(c => c.id === Number(d.categoryId));
    const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
    const invalidPhoto = photoError(file);
    if (invalidPhoto || !cat) { setErr(invalidPhoto || 'Choose a valid category.'); return; }
    createInFlight.current = true;
    setCreatingListing(true); setErr(''); setOk('');
    try {
      const l = await api<{ id: number }>('/seller/listings', { body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null } });
      // Once the server creates a draft, upload failure must not suggest that nothing was saved.
      let uploadFailure = '';
      if (file) {
        try {
          const fd = new FormData(); fd.append('image', file);
          await api(`/seller/listings/${l.id}/media`, { form: fd });
        } catch (x) { uploadFailure = explain(x); }
      }
      form.reset(); setNewCategoryId('');
      await load();
      if (uploadFailure) {
        setErr(`Draft "${d.title}" was saved, but its photo could not upload: ${uploadFailure} Use Edit on that draft below to retry the photo. Do not create another draft.`);
      } else {
        setOk('Draft saved. Submit it for review when you are ready.');
      }
    } catch (x) { setErr(explain(x)); }
    finally { createInFlight.current = false; setCreatingListing(false); }
  };
  const changeAvailability = async (id: number, availability: 'available' | 'reserved' | 'sold'): Promise<boolean> => {
    // Sold is terminal in v1: the listing leaves public search and cannot be relisted, so a mis-picked option must not end it silently.
    if (availability === 'sold' && !window.confirm('Mark this listing as sold? Sold is final — it disappears from public search and cannot be relisted or made available again.')) return false;
    setPending(id);
    try {
      await api(`/seller/listings/${id}/availability`, { method: 'PATCH', body: { availability } });
      setErr(''); setOk(availability === 'sold' ? 'Marked as sold. A sold listing cannot be relisted.' : `Availability updated to ${availability}.`);
      await load();
    } catch (x) { setErr(explain(x)); return false; } finally { setPending(null); }
    return true;
  };
  const removeListing = async (id: number) => {
    if (!window.confirm('Remove this listing? Its conversations and review history will be kept.')) return;
    setPending(id);
    try {
      await api(`/seller/listings/${id}`, { method: 'DELETE' });
      setErr(''); setOk('Listing removed from marketplace browsing.'); await load();
    } catch (x) { setErr(explain(x)); } finally { setPending(null); }
  };
  const submit = async (id: number) => { setPending(id); try { await api(`/seller/listings/${id}/submit`, { method: 'POST', body: {} }); setOk('Submitted. A reviewer will decide soon.'); setErr(''); await load(); } catch (x) { setErr(explain(x)); } finally { setPending(null); } };
  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editInFlight.current || !editing) return;
    const form = e.currentTarget;
    const d: any = Object.fromEntries(new FormData(form));
    const cat = cats.find(c => c.id === Number(d.categoryId));
    const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
    const invalidPhoto = photoError(file);
    if (invalidPhoto || !cat) { setErr(invalidPhoto || 'Choose a valid category.'); return; }
    editInFlight.current = true;
    setSavingEdit(true); setErr(''); setOk('');
    try {
      await api(`/seller/listings/${editing.id}`, { method: 'PATCH', body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null } });
      let uploadFailure = '';
      if (file) {
        try {
          const fd = new FormData(); fd.append('image', file);
          await api(`/seller/listings/${editing.id}/media`, { form: fd });
        } catch (x) { uploadFailure = explain(x); }
      }
      setEditing(null);
      await load();
      if (uploadFailure) setErr(`Listing details were saved, but the photo could not upload: ${uploadFailure} Select Edit below to retry the photo.`);
      else setOk(file ? 'Photo saved. Submit the listing for review again before it appears publicly.' : 'Listing updated.');
    } catch (x) { setErr(explain(x)); }
    finally { editInFlight.current = false; setSavingEdit(false); }
  };
  return <>
    <div className="page-head">
      <div><h1>My store</h1><p className="muted">Create listings, manage drafts, and follow reviewer decisions.</p></div>
    </div>
    <div className="panel"><h2 className="panel-heading-small">CPSU affiliation</h2>{me.affiliations.map(a => <p key={a.id}>{a.campus.name}: <span className={`status ${a.status}`}>{a.status}</span></p>)}
      {!verified && <p className="muted">Pending until a campus reviewer confirms you. You can still browse and message sellers.</p>}</div>
    {err && <p className="err" role="alert">{err}</p>}{ok && <p role="status">{ok}</p>}
    {verified && !me.storeId && <form className="panel stack" onSubmit={createStore}><h2>Open your store</h2>
      <label className="field">Store name<input name="storeName" placeholder="Name students will see" required minLength={2} maxLength={80} /></label>
      <label className="field">Store description<textarea name="description" placeholder="What do you make or offer?" required minLength={10} maxLength={1000} /></label>
      <button className="btn">Open store</button></form>}
    {me.storeId && <>
      <form className="panel stack seller-composer" onSubmit={createListing}><h2>New listing</h2><p className="muted">Add the essential details first. Save your draft, then submit it for review.</p>
        <label className="field">Title<input name="title" placeholder="What are you offering?" required minLength={3} maxLength={120} /></label>
        <label className="field">Category
          <select name="categoryId" required value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)}><option value="" disabled>Select a category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        {cats.find(c => c.id === Number(newCategoryId))?.listingType === 'physical_product' && <label className="field">Product condition<select name="condition" defaultValue="" required><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>}
        <label className="field">Description<textarea name="description" placeholder="Describe it: condition, size, what is included" required minLength={10} maxLength={3000} /></label>
        <div className="row">
          <label className="field">Price (PHP)<input name="price" type="number" min="1" max="1000000" step="1" required /></label>
          <label className="field">Price basis (optional)<input name="priceBasis" placeholder="Per item or per hour" maxLength={40} /></label>
        </div>
        <label className="field">Photo (JPEG, PNG or WebP, up to 3 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="new-photo-policy" /></label>
        <p className="muted" id="new-photo-policy">No pornography, explicit sexual imagery, graphic violence, or other prohibited content. Photos must pass campus reviewer inspection before publication.</p>
        <button className="btn" disabled={creatingListing}>{creatingListing ? 'Saving draft…' : 'Save draft'}</button></form>
      <h2>Your listings</h2>
      {listingsLoading && <p className="muted" role="status">Loading your listings…</p>}
      {listingLoadError && <p className="err" role="alert">Could not load your listings: {listingLoadError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
      {!listingsLoading && !listingLoadError && listings.length === 0 && <p className="muted">No listings yet. Add your first one above.</p>}
      {!listingLoadError && listings.filter(l => !l.deletedAt).map(l => editing?.id === l.id
        ? <form key={l.id} className="panel stack" onSubmit={saveEdit}><h2>Edit listing</h2>
            <label className="field">Title<input name="title" defaultValue={l.title} required minLength={3} maxLength={120} /></label>
            <label className="field">Category
              <select name="categoryId" required value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            {cats.find(c => c.id === Number((editCategoryId || l.categoryId)))?.listingType === 'physical_product' && <label className="field">Product condition<select name="condition" defaultValue={l.condition ?? ''} required><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>}
            <label className="field">Description<textarea name="description" defaultValue={l.description} required minLength={10} maxLength={3000} /></label>
            <div className="row">
              <label className="field">Price (PHP)<input name="price" type="number" min="1" max="1000000" step="1" defaultValue={Number(l.price)} required /></label>
              <label className="field">Price basis (optional)<input name="priceBasis" defaultValue={l.priceBasis} maxLength={40} /></label>
            </div>
            <p className="muted">{l.media.length} of 6 photos{l.media.length >= 6 && ' (limit reached)'}</p>
            <label className="field">Add photo (JPEG, PNG or WebP, up to 3 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={l.media.length >= 6} aria-describedby="edit-photo-policy" /></label>
            <p className="muted" id="edit-photo-policy">Explicit or harmful photos are prohibited. Adding a photo to a published listing returns it to draft for another campus review.</p>
            <div className="row"><button className="btn" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</button><button type="button" className="btn ghost" disabled={savingEdit} onClick={() => setEditing(null)}>Cancel</button></div></form>
        : <div key={l.id} className="panel row"><div style={{ flex: 1 }}><h3>{l.title}</h3><span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span> <span>{peso(Number(l.price))}</span></div>
            {!['pending_review', 'suspended', 'rejected'].includes(l.status) && l.availabilityState !== 'sold' && <button className="btn ghost" onClick={() => { setEditing(l); setEditCategoryId(String(l.categoryId)); setErr(''); setOk(''); }}>Edit</button>}
            {['draft', 'changes_requested'].includes(l.status) && <button className="btn" disabled={pending === l.id} onClick={() => submit(l.id)}>{pending === l.id ? 'Submitting…' : 'Submit for review'}</button>}
            {l.status === 'published' && <><span className="status">{l.availabilityState || 'available'}</span>{l.availabilityState !== 'sold' && <select aria-label={`Availability for ${l.title}`} value={l.availabilityState || 'available'} disabled={pending === l.id} onChange={async e => { const next = e.target.value as 'available' | 'reserved' | 'sold'; if (!(await changeAvailability(l.id, next))) e.target.value = l.availabilityState || 'available'; }}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold (final)</option></select>}</>}
            <button type="button" className="btn ghost" disabled={pending === l.id} onClick={() => removeListing(l.id)}>Remove</button></div>)}
    </>}
  </>;
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
  const { me } = useMe();
  // User-scoped: wait for the restored session instead of racing it.
  const load = () => api('/inquiries').then(r => { setRows(r); setError(''); }).catch(x => setError(explain(x)));
  useEffect(() => { if (me) load(); }, [me?.id]);
  return <section className="messages-page">
    <div className="page-head messages-heading">
      <div><h1>Messages</h1><p className="muted">Your conversations with other CPSU students about listings.</p></div>
      <Link className="btn ghost" to="/explore">Browse listings</Link>
    </div>
    {rows === null && !error && <p className="muted" role="status">Loading conversations…</p>}
    {error && <div className="empty" role="alert"><h2>Messages could not load</h2><p className="muted">{error}</p><button type="button" className="btn" onClick={load}>Try again</button></div>}
    {rows?.length === 0 && !error && <div className="empty"><h2>No conversations yet</h2><p className="muted">Explore listings and send a seller a question to start a conversation.</p><Link className="btn" to="/explore">Explore listings</Link></div>}
    {!error && <div className="inquiry-list">{rows?.map(t => <Link key={t.id} to={`/inquiries/${t.id}`} className="inquiry-row">
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

type ConversationListing = {
  id: number; title: string; type: 'physical_product' | 'service'; price: number;
  priceBasis: string | null; condition: string | null;
  availability: 'available' | 'reserved' | 'sold' | 'unavailable'; imageUrl: string | null;
};

// One listing-context card per thread, before its first message. It is not an order,
// and it never implies that CPSU handles payments, delivery, or a sale.
function ConversationListingCard({ listing }: { listing: ConversationListing }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageUrl = listing.imageUrl;
  const showPhoto = !!imageUrl && failedImage !== imageUrl;
  const availability = listing.availability === 'available' ? 'Available'
    : listing.availability === 'reserved' ? 'Reserved'
    : listing.availability === 'sold' ? 'Sold' : 'Listing unavailable';
  const kind = listing.type === 'service' ? 'Service' : 'Product';

  return <article className="conversation-listing-card" aria-label="Listing discussed in this conversation">
    <div className="conversation-listing-head">
      <span>Listing details</span>
      <span className="conversation-listing-kind">{kind}</span>
    </div>
    <div className="conversation-listing-content">
      <div className="conversation-listing-photo">
        {showPhoto
          ? <img src={imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailedImage(imageUrl)} />
          : <span className="conversation-listing-photo-empty"><Icon name="tag" size={21} />
              <small>{imageUrl ? 'Photo unavailable' : 'No photo'}</small></span>}
      </div>
      <div className="conversation-listing-info">
        <strong title={listing.title}>{listing.title}</strong>
        <div className="conversation-listing-price">
          <b>{peso(listing.price)}</b>
          {listing.priceBasis && <span>{listing.priceBasis}</span>}
        </div>
        <div className="conversation-listing-meta">
          {listing.condition && <span>{listing.condition.replaceAll('_', ' ')}</span>}
          <span className={listing.availability === 'available' ? 'is-available' : ''}>{availability}</span>
        </div>
      </div>
    </div>
    <div className="conversation-listing-foot">
      <span>Listing ID: <strong>#{listing.id}</strong></span>
      {listing.availability !== 'unavailable' && <Link to={`/listings/${listing.id}`}>View listing <Icon name="arrow" size={14} /></Link>}
    </div>
  </article>;
}

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
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const lastPing = useRef(0);
  const pageRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const syncKeyboardRef = useRef<() => void>(() => {});

  // On phones whose keyboard overlays (rather than resizes) the layout viewport,
  // reserve scroll space and bring the reply field above the visible keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const editing = document.activeElement?.id === 'conversation-reply';
      const keyboardSpace = editing ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      pageRef.current?.style.setProperty('--chat-keyboard-space', `${Math.round(keyboardSpace)}px`);
      if (editing && keyboardSpace > 100 && composerRef.current) {
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
      syncKeyboardRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    let active = true;
    let newestRequest = 0;
    followLatest.current = true;
    firstFetchRef.current = false;
    messageIdsRef.current.clear();
    newlyArrivedRef.current.clear();
    seenConfirmedRef.current = 0;
    seenPendingRef.current = 0;
    setD(null); setLoadError(''); setSendError(''); setBody('');
    const refresh = async () => {
      const request = ++newestRequest;
      try {
        const next = await api(`/inquiries/${id}/messages`);
        if (active && request === newestRequest) {
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
    return () => { active = false; newestRequest++; clearInterval(timer); refreshRef.current = async () => {}; };
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

  // Keep new messages in view unless someone has scrolled up to read an older part of the thread.
  useEffect(() => {
    const log = logRef.current;
    if (log && followLatest.current) log.scrollTop = log.scrollHeight;
  }, [d?.thread?.id, d?.messages?.length]);

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

  const send = async () => {
    const message = body.trim();
    if (busy || !message || !d || d.thread.status === 'closed') return;
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
  return <section className="conversation-page" ref={pageRef}>
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
        {closed && <span className="status closed">Closed</span>}
        <Link className="btn ghost" to={`/listings/${d.thread.listingId}`}>View listing <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
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
      {d.typing && !closed && <div className="typing-indicator" role="status" aria-label="The other student is typing">
        <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
        <span>Typing…</span>
      </div>}
    </div>
    {d.handoff && <aside className="handoff-panel">
      <Icon name="pin" size={19} />
      <div><strong>Handoff arrangement</strong>
        <p>{d.handoff.method.replaceAll('_', ' ')} · {d.handoff.timeWindow} · {d.handoff.generalLocation}</p>
        <span className="status">{d.handoff.status.replaceAll('_', ' ')}</span>
      </div>
    </aside>}
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
  // savedIds in deps: unsaving a card here removes it from this list immediately.
  useEffect(() => { if (me) load(); }, [me?.id, savedIds]);
  return <><h1>Saved</h1>
    {rows === null && !error && <p className="muted" role="status">Loading saved listings…</p>}
    {error && <p className="err" role="alert">Could not load saved listings: {error} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {rows?.length === 0 && !error && <p className="muted">Nothing saved yet. Use Save on a listing to keep it here.</p>}
    {!error && <div className="grid listing-grid">{rows?.map(l => <ListingCard key={l.id} l={l} />)}</div>}
  </>;
}
