import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, explain, peso } from './api';
import { useMe } from './main';

const FLAG_TEXT: Record<string, string> = {
  sensitive_category: 'Sensitive category', restricted_review: 'Campus restriction: review', possible_establishment_overlap: 'May overlap with a campus establishment',
  academic_integrity_concern: 'Possible academic-integrity issue', missing_images: 'No photos', invalid_price: 'Invalid price',
};

export function Admin() {
  const { syncQueue } = useMe();
  const [q, setQ] = useState<any>(null); const [stats, setStats] = useState<any>(null); const [err, setErr] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState('');
  const [reports, setReports] = useState<any[] | null>(null);
  const [reportsError, setReportsError] = useState('');
  const [statsError, setStatsError] = useState('');
  const load = () => {
    api('/admin/review-queue').then(r => { setQ(r); setErr(''); syncQueue(r.listings.length + r.affiliations.length); }).catch(e => setErr(explain(e)));
    api('/admin/reports').then(r => { setReports(r); setReportsError(''); }).catch(e => setReportsError(explain(e)));
    api('/admin/analytics/overview').then(r => { setStats(r); setStatsError(''); }).catch(e => setStatsError(explain(e)));
  };
  useEffect(load, []);
  const resolveReport = async (id: number, status: 'resolved' | 'dismissed') => {
    setPending(`r${id}`);
    try { await api(`/admin/reports/${id}/resolve`, { body: { status } }); setErr(''); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
  };
  const decide = async (id: number, decision: string) => {
    setPending(`l${id}`);
    try { await api(`/admin/listings/${id}/decision`, { body: { decision, reason: reasons[`l${id}`] ?? '' } }); setErr(''); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
  };
  const verify = async (id: number, decision: string) => {
    setPending(`a${id}`);
    try { await api(`/admin/affiliations/${id}/verify`, { body: { decision, reason: reasons[`a${id}`].trim() } }); setErr(''); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
  };
  const field = (k: string, ph: string) => <label className="field moderation-reason">
    {k.startsWith('a') ? 'Verification reason' : 'Decision reason'}
    <input placeholder={ph} value={reasons[k] ?? ''} onChange={e => setReasons({ ...reasons, [k]: e.target.value })} required minLength={5} />
  </label>;
  const reasonOk = (k: string) => (reasons[k] ?? '').trim().length >= 5;
  return <>
    <div className="page-head"><div><h1>Review queue</h1><p className="muted">Check campus affiliations, review listings and resolve reports.</p></div></div>
    {err && <p className="err" role="alert">{err} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {q === null && !err && <p role="status" className="muted">Loading review queue…</p>}
    <h2>Affiliations to verify</h2>{q?.affiliations.length === 0 && <p className="muted">All caught up.</p>}
    {q?.affiliations.map((a: any) => <div key={a.id} className="panel row"><div style={{ flex: 1 }}><h3>{a.user.displayName}</h3><span className="muted">{a.campus}</span></div>
      {field(`a${a.id}`, 'Reason (5+ characters)')}<button className="btn" disabled={pending === `a${a.id}` || !reasonOk(`a${a.id}`)} onClick={() => verify(a.id, 'verified')}>Verify</button><button className="btn danger" disabled={pending === `a${a.id}` || !reasonOk(`a${a.id}`)} onClick={() => verify(a.id, 'rejected')}>Reject</button></div>)}
    <h2>Listings to review</h2>{q?.listings.length === 0 && <p className="muted">No listings waiting.</p>}
    {q?.listings.map((l: any) => <div key={l.id} className="panel stack" style={{ maxWidth: 'none' }}>
      <div className="row"><h3 style={{ flex: 1 }}>{l.title}</h3><span className="tag">{peso(l.price)}</span></div>
      <p className="muted">{l.store}, {l.campus}, {l.category}</p><p style={{ maxWidth: '65ch' }}>{l.description}</p>
      <div className="row">{l.flags.map((f: string) => <span key={f} className="flag">{FLAG_TEXT[f] ?? f}</span>)}{l.flags.length === 0 && <span className="muted">No automatic flags</span>}</div>
      <div className="row">{l.images.length === 0 && <span className="muted">No photos attached</span>}
        {l.images.map((s: string) => <a key={s} href={s} target="_blank" rel="noreferrer"><img src={s} alt="Listing photo" style={{ height: 160, borderRadius: 8 }} /></a>)}</div>
      <div className="row">{field(`l${l.id}`, 'Reason (required, 5+ characters, shown to the seller)')}{!reasonOk(`l${l.id}`) && <span className="muted">Type a reason to enable the buttons</span>}
        <button className="btn" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'approved')}>Approve</button><button className="btn ghost" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'changes_requested')}>Request changes</button><button className="btn danger" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'rejected')}>Reject</button></div></div>)}
    <h2>Reports from students</h2>{reportsError && <p className="err" role="alert">Reports could not load: {reportsError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {reports === null && !reportsError && <p className="muted" role="status">Loading reports…</p>}
    {reports?.length === 0 && !reportsError && <p className="muted">No open reports.</p>}
    {!reportsError && reports?.map(rep => <div key={rep.id} className="panel row"><div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ maxWidth: '65ch', margin: 0 }}>{rep.reason}</p>
      <p className="muted" style={{ margin: '.15rem 0 0' }}>
        {rep.listingId && <><Link to={`/listings/${rep.listingId}`}>View listing</Link> · </>}
        {rep.sellerProfileId && <><Link to={`/stores/${rep.sellerProfileId}`}>View store</Link> · </>}
        {new Date(rep.createdAt).toLocaleString()}
      </p></div>
      <button className="btn" disabled={pending === `r${rep.id}`} onClick={() => resolveReport(rep.id, 'resolved')}>Resolve</button>
      <button className="btn ghost" disabled={pending === `r${rep.id}`} onClick={() => resolveReport(rep.id, 'dismissed')}>Dismiss</button></div>)}
    <h2>Campus overview</h2>{statsError && <p className="err" role="alert">Campus overview could not load: {statsError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {!stats && !statsError && <p className="muted" role="status">Loading campus overview…</p>}
    {stats && !statsError && <><p className="muted">{stats.note}</p>
      <div className="grid">{stats.campuses.map((c: any) => <div key={c.campus} className="panel"><h3>{c.campus}</h3>
        <p>Storefronts: {c.activeStorefronts}<br />Published listings: {c.publishedListings}<br />Services: {c.serviceListings}<br />Pending review: {c.pendingReview}<br />Inquiries: {c.inquiries}</p></div>)}</div></>}
  </>;
}
