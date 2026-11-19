import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
// Keep the synthetic editor shape aligned with the shipped copy without importing JSON through Playwright.
const shippedCopy = JSON.parse(readFileSync(new URL('../../../shared/home-page-defaults.json', import.meta.url), 'utf8')).copy;
const DEFAULT_HOME_PAGE = { copy: shippedCopy, images: { hero: null, steps: null, cta: null } };

export type Persona = 'guest' | 'buyer' | 'seller' | 'reviewer' | 'admin';
const campus = { id: 1, code: 'MAIN', name: 'CPSU Main Campus' };
const categories = [
  { id: 1, parentId: null, name: 'Books', listingType: 'physical_product' },
  { id: 2, parentId: null, name: 'Photography', listingType: 'service' },
];
export const syntheticListing = {
  id: 91, type: 'physical_product', title: 'Synthetic calculus textbook',
  description: 'Good condition calculus textbook for student practice.',
  price: 250, priceBasis: 'per item', availability: 'available', status: 'published',
  condition: 'good', category: { id: 1, name: 'Books' }, campus,
  seller: { id: 30, storeName: 'Synthetic Campus Books', avatarUrl: null }, images: [],
};
const book = syntheticListing;

export async function mockMarketplace(page: Page, initialPersona: Persona = 'guest') {
  const state = {
    persona: initialPersona,
    drafts: [] as any[],
    uploads: 0,
    reports: [] as any[],
    verified: false,
    threadStatus: 'open',
    messages: [] as any[],
    unknownWrites: [] as string[],
  };
  const identity = () => {
    if (state.persona === 'guest') return null;
    const isSeller = state.persona === 'seller';
    const isReviewer = state.persona === 'reviewer';
    const isAdmin = state.persona === 'admin';
    return {
      id: isSeller ? 8 : isAdmin ? 10 : isReviewer ? 9 : 7,
      email: isSeller ? 'seller@example.invalid' : isAdmin ? 'admin@example.invalid' : isReviewer ? 'reviewer@example.invalid' : 'buyer@example.invalid',
      displayName: isSeller ? 'Synthetic Seller' : isAdmin ? 'Synthetic Administrator' : isReviewer ? 'Synthetic Reviewer' : 'Synthetic Buyer',
      roles: isAdmin ? [{ role: 'university_admin', campusId: null }] : isReviewer ? [{ role: 'campus_reviewer', campusId: 1 }] : [],
      affiliations: isAdmin || isReviewer ? [] : [{ id: 80, campus, status: 'verified' }],
      storeId: isSeller ? 30 : null,
    };
  };
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice('/api/v1'.length);
    const method = request.method();
    let status = 200;
    let data: any = {};
    const body = () => {
      try { return request.postDataJSON() ?? {}; } catch { return {}; }
    };
    if (path === '/auth/refresh') {
      if (state.persona === 'guest') { status = 204; data = undefined; }
      else data = { accessToken: 'synthetic-test-only' };
    } else if (path === '/auth/login' && method === 'POST') {
      state.persona = 'buyer';
      data = { accessToken: 'synthetic-test-only' };
    } else if (path === '/auth/logout' && method === 'POST') {
      state.persona = 'guest'; status = 204; data = undefined;
    } else if (path === '/auth/registration-policy') {
      data = { studentIdentityRequired: false };
    } else if (path === '/me') {
      data = identity();
    } else if (path === '/campuses') {
      data = [campus];
    } else if (path === '/categories') {
      data = categories;
    } else if (path === '/home-page') {
      data = { images: { hero: null, steps: null, cta: null } };
    } else if (path === '/announcements') {
      data = { items: [] };
    } else if (path === '/guidelines') {
      data = { body: '# Marketplace guidelines\\nRespect other students.', publishedAt: null };
    } else if (path === '/listings/fresh' || path === '/listings/popular') {
      data = { items: [book] };
    } else if (path === '/listings/91') {
      data = book;
    } else if (path === '/listings') {
      const category = url.searchParams.get('categoryId');
      const type = url.searchParams.get('type');
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const results = (!category || category === '1') && (!type || type === book.type) &&
        (!q || book.title.toLowerCase().includes(q)) ? [book] : [];
      data = { items: results, total: results.length, page: 1, pageSize: 20 };
    } else if (path === '/stores/most-followed') {
      data = { available: false, items: [] };
    } else if (path === '/seller-profiles/30' || path === '/seller-profiles/by-slug/synthetic-campus-books') {
      data = {
        id: 30, slug: 'synthetic-campus-books', storeName: 'Synthetic Campus Books',
        description: 'Books and study supplies for synthetic UI testing only.',
        badge: 'Verified CPSU community member', createdAt: '2026-11-18T00:00:00Z',
        listingCount: 1, follow: { count: 0, isFollowing: false, available: true },
        campus, listings: [book],
      };
    } else if (path === '/seller/store') {
      data = { id: 30, storeName: 'Synthetic Campus Books', campusId: 1 };
    } else if (path === '/seller/listings' && method === 'GET') {
      data = state.drafts;
    } else if (path === '/seller/listings' && method === 'POST') {
      const input = body();
      const draft = { id: 197, ...input, status: 'draft', deletedAt: null,
        availabilityState: 'available', media: [], category: categories.find(c => c.id === input.categoryId),
        campus, createdAt: new Date().toISOString() };
      state.drafts.push(draft); status = 201; data = { id: draft.id };
    } else if (/^\/seller\/listings\/197\/media$/.test(path) && method === 'POST') {
      const photoId = 600 + ++state.uploads;
      state.drafts[0]?.media.push({ id: photoId, position: state.uploads - 1 });
      status = 201; data = { id: photoId };
    } else if (path === '/saved') {
      data = [];
    } else if (path === '/transactions' && method === 'GET') {
      data = { items: [], total: 0, page: 1 };
    } else if (path === '/notifications/unread-count') {
      data = { total: 0, messages: 0 };
    } else if (path === '/notifications') {
      data = [];
    } else if (path === '/inquiries' && method === 'GET') {
      const items = state.messages.length ? [{
        id: 41, status: state.threadStatus, role: 'buyer',
        listing: { id: 91, title: book.title }, otherStudentName: 'Synthetic Seller',
        lastMessage: state.messages.at(-1),
      }] : [];
      data = { items, hasMore: false, nextBeforeId: null };
    } else if (path === '/inquiries' && method === 'POST') {
      const input = body();
      state.messages.push({ id: 101, body: input.body, mine: true, createdAt: new Date().toISOString(), receipt: 'sent' });
      status = 201; data = { id: 41 };
    } else if (path === '/inquiries/41/messages' && method === 'GET') {
      data = { thread: { id: 41, status: state.threadStatus, otherStudentName: 'Synthetic Seller',
        listing: book }, messages: state.messages, typing: false, otherActiveInChat: false };
    } else if (path === '/inquiries/41/messages' && method === 'POST') {
      const input = body();
      state.messages.push({ id: 101 + state.messages.length, body: input.body,
        mine: true, createdAt: new Date().toISOString(), receipt: 'sent' });
      status = 201; data = { ok: true };
    } else if (path === '/inquiries/41/close' && method === 'POST') {
      state.threadStatus = 'closed'; data = { ok: true };
    } else if (path === '/inquiries/41/typing' || path === '/inquiries/41/presence' || path === '/inquiries/41/seen') {
      data = { ok: true };
    } else if (path === '/reports' && method === 'POST') {
      state.reports.push(body()); status = 201; data = { id: 701 };
    } else if (path === '/admin/review-queue') {
      data = { listings: [], affiliations: state.verified ? [] : [
        { id: 501, campus: 'CPSU Main Campus', user: { id: 55, displayName: 'Synthetic Candidate', email: 'candidate@example.invalid' } },
      ], reportsPending: 0 };
    } else if (path === '/admin/affiliations/501/verify' && method === 'POST') {
      state.verified = body().decision === 'verified'; data = { ok: true };
    } else if (path === '/admin/reports') {
      data = [];
    } else if (path === '/admin/analytics/overview') {
      data = { note: 'Synthetic browser test', campuses: [] };
    } else if (path.startsWith('/admin/reviewers') && method === 'GET') {
      data = { items: [], total: 0, page: 1 };
    } else if (path === '/admin/catalog') {
      data = { campuses: [], categories: [] };
    } else if (path === '/admin/store-reviews') {
      data = { items: [], hasMore: false };
    } else if (path === '/admin/content/guidelines') {
      data = { draftBody: 'Synthetic guidelines draft', publishedBody: null, publishedAt: null };
    } else if (path === '/admin/content/announcements') {
      data = { items: [] };
    } else if (path === '/admin/content/home-page') {
      data = { draft: DEFAULT_HOME_PAGE, published: null, revision: 1, publishedRevision: 1, publishedAt: null };
    } else if (path.startsWith('/admin/transactions')) {
      data = { items: [], total: 0 };
    } else if (path.startsWith('/admin/users')) {
      data = { items: [], total: 0, page: 1 };
    } else if (path.startsWith('/admin/audit-logs')) {
      data = { items: [], nextCursor: null };
    } else if (path.startsWith('/push/')) {
      data = { enabled: false, deliveryEnabled: false, publicKey: null };
    } else if (path.startsWith('/store-follows/') || path.startsWith('/store-reviews/')) {
      data = { available: false, items: [], count: 0, followers: 0, following: 0 };
    } else if (method !== 'GET') {
      state.unknownWrites.push(method + ' ' + path);
      status = 403; data = { error: { code: 'synthetic_write_not_allowed' } };
    } else {
      data = [];
    }
    await route.fulfill({ status, contentType: 'application/json',
      ...(status === 204 ? {} : { body: JSON.stringify(data) }) });
  });
  return state;
}
