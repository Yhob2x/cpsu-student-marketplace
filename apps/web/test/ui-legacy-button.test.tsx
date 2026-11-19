import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegacyButton } from '../src/components/ui/legacy-button';

describe('legacy button consolidation without design or behavior changes', () => {
  test('keeps the exact .btn CSS contract and does not force type=button', () => {
    const html = renderToStaticMarkup(<LegacyButton>Save</LegacyButton>);
    expect(html).toContain('<button');
    expect(html).toContain('class="btn"');
    expect(html).not.toContain('type=');
    expect(html).toContain('>Save</button>');
  });

  test('keeps native submit semantics, ghost/danger variants and accessibility attributes', () => {
    const html = renderToStaticMarkup(
      <LegacyButton type="submit" className="ghost" disabled aria-label="Save changes"
        aria-busy="true" data-testid="save-action">Save</LegacyButton>);
    expect(html).toContain('type="submit"');
    expect(html).toContain('class="btn ghost"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="Save changes"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-testid="save-action"');
    const danger = renderToStaticMarkup(
      <LegacyButton type="button" className="danger">Deactivate</LegacyButton>);
    expect(danger).toContain('class="btn danger"');
  });

  test('six public, transaction, and admin screens use the reusable native button', () => {
    for (const [filename, expected] of [
      ['pages-managed-content.tsx', 8],
      ['pages-reviewers.tsx', 7],
      ['pages-catalog-admin.tsx', 11],
      ['pages-public.tsx', 13],
      ['pages-transactions.tsx', 10],
      ['pages-storefront.tsx', 6],
    ] as const) {
      const source = readFileSync(new URL('../src/' + filename, import.meta.url), 'utf8');
      expect(source).toContain("from './components/ui/legacy-button'");
      expect((source.match(/<LegacyButton(?:\s|>)/g) ?? []).length).toBe(expected);
      expect(source).not.toMatch(/<button[^>]+className="btn(?:\s|")/);
    }
  });
});
