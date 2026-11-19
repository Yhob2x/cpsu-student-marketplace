import { Field } from './components/ui/primitives';
import { useEffect, useState, type FormEvent } from 'react';
import { api, explain } from './api';
import { showActionFeedback } from './action-feedback';
import './catalog-admin.css';

type Campus = {
  id: number; code: string; name: string; active: boolean;
  _count: { affiliations: number; listings: number; campusRoles: number };
};
type CategoryKind = 'physical_product' | 'service';
type Category = { id: number; name: string; listingType: CategoryKind; parentId: number | null; _count: { listings: number; children: number } };
type Catalog = { campuses: Campus[]; categories: Category[] };

export function CatalogAdmin({ onCampusesChange }: { onCampusesChange: () => void }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [newCampus, setNewCampus] = useState({ code: '', name: '' });
  const [newCategory, setNewCategory] = useState<Record<CategoryKind, string>>({ physical_product: '', service: '' });
  const [selectedKind, setSelectedKind] = useState<CategoryKind>('physical_product');
  const [editCampus, setEditCampus] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState<number | null>(null);
  const [campusDraft, setCampusDraft] = useState({ code: '', name: '' });
  const [categoryDraft, setCategoryDraft] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setData(await api<Catalog>('/admin/catalog'));
      setError('');
    } catch (cause) { setError(explain(cause)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const save = async (key: string, action: () => Promise<unknown>, success: string, campusChange = false) => {
    setBusy(key); setActionError('');
    try {
      await action();
      await load();
      if (campusChange) onCampusesChange();
      showActionFeedback({ kind: 'success', title: 'Changes saved', message: success });
      return true;
    } catch (cause) {
      setActionError(explain(cause));
      return false;
    } finally { setBusy(''); }
  };

  const addCampus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await save('add-campus', () => api('/admin/catalog/campuses', {
      body: { code: newCampus.code.trim(), name: newCampus.name.trim() },
    }), 'The campus is now available to the marketplace.', true)) setNewCampus({ code: '', name: '' });
  };
  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await save('add-category', () => api('/admin/catalog/categories', {
      body: { name: newCategory[selectedKind].trim(), listingType: selectedKind },
    }), 'The new category is available when students create listings.'))
      setNewCategory(current => ({ ...current, [selectedKind]: '' }));
  };
  const updateCampus = async (campus: Campus, patch: Record<string, unknown>) => {
    const success = await save('campus-' + campus.id, () =>
      api('/admin/catalog/campuses/' + campus.id, { method: 'PATCH', body: patch }),
    'Campus details have been updated.', true);
    if (success) setEditCampus(null);
  };
  const toggleCampus = async (campus: Campus) => {
    const linked = campus._count.affiliations + campus._count.listings + campus._count.campusRoles;
    if (campus.active && !window.confirm(
      'Deactivate ' + campus.name + '? The campus will disappear from public campus choices and its student storefronts may become hidden. Existing affiliations, listings and reviewer assignments will remain saved.' +
      (linked ? ' This campus has ' + linked + ' linked records.' : ''),
    )) return;
    await updateCampus(campus, { active: !campus.active, ...(campus.active ? { confirmImpact: true } : {}) });
  };
  const updateCategory = async (category: Category) => {
    const success = await save('category-' + category.id, () =>
      api('/admin/catalog/categories/' + category.id, { method: 'PATCH', body: { name: categoryDraft.trim() } }),
    'The category name is updated wherever it appears.');
    if (success) setEditCategory(null);
  };
  const filteredCategories = data?.categories.filter(category => category.listingType === selectedKind) ?? [];
  const categoryLabel = selectedKind === 'service' ? 'Service' : 'Product';

  return <section className="catalog-admin" aria-labelledby="catalog-admin-heading">
    <div className="catalog-admin-heading">
      <div><h2 id="catalog-admin-heading">Campuses &amp; categories</h2>
        <p className="muted">Manage what students can choose when posting and exploring listings.</p></div>
      <button type="button" className="btn ghost" onClick={() => void load()} disabled={loading || Boolean(busy)}>Refresh</button>
    </div>
    {error && <p role="alert" className="err">Couldn't load the catalog. {error} <button type="button" className="btn ghost" onClick={() => void load()}>Retry</button></p>}
    {actionError && <p role="alert" className="err">Not saved. {actionError}</p>}
    {loading && !data && <p role="status">Loading campuses and categories…</p>}
    {data && <div className="catalog-admin-grid">
      <div className="panel catalog-admin-panel">
        <div className="catalog-admin-title"><div><h3>Campuses</h3>
          <p className="muted">Update names, codes, or availability. Existing records are never deleted.</p></div>
          <span className="catalog-admin-count">{data.campuses.length}</span></div>
        <form className="catalog-admin-add" onSubmit={event => void addCampus(event)}>
          <strong>Add campus</strong>
          <div className="catalog-admin-fields">
            <Field>Code<input required minLength={2} maxLength={24} pattern="[A-Za-z0-9_-]+" value={newCampus.code} placeholder="e.g. MAIN" onChange={event => setNewCampus(current => ({ ...current, code: event.target.value }))} /></Field>
            <Field>Campus name<input required minLength={2} maxLength={100} value={newCampus.name} placeholder="Campus name" onChange={event => setNewCampus(current => ({ ...current, name: event.target.value }))} /></Field>
          </div>
          <button className="btn" disabled={Boolean(busy) || !newCampus.name.trim() || !newCampus.code.trim()} type="submit">{busy === 'add-campus' ? 'Adding…' : 'Add campus'}</button>
        </form>
        <div className="catalog-admin-rows">
          {data.campuses.map(campus => <div className="catalog-admin-item" key={campus.id}>
            {editCampus === campus.id ? <form onSubmit={event => { event.preventDefault(); void updateCampus(campus, campusDraft); }}>
              <div className="catalog-admin-fields">
                <Field>Code<input required minLength={2} maxLength={24} pattern="[A-Za-z0-9_-]+" value={campusDraft.code} onChange={event => setCampusDraft(prev => ({ ...prev, code: event.target.value }))} /></Field>
                <Field>Campus name<input required minLength={2} maxLength={100} value={campusDraft.name} onChange={event => setCampusDraft(prev => ({ ...prev, name: event.target.value }))} /></Field>
              </div>
              <div className="catalog-admin-actions"><button className="btn" type="submit" disabled={Boolean(busy)}>Save</button>
                <button className="btn ghost" type="button" onClick={() => setEditCampus(null)} disabled={Boolean(busy)}>Cancel</button></div>
            </form> : <>
              <div className="catalog-admin-item-header"><div>
                <strong>{campus.name}</strong><div className="catalog-admin-meta"><span>{campus.code}</span><span>{campus.active ? 'Active' : 'Inactive'}</span></div>
                <p className="muted">{campus._count.listings} listings · {campus._count.affiliations} affiliations</p>
              </div></div>
              <div className="catalog-admin-actions">
                <button type="button" className="btn ghost" disabled={Boolean(busy)}
                  onClick={() => { setEditCampus(campus.id); setEditCategory(null); setCampusDraft({ code: campus.code, name: campus.name }); }}>Edit</button>
                <button type="button" className="btn ghost" disabled={Boolean(busy)}
                  onClick={() => void toggleCampus(campus)}>{busy === 'campus-' + campus.id ? 'Saving…' : campus.active ? 'Deactivate' : 'Reactivate'}</button>
              </div>
            </>}
          </div>)}
          {!data.campuses.length && <p className="muted">No campuses yet.</p>}
        </div>
      </div>
      <div className="panel catalog-admin-panel">
        <div className="catalog-admin-title"><div><h3>Product &amp; service categories</h3>
          <p className="muted">Choose a listing type, then add or edit its categories.</p></div>
          <span className="catalog-admin-count">{data.categories.length}</span></div>
        <div className="catalog-admin-kind" role="group" aria-label="Category type">
          <button type="button" aria-pressed={selectedKind === 'physical_product'}
            className={selectedKind === 'physical_product' ? 'catalog-admin-kind-active' : ''}
            disabled={Boolean(busy)}
            onClick={() => { setSelectedKind('physical_product'); setEditCategory(null); setActionError(''); }}>Products</button>
          <button type="button" aria-pressed={selectedKind === 'service'}
            className={selectedKind === 'service' ? 'catalog-admin-kind-active' : ''}
            disabled={Boolean(busy)}
            onClick={() => { setSelectedKind('service'); setEditCategory(null); setActionError(''); }}>Services</button>
        </div>
        <form className="catalog-admin-add" onSubmit={event => void addCategory(event)}>
          <strong>Add {categoryLabel.toLowerCase()} category</strong>
          <Field>What {categoryLabel.toLowerCase()} category would you like to add?
            <input required minLength={2} maxLength={80}
              placeholder={selectedKind === 'service' ? 'e.g. Event photography' : 'e.g. School supplies'}
              value={newCategory[selectedKind]}
              onChange={event => setNewCategory(current => ({ ...current, [selectedKind]: event.target.value }))} />
          </Field>
          <button className="btn" type="submit" disabled={Boolean(busy) || newCategory[selectedKind].trim().length < 2}>
            {busy === 'add-category' ? 'Adding…' : 'Add ' + categoryLabel.toLowerCase() + ' category'}
          </button>
        </form>
        <div className="catalog-admin-rows">
          <p className="catalog-admin-subtitle">{categoryLabel} categories ({filteredCategories.length})</p>
          {filteredCategories.map(category => <div className="catalog-admin-item" key={category.id}>
            {editCategory === category.id ? <form onSubmit={event => { event.preventDefault(); void updateCategory(category); }}>
              <Field>Category name<input required minLength={2} maxLength={80} value={categoryDraft}
                onChange={event => setCategoryDraft(event.target.value)} /></Field>
              <div className="catalog-admin-actions"><button type="submit" className="btn" disabled={Boolean(busy) || categoryDraft.trim().length < 2}>Save</button>
                <button className="btn ghost" type="button" onClick={() => setEditCategory(null)} disabled={Boolean(busy)}>Cancel</button></div>
            </form> : <>
              <div className="catalog-admin-item-header"><div><strong>{category.name}</strong>
                <p className="muted">{category._count.listings} listings</p></div></div>
              <div className="catalog-admin-actions"><button type="button" className="btn ghost" disabled={Boolean(busy)}
                onClick={() => { setEditCategory(category.id); setEditCampus(null); setCategoryDraft(category.name); }}>Edit</button></div>
            </>}
          </div>)}
          {!filteredCategories.length && <p className="muted">No {categoryLabel.toLowerCase()} categories yet.</p>}
        </div>
        <p className="muted catalog-admin-footnote">Renaming a category preserves existing listings. Its product or service type cannot be changed after creation.</p>
      </div>
    </div>}
  </section>;
}
