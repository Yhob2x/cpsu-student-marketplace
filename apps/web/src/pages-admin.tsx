import { useEffect, useState } from 'react';
import { api, explain, peso } from './api';

const FLAG_TEXT: Record<string, string> = {
  sensitive_category: 'Sensitive category', restricted_review: 'Campus restriction: review', possible_establishment_overlap: 'May overlap with a campus establishment',
  academic_integrity_concern: 'Possible academic-integrity issue', missing_images: 'No photos', invalid_price: 'Invalid price',
};

export function Admin() {
  const [q, setQ] = useState<any>(null); const [stats, setStats] = useState<any>(null); const [err, setErr] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState('');
  const load = () => { api('/admin/review-queue').then(setQ).catch(e => setErr(explain(e))); api('/admin/analytics/overview').then(setStats).catch(() => {}); };
  useEffect(load, []);
  const decide = async (id: number, decision: string) => {
    setPending(`l${id}`);
    try { await api(`/admin/listings/${id}/decision`, { body: { decision, reason: reasons[`l${id}`] ?? '' } }); setErr(''); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
  };
  const verify = async (id: number, decision: string) => {
    setPending(`a${id}`);
    try { await api(`/admin/affiliations/${id}/verify`, { body: { decision, reason: reasons[`a${id}`] || 'Checked against enrollment records' } }); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
  };
  const field = (k: string, ph: string) => <input placeholder={ph} value={reasons[k] ?? ''} onChange={e => setReasons({ ...reasons, [k]: e.target.value })} style={{ flex: 1, minWidth: 200 }} />;
  const reasonOk = (k: string) => (reasons[k] ?? '').trim().length >= 5;
  return <>
    <h1>Review queue</h1>{err && <p className="err" role="alert">{err}</p>}
    <h2>Affiliations to verify</h2>{q?.affiliations.length === 0 && <p className="muted">All caught up.</p>}
    {q?.affiliations.map((a: any) => <div key={a.id} className="panel row"><div style={{ flex: 1 }}><h3>{a.user.displayName}</h3><span className="muted">{a.campus}</span></div>
      {field(`a${a.id}`, 'Note (optional)')}<button className="btn" disabled={pending === `a${a.id}`} onClick={() => verify(a.id, 'verified')}>Verify</button><button className="btn danger" disabled={pending === `a${a.id}`} onClick={() => verify(a.id, 'rejected')}>Reject</button></div>)}
    <h2>Listings to review</h2>{q?.listings.length === 0 && <p className="muted">No listings waiting.</p>}
    {q?.listings.map((l: any) => <div key={l.id} className="panel stack" style={{ maxWidth: 'none' }}>
      <div className="row"><h3 style={{ flex: 1 }}>{l.title}</h3><span className="tag">{peso(l.price)}</span></div>
      <p className="muted">{l.store}, {l.campus}, {l.category}</p><p style={{ maxWidth: '65ch' }}>{l.description}</p>
      <div className="row">{l.flags.map((f: string) => <span key={f} className="flag">{FLAG_TEXT[f] ?? f}</span>)}{l.flags.length === 0 && <span className="muted">No automatic flags</span>}</div>
      <div className="row">{l.images.length === 0 && <span className="muted">No photos attached</span>}
        {l.images.map((s: string) => <a key={s} href={s} target="_blank" rel="noreferrer"><img src={s} alt="Listing photo" style={{ height: 160, borderRadius: 8 }} /></a>)}</div>
      <div className="row">{field(`l${l.id}`, 'Reason (required, 5+ characters, shown to the seller)')}{!reasonOk(`l${l.id}`) && <span className="muted">Type a reason to enable the buttons</span>}
        <button className="btn" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'approved')}>Approve</button><button className="btn ghost" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'changes_requested')}>Request changes</button><button className="btn danger" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'rejected')}>Reject</button></div></div>)}
    <h2>Campus overview</h2>{stats && <><p className="muted">{stats.note}</p>
      <div className="grid">{stats.campuses.map((c: any) => <div key={c.campus} className="panel"><h3>{c.campus}</h3>
        <p>Storefronts: {c.activeStorefronts}<br />Published listings: {c.publishedListings}<br />Services: {c.serviceListings}<br />Pending review: {c.pendingReview}<br />Inquiries: {c.inquiries}</p></div>)}</div></>}
  </>;
}
