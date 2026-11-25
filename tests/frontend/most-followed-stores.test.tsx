import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { MostFollowedStores } from '../../resources/js/components/stores/most-followed-stores';

const render = (stores: Parameters<typeof MostFollowedStores>[0]['stores']) =>
  renderToStaticMarkup(createElement(StaticRouter, { location: '/' }, createElement(MostFollowedStores, { stores })));

describe('Most followed store discovery', () => {
  test('displays real totals and navigates to the correct existing storefront', () => {
    const markup = render([{ id: 3, storeName: 'Student Prints', avatarUrl: null,
      campus: { name: 'CPSU Main Campus', code: 'MAIN' }, followerCount: 2, listingCount: 1 }]);
    expect(markup).toContain('Most followed stores');
    expect(markup).toContain('Student Prints');
    expect(markup).toContain('2 followers');
    expect(markup).toContain('1 listing');
    expect(markup).toContain('href="/stores/3"');
    expect(markup).not.toContain('rating');
    expect(markup).not.toContain('sales');
  });
  test('hides ranking instead of fabricating stores when nobody follows', () => {
    expect(render([])).toBe('');
  });
});
