import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { StoreFollowersView, type StoreFollowPage } from '../src/store-followers';

const followers: StoreFollowPage = {
  total: 8, followingCount: 3, page: 1, pageSize: 6,
  items: Array.from({ length: 6 }, (_, i) => ({
    displayName: `Synthetic Follower ${i + 1}`,
    followedAt: `2026-11-${String(18 - i).padStart(2, '0')}T08:00:00.000Z`,
  })),
};
const following: StoreFollowPage = {
  total: 3, followerCount: 8, followingCount: 3, page: 1, pageSize: 6,
  items: [
    { storeId: 31, storeName: 'Campus Crafts', campusName: 'Main Campus', followedAt: '2026-11-18T08:00:00.000Z' },
    { storeId: 32, storeName: 'Study Finds', campusName: 'Cauayan Campus', followedAt: '2026-11-17T08:00:00.000Z' },
  ],
};
const render = (activeTab: 'followers' | 'following', data: StoreFollowPage | null,
  counts: { followers: number; following: number } | null = { followers: 8, following: 3 }, error = '', publicView = false) =>
  renderToStaticMarkup(<StaticRouter location="/"><StoreFollowersView activeTab={activeTab} data={data} counts={counts}
    loading={false} error={error} onTab={() => {}} onPage={() => {}} onRetry={() => {}}
    publicView={publicView} /></StaticRouter>);

describe('owner-only follow list presentation', () => {
  test('both counts open the same dialog with accessible Followers and Following tabs', () => {
    const html = render('followers', followers);
    expect(html).toContain('View 8 followers');
    expect(html).toContain('View 3 followed stores');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Synthetic Follower 1');
    expect(html).not.toContain('Synthetic Follower 7');
    expect(html).not.toContain('Refresh followers');
  });
  test('Following tab lists real store links without private owner details', () => {
    const html = render('following', following);
    expect(html).toContain('Campus Crafts');
    expect(html).toContain('/stores/31');
    expect(html).toContain('Main Campus');
    expect(html).not.toContain('example.invalid');
    expect(html).not.toContain('PRIVATE-');
  });
  test('empty and unavailable lists have useful feedback', () => {
    expect(render('followers', { ...followers, total: 0, items: [] }, { followers: 0, following: 0 }))
      .toContain('No followers yet');
    expect(render('following', { ...following, total: 0, items: [] }, { followers: 0, following: 0 }))
      .toContain('You are not following any stores yet');
    expect(render('following', null, null, 'Not available')).toContain('Try again');
  });
});

describe('public store connection presentation', () => {
  test('visitors see clickable counts and a public description', () => {
    const html = render('followers', followers, { followers: 8, following: 3 }, '', true);
    expect(html).toContain('View 8 followers');
    expect(html).toContain('View 3 followed stores');
    expect(html).toContain('People following this store');
    expect(html).not.toContain('visible only to you');
  });
  test('empty following uses third-person language', () => {
    const html = render('following', { ...following, total: 0, items: [] },
      { followers: 0, following: 0 }, '', true);
    expect(html).toContain('This store is not following any stores yet');
  });
});
