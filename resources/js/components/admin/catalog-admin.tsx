import { useEffect, useId, useState, type FormEvent } from 'react';

import { showActionFeedback } from '@/components/action-feedback';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { api, explain } from '@/lib/api';

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

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

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
  const [showCampusForm, setShowCampusForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

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
    }), 'The campus is now available to the marketplace.', true)) { setNewCampus({ code: '', name: '' }); setShowCampusForm(false); }
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
  const kindCategories = data?.categories.filter(category => category.listingType === selectedKind) ?? [];
  const query = categoryQuery.trim().toLowerCase();
  const filteredCategories = query ? kindCategories.filter(category => category.name.toLowerCase().includes(query)) : kindCategories;
  const categoryLabel = selectedKind === 'service' ? 'Service' : 'Product';
  const activeCampuses = data?.campuses.filter(campus => campus.active).length ?? 0;

  return <section className="catalog-admin catalog-admin--compact" aria-labelledby="catalog-admin-heading">
    <div className="catalog-admin-heading">
      <div><h2 id="catalog-admin-heading">Campuses &amp; categories</h2>
        <p className="muted">Manage what students can choose when posting and exploring listings.</p></div>
      <LegacyButton type="button" className="ghost catalog-icon-btn" aria-label="Refresh campuses and categories" title="Refresh"
        onClick={() => void load()} disabled={loading || Boolean(busy)}><Icon name="refresh" size={18} /></LegacyButton>
    </div>
    {error && <p role="alert" className="err">Couldn't load the catalog. {error} <LegacyButton type="button" className="ghost" onClick={() => void load()}>Retry</LegacyButton></p>}
    {actionError && <p role="alert" className="err">Not saved. {actionError}</p>}
    {loading && !data && <p role="status">Loading campuses and categories…</p>}
    {data && <div className="catalog-admin-grid">
      <Panel className="catalog-admin-panel">
        <div className="catalog-admin-title">
          <div><h3>Campuses <span className="catalog-admin-count">{data.campuses.length}</span></h3>
            <p className="muted">{activeCampuses} active · records are never deleted</p></div>
          <LegacyButton type="button" className={showCampusForm ? 'ghost' : ''} aria-expanded={showCampusForm} aria-controls="catalog-new-campus"
            onClick={() => { setShowCampusForm(open => !open); setNewCampusError(null); }}>
            <Icon name={showCampusForm ? 'close' : 'plus'} size={18} /> New campus
          </LegacyButton>
        </div>
        {showCampusForm && <form id="catalog-new-campus" className="catalog-admin-add" noValidate onSubmit={event => void addCampus(event)}>
          <CampusFields draft={newCampus} error={newCampusError}
            onChange={draft => { setNewCampus(draft); setNewCampusError(null); }} />
          <LegacyButton className="" disabled={Boolean(busy) || !newCampus.name.trim() || !newCampus.code.trim()} type="submit">{busy === 'add-campus' ? 'Adding…' : 'Add campus'}</LegacyButton>
        </form>}
        <ul className="catalog-admin-rows" aria-label="Campuses">
          {data.campuses.map(campus => <li className={'catalog-admin-item' + (campus.active ? '' : ' is-inactive')} key={campus.id}>
            {editCampus === campus.id ? <form className="catalog-admin-edit" noValidate onSubmit={event => {
              if (validateCampus(event, campusDraft, setCampusDraftError)) void updateCampus(campus, campusDraft);
            }}>
              <CampusFields draft={campusDraft} error={campusDraftError}
                onChange={draft => { setCampusDraft(draft); setCampusDraftError(null); }} />
              <div className="catalog-admin-actions"><LegacyButton className="" type="submit" disabled={Boolean(busy)}>Save</LegacyButton>
                <LegacyButton className="ghost" type="button" onClick={() => setEditCampus(null)} disabled={Boolean(busy)}>Cancel</LegacyButton></div>
            </form> : <>
              <div className="catalog-admin-item-main">
                <strong>{campus.name}</strong>
                <span className="catalog-admin-meta"><span className="catalog-admin-code">{campus.code}</span>
                  <span>{plural(campus._count.listings, 'listing')}</span><span>{plural(campus._count.affiliations, 'student')}</span></span>
              </div>
              <span className={'catalog-admin-status' + (campus.active ? ' is-active' : '')}>{campus.active ? 'Active' : 'Inactive'}</span>
              <div className="catalog-admin-actions">
                <LegacyButton type="button" className="ghost catalog-icon-btn" aria-label={`Edit campus ${campus.name}`} title="Edit" disabled={Boolean(busy)}
                  onClick={() => { setEditCampus(campus.id); setEditCategory(null); setCampusDraftError(null); setCampusDraft({ code: campus.code, name: campus.name }); }}>
                  <Icon name="edit" size={18} /></LegacyButton>
                <LegacyButton type="button" className={'ghost catalog-icon-btn' + (campus.active ? ' catalog-icon-btn--danger' : ' catalog-icon-btn--positive')}
                  aria-label={`${campus.active ? 'Deactivate' : 'Reactivate'} campus ${campus.name}`} title={campus.active ? 'Deactivate' : 'Reactivate'}
                  aria-busy={busy === 'campus-' + campus.id} disabled={Boolean(busy)} onClick={() => void toggleCampus(campus)}>
                  <Icon name="power" size={18} /></LegacyButton>
              </div>
            </>}
          </li>)}
          {!data.campuses.length && <li className="muted">No campuses yet.</li>}
        </ul>
      </Panel>
      <Panel className="catalog-admin-panel">
        <div className="catalog-admin-title">
          <div><h3>Categories <span className="catalog-admin-count">{data.categories.length}</span></h3>
            <p className="muted">What students choose when posting a listing</p></div>
          <LegacyButton type="button" className={showCategoryForm ? 'ghost' : ''} aria-expanded={showCategoryForm} aria-controls="catalog-new-category"
            onClick={() => setShowCategoryForm(open => !open)}>
            <Icon name={showCategoryForm ? 'close' : 'plus'} size={18} /> New category
          </LegacyButton>
        </div>
        <div className="catalog-admin-toolbar">
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
          <label className="catalog-admin-filter">
            <Icon name="search" size={16} /><span className="sr-only">Filter categories</span>
            <input type="search" value={categoryQuery} placeholder="Filter" onChange={event => setCategoryQuery(event.target.value)} />
          </label>
        </div>
        {showCategoryForm && <form id="catalog-new-category" className="catalog-admin-add" onSubmit={event => void addCategory(event)}>
          <Field>New {categoryLabel.toLowerCase()} category
            <input required minLength={2} maxLength={80}
              placeholder={selectedKind === 'service' ? 'e.g. Event photography' : 'e.g. School supplies'}
              value={newCategory[selectedKind]}
              onChange={event => setNewCategory(current => ({ ...current, [selectedKind]: event.target.value }))} />
          </Field>
          <LegacyButton className="" type="submit" disabled={Boolean(busy) || newCategory[selectedKind].trim().length < 2}>
            {busy === 'add-category' ? 'Adding…' : 'Add ' + categoryLabel.toLowerCase() + ' category'}
          </LegacyButton>
        </form>}
        <ul className="catalog-admin-rows" aria-label={`${categoryLabel} categories (${filteredCategories.length})`}>
          {filteredCategories.map(category => <li className="catalog-admin-item" key={category.id}>
            {editCategory === category.id ? <form className="catalog-admin-edit" onSubmit={event => { event.preventDefault(); void updateCategory(category); }}>
              <Field>Category name<input required minLength={2} maxLength={80} value={categoryDraft}
                onChange={event => setCategoryDraft(event.target.value)} /></Field>
              <div className="catalog-admin-actions"><LegacyButton type="submit" className="" disabled={Boolean(busy) || categoryDraft.trim().length < 2}>Save</LegacyButton>
                <LegacyButton className="ghost" type="button" onClick={() => setEditCategory(null)} disabled={Boolean(busy)}>Cancel</LegacyButton></div>
            </form> : <>
              <div className="catalog-admin-item-main"><strong>{category.name}</strong>
                <span className="catalog-admin-meta"><span>{plural(category._count.listings, 'listing')}</span></span></div>
              <div className="catalog-admin-actions">
                <LegacyButton type="button" className="ghost catalog-icon-btn" aria-label={`Edit ${categoryLabel.toLowerCase()} category ${category.name}`} title="Edit" disabled={Boolean(busy)}
                  onClick={() => { setEditCategory(category.id); setEditCampus(null); setCategoryDraft(category.name); }}><Icon name="edit" size={18} /></LegacyButton>
              </div>
            </>}
          </li>)}
          {!filteredCategories.length && <li className="muted">{query ? 'No categories match this filter.' : `No ${categoryLabel.toLowerCase()} categories yet.`}</li>}
        </ul>
        <p className="muted catalog-admin-footnote">Renaming keeps existing listings. A category's product or service type cannot be changed.</p>
      </Panel>
    </div>}
  </section>;
}
