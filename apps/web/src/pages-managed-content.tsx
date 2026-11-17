import { useEffect, useState } from 'react';
import { api, explain } from './api';

type Guidelines = { draftBody: string; publishedBody: string | null; publishedAt: string | null };
type Announcement = { id: number; title: string; body: string; pendingTitle: string | null; pendingBody: string | null; status: 'draft' | 'published' | 'archived'; publishedAt: string | null };

export function ManagedContentAdmin() {
  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);
  const [draft, setDraft] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => {
    try {
      const [g, a] = await Promise.all([api<Guidelines>('/admin/content/guidelines'), api<{ items: Announcement[] }>('/admin/content/announcements')]);
      setGuidelines(g); setDraft(g.draftBody); setAnnouncements(a.items); setError('');
    } catch (e) { setError(explain(e)); }
  };
  useEffect(() => { void load(); }, []);
  const act = async (work: () => Promise<void>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(message); }
    catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  };
  const saveGuidelines = () => act(async () => {
    const g = await api<Guidelines>('/admin/content/guidelines', { method: 'PUT', body: { body: draft } });
    setGuidelines(g);
  }, 'Guideline draft saved. Students still see the published version.');
  const publishGuidelines = () => act(async () => {
    const g = await api<Guidelines>('/admin/content/guidelines/publish', { method: 'POST', body: { expectedBody: guidelines?.draftBody } });
    setGuidelines(g); setDraft(g.draftBody);
  }, 'Guidelines published for students.');
  const select = (item: Announcement | null) => {
    setSelectedId(item?.id ?? null); setTitle(item?.pendingTitle ?? item?.title ?? ''); setBody(item?.pendingBody ?? item?.body ?? ''); setNotice(''); setError('');
  };
  const saveAnnouncement = () => act(async () => {
    const endpoint = selectedId ? `/admin/content/announcements/${selectedId}` : '/admin/content/announcements';
    const item = await api<Announcement>(endpoint, { method: selectedId ? 'PATCH' : 'POST', body: { title, body } });
    setAnnouncements(prev => [item, ...prev.filter(a => a.id !== item.id)]);
    setSelectedId(item.id);
  }, 'Announcement draft saved. Publish it when approved.');
  const changeAnnouncement = (action: 'publish' | 'archive') => act(async () => {
    const item = await api<Announcement>(`/admin/content/announcements/${selectedId}/${action}`, { method: 'POST', ...(action === 'publish' ? { body: { expectedTitle: title, expectedBody: body } } : {}) });
    setAnnouncements(prev => prev.map(a => a.id === item.id ? item : a));
    select(item);
  }, action === 'publish' ? 'Announcement published for students.' : 'Announcement archived. It is no longer visible to students.');
  const selected = announcements.find(a => a.id === selectedId);
  return <div className="admin-content-editor">
    <h2>Student-facing content</h2>
    <p className="muted">Confirm institutional approval before publishing policy text.</p>
    {error && <p className="err" role="alert">{error} <button className="btn ghost" type="button" onClick={() => void load()}>Retry</button></p>}
    {notice && <p role="status" className="muted">{notice}</p>}
    {!guidelines && !error && <p role="status">Loading content…</p>}
    {guidelines && <section className="panel stack" aria-labelledby="guideline-editor-title">
      <div><h3 id="guideline-editor-title">Marketplace guidelines</h3><p className="muted">{guidelines.publishedAt ? `Published ${new Date(guidelines.publishedAt).toLocaleDateString('en-PH')}` : 'No managed version published yet. Students see the existing guidelines.'}</p></div>
      <label className="field">Draft text <span className="muted">Use # at the start of a line for a section heading. Plain text only.</span>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={10000} rows={15} disabled={busy} />
      </label>
      {draft !== guidelines.draftBody && <p className="muted">You have unsaved changes.</p>}
      <div className="row"><button type="button" className="btn ghost" disabled={busy || !draft.trim() || draft === guidelines.draftBody} onClick={saveGuidelines}>Save draft</button>
        <button type="button" className="btn" disabled={busy || !guidelines.draftBody || draft !== guidelines.draftBody || draft === guidelines.publishedBody} onClick={publishGuidelines}>Publish saved draft</button></div>
    </section>}
    <section aria-labelledby="announcement-editor-title">
      <h3 id="announcement-editor-title">Announcements</h3>
      <p className="muted">Drafts stay private. Archived announcements disappear from student view.</p>
      <div className="admin-content-grid"><div className="admin-content-list"><button type="button" className="btn ghost" onClick={() => select(null)}>New announcement</button>
        {announcements.map(a => <button type="button" key={a.id} className="admin-content-item" aria-pressed={selectedId === a.id} onClick={() => select(a)}><strong>{a.pendingTitle ?? a.title}</strong><span>{a.status}{a.pendingBody != null ? ' · unpublished edits' : ''}</span></button>)}
      </div><div className="panel stack">
        <label className="field">Title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} disabled={busy || selected?.status === 'archived'} /></label>
        <label className="field">Message<textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={7} disabled={busy || selected?.status === 'archived'} /></label>
        <div className="row"><button className="btn ghost" type="button" disabled={busy || selected?.status === 'archived' || !title.trim() || !body.trim()} onClick={saveAnnouncement}>Save draft</button>
          {selected && selected.status !== 'archived' && <><button className="btn" type="button" disabled={busy || title !== (selected.pendingTitle ?? selected.title) || body !== (selected.pendingBody ?? selected.body) || (selected.status === 'published' && selected.pendingBody == null)} onClick={() => changeAnnouncement('publish')}>Publish saved version</button><button className="btn danger" type="button" disabled={busy} onClick={() => changeAnnouncement('archive')}>Archive</button></>}</div>
      </div></div>
    </section>
  </div>;
}
