import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { mergeInboxPages } from '../../resources/js/inbox-pages';

const inbox = readFileSync(new URL('../../resources/js/pages-account.tsx', import.meta.url), 'utf8');
const floating = readFileSync(new URL('../../resources/js/floating-chat-panel.tsx', import.meta.url), 'utf8');
const storefront = readFileSync(new URL('../../resources/js/pages-storefront.tsx', import.meta.url), 'utf8');
const storePage = readFileSync(new URL('../../resources/js/pages-public.tsx', import.meta.url), 'utf8');

describe('paged inbox and storefront readers', () => {
  test('repeated inbox refreshes keep old conversations and update new message previews', () => {
    const previous = [{ id: 5, last: 'old' }, { id: 4, last: 'hello' }];
    const current = [{ id: 6, last: 'new' }, { id: 5, last: 'updated' }];
    expect(mergeInboxPages(previous, current)).toEqual([
      { id: 6, last: 'new' }, { id: 5, last: 'updated' }, { id: 4, last: 'hello' },
    ]);
  });
  test('inbox and floating chat use bounded API requests and the full inbox pages older threads', () => {
    expect(inbox).toContain("'/inquiries?limit=30'");
    expect(floating).toContain("'/inquiries?limit=30'");
    expect(inbox).toContain('limit=30&beforeId=${beforeId}');
    expect(inbox).toContain('Load older conversations');
  });
  test('store listing paging is explicit and filter labels clarify partial results', () => {
    expect(storePage).toContain('`${resource}?limit=24`');
    expect(storePage).toContain('limit=24&beforeId=${s.nextListingBeforeId}');
    expect(storefront).toContain('Load more listings');
    expect(storefront).toContain('Filters search the loaded items.');
  });
});
