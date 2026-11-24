import { describe, expect, test } from 'bun:test';
import { PAGE_GROUPS, readSource } from './support/source-files';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegacyButton } from '../../resources/js/components/ui/legacy-button';

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

  test('fourteen marketplace, chat, student, review, and admin files reuse the native button', () => {
    for (const [filename, expected] of [
      [['components/admin/managed-content-admin.tsx'], 8],
      [['components/admin/reviewer-admin.tsx'], 7],
      [['components/admin/catalog-admin.tsx'], 11],
      [PAGE_GROUPS.public, 13],
      [PAGE_GROUPS.transactions, 10],
      [['components/stores/storefront-view.tsx'], 6],
      [PAGE_GROUPS.account, 26],
      [['pages/admin/index.tsx'], 19],
      [PAGE_GROUPS.profile, 4],
      [['components/stores/store-review-widgets.tsx'], 13],
      [['components/meetup/meetup-location-card.tsx'], 4],
      [['components/stores/seller-store-details.tsx'], 2],
      [['components/chat/floating-chat-panel.tsx'], 5],
      [PAGE_GROUPS.shell, 1],
    ] as const) {
      const source = readSource(...filename);
      expect(source).toContain("from '@/components/ui/legacy-button'");
      expect((source.match(/<LegacyButton(?:\s|>)/g) ?? []).length).toBe(expected);
      expect(source).not.toMatch(/<button[^>]+className="btn(?:\s|")/);
    }
  });
});
