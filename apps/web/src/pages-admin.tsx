import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, explain, peso } from './api';
import { useMe } from './main';
import { ManagedContentAdmin } from './pages-managed-content';
import { ReviewerAdmin } from './pages-reviewers';

const FLAG_TEXT: Record<string, string> = {
  sensitive_category: 'Sensitive category', restricted_review: 'Campus restriction: review', possible_establishment_overlap: 'May overlap with a campus establishment',
  academic_integrity_concern: 'Possible academic-integrity issue', missing_images: 'No photos', invalid_price: 'Invalid price',
};
const AUDIT_ACTION_TEXT: Record<string, string> = {
  'listing.submit': 'Listing submitted', 'listing.approved': 'Listing approved',
  'listing.changes_requested': 'Listing changes requested', 'listing.rejected': 'Listing rejected',
  'listing.suspend': 'Listing suspended', 'affiliation.verified': 'Affiliation verified',
  'affiliation.rejected': 'Affiliation rejected', 'report.create': 'Report created',
  'report.resolved': 'Report resolved', 'report.dismissed': 'Report dismissed',
  'user.suspended': 'Student suspended', 'user.reactivated': 'Student reactivated',
  'reviewer.created': 'Reviewer account created', 'reviewer.updated': 'Reviewer account updated',
};

export function Admin() {
  const { syncQueue, me } = useMe();
  const accountAdmin = Boolean(me?.roles.some(role => role.role === 'university_admin' && role.campusId === null));
  const [q, setQ] = useState<any>(null); const [stats, setStats] = useState<any>(null); const [err, setErr] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState('');
  const [activeSection, setActiveSection] = useState('listings');
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
  const [studentStatus, setStudentStatus] = useState('');
  const [studentVerification, setStudentVerification] = useState('');
  const [studentCampusId, setStudentCampusId] = useState('');
  const [studentApplied, setStudentApplied] = useState({ q: '', status: '', verification: '', campusId: '' });
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotal, setStudentTotal] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
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
  const searchStudents = async (filters = studentApplied, page = 1, keepSelection = false) => {
    setStudentsLoading(true);
    try {
      const params = new URLSearchParams({ q: filters.q.trim(), page: String(page), pageSize: '25' });
      if (filters.status) params.set('status', filters.status);
      if (filters.verification) params.set('verification', filters.verification);
      if (filters.campusId) params.set('campusId', filters.campusId);
      const result = await api<{ items: any[]; total: number; page: number }>('/admin/users?' + params);
      setStudents(result.items);
      setStudentTotal(result.total);
      setStudentPage(result.page);
      setStudentApplied(filters);
      if (!keepSelection) setSelectedStudentId(null);
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
  useEffect(() => { if (accountAdmin) { void searchStudents(); void loadAudit(); api<{ id: number; name: string }[]>('/campuses').then(setCampuses).catch(() => {}); } }, [accountAdmin]);
  const changeAccountStatus = async (id: number, status: 'active' | 'suspended') => {
    const reason = (reasons[`u${id}`] ?? '').trim();
    if (reason.length < 10) return;
    setPending(`u${id}`);
    try {
      await api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status, reason } });
      setReasons(previous => ({ ...previous, [`u${id}`]: '' }));
      setErr('');
      await searchStudents(studentApplied, studentPage, true);
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
  const selectedStudent = students?.find(student => student.id === selectedStudentId);
  return <>
    <div className="page-head"><div><h1>Administration</h1><p className="muted">Review campus activity and manage the work assigned to your role.</p></div></div>
    <nav className="admin-section-nav" aria-label="Administration sections">
      {([['listings', 'Listings', q?.listings.length], ['affiliations', 'Affiliations', q?.affiliations.length], ['reports', 'Reports', reports?.length], ['transactions', 'Transactions'], ...(accountAdmin ? [['students', 'Students'], ['staff', 'Staff'], ['content', 'Content'], ['audit', 'Audit history']] : []), ['overview', 'Overview']] as [string, string, number?][]).map(([key, label, count]) =>
        <button key={key} type="button" aria-pressed={activeSection === key} onClick={() => setActiveSection(key)}>{label} {count != null && <span>{count}</span>}</button>)}
    </nav>
    <div hidden={activeSection !== 'affiliations'}>
    {err && <p className="err" role="alert">{err} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {q === null && !err && <p role="status" className="muted">Loading review queue…</p>}
    <h2 id="admin-affiliations">Affiliations to verify</h2>{q?.affiliations.length === 0 && <p className="muted">All caught up.</p>}
    {q?.affiliations.map((a: any) => <div key={a.id} className="panel row"><div style={{ flex: 1 }}><h3>{a.user.displayName}</h3><span className="muted">{a.campus}</span></div>
      {field(`a${a.id}`, 'Reason (5+ characters)')}<button className="btn" disabled={pending === `a${a.id}` || !reasonOk(`a${a.id}`)} onClick={() => verify(a.id, 'verified')}>Verify</button><button className="btn danger" disabled={pending === `a${a.id}` || !reasonOk(`a${a.id}`)} onClick={() => verify(a.id, 'rejected')}>Reject</button></div>)}
    </div>
    <div hidden={activeSection !== 'listings'}>
    {err && <p className="err" role="alert">{err} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {q === null && !err && <p role="status" className="muted">Loading review queue…</p>}
    <h2 id="admin-listings">Listings to review</h2>{q?.listings.length === 0 && <p className="muted">No listings waiting.</p>}
    {q?.listings.map((l: any) => <article key={l.id} className="panel stack review-listing">
      <div className="review-listing-heading"><div><h3>{l.title}</h3><p className="muted">{l.store} · {l.campus} · {l.category}</p></div><span className="tag">{peso(l.price)}</span></div>
      <p className="review-description">{l.description}</p>
      <div className="row">{l.flags.map((f: string) => <span key={f} className="flag">{FLAG_TEXT[f] ?? f}</span>)}{l.flags.length === 0 && <span className="muted">No text/category flags — photos still need human review</span>}</div>
      <p className="muted">{l.images.length} listing {l.images.length === 1 ? 'photo' : 'photos'} to inspect. Photos are not automatically checked for explicit content.</p>
      <div className="review-photos">{l.images.length === 0 && <span className="muted">No photos attached</span>}
        {l.images.map((s: string, i: number) => <a key={s} href={s} target="_blank" rel="noreferrer" aria-label={`Open listing photo ${i + 1} of ${l.images.length} in a new tab`}><img src={s} alt={`Listing photo ${i + 1} of ${l.images.length}`} loading="lazy" /></a>)}</div>
      <label className="review-confirmation">
        <input type="checkbox" checked={photosReviewed[l.id] === true}
          onChange={e => setPhotosReviewed(prev => ({ ...prev, [l.id]: e.target.checked }))}
          disabled={l.images.length === 0 || pending === `l${l.id}`} />
        <span>I personally inspected all {l.images.length} photos and confirm they do not contain pornography, explicit sexual imagery, graphic violence, or other prohibited content.</span>
      </label>
      <div className="review-decision">{field(`l${l.id}`, 'Reason (required, 5+ characters, shown to the seller)')}{!reasonOk(`l${l.id}`) && <span className="muted">Enter a reason of at least 5 characters to enable a decision.</span>}
        <div className="review-actions"><button className="btn" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`) || !photosReviewed[l.id] || l.images.length === 0} onClick={() => decide(l.id, 'approved')}>{pending === `l${l.id}` ? 'Saving decision…' : 'Approve'}</button><button className="btn ghost" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'changes_requested')}>Request changes</button><button className="btn danger" disabled={pending === `l${l.id}` || !reasonOk(`l${l.id}`)} onClick={() => decide(l.id, 'rejected')}>Reject</button></div></div></article>)}
    </div>
    <div hidden={activeSection !== 'reports'}>
    <h2 id="admin-reports">Reports from students</h2>{reportsError && <p className="err" role="alert">Reports could not load: {reportsError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
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
    </div>
    <section hidden={activeSection !== 'transactions'} aria-labelledby="admin-transactions-heading">
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
    {accountAdmin && <section hidden={activeSection !== 'students'} aria-labelledby="student-management-heading">
      <h2 id="student-management-heading">Student accounts</h2>
      <p className="muted">University administrators can suspend and reactivate student accounts. Suspending a student signs out their active sessions and hides their public listings.</p>
      <form className="panel admin-student-filters" role="search" aria-label="Search student accounts" onSubmit={e => { e.preventDefault(); void searchStudents({ q: studentQuery, status: studentStatus, verification: studentVerification, campusId: studentCampusId }); }}>
        <label className="field">Name or email<input type="search" value={studentQuery} onChange={e => setStudentQuery(e.target.value)} maxLength={80} placeholder="Search students" /></label>
        <label className="field">Campus<select value={studentCampusId} onChange={e => setStudentCampusId(e.target.value)}><option value="">All campuses</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field">Account<select value={studentStatus} onChange={e => setStudentStatus(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
        <label className="field">Verification<select value={studentVerification} onChange={e => setStudentVerification(e.target.value)}><option value="">Any status</option><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></label>
        <button className="btn" disabled={studentsLoading} type="submit">Apply filters</button>
      </form>
      {studentsError && <p className="err" role="alert">Students could not load: {studentsError} <button className="btn ghost" type="button" onClick={() => void searchStudents(studentApplied, studentPage)}>Retry</button></p>}
      {studentsLoading && <p role="status" className="muted">Loading student accounts…</p>}
      {!studentsLoading && students && !studentsError && <p className="muted" role="status">{studentTotal === 0 ? 'No matching students.' : `Showing ${(studentPage - 1) * 25 + 1}–${(studentPage - 1) * 25 + students.length} of ${studentTotal} students`}</p>}
      {!studentsError && students && students.length > 0 && <div className="admin-student-layout">
        <div className="admin-student-list" aria-label="Student results">{students.map(student => <button key={student.id} type="button" className="admin-student-row" aria-pressed={selectedStudentId === student.id} onClick={() => setSelectedStudentId(student.id)}>
          <span className="admin-student-name">{student.displayName}<small>{student.email}</small></span>
          <span>{student.affiliations.map((a: any) => a.campus.code).join(', ') || 'No campus'}</span>
          <span>{student.affiliations.some((a: any) => a.verificationStatus === 'verified') ? 'Verified' : 'Unverified'}</span>
          <span className="status">{student.status === 'active' ? 'Active' : 'Suspended'}</span>
        </button>)}</div>
        <aside className="panel admin-student-detail" aria-label="Selected student account">
          {!selectedStudent && <p className="muted">Select a student to view account actions.</p>}
          {selectedStudent && <><h3>{selectedStudent.displayName}</h3><p className="muted">{selectedStudent.email}</p><p>Account: {selectedStudent.status}</p><p>Campus: {selectedStudent.affiliations.map((a: any) => `${a.campus.code} (${a.verificationStatus})`).join(', ') || 'None'}</p>
            {selectedStudent.roles.some((role: any) => ['campus_reviewer', 'university_admin', 'system_admin'].includes(role.role)) ? <p className="muted">Protected staff account — changes require a separate administrative review.</p> : selectedStudent.id !== me?.id && <div className="stack"><label className="field">Reason for account decision<input value={reasons[`u${selectedStudent.id}`] ?? ''} onChange={e => setReasons(previous => ({ ...previous, [`u${selectedStudent.id}`]: e.target.value }))} placeholder="Required reason (10+ characters)" maxLength={500} minLength={10} /></label><button className={selectedStudent.status === 'active' ? 'btn danger' : 'btn'} type="button" disabled={pending === `u${selectedStudent.id}` || (reasons[`u${selectedStudent.id}`] ?? '').trim().length < 10} onClick={() => void changeAccountStatus(selectedStudent.id, selectedStudent.status === 'active' ? 'suspended' : 'active')}>{selectedStudent.status === 'active' ? 'Suspend student' : 'Reactivate student'}</button></div>}
          </>}
        </aside>
      </div>}
      {!studentsError && studentTotal > 25 && <nav className="admin-student-pages" aria-label="Student result pages"><button className="btn ghost" type="button" disabled={studentsLoading || studentPage <= 1} onClick={() => void searchStudents(studentApplied, studentPage - 1)}>Previous</button><span>Page {studentPage} of {Math.ceil(studentTotal / 25)}</span><button className="btn ghost" type="button" disabled={studentsLoading || studentPage * 25 >= studentTotal} onClick={() => void searchStudents(studentApplied, studentPage + 1)}>Next</button></nav>}
    </section>}
    {accountAdmin && activeSection === 'staff' && <ReviewerAdmin active campuses={campuses} />}
    {accountAdmin && activeSection === 'content' && <ManagedContentAdmin />}
    {accountAdmin && <section hidden={activeSection !== 'audit'} aria-labelledby="audit-history-heading">
      <h2 id="audit-history-heading">Administrative audit history</h2>
      <p className="muted">Restricted to university administration. Events are shown newest first.</p>
      {auditError && <p role="alert" className="err">Audit history could not load: {auditError}
        <button className="btn ghost" type="button" onClick={() => void loadAudit(auditCursor ?? undefined)}>Retry</button>
      </p>}
      {auditEvents.length === 0 && !auditLoading && !auditError && <p className="muted">No audit events found.</p>}
      {auditEvents.length > 0 && <><p className="muted" role="status">Showing {auditEvents.length} events, newest first.</p>
        <ol className="admin-audit-list">{auditEvents.map(event => {
          const reason = event.metadata && typeof event.metadata === 'object' && typeof event.metadata.reason === 'string' ? event.metadata.reason : '';
          return <li key={event.id} className="admin-audit-event">
            <div className="admin-audit-main"><strong>{AUDIT_ACTION_TEXT[event.action] ?? event.action.replaceAll('_', ' ').replaceAll('.', ' · ')}</strong><span>{event.targetType} {event.targetId != null ? `#${event.targetId}` : ''}</span></div>
            <p className="admin-audit-byline">{event.actor?.displayName ?? 'System'} <span aria-hidden="true">·</span> <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time></p>
            {reason && <p className="admin-audit-reason">Reason: {reason}</p>}
          </li>;
        })}</ol></>}
      {auditLoading && <p role="status" className="muted">Loading audit history…</p>}
      {auditCursor !== null && !auditLoading && !auditError && <button type="button" className="btn ghost" onClick={() => void loadAudit(auditCursor)}>Load older events</button>}
    </section>}
    <div hidden={activeSection !== 'overview'}>
    <h2 id="admin-overview">Campus overview</h2>{statsError && <p className="err" role="alert">Campus overview could not load: {statsError} <button type="button" className="btn ghost" onClick={load}>Retry</button></p>}
    {!stats && !statsError && <p className="muted" role="status">Loading campus overview…</p>}
    {stats && !statsError && <><p className="muted">{stats.note}</p>
      <div className="grid">{stats.campuses.map((c: any) => <div key={c.campus} className="panel"><h3>{c.campus}</h3>
        <p>Storefronts: {c.activeStorefronts}<br />Published listings: {c.publishedListings}<br />Services: {c.serviceListings}<br />Pending review: {c.pendingReview}<br />Inquiries: {c.inquiries}</p></div>)}</div></>}
    </div>
  </>;
}
