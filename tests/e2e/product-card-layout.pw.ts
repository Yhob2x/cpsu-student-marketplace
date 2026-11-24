import { test, expect, type Page } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

const photo = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#dfe7df"/></svg>');

/** Home's first rail ("Trending on Campus") falls back to fresh listings when nothing is popular yet. */
async function homeListings(page: Page, items: unknown[]) {
  await page.route('**/api/v1/listings/popular', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/listings/fresh', route => route.fulfill({ json: { items } }));
}

test('Concept 2 listing card stays legible, with touch-sized actions that never overlap', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await homeListings(page, [{
    ...syntheticListing, id: 91,
    title: 'ExtraordinaryLongUnbrokenStudentProductNameWithoutSpacesForWrapping',
    price: 213123, priceBasis: 'per item', stockQuantity: 3,
    images: [photo, photo, photo, photo, photo],
  }]);
  await page.goto('/');
  const card = page.locator('.home-listing-section .product-card').first();
  await expect(card).toBeVisible();
  const title = card.getByRole('heading', { level: 3 });
  // Long titles clamp to two lines inside the card instead of overflowing.
  expect(await title.evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))).toBeLessThanOrEqual(2);
  expect(await title.evaluate(el => el.scrollWidth <= el.parentElement!.clientWidth + 1)).toBe(true);
  await expect(card.getByRole('link', { name: 'View ExtraordinaryLongUnbrokenStudentProductNameWithoutSpacesForWrapping' })).toBeAttached();
  await expect(card.locator('.product-photo-multiple')).toHaveText('5 photos');
  await expect(card.locator('.market-card__badge')).toHaveText('For Sale');
  await expect(card.locator('.market-card__status')).toHaveText('Only 3 left');
  await expect(card.getByRole('button', { name: 'Save for later' })).toBeVisible();
  await expect(card.getByRole('img', { name: 'Verified CPSU student store' })).toBeVisible();
  await expect(card.locator('.price-unit')).toHaveCount(0);

  const bounds = await card.evaluate(el => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const q = (selector: string) => { const n = el.querySelector(selector); if (!n) throw new Error('Missing ' + selector); return rect(n); };
    return {
      photo: q('.product-photo'), save: q('.listing-save-btn'), photos: q('.product-photo-multiple'), badge: q('.market-card__badge'),
      status: q('.market-card__status'), title: q('h3'), price: q('.market-card__price'), seller: q('.market-card__seller'),
      campus: q('.market-card__campus'), card: rect(el),
    };
  });
  const collides = (a: typeof bounds.save, b: typeof bounds.save) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  expect(collides(bounds.photos, bounds.save)).toBe(false);
  expect(collides(bounds.badge, bounds.photos)).toBe(false);
  expect(collides(bounds.status, bounds.save)).toBe(false);
  expect(bounds.save.w).toBeGreaterThanOrEqual(40);
  expect(bounds.save.h).toBeGreaterThanOrEqual(40);
  expect(bounds.title.y + bounds.title.h).toBeLessThanOrEqual(bounds.price.y);
  expect(bounds.price.y + bounds.price.h).toBeLessThanOrEqual(bounds.seller.y);
  expect(bounds.campus.x + bounds.campus.w).toBeLessThanOrEqual(bounds.card.x + bounds.card.w);
  expect(bounds.card.w).toBeGreaterThan(160);
});

for (const path of ['/', '/explore']) {
  test(`price and seller rows align across listings with different amounts of detail on ${path}`, async ({ page }) => {
    await mockMarketplace(page, 'buyer');
    const items = [
      { ...syntheticListing, images: [photo], title: 'Calculus textbook with practice exercises and student notes' },
      { ...syntheticListing, id: 92, images: [photo], title: 'Tutoring', type: 'service', condition: null, stockQuantity: null, priceBasis: 'per session' },
    ];
    if (path === '/') await homeListings(page, items);
    else await page.route('**/api/v1/listings?*', route => route.fulfill({ json: { items, total: items.length, page: 1, pageSize: 20 } }));
    await page.goto(path);

    const cards = page.locator(path === '/' ? '.home-listing-section .rail' : '.explore-results').first().locator('.product-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator('.market-card__status')).toHaveText('Only 3 left');
    await expect(cards.nth(1).locator('.market-card__status')).toHaveCount(0);
    await expect(cards.nth(1).locator('.market-card__badge')).toHaveText('Service');

    for (const row of ['.market-card__price', '.market-card__seller']) {
      const positions = await cards.locator(row).evaluateAll(rows => rows.map(r => r.getBoundingClientRect().top));
      expect(Math.abs(positions[0] - positions[1]), row).toBeLessThan(1);
    }
  });
}
