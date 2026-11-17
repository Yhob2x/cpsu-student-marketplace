import { useEffect, useState, type FormEvent } from 'react';
import { api, explain } from './api';

type Campus = { id: number; name: string };
type Reviewer = {
  id: number; displayName: string; email: string; status: 'active' | 'suspended';
  roles: { role: string; campusId: number | null; campus: { code: string; name: string } | null }[];
  _count: { affiliations: number };
};
type Editor = { displayName: string; email: string; campusId: string; status: 'active' | 'suspended'; password: string; reason: string };

export function ReviewerAdmin({ active, campuses, campusesError, onRetryCampuses }: { active: boolean; campuses: Campus[]; campusesError: string; onRetryCampuses: () => void }) {
  const [items, setItems] = useState<Reviewer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [applied, setApplied] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState({ displayName: '', email: '', campusId: '', password: '' });
  const [edit, setEdit] = useState<Editor>({ displayName: '', email: '', campusId: '', status: 'active', password: '', reason: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = items.find(item => item.id === selectedId);

  const load = async (search = applied, nextPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: search, page: String(nextPage), pageSize: '25' });
      const result = await api<{ items: Reviewer[]; total: number; page: number }>(`/admin/reviewers?${params}`);
      setItems(result.items); setTotal(result.total); setPage(result.page); setApplied(search); setError('');
    } catch (cause) { setError(explain(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (active) void load(); }, [active]);
  useEffect(() => {
    if (!selected) return;
    setEdit({ displayName: selected.displayName, email: selected.email,
      campusId: String(selected.roles[0]?.campusId ?? ''), status: selected.status, password: '', reason: '' });
  }, [selected?.id, selected?.displayName, selected?.email, selected?.status, selected?.roles[0]?.campusId]);

  const createReviewer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await api('/admin/reviewers', { body: { ...create, campusId: Number(create.campusId) } });
      setCreate({ displayName: '', email: '', campusId: '', password: '' }); setShowCreate(false);
      setNotice('Reviewer account created. Share the sign-in details privately.');
      await load('', 1);
    } catch (cause) { setError(explain(cause)); }
    finally { setSaving(false); }
  };
  const saveReviewer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    const changes: Record<string, unknown> = {};
    if (edit.displayName.trim() !== selected.displayName) changes.displayName = edit.displayName;
    if (edit.email.trim().toLowerCase() !== selected.email) changes.email = edit.email;
    if (Number(edit.campusId) !== selected.roles[0]?.campusId) changes.campusId = Number(edit.campusId);
    if (edit.status !== selected.status) changes.status = edit.status;
    if (edit.password) changes.password = edit.password;
    if (!Object.keys(changes).length) { setNotice('No reviewer details changed.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api<{ sessionsRevoked: boolean }>(`/admin/reviewers/${selected.id}`, {
        method: 'PATCH', body: { ...changes, reason: edit.reason },
      });
      setNotice(result.sessionsRevoked
        ? changes.status === 'suspended' ? 'Reviewer suspended. Their access is blocked.' : 'Reviewer updated. They will need to sign in again when their current access expires.'
        : 'Reviewer updated.');
      setEdit(previous => ({ ...previous, password: '', reason: '' }));
      await load(applied, page);
    } catch (cause) { setError(explain(cause)); }
    finally { setSaving(false); }
  };

  return <section aria-labelledby="staff-management-heading">
    <div className="sec-head"><div><h2 id="staff-management-heading">Reviewer accounts</h2><p className="muted">Staff logins are separate from student accounts. Campus reviewers can moderate only their assigned campus.</p></div>
      <button type="button" className="btn" onClick={() => { setShowCreate(previous => !previous); setError(''); setNotice(''); }}>{showCreate ? 'Cancel' : 'Add reviewer'}</button></div>
    {error && <p className="err" role="alert">{error}</p>}
    {campusesError && <p className="err" role="alert">Could not load campus choices: {campusesError}. <button className="btn ghost" type="button" onClick={onRetryCampuses}>Retry campuses</button></p>}
    {notice && <p role="status">{notice}</p>}
    {showCreate && <form className="panel stack admin-reviewer-form" onSubmit={createReviewer}>
      <h3>New campus reviewer</h3>
      <label className="field">Full name<input required minLength={2} maxLength={80} autoComplete="name" value={create.displayName} onChange={e => setCreate(previous => ({ ...previous, displayName: e.target.value }))} /></label>
      <label className="field">Email<input required type="email" maxLength={191} autoComplete="off" value={create.email} onChange={e => setCreate(previous => ({ ...previous, email: e.target.value }))} /></label>
      <label className="field">Campus<select required value={create.campusId} onChange={e => setCreate(previous => ({ ...previous, campusId: e.target.value }))}><option value="">Select campus</option>{campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
      <label className="field">Initial password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={create.password} onChange={e => setCreate(previous => ({ ...previous, password: e.target.value }))} /></label>
      <p className="muted">Use a unique password of at least 12 characters. Share it with the reviewer through a private channel.</p>
      <button className="btn" disabled={saving || !campuses.length}>{saving ? 'Creating…' : 'Create reviewer'}</button>
    </form>}
    <form className="panel admin-student-filters" role="search" aria-label="Search reviewers" onSubmit={e => { e.preventDefault(); void load(query.trim(), 1); }}>
      <label className="field">Name or email<input type="search" maxLength={80} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search reviewers" /></label>
      <button className="btn" disabled={loading}>Search</button>
    </form>
    {loading && <p role="status" className="muted">Loading reviewers…</p>}
    {!loading && !error && <p role="status" className="muted">{total === 0 ? 'No reviewers found.' : `Showing ${(page - 1) * 25 + 1}–${(page - 1) * 25 + items.length} of ${total} reviewers`}</p>}
    {items.length > 0 && <div className="admin-student-layout">
      <div className="admin-student-list" aria-label="Reviewer results">{items.map(item => <button key={item.id} type="button" className="admin-student-row" aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}>
        <span className="admin-student-name">{item.displayName}<small>{item.email}</small></span>
        <span>{item.roles[0]?.campus?.code ?? 'No campus'}</span><span>Campus reviewer</span>
        <span className="status">{item.status === 'active' ? 'Active' : 'Suspended'}</span>
      </button>)}</div>
      <aside className="panel admin-student-detail" aria-label="Selected reviewer account">
        {!selected && <p className="muted">Select a reviewer to edit their details.</p>}
        {selected && <form className="stack" onSubmit={saveReviewer}>
          <h3>Edit {selected.displayName}</h3>
          <p className="muted">Role: Campus reviewer{selected._count.affiliations > 0 ? ' · Legacy student affiliation retained for record integrity' : ''}</p>
          <label className="field">Full name<input required minLength={2} maxLength={80} value={edit.displayName} onChange={e => setEdit(previous => ({ ...previous, displayName: e.target.value }))} /></label>
          <label className="field">Email<input required type="email" maxLength={191} value={edit.email} onChange={e => setEdit(previous => ({ ...previous, email: e.target.value }))} /></label>
          <label className="field">Campus<select required value={edit.campusId} onChange={e => setEdit(previous => ({ ...previous, campusId: e.target.value }))}>{campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
          <label className="field">Account status<select value={edit.status} onChange={e => setEdit(previous => ({ ...previous, status: e.target.value as Editor['status'] }))}><option value="active">Active</option><option value="suspended">Suspended</option></select></label>
          <label className="field">New password (optional)<input type="password" minLength={12} maxLength={128} autoComplete="new-password" value={edit.password} onChange={e => setEdit(previous => ({ ...previous, password: e.target.value }))} /></label>
          <label className="field">Reason for change<input required minLength={10} maxLength={500} value={edit.reason} onChange={e => setEdit(previous => ({ ...previous, reason: e.target.value }))} /></label>
          <button className="btn" disabled={saving || !campuses.length}>{saving ? 'Saving…' : 'Save reviewer'}</button>
        </form>}
      </aside>
    </div>}
    {total > 25 && <nav className="admin-student-pages" aria-label="Reviewer result pages"><button type="button" className="btn ghost" disabled={loading || page <= 1} onClick={() => void load(applied, page - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 25)}</span><button type="button" className="btn ghost" disabled={loading || page * 25 >= total} onClick={() => void load(applied, page + 1)}>Next</button></nav>}
  </section>;
}
