import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { CatalogAdmin } from '@/components/admin/catalog-admin';
import { ManagedContentAdmin } from '@/components/admin/managed-content-admin';
import { ReviewerAdmin } from '@/components/admin/reviewer-admin';
import { Icon } from '@/components/icons';
import { StoreReviewModeration } from '@/components/stores/store-review-widgets';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { api, explain, peso } from '@/lib/api';
import { assessListingReadability } from '@/lib/listings/listing-quality';
import { statusLabels, type TransactionStatus } from '@/lib/transactions/transaction-flow';
import { useMe } from '@/providers/session-provider';

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
  'seller.avatar_published': 'Seller photo updated', 'seller.avatar_removed': 'Seller photo removed',
  'campus.created': 'Campus added', 'campus.updated': 'Campus updated',
  'service_category.created': 'Service category added', 'service_category.updated': 'Service category renamed',
  'category.created': 'Listing category added', 'category.updated': 'Listing category renamed',
};

export function Admin() {
  const { syncQueue, me } = useMe();
  const accountAdmin = Boolean(me?.roles.some(role => role.role === 'university_admin' && role.campusId === null));
  const [q, setQ] = useState<any>(null); const [stats, setStats] = useState<any>(null); const [err, setErr] = useState(''); const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState('');
  const [pendingAction, setPendingAction] = useState('');
  const [activeSection, setActiveSection] = useState(() => accountAdmin ? 'overview' : 'listings');
  useEffect(() => { if (me) setActiveSection(accountAdmin ? 'overview' : 'listings'); }, [me?.id, accountAdmin]);
  const [selectedListingId, setSelectedListingId] = useState<number | null>(null);
  const [photosReviewed, setPhotosReviewed] = useState<Record<number, boolean>>({});
  const [reports, setReports] = useState<any[] | null>(null);
  const [reportsError, setReportsError] = useState('');
  const [reportActionError, setReportActionError] = useState('');
  const [reportReasons, setReportReasons] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState('');
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
  const [reviewerCampusId, setReviewerCampusId] = useState('');
  const [reviewerReason, setReviewerReason] = useState('');
  const [studentTotal, setStudentTotal] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [campuses, setCampuses] = useState<{ id: number; name: string }[]>([]);
  const [campusesError, setCampusesError] = useState('');
  const [students, setStudents] = useState<any[] | null>(null);
  const [studentsError, setStudentsError] = useState('');
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditCursor, setAuditCursor] = useState<number | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const refreshQueues = () => Promise.all([
    api('/admin/review-queue').then(r => {
      setQ(r); setErr('');
      void syncQueue(r.listings.length + r.affiliations.length + (r.reportsPending ?? 0));
    }).catch(e => setErr(explain(e))),
    api('/admin/reports').then(r => { setReports(r); setReportsError(''); }).catch(e => setReportsError(explain(e))),
  ]);
  const refreshStats = () => api('/admin/analytics/overview')
    .then(r => { setStats(r); setStatsError(''); }).catch(e => setStatsError(explain(e)));
  const load = () => { void refreshQueues(); void refreshStats(); };
  useEffect(() => { if (me) load(); }, [me?.id]);
  // Queue, verification and report cases must appear for a reviewer without navigation.
  // Do not touch in-progress decision text or photo confirmations.
  useForegroundRefresh(() => {
    if (!pending) refreshQueues();
  }, 5_000, Boolean(me));
  useForegroundRefresh(() => {
    if (!pending) return refreshStats();
  }, 15_000, Boolean(me));
  const loadTransactions = async (page = 1) => {
    setTransactionLoading(true);
    try {
      const result = await api<{ items: any[]; total: number }>(`/admin/transactions?page=${page}&pageSize=20`);
      setMonitoredTransactions(prev => page === 1 ? result.items : [...prev, ...result.items]);
      setTransactionCount(result.total); setTransactionPage(page); setTransactionError('');
    } catch (e) { setTransactionError(explain(e)); }
    finally { setTransactionLoading(false); }
  };
  useEffect(() => { if (me) void loadTransactions(); }, [me?.id]);
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
  const loadCampuses = async () => {
    try { setCampuses(await api<{ id: number; name: string }[]>('/campuses')); setCampusesError(''); }
    catch (e) { setCampusesError(explain(e)); }
  };
  useEffect(() => { if (accountAdmin) { void searchStudents(); void loadAudit(); void loadCampuses(); } }, [accountAdmin]);
  const assignStudentReviewer = async (id: number) => {
    if (!reviewerCampusId || reviewerReason.trim().length < 10) return;
    setPending(`reviewer-${id}`);
    try {
      await api(`/admin/users/${id}/assign-reviewer`, { method: 'POST', body: {
        campusId: Number(reviewerCampusId), reason: reviewerReason.trim(),
      } });
      setReviewerCampusId(''); setReviewerReason(''); setSelectedStudentId(null);
      setErr(''); setNotice('Reviewer assigned. Existing sessions revoked; they must sign in again.');
      showActionFeedback({ kind: 'success', title: 'Reviewer assigned', message: 'The student must sign in again to use reviewer access.' });
      await searchStudents(studentApplied, studentPage);
    } catch (e) { setErr(explain(e)); }
    finally { setPending(''); }
  };
  const changeAccountStatus = async (id: number, status: 'active' | 'suspended') => {
    const reason = (reasons[`u${id}`] ?? '').trim();
    if (reason.length < 10) return;
    setPending(`u${id}`);
    try {
      await api(`/admin/users/${id}/status`, { method: 'PATCH', body: { status, reason } });
      setReasons(previous => ({ ...previous, [`u${id}`]: '' }));
      setErr('');
      setNotice(`Student #${id} ${status === 'suspended' ? 'suspended' : 'reactivated'}.`);
      showActionFeedback({ kind: 'success', title: status === 'suspended' ? 'Account suspended' : 'Account reactivated', message: 'The student account status was updated.' });
      await searchStudents(studentApplied, studentPage, true);
    } catch (e) { setErr(explain(e)); }
    finally { setPending(''); }
  };
  const resolveReport = async (id: number, status: 'resolved' | 'dismissed') => {
    const reason = (reportReasons[id] ?? '').trim();
    if (reason.length < 10) return;
    setPending(`r${id}`); setPendingAction(status); setReportActionError(''); setNotice('');
    try {
      await api(`/admin/reports/${id}/resolve`, { body: { status, reason } });
      setReportReasons(previous => ({ ...previous, [id]: '' }));
      setNotice(`Report #${id} ${status === 'resolved' ? 'resolved' : 'dismissed'}. Your reason was recorded.`);
      showActionFeedback({ kind: 'success', title: status === 'resolved' ? 'Report resolved' : 'Report dismissed', message: 'The reason was recorded for the audit trail.' });
      load();
    } catch (e) { setReportActionError(explain(e)); }
    finally { setPending(''); setPendingAction(''); }
  };
  const decide = async (id: number, decision: string) => {
    setPending(`l${id}`); setPendingAction(decision);
    try { await api(`/admin/listings/${id}/decision`, { body: {
      decision, reason: (reasons[`l${id}`] ?? '').trim(),
      ...(decision === 'approved' ? { photosReviewed: photosReviewed[id] === true } : {}),
    } }); setErr(''); setPhotosReviewed(prev => ({ ...prev, [id]: false }));
      setReasons(prev => ({ ...prev, [`l${id}`]: '' }));
      setNotice(`Listing #${id}: ${decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'changes requested'}.`);
      showActionFeedback({ kind: 'success', title: 'Listing decision recorded', message: 'The moderation decision has been saved.' });
      load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); setPendingAction(''); }
  };
  const verify = async (id: number, decision: string) => {
    setPending(`a${id}`); setPendingAction(decision);
    try { await api(`/admin/affiliations/${id}/verify`, { body: { decision, reason: (reasons[`a${id}`] ?? '').trim() } });
      setErr(''); setReasons(prev => ({ ...prev, [`a${id}`]: '' }));
      setNotice(`Student affiliation #${id} ${decision === 'verified' ? 'verified' : 'rejected'}.`);
      showActionFeedback({ kind: 'success', title: 'Affiliation decision recorded', message: 'The verification decision has been saved.' });
      load(); } catch (e) { setErr(explain(e)); } finally { setPending(''); setPendingAction(''); }
  };
  const field = (k: string, ph: string, min = 5) => <Field className="moderation-reason">
    {k.startsWith('a') ? 'Verification reason' : 'Decision reason'}
    <input placeholder={ph} value={reasons[k] ?? ''} onChange={e => setReasons({ ...reasons, [k]: e.target.value })} required minLength={min} maxLength={k.startsWith('a') ? 500 : 1000} />
  </Field>;
  const reasonOk = (k: string, min = 5) => (reasons[k] ?? '').trim().length >= min;
  const selectedStudent = students?.find(student => student.id === selectedStudentId);
  const selectedListing = q?.listings.find((listing: any) => listing.id === selectedListingId) ?? q?.listings[0];
  type NavItem = { id: string; label: string; count?: number };
  const navGroups: { title: string; items: NavItem[] }[] = accountAdmin
    ? [
      { title: 'Dashboard', items: [{ id: 'overview', label: 'Overview' }] },
      { title: 'Management', items: [{ id: 'students', label: 'Students' }, { id: 'staff', label: 'Reviewer accounts' }, { id: 'catalog', label: 'Campuses & categories' }, { id: 'content', label: 'Content' }] },
      { title: 'Review & safety', items: [
        { id: 'listings', label: 'Listing reviews', count: q?.listings.length },
        { id: 'affiliations', label: 'Verifications', count: q?.affiliations.length },
        { id: 'reports', label: 'Reports', count: reports?.length },
        { id: 'store-reviews', label: 'Store ratings' },
      ] },
      { title: 'Monitoring', items: [{ id: 'transactions', label: 'Transactions' }, { id: 'audit', label: 'Audit history' }] },
    ]
    : [
      { title: 'Review queue', items: [
        { id: 'listings', label: 'Listing reviews', count: q?.listings.length },
        { id: 'affiliations', label: 'Verifications', count: q?.affiliations.length },
        { id: 'reports', label: 'Reports', count: reports?.length },
        { id: 'store-reviews', label: 'Store ratings' },
      ] },
      { title: 'Monitoring', items: [{ id: 'transactions', label: 'Transactions' }, { id: 'overview', label: 'Campus overview' }] },
    ];
  const changeSection = (id: string) => { setActiveSection(id); setNotice(''); };
  return <div className="admin-workspace">
    <div className="page-head"><div><h1>{accountAdmin ? 'University administration' : 'Campus review workspace'}</h1>
      <p className="muted">{accountAdmin ? 'Manage students, reviews and campus activity.' : 'Review listings, affiliations and reports for your campus.'}</p></div>
      <Link className="btn ghost admin-marketplace-search" to="/explore" aria-label="Search marketplace listings"><Icon name="search" size={17} /> Search marketplace</Link></div>
    {notice && <p className="admin-action-notice" role="status">{notice}</p>}
    <Field className="admin-workspace-mobile-nav">Workspace section
      <select value={activeSection} onChange={event => changeSection(event.target.value)}>
        {navGroups.map(group => <optgroup label={group.title} key={group.title}>{group.items.map(item =>
          <option key={item.id} value={item.id}>{item.label}{item.count !== undefined ? ` (${item.count})` : ''}</option>)}</optgroup>)}
      </select>
    </Field>
    <div className="admin-workspace-layout">
      <nav className="admin-workspace-nav" aria-label="Administration sections">
        {navGroups.map(group => <div className="admin-workspace-nav-group" key={group.title}>
          <p className="admin-workspace-nav-title">{group.title}</p>
          {group.items.map(item => <button type="button" key={item.id}
            aria-current={activeSection === item.id ? 'page' : undefined}
            className="admin-workspace-nav-item" onClick={() => changeSection(item.id)}>
            <span>{item.label}</span>{item.count !== undefined && <span className="admin-workspace-count">{item.count}</span>}
          </button>)}
        </div>)}
      </nav>
      <div className="admin-workspace-main" id="admin-workspace-main">
    <div hidden={activeSection !== 'affiliations'}>
    {err && <p className="err" role="alert">{err} <LegacyButton type="button" className="ghost" onClick={load}>Retry</LegacyButton></p>}
    {q === null && !err && <p role="status" className="muted">Loading review queue…</p>}
    <h2 id="admin-affiliations">Affiliations to verify</h2><p className="muted">This queue does not contain proof of enrollment. Confirm affiliation using authorized campus records before deciding.</p>{q?.affiliations.length === 0 && <p className="muted">All caught up.</p>}
    {q?.affiliations.map((a: any) => <Panel key={a.id} className="row"><div style={{ flex: 1 }}><h3>{a.user.displayName}</h3><span className="muted">{a.campus} · {a.user.email} · Affiliation #{a.id}</span></div>
      {field(`a${a.id}`, 'Reason (5+ characters)')}
      <div className="admin-inline-actions">
        <LegacyButton type="button" className="" disabled={Boolean(pending) || !reasonOk(`a${a.id}`)}
          aria-busy={pending === `a${a.id}` && pendingAction === 'verified'}
          aria-label={`Verify affiliation for ${a.user.displayName}`} onClick={() => verify(a.id, 'verified')}>
          {pending === `a${a.id}` && pendingAction === 'verified' ? 'Verifying…' : 'Verify'}
        </LegacyButton>
        <LegacyButton type="button" className="danger-outline" disabled={Boolean(pending) || !reasonOk(`a${a.id}`)}
          aria-busy={pending === `a${a.id}` && pendingAction === 'rejected'}
          aria-label={`Reject affiliation for ${a.user.displayName}`} onClick={() => verify(a.id, 'rejected')}>
          {pending === `a${a.id}` && pendingAction === 'rejected' ? 'Rejecting…' : 'Reject'}
        </LegacyButton>
      </div></Panel>)}
    </div>
    <div hidden={activeSection !== 'listings'}>
    {err && <p className="err" role="alert">{err} <LegacyButton type="button" className="ghost" onClick={load}>Retry</LegacyButton></p>}
    {q === null && !err && <p role="status" className="muted">Loading review queue…</p>}
    <h2 id="admin-listings">Listings to review</h2>{q?.listings.length === 0 && <p className="muted">No listings waiting.</p>}
    {q?.listings.length > 0 && <div className="admin-review-layout">
      <Field className="admin-review-mobile-picker">Choose a listing to review
        <select value={selectedListing?.id ?? ''} onChange={event => setSelectedListingId(Number(event.target.value))}>
          {q.listings.map((listing: any) => <option value={listing.id} key={listing.id}>{listing.title} · {listing.campus}</option>)}
        </select>
      </Field>
      <section className="admin-review-queue" aria-label="Pending listing queue">
        <p className="muted">Select a listing to review.</p>
        {q.listings.map((listing: any) => <button type="button" key={listing.id}
          className="admin-review-queue-item" aria-pressed={selectedListing?.id === listing.id}
          onClick={() => setSelectedListingId(listing.id)}>
          <strong>{listing.title}</strong>
          <span>{listing.campus} · {listing.store}</span>
          <span>{assessListingReadability(listing.title, listing.description).length > 0 ? 'Check listing clarity' : listing.flags.length ? `${listing.flags.length} policy flag${listing.flags.length === 1 ? '' : 's'}` : 'Awaiting photo review'}</span>
        </button>)}
      </section>
      <div className="admin-review-detail">
        {q.listings.filter((listing: any) => listing.id === selectedListing?.id).map((l: any) => <Panel as="article" key={l.id} className="stack review-listing">
      <div className="review-listing-heading"><div><h3>{l.title}</h3><p className="muted">{l.store} · {l.campus} · {l.category}</p></div><span className="tag">{peso(l.price)}</span></div>
      <p className="review-description">{l.description}</p>
      {assessListingReadability(l.title, l.description).length > 0 && <aside className="review-listing-clarity" aria-label="Listing clarity guidance">
        <strong>Content clarity review</strong>
        <ul>{assessListingReadability(l.title, l.description).map(issue => <li key={issue}>{issue}</li>)}</ul>
        <p>Editorial suggestions only. Check the actual listing and request changes where needed; no automatic rejection or title changes.</p>
      </aside>}
      <div className="row">{l.flags.map((f: string) => <span key={f} className="flag">{FLAG_TEXT[f] ?? f}</span>)}{l.flags.length === 0 && <span className="muted">No text/category flags — photos still need human review</span>}</div>
      <p className="muted">Inspect all {l.images.length} {l.images.length === 1 ? 'photo' : 'photos'}; check that photos show the advertised item or service, not unrelated content. Explicit content is not checked automatically.</p>
      <div className="review-photos">{l.images.length === 0 && <span className="muted">No photos attached</span>}
        {l.images.map((s: string, i: number) => <a key={s} href={s} target="_blank" rel="noreferrer" aria-label={`Open listing photo ${i + 1} of ${l.images.length} in a new tab`}><img src={s} alt={`Listing photo ${i + 1} of ${l.images.length}`} loading="lazy" /></a>)}</div>
      <label className="review-confirmation">
        <input type="checkbox" checked={photosReviewed[l.id] === true}
          onChange={e => setPhotosReviewed(prev => ({ ...prev, [l.id]: e.target.checked }))}
          disabled={l.images.length === 0 || pending === `l${l.id}`} />
        <span>I personally inspected all {l.images.length} photos and confirm they do not contain pornography, explicit sexual imagery, graphic violence, or other prohibited content.</span>
      </label>
      <div className="review-decision">{field(`l${l.id}`, 'Reason (required, 5+ characters, shown to the seller)')}{!reasonOk(`l${l.id}`) && <span className="muted">Enter a reason of at least 5 characters to enable a decision.</span>}{l.flags.includes('academic_integrity_concern') && <span className="muted">Academic-integrity flag: approval requires a documented reason of at least 20 characters.</span>}
        <div className="review-actions" role="group" aria-label={`Review decision for ${l.title}`}>
          <LegacyButton type="button" className="" disabled={Boolean(pending) || !reasonOk(`l${l.id}`, l.flags.includes('academic_integrity_concern') ? 20 : 5) || !photosReviewed[l.id] || l.images.length === 0}
            aria-busy={pending === `l${l.id}` && pendingAction === 'approved'} onClick={() => decide(l.id, 'approved')}>
            {pending === `l${l.id}` && pendingAction === 'approved' ? 'Approving…' : 'Approve'}
          </LegacyButton>
          <LegacyButton type="button" className="ghost" disabled={Boolean(pending) || !reasonOk(`l${l.id}`)}
            aria-busy={pending === `l${l.id}` && pendingAction === 'changes_requested'} onClick={() => decide(l.id, 'changes_requested')}>
            {pending === `l${l.id}` && pendingAction === 'changes_requested' ? 'Requesting…' : 'Request changes'}
          </LegacyButton>
          <LegacyButton type="button" className="danger-outline" disabled={Boolean(pending) || !reasonOk(`l${l.id}`)}
            aria-busy={pending === `l${l.id}` && pendingAction === 'rejected'} onClick={() => decide(l.id, 'rejected')}>
            {pending === `l${l.id}` && pendingAction === 'rejected' ? 'Rejecting…' : 'Reject'}
          </LegacyButton>
        </div></div></Panel>)}
      </div>
    </div>}
    </div>
    <div hidden={activeSection !== 'reports'}>
    <h2 id="admin-reports">Reports from students</h2><p className="muted">Review the report and record your findings. Closing it does not suspend the subject.</p>{reportsError && <p className="err" role="alert">Reports could not load: {reportsError} <LegacyButton type="button" className="ghost" onClick={load}>Retry</LegacyButton></p>}{reportActionError && <p className="err" role="alert">Could not save the report decision: {reportActionError}. Your findings are retained; check and retry the decision.</p>}
    {reports === null && !reportsError && <p className="muted" role="status">Loading reports…</p>}
    {reports?.length === 0 && !reportsError && <p className="muted">No open reports.</p>}
    {!reportsError && reports?.map(rep => <Panel key={rep.id} className="row"><div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ maxWidth: '65ch', margin: 0 }}>{rep.reason}</p>
      <p className="muted" style={{ margin: '.15rem 0 0' }}>
        {rep.listingId && <><Link to={`/listings/${rep.listingId}`}>View listing</Link> · </>}
        {rep.sellerProfileId && <><Link to={`/stores/${rep.sellerProfileId}`}>View store</Link> · </>}
        {new Date(rep.createdAt).toLocaleString()}
      </p></div>
      <Field className="moderation-reason">Investigation findings for report #{rep.id}
        <textarea rows={2} minLength={10} maxLength={1000} value={reportReasons[rep.id] ?? ''} onChange={e => setReportReasons(previous => ({ ...previous, [rep.id]: e.target.value }))} placeholder="Record what you checked and why this decision is appropriate" />
      </Field>
      <div className="admin-inline-actions">
        <LegacyButton type="button" className="" disabled={Boolean(pending) || (reportReasons[rep.id] ?? '').trim().length < 10}
          aria-busy={pending === `r${rep.id}` && pendingAction === 'resolved'}
          aria-label={`Resolve report ${rep.id}`} onClick={() => resolveReport(rep.id, 'resolved')}>
          {pending === `r${rep.id}` && pendingAction === 'resolved' ? 'Resolving…' : 'Resolve'}
        </LegacyButton>
        <LegacyButton type="button" className="ghost" disabled={Boolean(pending) || (reportReasons[rep.id] ?? '').trim().length < 10}
          aria-busy={pending === `r${rep.id}` && pendingAction === 'dismissed'}
          aria-label={`Dismiss report ${rep.id}`} onClick={() => resolveReport(rep.id, 'dismissed')}>
          {pending === `r${rep.id}` && pendingAction === 'dismissed' ? 'Dismissing…' : 'Dismiss'}
        </LegacyButton>
      </div></Panel>)}
    </div>
    {activeSection === 'store-reviews' && <StoreReviewModeration />}
    <section hidden={activeSection !== 'transactions'} aria-labelledby="admin-transactions-heading">
      <h2 id="admin-transactions-heading">Transaction monitoring</h2>
      <p className="muted">Read-only campus records. Completed means both students confirmed; payments are unverified. Private messages are hidden.</p>
      {transactionError && <p role="alert" className="err">Transactions could not load: {transactionError} <LegacyButton type="button" className="ghost" onClick={() => void loadTransactions(transactionPage)}>Retry</LegacyButton></p>}
      {!transactionLoading && !transactionError && monitoredTransactions.length === 0 && <p className="muted">No transactions to monitor.</p>}
      <div className="stack admin-transaction-list">{monitoredTransactions.map(t => <Panel as="article" className="admin-transaction-row" key={t.id}>
        <div><strong>{t.listing.title}</strong>
          <p className="muted">#{t.id} · {t.listing.campus.code} · {t.listing.type === 'service' ? 'Service' : 'Product'}</p>
          <time className="muted" dateTime={t.createdAt}>{new Date(t.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time>
        </div>
        <span className={'transaction-status transaction-status--' + t.status}>
          {statusLabels[t.status as TransactionStatus] ?? String(t.status).replaceAll('_', ' ')}
        </span>
      </Panel>)}</div>
      {transactionLoading && <p role="status" className="muted">Loading transaction records…</p>}
      {!transactionLoading && !transactionError && monitoredTransactions.length < transactionCount && <LegacyButton type="button" className="ghost" onClick={() => void loadTransactions(transactionPage + 1)}>Load more transactions</LegacyButton>}
    </section>
    {accountAdmin && <section hidden={activeSection !== 'students'} aria-labelledby="student-management-heading">
      <h2 id="student-management-heading">Student accounts</h2>
      <p className="muted">Suspending a student signs them out and hides their public listings.</p>
      <form className="panel admin-student-filters" role="search" aria-label="Search student accounts" onSubmit={e => { e.preventDefault(); void searchStudents({ q: studentQuery, status: studentStatus, verification: studentVerification, campusId: studentCampusId }); }}>
        <Field className="">Name or email<input type="search" value={studentQuery} onChange={e => setStudentQuery(e.target.value)} maxLength={80} placeholder="Search students" /></Field>
        <Field className="">Campus<select value={studentCampusId} onChange={e => setStudentCampusId(e.target.value)}><option value="">All campuses</option>{campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field className="">Account<select value={studentStatus} onChange={e => setStudentStatus(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option></select></Field>
        <Field className="">Verification<select value={studentVerification} onChange={e => setStudentVerification(e.target.value)}><option value="">Any status</option><option value="unverified">Unverified</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select></Field>
        <LegacyButton className="" disabled={studentsLoading} type="submit">Apply filters</LegacyButton>
      </form>
      {studentsError && <p className="err" role="alert">Students could not load: {studentsError} <LegacyButton className="ghost" type="button" onClick={() => void searchStudents(studentApplied, studentPage)}>Retry</LegacyButton></p>}
      {studentsLoading && <p role="status" className="muted">Loading student accounts…</p>}
      {!studentsLoading && students && !studentsError && <p className="muted" role="status">{studentTotal === 0 ? 'No matching students.' : `Showing ${(studentPage - 1) * 25 + 1}–${(studentPage - 1) * 25 + students.length} of ${studentTotal} students`}</p>}
      {!studentsError && students && students.length > 0 && <div className="admin-student-layout">
        <div className="admin-student-list" aria-label="Student results">{students.map(student => <button key={student.id} type="button" className="admin-student-row" aria-pressed={selectedStudentId === student.id} onClick={() => { setSelectedStudentId(student.id); setReviewerCampusId(''); setReviewerReason(''); }}>
          <span className="admin-student-name">{student.displayName}<small>{student.email}</small></span>
          <span>{student.affiliations.map((a: any) => a.campus.code).join(', ') || 'No campus'}</span>
          <span>{student.affiliations.some((a: any) => a.verificationStatus === 'verified') ? 'Verified' : 'Unverified'}</span>
          <span className="status">{student.status === 'active' ? 'Active' : 'Suspended'}</span>
        </button>)}</div>
        <Panel as="aside" className="admin-student-detail" aria-label="Selected student account">
          {!selectedStudent && <p className="muted">Select a student to view account actions.</p>}
          {selectedStudent && <><h3>{selectedStudent.displayName}</h3><p className="muted">{selectedStudent.email}</p><p>Account: {selectedStudent.status}</p><p>Campus: {selectedStudent.affiliations.map((a: any) => `${a.campus.code} (${a.verificationStatus})`).join(', ') || 'None'}</p>
            {selectedStudent.roles.some((role: any) => ['campus_reviewer', 'university_admin', 'system_admin'].includes(role.role)) ? <p className="muted">Protected staff account — changes require a separate administrative review.</p> : selectedStudent.id !== me?.id && <div className="stack"><Field className="">Reason for account decision<input value={reasons[`u${selectedStudent.id}`] ?? ''} onChange={e => setReasons(previous => ({ ...previous, [`u${selectedStudent.id}`]: e.target.value }))} placeholder="Required reason (10+ characters)" maxLength={500} minLength={10} /></Field><button className={selectedStudent.status === 'active' ? 'btn danger' : 'btn'} type="button" disabled={pending === `u${selectedStudent.id}` || (reasons[`u${selectedStudent.id}`] ?? '').trim().length < 10} onClick={() => void changeAccountStatus(selectedStudent.id, selectedStudent.status === 'active' ? 'suspended' : 'active')}>{selectedStudent.status === 'active' ? 'Suspend student' : 'Reactivate student'}</button></div>}
            {selectedStudent.status === 'active' && selectedStudent.roles.length === 0 && selectedStudent.id !== me?.id && <div className="stack">
              <h4>Assign campus reviewer</h4>
              <p className="muted">Only students with an active, verified campus affiliation are eligible. Assigning changes their access to staff and signs them out.</p>
              <Field className="">Review campus<select value={reviewerCampusId} onChange={e => setReviewerCampusId(e.target.value)}>
                <option value="">Choose a verified campus</option>
                {campuses.filter(c => selectedStudent.affiliations.some((a: any) => a.campus.id === c.id && a.verificationStatus === 'verified' && (!a.expirationAt || new Date(a.expirationAt) > new Date()))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></Field>
              <Field className="">Reason for assignment<input value={reviewerReason} onChange={e => setReviewerReason(e.target.value)} minLength={10} maxLength={500} placeholder="Required reason (10+ characters)" /></Field>
              <LegacyButton className="" type="button" disabled={pending === `reviewer-${selectedStudent.id}` || !reviewerCampusId || reviewerReason.trim().length < 10} onClick={() => void assignStudentReviewer(selectedStudent.id)}>Assign as reviewer</LegacyButton>
            </div>}
          </>}
        </Panel>
      </div>}
      {!studentsError && studentTotal > 25 && <nav className="admin-student-pages" aria-label="Student result pages"><LegacyButton className="ghost" type="button" disabled={studentsLoading || studentPage <= 1} onClick={() => void searchStudents(studentApplied, studentPage - 1)}>Previous</LegacyButton><span>Page {studentPage} of {Math.ceil(studentTotal / 25)}</span><LegacyButton className="ghost" type="button" disabled={studentsLoading || studentPage * 25 >= studentTotal} onClick={() => void searchStudents(studentApplied, studentPage + 1)}>Next</LegacyButton></nav>}
    </section>}
    {accountAdmin && activeSection === 'staff' && <ReviewerAdmin active campuses={campuses} campusesError={campusesError} onRetryCampuses={() => void loadCampuses()} />}
    {accountAdmin && activeSection === 'content' && <ManagedContentAdmin />}
    {accountAdmin && activeSection === 'catalog' && <CatalogAdmin onCampusesChange={() => { void loadCampuses(); }} />}
    {accountAdmin && <section hidden={activeSection !== 'audit'} aria-labelledby="audit-history-heading">
      <h2 id="audit-history-heading">Administrative audit history</h2>
      <p className="muted">Newest first.</p>
      {auditError && <p role="alert" className="err">Audit history could not load: {auditError}
        <LegacyButton className="ghost" type="button" onClick={() => void loadAudit(auditCursor ?? undefined)}>Retry</LegacyButton>
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
      {auditCursor !== null && !auditLoading && !auditError && <LegacyButton type="button" className="ghost" onClick={() => void loadAudit(auditCursor)}>Load older events</LegacyButton>}
    </section>}
    <div hidden={activeSection !== 'overview'}>
    <h2 id="admin-overview">{accountAdmin ? 'University dashboard' : 'Campus overview'}</h2>
    {accountAdmin && <div className="admin-overview-shortcuts" role="group" aria-label="Pending administration work">
      <button type="button" onClick={() => changeSection('listings')}><strong>{q?.listings.length ?? '—'}</strong><span>Listing reviews</span></button>
      <button type="button" onClick={() => changeSection('affiliations')}><strong>{q?.affiliations.length ?? '—'}</strong><span>Verifications</span></button>
      <button type="button" onClick={() => changeSection('reports')}><strong>{reports?.length ?? '—'}</strong><span>Open reports</span></button>
    </div>}
    {statsError && <p className="err" role="alert">Campus overview could not load: {statsError} <LegacyButton type="button" className="ghost" onClick={load}>Retry</LegacyButton></p>}
    {!stats && !statsError && <p className="muted" role="status">Loading campus overview…</p>}
    {stats && !statsError && <><p className="muted">{stats.note}</p>
      <div className="grid">{stats.campuses.map((c: any) => <Panel key={c.campus} className=""><h3>{c.campus}</h3>
        <p>Storefronts: {c.activeStorefronts}<br />Published listings: {c.publishedListings}<br />Services: {c.serviceListings}<br />Pending review: {c.pendingReview}<br />Inquiries: {c.inquiries}</p></Panel>)}</div></>}
    </div>
      </div>
    </div>
  </div>;
}
