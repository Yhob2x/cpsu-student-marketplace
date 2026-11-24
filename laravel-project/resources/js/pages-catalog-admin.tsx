import { LegacyButton } from './components/ui/legacy-button';
import { Field, Panel } from './components/ui/primitives';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { api, explain } from './api';
import { showActionFeedback } from './action-feedback';
import '../css/catalog-admin.css';

type Campus = {
  id: number; code: string; name: string; active: boolean;
  _count: { affiliations: number; listings: number; campusRoles: number };
};
type CategoryKind = 'physical_product' | 'service';
type Category = { id: number; name: string; listingType: CategoryKind; parentId: number | null; _count: { listings: number; children: number } };
type Catalog = { campuses: Campus[]; categories: Category[] };
type CampusDraft = Pick<Campus, 'code' | 'name'>;
type CampusField = keyof CampusDraft;

const campusFieldMessages = {
  code: 'Enter a campus code of 2–24 characters. Use letters, numbers, hyphens and underscores.',
  name: 'Enter a campus name of 2–100 characters.',
};

function campusFieldError(draft: CampusDraft): CampusField | null {
  if (!/^[A-Za-z0-9_-]{2,24}$/.test(draft.code.trim())) return 'code';
  const nameLength = draft.name.trim().length;
  return nameLength < 2 || nameLength > 100 ? 'name' : null;
}

function CampusFields({ draft, onChange, error }: {
  draft: CampusDraft; onChange: (draft: CampusDraft) => void; error: CampusField | null;
}) {
  const errorId = useId();
  return <>
    <div className="catalog-admin-fields">
      <Field>Code<input name="code" required minLength={2} maxLength={24} value={draft.code}
        placeholder="e.g. CPSU-WEST" aria-invalid={error === 'code' || undefined}
        aria-describedby={error === 'code' ? errorId : undefined}
        onChange={event => onChange({ ...draft, code: event.target.value })} /></Field>
      <Field>Campus name<input name="name" required minLength={2} maxLength={100} value={draft.name}
        placeholder="Campus name" aria-invalid={error === 'name' || undefined}
        aria-describedby={error === 'name' ? errorId : undefined}
        onChange={event => onChange({ ...draft, name: event.target.value })} /></Field>
    </div>
    {error && <p id={errorId} role="alert" className="err">{campusFieldMessages[error]}</p>}
  </>;
}

export function CatalogAdmin({ onCampusesChange }: { onCampusesChange: () => void }) {
  const [data, setData] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [newCampus, setNewCampus] = useState({ code: '', name: '' });
  const [newCampusError, setNewCampusError] = useState<CampusField | null>(null);
  const [newCategory, setNewCategory] = useState<Record<CategoryKind, string>>({ physical_product: '', service: '' });
  const [selectedKind, setSelectedKind] = useState<CategoryKind>('physical_product');
  const [editCampus, setEditCampus] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState<number | null>(null);
  const [campusDraft, setCampusDraft] = useState({ code: '', name: '' });
  const [campusDraftError, setCampusDraftError] = useState<CampusField | null>(null);
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

  const validateCampus = (event: FormEvent<HTMLFormElement>, draft: CampusDraft,
    setFieldError: (field: CampusField | null) => void) => {
    event.preventDefault();
    setActionError('');
    const field = campusFieldError(draft);
    setFieldError(field);
    if (field) (event.currentTarget.elements.namedItem(field) as HTMLInputElement).focus();
    return !field;
  };
  const addCampus = async (event: FormEvent<HTMLFormElement>) => {
    if (!validateCampus(event, newCampus, setNewCampusError)) return;
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
      <LegacyButton type="button" className="ghost" onClick={() => void load()} disabled={loading || Boolean(busy)}>Refresh</LegacyButton>
    </div>
    {error && <p role="alert" className="err">Couldn't load the catalog. {error} <LegacyButton type="button" className="ghost" onClick={() => void load()}>Retry</LegacyButton></p>}
    {actionError && <p role="alert" className="err">Not saved. {actionError}</p>}
    {loading && !data && <p role="status">Loading campuses and categories…</p>}
    {data && <div className="catalog-admin-grid">
      <Panel className="catalog-admin-panel">
        <div className="catalog-admin-title"><div><h3>Campuses</h3>
          <p className="muted">Update names, codes, or availability. Existing records are never deleted.</p></div>
          <span className="catalog-admin-count">{data.campuses.length}</span></div>
        <form className="catalog-admin-add" noValidate onSubmit={event => void addCampus(event)}>
          <strong>Add campus</strong>
          <CampusFields draft={newCampus} error={newCampusError}
            onChange={draft => { setNewCampus(draft); setNewCampusError(null); }} />
          <LegacyButton className="" disabled={Boolean(busy) || !newCampus.name.trim() || !newCampus.code.trim()} type="submit">{busy === 'add-campus' ? 'Adding…' : 'Add campus'}</LegacyButton>
        </form>
        <div className="catalog-admin-rows">
          {data.campuses.map(campus => <div className="catalog-admin-item" key={campus.id}>
            {editCampus === campus.id ? <form noValidate onSubmit={event => {
              if (validateCampus(event, campusDraft, setCampusDraftError)) void updateCampus(campus, campusDraft);
            }}>
              <CampusFields draft={campusDraft} error={campusDraftError}
                onChange={draft => { setCampusDraft(draft); setCampusDraftError(null); }} />
              <div className="catalog-admin-actions"><LegacyButton className="" type="submit" disabled={Boolean(busy)}>Save</LegacyButton>
                <LegacyButton className="ghost" type="button" onClick={() => setEditCampus(null)} disabled={Boolean(busy)}>Cancel</LegacyButton></div>
            </form> : <>
              <div className="catalog-admin-item-header"><div>
                <strong>{campus.name}</strong><div className="catalog-admin-meta"><span>{campus.code}</span><span>{campus.active ? 'Active' : 'Inactive'}</span></div>
                <p className="muted">{campus._count.listings} listings · {campus._count.affiliations} affiliations</p>
              </div></div>
              <div className="catalog-admin-actions">
                <LegacyButton type="button" className="ghost" aria-label={`Edit campus ${campus.name}`} disabled={Boolean(busy)}
                  onClick={() => { setEditCampus(campus.id); setEditCategory(null); setCampusDraftError(null); setCampusDraft({ code: campus.code, name: campus.name }); }}>Edit</LegacyButton>
                <LegacyButton type="button" className="ghost" aria-label={`${campus.active ? 'Deactivate' : 'Reactivate'} campus ${campus.name}`} disabled={Boolean(busy)}
                  onClick={() => void toggleCampus(campus)}>{busy === 'campus-' + campus.id ? 'Saving…' : campus.active ? 'Deactivate' : 'Reactivate'}</LegacyButton>
              </div>
            </>}
          </div>)}
          {!data.campuses.length && <p className="muted">No campuses yet.</p>}
        </div>
      </Panel>
      <Panel className="catalog-admin-panel">
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
          <LegacyButton className="" type="submit" disabled={Boolean(busy) || newCategory[selectedKind].trim().length < 2}>
            {busy === 'add-category' ? 'Adding…' : 'Add ' + categoryLabel.toLowerCase() + ' category'}
          </LegacyButton>
        </form>
        <div className="catalog-admin-rows">
          <p className="catalog-admin-subtitle">{categoryLabel} categories ({filteredCategories.length})</p>
          {filteredCategories.map(category => <div className="catalog-admin-item" key={category.id}>
            {editCategory === category.id ? <form onSubmit={event => { event.preventDefault(); void updateCategory(category); }}>
              <Field>Category name<input required minLength={2} maxLength={80} value={categoryDraft}
                onChange={event => setCategoryDraft(event.target.value)} /></Field>
              <div className="catalog-admin-actions"><LegacyButton type="submit" className="" disabled={Boolean(busy) || categoryDraft.trim().length < 2}>Save</LegacyButton>
                <LegacyButton className="ghost" type="button" onClick={() => setEditCategory(null)} disabled={Boolean(busy)}>Cancel</LegacyButton></div>
            </form> : <>
              <div className="catalog-admin-item-header"><div><strong>{category.name}</strong>
                <p className="muted">{category._count.listings} listings</p></div></div>
              <div className="catalog-admin-actions"><LegacyButton type="button" className="ghost" aria-label={`Edit ${categoryLabel.toLowerCase()} category ${category.name}`} disabled={Boolean(busy)}
                onClick={() => { setEditCategory(category.id); setEditCampus(null); setCategoryDraft(category.name); }}>Edit</LegacyButton></div>
            </>}
          </div>)}
          {!filteredCategories.length && <p className="muted">No {categoryLabel.toLowerCase()} categories yet.</p>}
        </div>
        <p className="muted catalog-admin-footnote">Renaming a category preserves existing listings. Its product or service type cannot be changed after creation.</p>
      </Panel>
    </div>}
  </section>;
}
