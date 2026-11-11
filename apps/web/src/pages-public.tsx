import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, explain, peso } from './api';
import { useMe } from './main';

export type Listing = { id: number; type: string; title: string; description: string; price: number; priceBasis: string; availability: string;
  handoffNote?: string; category: { name: string }; campus: { code: string; name: string }; seller: { id: number; storeName: string }; images: string[]; status?: string };

export function ListingCard({ l }: { l: Listing }) {
  return (
    <Link to={`/listings/${l.id}`} className="card">
      <div className="img">{l.images[0]
        ? <img src={l.images[0]} alt="" loading="lazy" decoding="async" />
        : 'No photo'}</div>
      <div className="body"><h3>{l.title}</h3><p>{l.seller.storeName}, {l.campus.name}</p><span className="tag">{peso(l.price)}</span></div>
    </Link>
  );
}

// Landing page: sectioned showcase. "Featured" is simply the newest published listings.
// shortcut: no editorial curation yet; add an isFeatured flag when reviewers want to pick these.
export function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [feed, setFeed] = useState<Listing[] | null>(null);
  const [services, setServices] = useState<Listing[] | null>(null);
  const [popular, setPopular] = useState<Listing[] | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  useEffect(() => {
    api('/listings?pageSize=24').then(r => setFeed(r.items)).catch(() => setFeed([]));
    api('/listings?type=service&pageSize=8').then(r => setServices(r.items)).catch(() => setServices([]));
    api('/listings/popular').then(r => setPopular(r.items)).catch(() => setPopular([]));
    api('/categories').then(setCats).catch(() => {});
  }, []);
  const go = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); nav(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore'); };
  const rail = (rows: Listing[]) => <div className="rail">{rows.map(l => <ListingCard key={l.id} l={l} />)}</div>;
  const skeletons = <div className="rail">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skel card" aria-hidden="true" />)}</div>;
  // Sections render skeletons while loading and disappear once loaded empty, so the page never shows dead headings.
  const section = (title: string, rows: Listing[] | null) => rows === null ? <><h2 className="sect">{title}</h2>{skeletons}</>
    : rows.length > 0 ? <><h2 className="sect">{title}</h2>{rail(rows)}</> : null;
  return <>
    <section className="hero"><h1>Made, sold and offered by CPSU students.</h1>
      <p>Browse handmade goods, pre-loved items and student services. Message the seller, then arrange payment and pickup directly with them.</p>
      <form className="search" role="search" onSubmit={go}>
        <input aria-label="Search" placeholder="Search products, services..." value={q} onChange={e => setQ(e.target.value)} />
        <button className="btn">Search</button>
      </form></section>
    {feed === null ? section('Featured listings', null)
      : feed.length === 0 ? <p className="muted">No listings yet — check back soon.</p>
      : section('Featured listings', feed.slice(0, 4))}
    <h2 className="sect">Categories</h2>
    <div className="chips">{cats.map(c => <Link key={c.id} className="chip" to={`/explore?categoryId=${c.id}`}>{c.name}</Link>)}</div>
    {section('Recently added', feed === null ? null : feed.slice(4, 12))}
    {section('Student services', services)}
    {section('Popular listings', popular)}
  </>;
}

export function Discover() {
  const [sp] = useSearchParams();
  const [f, setF] = useState({ q: sp.get('q') ?? '', campusId: sp.get('campusId') ?? '', categoryId: sp.get('categoryId') ?? '', type: sp.get('type') ?? '' });
  const [campuses, setCampuses] = useState<any[]>([]); const [cats, setCats] = useState<any[]>([]);
  const [items, setItems] = useState<Listing[] | null>(null); const [error, setError] = useState('');
  useEffect(() => { api('/campuses').then(setCampuses).catch(() => {}); api('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    const t = setTimeout(() => api(`/listings?${qs}`).then(r => { setItems(r.items); setError(''); }).catch(e => setError(explain(e))), 250);
    return () => clearTimeout(t);
  }, [f]);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return <>
    <h1>Explore listings</h1>
    <div className="filters" role="search">
      <input aria-label="Search" placeholder="Search listings" value={f.q} onChange={set('q')} />
      <select aria-label="Campus" value={f.campusId} onChange={set('campusId')}><option value="">All campuses</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label="Category" value={f.categoryId} onChange={set('categoryId')}><option value="">All categories</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label="Type" value={f.type} onChange={set('type')}><option value="">Products and services</option><option value="physical_product">Products</option><option value="service">Services</option></select>
    </div>
    {error && <p className="err" role="alert">{error}</p>}
    {items === null && <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skel card" aria-hidden="true" />)}</div>}
    {items && items.length === 0 && <p className="muted">No listings match yet. Try a different campus or category, or check back soon.</p>}
    <div className="grid">{items?.map(l => <ListingCard key={l.id} l={l} />)}</div>
  </>;
}

export function ListingDetail() {
  const { id } = useParams(); const { me } = useMe();
  const [l, setL] = useState<Listing | null>(null); const [body, setBody] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); const [reporting, setReporting] = useState(false); const [reason, setReason] = useState('');
  useEffect(() => { api(`/listings/${id}`).then(setL).catch(e => setErr(explain(e))); }, [id]);
  if (err && !l) return <p className="err">This listing is not available.</p>;
  if (!l) return <p className="muted">Loading</p>;
  const send = async () => { setBusy(true); try { const r = await api('/inquiries', { body: { listingId: l.id, body } }); setBody(''); setNote(`Message sent. Continue in Inquiries (thread ${r.id}).`); setErr(''); } catch (e) { setErr(explain(e)); } finally { setBusy(false); } };
  const save = async () => { setBusy(true); try { await api(`/saved/${l.id}`, { method: 'PUT' }); setNote('Saved to your list.'); setErr(''); } catch (e) { setErr(explain(e)); } finally { setBusy(false); } };
  const report = async () => { setBusy(true); try { await api('/reports', { body: { listingId: l.id, reason } }); setReason(''); setReporting(false); setNote('Report sent to a campus reviewer.'); setErr(''); } catch (e) { setErr(explain(e)); } finally { setBusy(false); } };
  return <article>
    <div className="gallery">{l.images.map((s, i) => <img key={s} src={s} alt={l.title} loading={i ? 'lazy' : 'eager'} decoding="async" />)}</div>
    <h1 style={{ marginTop: '1rem' }}>{l.title}</h1>
    <div className="row"><span className="tag">{peso(l.price)}</span><span className="muted">{l.priceBasis}</span><span className="status">{l.category.name}</span>{l.status && <span className={`status ${l.status}`}>{l.status.replace('_', ' ')}</span>}</div>
    <p style={{ maxWidth: '60ch', whiteSpace: 'pre-wrap' }}>{l.description}</p>
    <p className="muted">Sold by <Link to={`/stores/${l.seller.id}`}>{l.seller.storeName}</Link> at {l.campus.name}. {l.handoffNote && `Handoff: ${l.handoffNote}.`}</p>
    <div className="panel stack">
      <h2>Ask the seller</h2>
      <p className="muted">Payment and handoff are arranged directly between you and the seller. The marketplace does not hold money or deliver items.</p>
      {me ? <><textarea aria-label="Message" value={body} onChange={e => setBody(e.target.value)} maxLength={1000} placeholder="Is this still available? Where can we meet on campus?" />
        <div className="row"><button className="btn" disabled={busy || !body.trim()} onClick={send}>Send inquiry</button>
          <button className="btn ghost" disabled={busy} onClick={save}>Save</button>
          <button className="btn ghost" disabled={busy} onClick={() => { setReporting(!reporting); setErr(''); }}>Report</button></div>
        {reporting && <div className="stack">
          <textarea aria-label="Report reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="What is wrong with this listing? (at least 10 characters)" />
          <div className="row"><button className="btn danger" disabled={busy || reason.trim().length < 10} onClick={report}>Send report</button>
            <button className="btn ghost" disabled={busy} onClick={() => setReporting(false)}>Cancel</button></div></div>}</>
        : <p><Link to="/login">Sign in</Link> to message this seller.</p>}
      {note && <p role="status">{note}</p>}{err && <p className="err" role="alert">{err}</p>}
    </div>
  </article>;
}

export function StorePage() {
  const { id } = useParams(); const [s, setS] = useState<any>(null);
  useEffect(() => { api(`/seller-profiles/${id}`).then(setS).catch(() => setS(false)); }, [id]);
  if (s === false) return <p className="err">Store not found.</p>; if (!s) return <p className="muted">Loading</p>;
  return <><h1>{s.storeName}</h1><p><span className="status">{s.badge}</span></p><p style={{ maxWidth: '60ch' }}>{s.description}</p>
    <p className="muted">This badge confirms campus affiliation only. It is not an endorsement of products or services by the university.</p>
    <div className="grid">{s.listings.map((l: Listing) => <ListingCard key={l.id} l={l} />)}</div></>;
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
