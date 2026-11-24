import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CatalogAdmin } from '../../resources/js/pages-catalog-admin';

const initial = {
  campuses: [{ id: 7, code: 'MAIN', name: 'Main Campus', active: true,
    _count: { affiliations: 2, listings: 3, campusRoles: 1 } }],
  categories: [
    { id: 10, name: 'Notebooks', listingType: 'physical_product' as const, parentId: null,
      _count: { listings: 4, children: 0 } },
    { id: 9, name: 'Photography', listingType: 'service' as const, parentId: null,
      _count: { listings: 2, children: 0 } },
  ],
};
const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });

test('identifies invalid campus fields and saves the corrected campus', async () => {
  const campuses = structuredClone(initial.campuses);
  const writes: unknown[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      writes.push(body);
      const created = { ...campuses[0], ...body, id: 8 };
      campuses.push(created);
      return Response.json(created, { status: 201 });
    }
    return Response.json({ ...initial, campuses });
  }) as typeof fetch;

  render(<CatalogAdmin onCampusesChange={() => {}} />);
  const add = await screen.findByRole('button', { name: 'Add campus' });
  const code = screen.getByLabelText('Code');
  const name = screen.getByLabelText('Campus name');
  fireEvent.change(code, { target: { value: 'CPSU West' } });
  fireEvent.change(name, { target: { value: 'W' } });
  fireEvent.click(add);

  expect(code.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(code);
  expect(screen.getByRole('alert').textContent).toContain('hyphens and underscores');
  expect(writes).toEqual([]);

  fireEvent.change(code, { target: { value: ' CPSU-WEST ' } });
  fireEvent.click(add);
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(name);
  expect(writes).toEqual([]);

  fireEvent.change(name, { target: { value: ' CPSU West Campus ' } });
  fireEvent.click(add);
  expect(await screen.findByText('CPSU West Campus')).toBeTruthy();
  expect(writes).toEqual([{ code: 'CPSU-WEST', name: 'CPSU West Campus' }]);
});

describe('admin product and service category editing', () => {
  test('selects product/service type when adding and keeps existing category edits in the same type', async () => {
    const actions: { url: string; method: string; body?: any }[] = [];
    let catalog = structuredClone(initial);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      actions.push({ url, method, body });
      if (url.endsWith('/admin/catalog') && method === 'GET') return Response.json(catalog);
      if (url.endsWith('/admin/catalog/campuses/7') && method === 'PATCH') {
        catalog.campuses[0] = { ...catalog.campuses[0], ...body };
        return Response.json(catalog.campuses[0]);
      }
      if (url.endsWith('/admin/catalog/categories') && method === 'POST') {
        const created = { id: 40 + catalog.categories.length, name: body.name,
          listingType: body.listingType, parentId: null, _count: { listings: 0, children: 0 } };
        catalog.categories.push(created);
        return Response.json(created, { status: 201 });
      }
      if (url.endsWith('/admin/catalog/categories/9') && method === 'PATCH') {
        catalog.categories[1] = { ...catalog.categories[1], ...body };
        return Response.json(catalog.categories[1]);
      }
      return Response.json({ error: { code: 'not_found' } }, { status: 404 });
    }) as typeof fetch;
    let refreshed = 0;
    render(<CatalogAdmin onCampusesChange={() => { refreshed++; }} />);
    expect(await screen.findByText('Main Campus')).toBeTruthy();
    expect(screen.getByText('Notebooks')).toBeTruthy();
    expect(screen.queryByText('Photography')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('e.g. School supplies'), { target: { value: 'Textbooks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add product category' }));
    await waitFor(() => expect(screen.getByText('Textbooks')).toBeTruthy());
    expect(actions.some(a => a.url.endsWith('/admin/catalog/categories') && a.method === 'POST' &&
      a.body.listingType === 'physical_product' && a.body.name === 'Textbooks')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    expect(screen.queryByText('Notebooks')).toBeNull();
    expect(screen.getByText('Photography')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('e.g. Event photography'), { target: { value: 'Tutoring' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add service category' }));
    await waitFor(() => expect(screen.getByText('Tutoring')).toBeTruthy());
    expect(actions.some(a => a.url.endsWith('/admin/catalog/categories') && a.method === 'POST' &&
      a.body.listingType === 'service' && a.body.name === 'Tutoring')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Edit service category Photography' }));
    fireEvent.change(screen.getByDisplayValue('Photography'), { target: { value: 'Event photography' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Event photography')).toBeTruthy());
    expect(actions.some(a => a.url.endsWith('/admin/catalog/categories/9') && a.method === 'PATCH' &&
      a.body.name === 'Event photography' && a.body.listingType === undefined)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Edit campus Main Campus' }));
    fireEvent.change(screen.getByDisplayValue('Main Campus'), { target: { value: 'CPSU Main Campus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(refreshed).toBe(1));
  });

  test('does not deactivate linked campuses without confirmation', async () => {
    let updated = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/admin/catalog') && (!init || init.method === 'GET')) return Response.json(initial);
      updated = true;
      return Response.json(initial.campuses[0]);
    }) as typeof fetch;
    const originalConfirm = window.confirm;
    window.confirm = () => false;
    try {
      render(<CatalogAdmin onCampusesChange={() => {}} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Deactivate campus Main Campus' }));
      expect(updated).toBe(false);
    } finally { window.confirm = originalConfirm; }
  });
});
