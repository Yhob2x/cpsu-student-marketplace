import { useEffect, useState } from 'react';
import { api, apiBlob, explain } from './api';
import { homePageDraftStatus, type HomeImageSlot, type HomePageCopy, type HomePageEditorState } from './home-page-content';

const base = '/admin/content/home-page';
const slots: { key: HomeImageSlot; label: string; hint: string }[] = [
  { key: 'hero', label: 'Hero photo', hint: 'Displayed beside the main headline. Without one, the default marketplace illustration appears.' },
  { key: 'steps', label: 'How it works photo', hint: 'Displayed beside the three campus trading steps.' },
  { key: 'cta', label: 'Seller banner photo', hint: 'Displayed behind the seller invitation.' },
];
type ImagePreview = Partial<Record<HomeImageSlot, string>>;

export function HomePageEditor() {
  const [saved, setSaved] = useState<HomePageEditorState | null>(null);
  const [copy, setCopy] = useState<HomePageCopy | null>(null);
  const [previews, setPreviews] = useState<ImagePreview>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const receive = (state: HomePageEditorState) => { setSaved(state); setCopy(structuredClone(state.draft.copy)); };
  const load = async () => {
    setLoading(true); setError('');
    try { receive(await api<HomePageEditorState>(base)); }
    catch (e) { setError(explain(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    const paths = saved?.draft.images;
    setPreviews({});
    if (paths) {
      for (const slot of slots) {
        const path = paths[slot.key];
        if (!path) continue;
        apiBlob(path.replace(/^\/api\/v1/, '')).then(blob => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setPreviews(prev => ({ ...prev, [slot.key]: url }));
        }).catch(() => { /* The image control retains its replace/remove actions. */ });
      }
    }
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [saved?.revision]);

  const dirty = saved != null && copy != null && JSON.stringify(copy) !== JSON.stringify(saved.draft.copy);
  const publication = saved ? homePageDraftStatus(saved) : null;
  const change = <K extends keyof HomePageCopy>(key: K, value: HomePageCopy[K]) =>
    setCopy(current => current ? { ...current, [key]: value } : current);
  const run = async (work: () => Promise<HomePageEditorState>, message: string) => {
    setBusy(true); setError(''); setNotice('');
    try { receive(await work()); setNotice(message); }
    catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  };
  const save = () => {
    if (!saved || !copy) return;
    void run(() => api(base, { method: 'PUT', body: { copy, expectedRevision: saved.revision } }),
      'Homepage draft saved. Students still see the published version.');
  };
  const publish = () => {
    if (!saved) return;
    void run(() => api(`${base}/publish`, { method: 'POST', body: { expectedRevision: saved.revision } }),
      'Homepage published for students.');
  };
  const upload = (slot: HomeImageSlot, file: File | undefined) => {
    if (!saved || !file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image up to 3 MB.'); return;
    }
    const form = new FormData();
    form.set('image', file);
    form.set('expectedRevision', String(saved.revision));
    void run(() => api(`${base}/images/${slot}`, { method: 'POST', form }),
      `${slots.find(item => item.key === slot)?.label} saved to the draft. Publish to show it to students.`);
  };
  const remove = (slot: HomeImageSlot) => {
    if (!saved) return;
    void run(() => api(`${base}/images/${slot}`, {
      method: 'DELETE', body: { expectedRevision: saved.revision },
    }), 'Draft image removed. Publish to update the student homepage.');
  };
  const field = (label: string, key: keyof HomePageCopy, maxLength: number, multiline = false) => {
    const value = copy?.[key];
    if (typeof value !== 'string') return null;
    return <label className="field" key={key}>{label}
      {multiline ? <textarea rows={3} value={value} maxLength={maxLength} disabled={busy}
        onChange={e => change(key, e.target.value as HomePageCopy[typeof key])} />
        : <input value={value} maxLength={maxLength} disabled={busy}
          onChange={e => change(key, e.target.value as HomePageCopy[typeof key])} />}
    </label>;
  };

  return <section className="panel home-admin-editor" aria-labelledby="home-editor-heading">
    <header className="home-admin-heading">
      <div><p className="home-admin-kicker">HOMEPAGE</p><h3 id="home-editor-heading">Editorial content</h3>
        <p className="muted">Edit the designed homepage text and three photos. Save a draft, then publish when ready.</p></div>
    </header>
    {error && <p className="err" role="alert">{error} <button type="button" className="btn ghost" onClick={() => void load()}>Reload</button></p>}
    {notice && <p role="status" className="muted">{notice}</p>}
    {loading && <p role="status">Loading homepage editor…</p>}
    {saved && copy && <>
      <div className="home-admin-sections">
        <fieldset className="home-admin-group"><legend>Hero & discovery</legend>
          {field('Eyebrow', 'heroEyebrow', 70)}
          <div className="home-admin-field-grid">{field('Headline start', 'heroLine1', 70)}{field('Accent', 'heroAccent', 12)}</div>
          <div className="home-admin-field-grid">{field('Headline middle', 'heroLine2', 70)}{field('Headline ending', 'heroLine3', 70)}</div>
          {field('Introduction', 'heroBody', 240, true)}
          {field('Search heading', 'searchHeading', 100)}
          {field('Category heading', 'categoryHeading', 70)}
        </fieldset>
        <fieldset className="home-admin-group"><legend>Trust & reassurance</legend>
          <div className="home-admin-field-grid">{field('Heading', 'trustHeading', 100)}{field('Accent', 'trustAccent', 70)}</div>
          {copy.trustItems.map((item, index) => <label className="field" key={index}>Trust point {index + 1}
            <input value={item} maxLength={100} disabled={busy} onChange={e => {
              const next = [...copy.trustItems] as HomePageCopy['trustItems']; next[index] = e.target.value; change('trustItems', next);
            }} /></label>)}
        </fieldset>
        <fieldset className="home-admin-group"><legend>How it works</legend>
          {field('Eyebrow', 'stepsEyebrow', 70)}
          <div className="home-admin-field-grid">{field('Heading', 'stepsHeading', 80)}{field('Accent', 'stepsAccent', 70)}</div>
          {copy.steps.map((step, index) => <div className="home-admin-step" key={index}>
            <strong>Step {index + 1}</strong>
            <label className="field">Title<input value={step.title} maxLength={70} disabled={busy} onChange={e => {
              const next = [...copy.steps] as HomePageCopy['steps']; next[index] = { ...step, title: e.target.value }; change('steps', next);
            }} /></label>
            <label className="field">Description<textarea rows={2} value={step.body} maxLength={160} disabled={busy} onChange={e => {
              const next = [...copy.steps] as HomePageCopy['steps']; next[index] = { ...step, body: e.target.value }; change('steps', next);
            }} /></label>
          </div>)}
        </fieldset>
        <fieldset className="home-admin-group"><legend>Seller invitation</legend>
          {field('Heading', 'ctaHeading', 100)}{field('Description', 'ctaBody', 180, true)}
        </fieldset>
      </div>
      <div className="home-admin-actions home-admin-draft-save">
        {dirty && <span className="muted" role="status">You have unsaved text changes. Save them before publishing.</span>}
        <button type="button" className="btn ghost" disabled={busy || !dirty} onClick={save}>Save text draft</button>
      </div>
      <div className="home-admin-images">
        <div className="home-admin-image-heading"><div><h4>Homepage photos</h4><p className="muted">JPEG, PNG or WebP, up to 3 MB each. Photos are prepared for the web. Save text first if you have edits in progress.</p></div>
          {publication && <span className={`home-admin-status${publication.pending ? ' is-draft' : ''}`}>{publication.label}</span>}
        </div>
        <div className="home-admin-image-grid">{slots.map(slot => <div className="home-admin-image" key={slot.key}>
          <div className="home-admin-image-preview">{previews[slot.key]
            ? <img src={previews[slot.key]} alt={`${slot.label} draft preview`} />
            : <span>{saved.draft.images[slot.key] ? 'Loading image…' : 'Using default artwork'}</span>}</div>
          <strong>{slot.label}</strong><p className="muted">{slot.hint}</p>
          {saved.draft.images[slot.key] && <p className="home-admin-photo-draft-note">Saved to draft · publish to update student view</p>}
          <label className="btn ghost home-admin-upload">{saved.draft.images[slot.key] ? 'Replace photo' : 'Choose photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || dirty}
              onChange={e => { upload(slot.key, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
          {saved.draft.images[slot.key] && <button type="button" className="btn ghost" disabled={busy || dirty}
            onClick={() => remove(slot.key)}>Use default artwork</button>}
        </div>)}</div>
      <div className="home-admin-actions home-admin-publish-actions">
        <div className="home-admin-publish-summary" role="status">
          <strong>{dirty ? 'Save text changes first' : publication?.label}</strong>
          <p className="muted">{dirty
            ? 'Save your text draft before publishing the latest homepage text and photos.'
            : publication?.detail}</p>
        </div>
        <button type="button" className="btn" disabled={busy || dirty || saved.revision === saved.publishedRevision}
          onClick={publish}>Publish saved draft</button>
      </div>
      </div>
    </>}
  </section>;
}
