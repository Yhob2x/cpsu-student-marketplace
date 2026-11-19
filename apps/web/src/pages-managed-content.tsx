import { Field, Panel } from './components/ui/primitives';
import { useEffect, useState } from 'react';
import { api, explain } from './api';
import { HomePageEditor } from './home-page-editor';

type Guidelines = { draftBody: string; publishedBody: string | null; publishedAt: string | null };
type Announcement = { id: number; title: string; body: string; pendingTitle: string | null; pendingBody: string | null; status: 'draft' | 'published' | 'archived'; publishedAt: string | null };

export function ManagedContentAdmin() {
  const [guidelines, setGuidelines] = useState<Guidelines | null>(null);
  const [draft, setDraft] = useState('');
  const [guidelinesLoading, setGuidelinesLoading] = useState(true);
  const [guidelinesBusy, setGuidelinesBusy] = useState(false);
  const [guidelinesError, setGuidelinesError] = useState('');
  const [guidelinesNotice, setGuidelinesNotice] = useState('');

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsReady, setAnnouncementsReady] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsBusy, setAnnouncementsBusy] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState('');
  const [announcementsNotice, setAnnouncementsNotice] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Fail and retry each editor independently. One missing table must never
  // hide an otherwise available content editor or the homepage photo editor.
  const loadGuidelines = async () => {
    setGuidelinesLoading(true); setGuidelinesError('');
    try {
      const data = await api<Guidelines>('/admin/content/guidelines');
      setGuidelines(data);
      setDraft(data.draftBody);
    } catch (e) { setGuidelinesError(explain(e)); }
    finally { setGuidelinesLoading(false); }
  };
  const loadAnnouncements = async () => {
    setAnnouncementsLoading(true); setAnnouncementsError('');
    try {
      const data = await api<{ items: Announcement[] }>('/admin/content/announcements');
      setAnnouncements(data.items);
      setAnnouncementsReady(true);
    } catch (e) { setAnnouncementsError(explain(e)); }
    finally { setAnnouncementsLoading(false); }
  };
  useEffect(() => {
    void loadGuidelines();
    void loadAnnouncements();
  }, []);

  const act = async (work: () => Promise<void>, message: string,
    setBusy: (busy: boolean) => void, setError: (message: string) => void,
    setNotice: (message: string) => void) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(message); }
    catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  };
  const saveGuidelines = () => act(async () => {
    const data = await api<Guidelines>('/admin/content/guidelines', { method: 'PUT', body: { body: draft } });
    setGuidelines(data);
    setDraft(data.draftBody);
  }, 'Guideline draft saved. Students still see the published version.',
  setGuidelinesBusy, setGuidelinesError, setGuidelinesNotice);
  const publishGuidelines = () => act(async () => {
    const data = await api<Guidelines>('/admin/content/guidelines/publish', { method: 'POST', body: { expectedBody: guidelines?.draftBody } });
    setGuidelines(data); setDraft(data.draftBody);
  }, 'Guidelines published for students.',
  setGuidelinesBusy, setGuidelinesError, setGuidelinesNotice);

  const select = (item: Announcement | null) => {
    setSelectedId(item?.id ?? null);
    setTitle(item?.pendingTitle ?? item?.title ?? '');
    setBody(item?.pendingBody ?? item?.body ?? '');
    setAnnouncementsNotice('');
    setAnnouncementsError('');
  };
  const saveAnnouncement = () => act(async () => {
    const endpoint = selectedId ? `/admin/content/announcements/${selectedId}` : '/admin/content/announcements';
    const item = await api<Announcement>(endpoint, { method: selectedId ? 'PATCH' : 'POST', body: { title, body } });
    setAnnouncements(prev => [item, ...prev.filter(a => a.id !== item.id)]);
    setSelectedId(item.id);
  }, 'Announcement draft saved. Publish it when approved.',
  setAnnouncementsBusy, setAnnouncementsError, setAnnouncementsNotice);
  const changeAnnouncement = (action: 'publish' | 'archive') => act(async () => {
    const item = await api<Announcement>(`/admin/content/announcements/${selectedId}/${action}`, {
      method: 'POST', ...(action === 'publish' ? { body: { expectedTitle: title, expectedBody: body } } : {}),
    });
    setAnnouncements(prev => prev.map(a => a.id === item.id ? item : a));
    select(item);
  }, action === 'publish' ? 'Announcement published for students.' : 'Announcement archived. It is no longer visible to students.',
  setAnnouncementsBusy, setAnnouncementsError, setAnnouncementsNotice);

  const selected = announcements.find(a => a.id === selectedId);
  return <div className="admin-content-editor">
    <h2>Student-facing content</h2>
    <p className="muted">Confirm institutional approval before publishing policy text.</p>
    <HomePageEditor />

    <Panel as="section" className="stack" aria-labelledby="guideline-editor-title">
      <div>
        <h3 id="guideline-editor-title">Marketplace guidelines</h3>
        {guidelines && <p className="muted">{guidelines.publishedAt
          ? `Published ${new Date(guidelines.publishedAt).toLocaleDateString('en-PH')}`
          : 'No managed version published yet. Students see the existing guidelines.'}</p>}
      </div>
      {guidelinesLoading && <p role="status">Loading guidelines…</p>}
      {guidelinesError && <p className="err" role="alert">{guidelinesError}{' '}
        <button className="btn ghost" type="button" disabled={guidelinesLoading} onClick={() => void loadGuidelines()}>Retry guidelines</button>
      </p>}
      {guidelines && <Field>Draft text <span className="muted">Use # at the start of a line for a section heading. Plain text only.</span>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} maxLength={10000} rows={15}
          disabled={guidelinesBusy || guidelinesLoading || Boolean(guidelinesError)} />
      </Field>}
      {guidelines && draft !== guidelines.draftBody && <p className="muted">You have unsaved changes.</p>}
      {guidelines && <div className="row">
        <button type="button" className="btn ghost"
          disabled={guidelinesBusy || guidelinesLoading || Boolean(guidelinesError) || !draft.trim() || draft === guidelines.draftBody}
          onClick={saveGuidelines}>Save draft</button>
        <button type="button" className="btn"
          disabled={guidelinesBusy || guidelinesLoading || Boolean(guidelinesError) || !guidelines.draftBody || draft !== guidelines.draftBody || draft === guidelines.publishedBody}
          onClick={publishGuidelines}>Publish saved draft</button>
      </div>}
      {guidelinesNotice && <p role="status" className="muted">{guidelinesNotice}</p>}
    </Panel>

    <section aria-labelledby="announcement-editor-title">
      <h3 id="announcement-editor-title">Announcements</h3>
      <p className="muted">Drafts stay private. Archived announcements disappear from student view.</p>
      {announcementsLoading && <p role="status">Loading announcements…</p>}
      {announcementsError && <p className="err" role="alert">{announcementsError}{' '}
        <button className="btn ghost" type="button" disabled={announcementsLoading}
          onClick={() => void loadAnnouncements()}>Retry announcements</button>
      </p>}
      {announcementsNotice && <p role="status" className="muted">{announcementsNotice}</p>}
      {announcementsReady && <div className="admin-content-grid">
        <div className="admin-content-list">
          <button type="button" className="btn ghost"
            disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError)}
            onClick={() => select(null)}>New announcement</button>
          {announcements.map(a => <button type="button" key={a.id} className="admin-content-item"
            aria-pressed={selectedId === a.id} disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError)}
            onClick={() => select(a)}>
            <strong>{a.pendingTitle ?? a.title}</strong>
            <span>{a.status}{a.pendingBody != null ? ' · unpublished edits' : ''}</span>
          </button>)}
        </div>
        <div className="panel stack">
          <Field>Title<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
            disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError) || selected?.status === 'archived'} /></Field>
          <Field>Message<textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={7}
            disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError) || selected?.status === 'archived'} /></Field>
          <div className="row">
            <button className="btn ghost" type="button"
              disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError) || selected?.status === 'archived' || !title.trim() || !body.trim()}
              onClick={saveAnnouncement}>Save draft</button>
            {selected && selected.status !== 'archived' && <>
              <button className="btn" type="button"
                disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError) ||
                  title !== (selected.pendingTitle ?? selected.title) || body !== (selected.pendingBody ?? selected.body) ||
                  (selected.status === 'published' && selected.pendingBody == null)}
                onClick={() => changeAnnouncement('publish')}>Publish saved version</button>
              <button className="btn danger" type="button"
                disabled={announcementsBusy || announcementsLoading || Boolean(announcementsError)}
                onClick={() => changeAnnouncement('archive')}>Archive</button>
            </>}
          </div>
        </div>
      </div>}
    </section>
  </div>;
}
