import { test, expect } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

const photo = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#dfe7df"/></svg>');

test('home listing card content and actions stay legible on desktop and mobile', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.route('**/api/v1/listings/fresh', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: [{
      ...syntheticListing, id: 91,
      title: 'ExtraordinaryLongUnbrokenStudentProductNameWithoutSpacesForWrapping',
      price: 213123, priceBasis: 'per item', stockQuantity: 3,
      images: [photo, photo, photo, photo, photo],
    }] }),
  }));
  await page.goto('/');
  const card = page.locator('.home-listing-section .product-card').first();
  await expect(card).toBeVisible();
  const title = card.getByRole('heading', { level: 3 });
  await expect(title).toHaveCSS('text-overflow', 'ellipsis');
  expect(await title.evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))).toBe(1);
  await expect(card.getByRole('link', { name: 'View ExtraordinaryLongUnbrokenStudentProductNameWithoutSpacesForWrapping' })).toBeAttached();
  await expect(card.locator('.product-photo-multiple')).toHaveText('5 photos');
  await expect(card.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' })).toBeVisible();
  await expect(card.getByRole('img', { name: '298 listing views' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Save for later' })).toBeVisible();
  await expect(card.locator('.product-card-arrow')).toHaveCount(0);
  await expect(card.locator('.price-unit')).toHaveCount(0);
  await expect(card.locator('.listing-stock-label')).toHaveText('3 in stock');
  const bounds = await card.evaluate(el => {
    const rect = (node: Element) => {
      const r = node.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const q = (selector: string) => {
      const n = el.querySelector(selector);
      if (!n) throw new Error('Missing '+selector);
      return rect(n);
    };
    return {
      photo: q('.product-photo'),
      save: q('.listing-save-btn'),
      like: q('.listing-appreciation.is-compact'),
      photos: q('.product-photo-multiple'),
      heading: q('.listing-card-heading'),
      title: q('h3'),
      seller: q('.listing-seller-row'),
      price: q('.listing-card-price'),
      meta: q('.listing-card-meta'),
      stock: q('.listing-card-status'),
      campus: q('.card-campus'),
      card: rect(el),
    };
  });
  const collides = (a: typeof bounds.save, b: typeof bounds.save) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  expect(collides(bounds.photos, bounds.save)).toBe(false);
  expect(collides(bounds.photos, bounds.like)).toBe(false);
  expect(collides(bounds.title, bounds.like)).toBe(false);
  expect(Math.abs(bounds.title.w - bounds.photo.w)).toBeLessThan(1);
  expect(bounds.like.w).toBeGreaterThanOrEqual(40);
  expect(bounds.save.w).toBeGreaterThanOrEqual(40);
  expect(bounds.title.y + bounds.title.h).toBeLessThanOrEqual(bounds.seller.y);
  expect(bounds.seller.y + bounds.seller.h).toBeLessThanOrEqual(bounds.price.y);
  expect(bounds.price.y + bounds.price.h).toBeLessThanOrEqual(bounds.meta.y);
  expect(bounds.stock.y + bounds.stock.h).toBeLessThanOrEqual(bounds.campus.y);
  expect(bounds.card.w).toBeGreaterThan(160);
});

for (const path of ['/', '/explore']) {
  test(`campus rows align across listings with different amounts of detail on ${path}`, async ({ page }) => {
    await mockMarketplace(page, 'buyer');
    const items = [
      { ...syntheticListing, images: [photo], title: 'Calculus textbook with practice exercises and student notes' },
      { ...syntheticListing, id: 92, images: [photo], title: 'Tutoring', type: 'service', condition: null, stockQuantity: null, priceBasis: 'per session' },
    ];
    await page.route(path === '/' ? '**/api/v1/listings/fresh' : '**/api/v1/listings?*', route =>
      route.fulfill({ json: { items, total: items.length, page: 1, pageSize: 20 } }));
    await page.goto(path);

    const cards = page.locator(path === '/' ? '.home-listing-section .rail' : '.explore-results').first().locator('.product-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator('.listing-stock-label')).toHaveText('3 in stock');
    await expect(cards.nth(1).locator('.listing-stock-label')).toHaveCount(0);

    const campusPositions = await cards.locator('.card-campus').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().bottom));
    expect(Math.abs(campusPositions[0] - campusPositions[1])).toBeLessThan(1);
  });
}
