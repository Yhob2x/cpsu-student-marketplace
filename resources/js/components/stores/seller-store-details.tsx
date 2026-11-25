import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { LegacyButton } from '@/components/ui/legacy-button';
import { api, explain } from '@/lib/api';

type StoreDetails = { id: number; storeName: string; description: string };

export function SellerStoreDetails({ storeId, onSaved }: { storeId: number; onSaved?: () => void }) {
  const [saved, setSaved] = useState<StoreDetails | null>(null);
  const [draft, setDraft] = useState({ storeName: '', description: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);
  useEffect(() => {
    let alive = true;
    const current = ++requestId.current;
    setLoading(true); setError('');
    api<StoreDetails>('/seller/store').then(s => {
      if (!alive || current !== requestId.current) return;
      if (!s || s.id !== storeId) { setError('Your store could not be found.'); return; }
      setSaved(s); setDraft({ storeName: s.storeName, description: s.description });
    }).catch(e => { if (alive && current === requestId.current) setError(explain(e)); })
      .finally(() => { if (alive && current === requestId.current) setLoading(false); });
    return () => { alive = false; };
  }, [storeId]);
  const name = draft.storeName.trim();
  const description = draft.description.trim();
  const changed = Boolean(saved && (saved.storeName !== name || saved.description !== description));
  const valid = name.length >= 2 && name.length <= 80 && description.length >= 10 && description.length <= 1000;
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!saved || !changed || !valid || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const next = await api<StoreDetails>('/seller/store', { method: 'PATCH', body: { storeName: name, description } });
      setSaved(next); setDraft({ storeName: next.storeName, description: next.description });
      setNotice('Store details updated. Your public storefront now shows these details.');
      onSaved?.();
    } catch (e) { setError(explain(e)); }
    finally { setSaving(false); }
  };
  return <section className="panel seller-store-settings" aria-labelledby="seller-store-details-title">
    <div className="seller-store-settings__header">
      <div><h2 id="seller-store-details-title">Store details</h2><p className="muted">Choose the name and description students see when they visit your store.</p></div>
      <Link to={`/stores/${storeId}`}>View my store</Link>
    </div>
    {loading && <p role="status">Loading store details…</p>}
    {saved && <form onSubmit={save} className="seller-store-settings__form">
      <label className="field">Store name
        <input value={draft.storeName} minLength={2} maxLength={80} required disabled={saving}
          onChange={e => { setDraft(p => ({ ...p, storeName: e.target.value })); setNotice(''); }} />
      </label>
      <label className="field">About your store
        <textarea value={draft.description} minLength={10} maxLength={1000} rows={3} required disabled={saving}
          onChange={e => { setDraft(p => ({ ...p, description: e.target.value })); setNotice(''); }} />
      </label>
      <div className="seller-store-settings__actions">
        <LegacyButton className="" type="submit" disabled={!changed || !valid || saving}>{saving ? 'Saving…' : 'Save store details'}</LegacyButton>
        {changed && <LegacyButton className="ghost" type="button" disabled={saving}
          onClick={() => setDraft({ storeName: saved.storeName, description: saved.description })}>Discard changes</LegacyButton>}
      </div>
    </form>}
    {error && <p className="err" role="alert">{error}</p>}
    {notice && <p className="seller-store-settings__notice" role="status">{notice}</p>}
  </section>;
}
