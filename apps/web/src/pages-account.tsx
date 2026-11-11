import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, explain, peso, setToken } from './api';
import { useMe } from './main';
import { ListingCard, Listing } from './pages-public';

export function Login() {
  const nav = useNavigate(); const { reload } = useMe(); const [err, setErr] = useState('');
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget));
    try { const r = await api('/auth/login', { body: d }); setToken(r.accessToken); await reload(); nav('/'); } catch (x) { setErr(explain(x)); }
  };
  return <form className="stack" onSubmit={go}><h1>Sign in</h1>
    <input name="email" type="email" placeholder="Email" autoComplete="email" required />
    <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
    {err && <p className="err" role="alert">{err}</p>}<button className="btn">Sign in</button>
    <p className="muted">New here? <Link to="/register">Create an account</Link></p></form>;
}

export function Register() {
  const nav = useNavigate(); const { reload } = useMe(); const [err, setErr] = useState(''); const [campuses, setCampuses] = useState<any[]>([]);
  useEffect(() => { api('/campuses').then(setCampuses); }, []);
  const go = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const d: any = Object.fromEntries(new FormData(e.currentTarget)); d.campusId = Number(d.campusId);
    try { const r = await api('/auth/register', { body: d }); setToken(r.accessToken); await reload(); nav('/dashboard'); } catch (x) { setErr(explain(x)); }
  };
  return <form className="stack" onSubmit={go}><h1>Create your account</h1>
    <input name="displayName" placeholder="Name shown to others" required minLength={2} />
    <input name="email" type="email" placeholder="Email" autoComplete="email" required />
    <input name="password" type="password" placeholder="Password (10+ characters)" autoComplete="new-password" required minLength={10} />
    <select name="campusId" required defaultValue=""><option value="" disabled>Your campus</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <p className="muted">A campus reviewer confirms you are part of the CPSU community before you can sell. Browsing and messaging work right away.</p>
    {err && <p className="err" role="alert">{err}</p>}<button className="btn">Create account</button></form>;
}

export function Dashboard() {
  const { me, reload } = useMe(); const [listings, setListings] = useState<any[]>([]); const [cats, setCats] = useState<any[]>([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [pending, setPending] = useState<number | null>(null); const [editing, setEditing] = useState<any | null>(null);
  const load = () => api('/seller/listings').then(setListings).catch(() => {});
  useEffect(() => { if (me?.storeId) load(); api('/categories').then(setCats); }, [me?.storeId]);
  if (!me) return <p className="muted">Loading</p>;
  const verified = me.affiliations.some(a => a.status === 'verified');
  const createStore = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); try { await api('/seller/store', { body: Object.fromEntries(new FormData(e.currentTarget)) }); await reload(); } catch (x) { setErr(explain(x)); } };
  const createListing = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const d: any = Object.fromEntries(new FormData(form));
    const cat = cats.find(c => c.id === Number(d.categoryId));
    try {
      const l = await api('/seller/listings', { body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined } });
      const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
      if (file) { const fd = new FormData(); fd.append('image', file); await api(`/seller/listings/${l.id}/media`, { form: fd }); }
      form.reset(); setErr(''); setOk('Draft saved. Submit it for review when you are ready.'); load();
    } catch (x) { setErr(explain(x)); }
  };
  const submit = async (id: number) => { setPending(id); try { await api(`/seller/listings/${id}/submit`, { method: 'POST', body: {} }); setOk('Submitted. A reviewer will decide soon.'); setErr(''); await load(); } catch (x) { setErr(explain(x)); } finally { setPending(null); } };
  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const d: any = Object.fromEntries(new FormData(form)); const cat = cats.find(c => c.id === Number(d.categoryId));
    try {
      await api(`/seller/listings/${editing.id}`, { method: 'PATCH', body: { type: cat.listingType, categoryId: cat.id, title: d.title, description: d.description, price: Number(d.price), priceBasis: d.priceBasis || undefined } });
      const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
      if (file) { const fd = new FormData(); fd.append('image', file); await api(`/seller/listings/${editing.id}/media`, { form: fd }); }
      setEditing(null); setErr(''); setOk('Listing updated.'); await load();
    } catch (x) { setErr(explain(x)); }
  };
  return <>
    <h1>My store</h1>
    <div className="panel"><h3>CPSU affiliation</h3>{me.affiliations.map(a => <p key={a.id}>{a.campus.name}: <span className={`status ${a.status}`}>{a.status}</span></p>)}
      {!verified && <p className="muted">Pending until a campus reviewer confirms you. You can still browse and message sellers.</p>}</div>
    {err && <p className="err" role="alert">{err}</p>}{ok && <p role="status">{ok}</p>}
    {verified && !me.storeId && <form className="panel stack" onSubmit={createStore}><h2>Open your store</h2>
      <input name="storeName" placeholder="Store name" required minLength={2} /><textarea name="description" placeholder="What do you make or offer?" required minLength={10} /><button className="btn">Open store</button></form>}
    {me.storeId && <>
      <form className="panel stack" onSubmit={createListing}><h2>New listing</h2>
        <input name="title" placeholder="Title" required minLength={3} />
        <select name="categoryId" required defaultValue=""><option value="" disabled>Category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <textarea name="description" placeholder="Describe it: condition, size, what is included" required minLength={10} />
        <div className="row"><input name="price" type="number" min="1" step="1" placeholder="Price (PHP)" required /><input name="priceBasis" placeholder="per item, per hour..." /></div>
        <label>Photo (JPEG, PNG or WebP, up to 3 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <button className="btn">Save draft</button></form>
      <h2>Your listings</h2>
      {listings.length === 0 && <p className="muted">No listings yet. Add your first one above.</p>}
      {listings.map(l => editing?.id === l.id
        ? <form key={l.id} className="panel stack" onSubmit={saveEdit}><h2>Edit listing</h2>
            <input name="title" defaultValue={l.title} required minLength={3} />
            <select name="categoryId" required defaultValue={l.categoryId}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <textarea name="description" defaultValue={l.description} required minLength={10} />
            <div className="row"><input name="price" type="number" min="1" step="1" defaultValue={Number(l.price)} required /><input name="priceBasis" defaultValue={l.priceBasis} /></div>
            <p className="muted">{l.media.length} of 6 photos{l.media.length >= 6 && ' (limit reached)'}</p>
            <label>Add photo (JPEG, PNG or WebP, up to 3 MB) <input name="image" type="file" accept="image/jpeg,image/png,image/webp" disabled={l.media.length >= 6} /></label>
            <div className="row"><button className="btn">Save changes</button><button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button></div></form>
        : <div key={l.id} className="panel row"><div style={{ flex: 1 }}><h3>{l.title}</h3><span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span> <span>{peso(Number(l.price))}</span></div>
            {!['pending_review', 'suspended', 'rejected'].includes(l.status) && <button className="btn ghost" onClick={() => { setEditing(l); setErr(''); setOk(''); }}>Edit</button>}
            {['draft', 'changes_requested'].includes(l.status) && <button className="btn" disabled={pending === l.id} onClick={() => submit(l.id)}>{pending === l.id ? 'Submitting…' : 'Submit for review'}</button>}</div>)}
    </>}
  </>;
}

export function Inquiries() {
  const [rows, setRows] = useState<any[] | null>(null);
  const { me } = useMe();
  // User-scoped: wait for the restored session instead of racing it.
  useEffect(() => { if (me) api('/inquiries').then(setRows).catch(() => setRows([])); }, [me]);
  return <><h1>Inquiries</h1>{rows?.length === 0 && <p className="muted">No conversations yet. Open a listing and send the seller a message.</p>}
    {rows?.map(t => <Link key={t.id} to={`/inquiries/${t.id}`} className="card panel" style={{ display: 'block' }}><h3>{t.listing.title}</h3>
      <p className="muted">{t.role === 'buyer' ? 'You asked' : 'Buyer asked'}: {t.lastMessage?.body}</p></Link>)}</>;
}

export function Thread() {
  const { id } = useParams(); const [d, setD] = useState<any>(null); const [body, setBody] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null); const lastPing = useRef(0);
  const load = () => api(`/inquiries/${id}/messages`).then(setD).catch(e => setErr(explain(e)));
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [d?.messages.length]);
  if (err && !d) return <p className="err">Conversation not found.</p>; if (!d) return <p className="muted">Loading</p>;
  const send = async () => { setBusy(true); try { await api(`/inquiries/${id}/messages`, { body: { body } }); setBody(''); await load(); } catch (e) { setErr(explain(e)); } finally { setBusy(false); } };
  const ping = () => { const now = Date.now(); if (now - lastPing.current < 2000) return; lastPing.current = now; api(`/inquiries/${id}/typing`, { body: {} }).catch(() => {}); };
  return <><h1>Conversation</h1><p><Link to={`/listings/${d.thread.listingId}`}>View listing</Link></p>
    {d.messages.map((m: any) => <div key={m.id} className={`msg ${m.mine ? 'mine' : ''}`}>
      <small className="muted">{m.author} · {new Date(m.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small><div>{m.body}</div></div>)}
    {d.typing && <p className="muted">Typing…</p>}
    <div ref={end} />
    {d.handoff && <p className="panel">Handoff: {d.handoff.method.replace('_', ' ')}, {d.handoff.timeWindow}, {d.handoff.generalLocation} ({d.handoff.status})</p>}
    <div className="stack" style={{ marginTop: '1rem' }}><textarea aria-label="Reply" value={body} onChange={e => { setBody(e.target.value); ping(); }} maxLength={1000} />
      {err && <p className="err" role="alert">{err}</p>}<button className="btn" disabled={busy || !body.trim()} onClick={send}>Send</button></div></>;
}

export function Saved() {
  const [rows, setRows] = useState<Listing[] | null>(null);
  const { me } = useMe();
  useEffect(() => { if (me) api('/saved').then(setRows).catch(() => setRows([])); }, [me]);
  return <><h1>Saved</h1>{rows?.length === 0 && <p className="muted">Nothing saved yet. Use Save on a listing to keep it here.</p>}<div className="grid">{rows?.map(l => <ListingCard key={l.id} l={l} />)}</div></>;
}
