import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, explain, peso, setToken, timeAgo } from './api';
import { useMe } from './main';
import { ListingCard, Listing } from './pages-public';
import { Icon } from './icons';

export function Login() {
  const nav = useNavigate(); const { reload } = useMe(); const [err, setErr] = useState('');
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget));
    try { const r = await api('/auth/login', { body: d }); setToken(r.accessToken); await reload(); nav('/'); } catch (x) { setErr(explain(x)); }
  };
  return <form className="stack auth-form" onSubmit={go}><h1>Sign in</h1>
    <label className="field">Email
      <input name="email" type="email" placeholder="Your CPSU email" autoComplete="email" required />
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
      <input name="displayName" placeholder="Name shown to others" required minLength={2} />
    </label>
    <label className="field">Email
      <input name="email" type="email" autoComplete="email" required />
    </label>
    <label className="field">Password (10 or more characters)
      <input name="password" type="password" autoComplete="new-password" required minLength={10} />
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
  const createListing = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const d: any = Object.fromEntries(new FormData(form));
    const cat = cats.find(c => c.id === Number(d.categoryId));
    try {
      const l = await api('/seller/listings', { body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null } });
      const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
      if (file) { const fd = new FormData(); fd.append('image', file); await api(`/seller/listings/${l.id}/media`, { form: fd }); }
      form.reset(); setNewCategoryId(''); setErr(''); setOk('Draft saved. Submit it for review when you are ready.'); load();
    } catch (x) { setErr(explain(x)); }
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
    e.preventDefault(); const form = e.currentTarget; const d: any = Object.fromEntries(new FormData(form)); const cat = cats.find(c => c.id === Number(d.categoryId));
    try {
      await api(`/seller/listings/${editing.id}`, { method: 'PATCH', body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined, condition: cat.listingType === 'physical_product' ? d.condition || null : null } });
      const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
      if (file) { const fd = new FormData(); fd.append('image', file); await api(`/seller/listings/${editing.id}/media`, { form: fd }); }
      setEditing(null); setErr(''); setOk('Listing updated.'); await load();
    } catch (x) { setErr(explain(x)); }
  };
  return <>
    <div className="page-head">
      <div><h1>My store</h1><p className="muted">Create listings, manage drafts, and follow reviewer decisions.</p></div>
    </div>
    <div className="panel"><h3>CPSU affiliation</h3>{me.affiliations.map(a => <p key={a.id}>{a.campus.name}: <span className={`status ${a.status}`}>{a.status}</span></p>)}
      {!verified && <p className="muted">Pending until a campus reviewer confirms you. You can still browse and message sellers.</p>}</div>
    {err && <p className="err" role="alert">{err}</p>}{ok && <p role="status">{ok}</p>}
    {verified && !me.storeId && <form className="panel stack" onSubmit={createStore}><h2>Open your store</h2>
      <label className="field">Store name<input name="storeName" placeholder="Name students will see" required minLength={2} /></label>
      <label className="field">Store description<textarea name="description" placeholder="What do you make or offer?" required minLength={10} /></label>
      <button className="btn">Open store</button></form>}
    {me.storeId && <>
      <form className="panel stack seller-composer" onSubmit={createListing}><h2>New listing</h2><p className="muted">Add the essential details first. Save your draft, then submit it for review.</p>
        <label className="field">Title<input name="title" placeholder="What are you offering?" required minLength={3} /></label>
        <label className="field">Category
          <select name="categoryId" required value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)}><option value="" disabled>Select a category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        {cats.find(c => c.id === Number(newCategoryId))?.listingType === 'physical_product' && <label className="field">Product condition<select name="condition" defaultValue="" required><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>}
        <label className="field">Description<textarea name="description" placeholder="Describe it: condition, size, what is included" required minLength={10} /></label>
        <div className="row">
          <label className="field">Price (PHP)<input name="price" type="number" min="1" step="1" required /></label>
          <label className="field">Price basis (optional)<input name="priceBasis" placeholder="Per item or per hour" /></label>
        </div>
        <label className="field">Photo (JPEG, PNG or WebP, up to 3 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <button className="btn">Save draft</button></form>
      <h2>Your listings</h2>
      {listingsLoading && <p className="muted" role="status">Loading your listings…</p>}
      {listingLoadError && <p className="err" role="alert">Could not load your listings: {listingLoadError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
      {!listingsLoading && !listingLoadError && listings.length === 0 && <p className="muted">No listings yet. Add your first one above.</p>}
      {!listingLoadError && listings.filter(l => !l.deletedAt).map(l => editing?.id === l.id
        ? <form key={l.id} className="panel stack" onSubmit={saveEdit}><h2>Edit listing</h2>
            <label className="field">Title<input name="title" defaultValue={l.title} required minLength={3} /></label>
            <label className="field">Category
              <select name="categoryId" required value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            {cats.find(c => c.id === Number((editCategoryId || l.categoryId)))?.listingType === 'physical_product' && <label className="field">Product condition<select name="condition" defaultValue={l.condition ?? ''} required><option value="" disabled>Select condition</option><option value="new">New</option><option value="like_new">Like new</option><option value="good">Good</option><option value="fair">Fair</option></select></label>}
            <label className="field">Description<textarea name="description" defaultValue={l.description} required minLength={10} /></label>
            <div className="row">
              <label className="field">Price (PHP)<input name="price" type="number" min="1" step="1" defaultValue={Number(l.price)} required /></label>
              <label className="field">Price basis (optional)<input name="priceBasis" defaultValue={l.priceBasis} /></label>
            </div>
            <p className="muted">{l.media.length} of 6 photos{l.media.length >= 6 && ' (limit reached)'}</p>
            <label className="field">Add photo (JPEG, PNG or WebP, up to 3 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={l.media.length >= 6} /></label>
            <div className="row"><button className="btn">Save changes</button><button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button></div></form>
        : <div key={l.id} className="panel row"><div style={{ flex: 1 }}><h3>{l.title}</h3><span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span> <span>{peso(Number(l.price))}</span></div>
            {!['pending_review', 'suspended', 'rejected'].includes(l.status) && l.availabilityState !== 'sold' && <button className="btn ghost" onClick={() => { setEditing(l); setEditCategoryId(String(l.categoryId)); setErr(''); setOk(''); }}>Edit</button>}
            {['draft', 'changes_requested'].includes(l.status) && <button className="btn" disabled={pending === l.id} onClick={() => submit(l.id)}>{pending === l.id ? 'Submitting…' : 'Submit for review'}</button>}
            {l.status === 'published' && <><span className="status">{l.availabilityState || 'available'}</span>{l.availabilityState !== 'sold' && <select aria-label={`Availability for ${l.title}`} value={l.availabilityState || 'available'} disabled={pending === l.id} onChange={async e => { const next = e.target.value as 'available' | 'reserved' | 'sold'; if (!(await changeAvailability(l.id, next))) e.target.value = l.availabilityState || 'available'; }}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold (final)</option></select>}</>}
            <button type="button" className="btn ghost" disabled={pending === l.id} onClick={() => removeListing(l.id)}>Remove</button></div>)}
    </>}
  </>;
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
      <span className="avatar" aria-hidden="true">{initials(t.listing.title)}</span>
      <span className="inq-main">
        <span className="inq-top"><strong>{t.listing.title}</strong>
          {t.lastMessage && <time dateTime={t.lastMessage.createdAt}>{timeAgo(t.lastMessage.createdAt)}</time>}</span>
        <span className="muted inq-preview">{t.lastMessage?.body ?? 'No messages yet.'}</span>
        <span className="inq-details"><span>{t.role === 'buyer' ? 'Buying' : 'Selling'}</span>
          {t.status === 'closed' && <span className="status closed">Closed</span>}</span>
      </span>
      <span className="inq-open" aria-hidden="true"><Icon name="arrow" size={18} /></span>
    </Link>)}</div>}
  </section>;
}

// First letters of up to two words: "Maria Santos" -> "MS", keeps chat avatars compact.
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

export function Thread() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [body, setBody] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const lastPing = useRef(0);

  useEffect(() => {
    let active = true;
    let newestRequest = 0;
    followLatest.current = true;
    setD(null); setLoadError(''); setSendError(''); setBody('');
    const refresh = async () => {
      const request = ++newestRequest;
      try {
        const next = await api(`/inquiries/${id}/messages`);
        if (active && request === newestRequest) { setD(next); setLoadError(''); }
      } catch (e) {
        if (active && request === newestRequest) setLoadError(explain(e));
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    return () => { active = false; newestRequest++; clearInterval(timer); refreshRef.current = async () => {}; };
  }, [id]);

  // Keep new messages in view unless someone has scrolled up to read an older part of the thread.
  useEffect(() => {
    const log = logRef.current;
    if (log && followLatest.current) log.scrollTop = log.scrollHeight;
  }, [d?.thread?.id, d?.messages?.length]);

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
  return <section className="conversation-page">
    <Link to="/inquiries" className="conversation-back">← Back to messages</Link>
    <div className={`conversation-heading ${closed ? 'is-closed' : ''}`}>
      <div><h1>Conversation</h1><p className="muted">Chat directly with the other student about this listing.</p></div>
      <div className="conversation-actions">
        {closed && <span className="status closed">Closed</span>}
        <Link className="btn ghost" to={`/listings/${d.thread.listingId}`}>View listing <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
    {loadError && <p className="err" role="alert">Could not refresh messages: {loadError}</p>}
    <div className="thread-scroll conversation-log" ref={logRef} role="log" aria-label="Conversation messages" aria-live="polite"
      onScroll={e => { const el = e.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {d.messages.length === 0 && <p className="muted">No messages yet. Start by asking a question about the listing.</p>}
      {d.messages.map((m: any) => <div key={m.id} className={`msg-row ${m.mine ? 'mine' : ''}`}>
        <span className="avatar" aria-hidden="true">{initials(m.author)}</span>
        <div className={`msg ${m.mine ? 'mine' : ''}`}>
          <small className="muted">{m.mine ? 'You' : m.author} · <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></small>
          <div className="message-text">{m.body}</div>
        </div>
      </div>)}
      {d.typing && !closed && <p className="typing-indicator" role="status">The other student is typing…</p>}
    </div>
    {d.handoff && <aside className="handoff-panel">
      <Icon name="pin" size={19} />
      <div><strong>Handoff arrangement</strong>
        <p>{d.handoff.method.replaceAll('_', ' ')} · {d.handoff.timeWindow} · {d.handoff.generalLocation}</p>
        <span className="status">{d.handoff.status.replaceAll('_', ' ')}</span>
      </div>
    </aside>}
    {closed ? <div className="conversation-closed" role="status">This conversation is closed. You can still read the messages above.</div>
      : <form className="chat-bar conversation-composer" onSubmit={e => { e.preventDefault(); void send(); }}>
        <label className="conversation-reply-label" htmlFor="conversation-reply">Your message</label>
        <div className="composer-row">
          <textarea id="conversation-reply" rows={2} value={body} onChange={e => { setBody(e.target.value); ping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            maxLength={1000} placeholder="Type a message…" />
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
