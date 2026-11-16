import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, explain, peso } from './api';
import { useMe } from './main';

const FLAG_TEXT: Record<string, string> = {
  sensitive_category: 'Sensitive category', restricted_review: 'Campus restriction: review', possible_establishment_overlap: 'May overlap with a campus establishment',
  academic_integrity_concern: 'Possible academic-integrity issue', missing_images: 'No photos', invalid_price: 'Invalid price',
};

export function Admin() {
  const { syncQueue, me } = useMe();
  const accountAdmin = Boolean(me?.roles.some(role => role.role === 'university_admin' && role.campusId === null));
  const [q, setQ] = useState<any>(null); const [stats, setStats] = useState<any>(null); const [err, setErr] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState('');
  const [photosReviewed, setPhotosReviewed] = useState<Record<number, boolean>>({});
  const [reports, setReports] = useState<any[] | null>(null);
  const [reportsError, setReportsError] = useState('');
  const [monitoredTransactions, setMonitoredTransactions] = useState<any[]>([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [statsError, setStatsError] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [students, setStudents] = useState<any[] | null>(null);
  const [studentsError, setStudentsError] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditCursor, setAuditCursor] = useState<number | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const load = () => {
    api('/admin/review-queue').then(r => { setQ(r); setErr(''); syncQueue(r.listings.length + r.affiliations.length); }).catch(e => setErr(explain(e)));
    api('/admin/reports').then(r => { setReports(r); setReportsError(''); }).catch(e => setReportsError(explain(e)));
    api('/admin/analytics/overview').then(r => { setStats(r); setStatsError(''); }).catch(e => setStatsError(explain(e)));
  };
  useEffect(load, []);
  const loadTransactions = async (page = 1) => {
    setTransactionLoading(true);
    try {
      const result = await api<{ items: any[]; total: number }>(`/admin/transactions?page=${page}&pageSize=20`);
      setMonitoredTransactions(prev => page === 1 ? result.items : [...prev, ...result.items]);
      setTransactionCount(result.total); setTransactionPage(page); setTransactionError('');
    } catch (e) { setTransactionError(explain(e)); }
    finally { setTransactionLoading(false); }
  };
  useEffect(() => { void loadTransactions(); }, []);
  const searchStudents = async (query: string) => {
    setStudentsLoading(true);
    try {
      const result = await api<{ items: any[] }>('/admin/users?q=' + encodeURIComponent(query.trim()));
      setStudents(result.items);
      setStudentsError('');
    } catch (e) { setStudentsError(explain(e)); }
    finally { setStudentsLoading(false); }
  };
  const loadAudit = async (cursor?: number) => {
    setAuditLoading(true);
    try {
      const result = await api<{ items: any[]; nextCursor: number | null }>(
        '/admin/audit-logs?limit=15' + (cursor ? '&cursor=' + cursor : ''),
      );
      setAuditEvents(previous => cursor ? [...previous, ...result.items] : result.items);
      setAuditCursor(result.nextCursor);
      setAuditError('');
    } catch (e) { setAuditError(explain(e)); }
    finally { setAuditLoading(false); }
  };
  useEffect(() => { if (accountAdmin) { void searchStudents(''); void loadAudit(); } }, [accountAdmin]);
  const changeAccountStatus = async (id: number, status: 'active' | 'suspended') => {
    const reason = (reasons[`u${id}`] ?? '').trim();
    if (reason.length < 10) return;
    setPending(`u${id}`);
    try {
      await api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status, reason } });
      setReasons(previous => ({ ...previous, [`u${id}`]: '' }));
      setErr('');
      await searchStudents(studentQuery);
    } catch (e) { setErr(explain(e)); }
    finally { setPending(''); }
  };
  const resolveReport = async (id: number, status: 'resolved' | 'dismissed') => {
    setPending(`r${id}`);
    try { await api(`/admin/reports/${id}/resolve`, { body: { status } }); setErr(''); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
  };
  const decide = async (id: number, decision: string) => {
    setPending(`l${id}`);
    try { await api(`/admin/listings/${id}/decision`, { body: {
      decision, reason: reasons[`l${id}`] ?? '',
      ...(decision === 'approved' ? { photosReviewed: photosReviewed[id] === true } : {}),
    } }); setErr(''); setPhotosReviewed(prev => ({ ...prev, [id]: false })); load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); }
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
      <div className="row">{l.flags.map((f: string) => <span key={f} className="flag">{FLAG_TEXT[f] ?? f}</span>)}{l.flags.length === 0 && <span className="muted">No text/category flags — photos still need human review</span>}</div>
      <p className="muted">{l.images.length} listing {l.images.length === 1 ? 'photo' : 'photos'} to inspect. Photos are not automatically checked for explicit content.</p>
      <div className="row">{l.images.length === 0 && <span className="muted">No photos attached</span>}
        {l.images.map((s: string, i: number) => <a key={s} href={s} target="_blank" rel="noreferrer"><img src={s} alt={`Listing photo ${i + 1} of ${l.images.length}`} style={{ height: 160, borderRadius: 8 }} /></a>)}</div>
      <label className="row" style={{ alignItems: 'flex-start' }}>
        <input type="checkbox" checked={photosReviewed[l.id] === true}
          onChange={e => setPhotosReviewed(prev => ({ ...prev, [l.id]: e.target.checked }))}
          style={{ flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>I personally inspected all {l.images.length} photos and confirm they do not contain pornography, explicit sexual imagery, graphic violence, or other prohibited content.</span>
      </label>
      <div className="row">{field(`l${l.id}`, 'Reason (required, 5+ characters, shown to the seller)')}{!reasonOk(`l${l.id}`) && <span className="muted">Type a reason to enable the buttons</span>}
        <button className="btn" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`) || !photosReviewed[l.id] || l.images.length === 0} onClick={() => decide(l.id, 'approved')}>Approve</button><button className="btn ghost" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'changes_requested')}>Request changes</button><button className="btn danger" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'rejected')}>Reject</button></div></div>)}
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
    <section aria-labelledby="admin-transactions-heading">
      <h2 id="admin-transactions-heading">Transaction monitoring</h2>
      <p className="muted">Read-only transaction statuses in your authorized campuses. Completed means both students confirmed; payments are not verified. Private messages and payment arrangements are not shown.</p>
      {transactionError && <p role="alert" className="err">Transactions could not load: {transactionError} <button type="button" className="btn ghost" onClick={() => void loadTransactions(transactionPage)}>Retry</button></p>}
      {!transactionLoading && !transactionError && monitoredTransactions.length === 0 && <p className="muted">No transactions to monitor.</p>}
      <div className="stack">{monitoredTransactions.map(t => <div className="panel row" key={t.id} style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}><strong>{t.listing.title}</strong>
          <p className="muted" style={{ margin: '.25rem 0' }}>Transaction #{t.id} · {t.listing.campus.code} · {t.listing.type === 'service' ? 'Service' : 'Product'}</p>
          <time className="muted" dateTime={t.createdAt}>{new Date(t.createdAt).toLocaleString('en-PH')}</time></div>
        <span className="tag">{String(t.status).replaceAll('_', ' ')}</span>
      </div>)}</div>
      {transactionLoading && <p role="status" className="muted">Loading transaction records…</p>}
      {!transactionLoading && !transactionError && monitoredTransactions.length < transactionCount && <button type="button" className="btn ghost" onClick={() => void loadTransactions(transactionPage + 1)}>Load more transactions</button>}
    </section>
    {accountAdmin && <section aria-labelledby="student-management-heading">
      <h2 id="student-management-heading">Student accounts</h2>
      <p className="muted">University administrators can suspend and reactivate student accounts. Suspending a student signs out their active sessions and hides their public listings.</p>
      <form className="panel row" role="search" aria-label="Search student accounts" onSubmit={e => { e.preventDefault(); void searchStudents(studentQuery); }}>
        <label className="field" style={{ flex: 1, minWidth: 220 }} htmlFor="student-search">Search by name or email
          <input id="student-search" type="search" value={studentQuery} onChange={e => setStudentQuery(e.target.value)} maxLength={80} placeholder="Student name or email" />
        </label>
        <button className="btn" disabled={studentsLoading} type="submit">Search students</button>
      </form>
      {studentsError && <p className="err" role="alert">Students could not load: {studentsError} <button className="btn ghost" type="button" onClick={() => void searchStudents(studentQuery)}>Retry</button></p>}
      {studentsLoading && <p role="status" className="muted">Loading student accounts…</p>}
      {!studentsLoading && students?.length === 0 && !studentsError && <p className="muted">No matching students.</p>}
      {!studentsError && students?.map(student => <div className="panel stack" key={student.id} style={{ maxWidth: 'none' }}>
        <div className="row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ marginBottom: 0 }}>{student.displayName}</h3>
            <p className="muted" style={{ overflowWrap: 'anywhere', margin: 0 }}>{student.email}</p>
            <p className="muted" style={{ marginBottom: 0 }}>Campus: {student.affiliations.map((a: any) => a.campus.code).join(', ') || 'None'}</p>
          </div>
          <span className="tag">{student.status === 'active' ? 'Active' : 'Suspended'}</span>
        </div>
        {student.roles.some((role: any) => ['campus_reviewer', 'university_admin', 'system_admin'].includes(role.role)) && <p className="muted">Protected staff account — changes require a separate administrative review.</p>}
        {student.id !== me?.id && !student.roles.some((role: any) => ['campus_reviewer', 'university_admin', 'system_admin'].includes(role.role)) && <div className="row">
          <label className="field" style={{ flex: 1, minWidth: 200 }} htmlFor={`user-reason-${student.id}`}>Reason for account decision
            <input id={`user-reason-${student.id}`} value={reasons[`u${student.id}`] ?? ''}
              onChange={e => setReasons(previous => ({ ...previous, [`u${student.id}`]: e.target.value }))}
              placeholder="Required reason (10+ characters)" maxLength={500} minLength={10} />
          </label>
          <button className={student.status === 'active' ? 'btn danger' : 'btn'}
            type="button" disabled={pending === `u${student.id}` || (reasons[`u${student.id}`] ?? '').trim().length < 10}
            onClick={() => void changeAccountStatus(student.id, student.status === 'active' ? 'suspended' : 'active')}>
            {student.status === 'active' ? 'Suspend student' : 'Reactivate student'}
          </button>
        </div>}
      </div>)}
    </section>}
    {accountAdmin && <section aria-labelledby="audit-history-heading">
      <h2 id="audit-history-heading">Administrative audit history</h2>
      <p className="muted">Restricted to university administration. Events are shown newest first.</p>
      {auditError && <p role="alert" className="err">Audit history could not load: {auditError}
        <button className="btn ghost" type="button" onClick={() => void loadAudit()}>Retry</button>
      </p>}
      {auditEvents.length === 0 && !auditLoading && !auditError && <p className="muted">No audit events found.</p>}
      <div className="stack">{auditEvents.map(event => <div className="panel" key={event.id}>
        <p style={{ margin: 0 }}><strong>{event.action}</strong> · {event.targetType} {event.targetId ?? ''}</p>
        <p className="muted" style={{ margin: '.25rem 0 0' }}>
          {event.actor?.displayName ?? 'System'} · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
        </p>
      </div>)}</div>
      {auditLoading && <p role="status" className="muted">Loading audit history…</p>}
      {auditCursor !== null && !auditLoading && <button type="button" className="btn ghost" onClick={() => void loadAudit(auditCursor)}>Load older events</button>}
    </section>}
    <h2>Campus overview</h2>{statsError && <p className="err" role="alert">Campus overview could not load: {statsError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {!stats && !statsError && <p className="muted" role="status">Loading campus overview…</p>}
    {stats && !statsError && <><p className="muted">{stats.note}</p>
      <div className="grid">{stats.campuses.map((c: any) => <div key={c.campus} className="panel"><h3>{c.campus}</h3>
        <p>Storefronts: {c.activeStorefronts}<br />Published listings: {c.publishedListings}<br />Services: {c.serviceListings}<br />Pending review: {c.pendingReview}<br />Inquiries: {c.inquiries}</p></div>)}</div></>}
  </>;
}
