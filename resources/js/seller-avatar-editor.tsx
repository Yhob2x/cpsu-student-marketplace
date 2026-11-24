import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, explain } from './api';
import { SellerAvatar } from './seller-avatar';
import '../css/seller-avatar-editor.css';

type SellerStore = { id: number; storeName: string; avatarUrl: string | null };
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024;

export function SellerAvatarEditor({ storeId, refreshVersion = 0 }: { storeId: number; refreshVersion?: number }) {
  const [store, setStore] = useState<SellerStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const next = await api<SellerStore | null>('/seller/store');
      if (!next || next.id !== storeId) throw new Error('Your store could not be found.');
      setStore(next);
      setError('');
    } catch (e) { setError(explain(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [storeId, refreshVersion]);
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const select = (chosen: File | null) => {
    setError(''); setNotice('');
    if (!chosen) { setFile(null); return; }
    if (!ACCEPTED.has(chosen.type) || chosen.size === 0 || chosen.size > MAX_BYTES) {
      setError('Choose one JPEG, PNG or WebP photo up to 3 MB.');
      setFile(null); setFileKey(n => n + 1); return;
    }
    setFile(chosen);
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !store || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData(); form.append('image', file);
      const published = await api<{ avatarUrl: string }>('/seller/store/avatar', { form });
      setStore(previous => previous ? { ...previous, avatarUrl: published.avatarUrl } : previous);
      setFile(null); setFileKey(n => n + 1);
      setNotice('Profile picture updated. It is now visible on your public store.');
    } catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!store?.avatarUrl || busy || !window.confirm(
      'Remove your public profile picture? Your store will show initials until you upload another photo.',
    )) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/seller/store/avatar', { method: 'DELETE' });
      setStore(previous => previous ? { ...previous, avatarUrl: null } : previous);
      setNotice('Profile picture removed. Your store now shows initials.');
    } catch (e) { setError(explain(e)); }
    finally { setBusy(false); }
  };

  return <section className="panel seller-avatar-editor" aria-labelledby="seller-photo-heading">
    <div className="seller-avatar-editor__heading">
      <div><h2 id="seller-photo-heading">Store profile picture</h2>
        <p className="muted">Choose and upload a picture for your own store. It is not added automatically and does not require campus approval.</p></div>
      <Link to={`/stores/${storeId}`}>View public store</Link>
    </div>
    {loading && !store && <p role="status">Loading store photo…</p>}
    {store && <div className="seller-avatar-editor__content">
      <div className="seller-avatar-editor__photos">
        <div>
          <SellerAvatar name={store.storeName} src={store.avatarUrl} size="large" />
          <small>Current public picture</small>
        </div>
        {previewUrl && <div><SellerAvatar name={store.storeName} src={previewUrl} size="large" />
          <small>Selected photo preview</small></div>}
      </div>
      <div className="seller-avatar-editor__form">
        <form className="stack" onSubmit={upload} aria-busy={busy}>
          <label className="field">Choose profile picture
            <input key={fileKey} type="file" accept="image/jpeg,image/png,image/webp"
              disabled={busy || loading} onChange={event => select(event.currentTarget.files?.[0] ?? null)} />
          </label>
          <p className="muted">JPEG, PNG or WebP, up to 3 MB. We check photos for explicit content on the server before publication. Safe pictures publish automatically; rejected or uncertain pictures leave your current picture unchanged. Automated screening may make mistakes.</p>
          <button type="submit" className="btn" disabled={!file || busy || loading}>
            {busy ? 'Uploading and checking…' : store.avatarUrl ? 'Replace profile picture' : 'Upload profile picture'}
          </button>
        </form>
        {store.avatarUrl && <button type="button" className="btn ghost seller-avatar-editor__remove"
          disabled={busy} onClick={() => void remove()}>Remove current picture</button>}
      </div>
    </div>}
    {error && <div className="seller-avatar-editor__feedback" role="alert"><p className="err">{error}</p>
      {!store && <button type="button" className="btn ghost" disabled={busy} onClick={() => void reload()}>Retry loading store</button>}</div>}
    {notice && <p role="status" className="seller-avatar-editor__notice">{notice}</p>}
  </section>;
}
