import { test, expect, type Page } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

const photo = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#dfe7df"/></svg>');

/** Trending on Campus falls back to fresh listings when nothing is popular yet. */
async function homeListings(page: Page, items: unknown[]) {
  await page.route('**/api/v1/listings/popular', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/listings/fresh', route => route.fulfill({ json: { items } }));
}

test('Trending on Campus scrolls through ten cards in one row without arrow controls', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  const fresh = Array.from({ length: 12 }, (_, index) => ({
    ...syntheticListing, id: 91 + index, title: `Campus listing ${index + 1}`, images: [photo],
  }));
  const popular = fresh.slice(0, 5).reverse();
  await homeListings(page, fresh);
  await page.route('**/api/v1/listings/popular', route => route.fulfill({ json: { items: popular } }));
  await page.goto('/');

  const trending = page.getByRole('region', { name: 'Trending on Campus', exact: true });
  const cards = trending.locator('.product-card');
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText([...popular, ...fresh.slice(5, 10)].map(listing => listing.title));
  const freshSection = page.locator('section[aria-label="Fresh listings"]');
  await expect(freshSection.getByRole('heading', { level: 3 })).toHaveText(fresh.slice(0, 8).map(listing => listing.title));
  const freshRail = freshSection.locator('.rail');
  await expect(freshRail).toHaveCSS('scrollbar-width', 'none');
  await expect(freshRail).toHaveCSS('overflow-x', 'auto');
  await expect(freshSection.locator('.mobile-browse-controls')).toHaveCount(0);
  await expect(trending.getByRole('link', { name: 'View more' })).toHaveAttribute('href', '/explore');
  await expect(trending.locator('.mobile-browse-controls')).toHaveCount(0);
  const layout = await cards.evaluateAll(items => {
    const container = items[0].parentElement!;
    return {
      hasHorizontalOverflow: container.scrollWidth > container.clientWidth,
      rows: new Set(items.map(item => item.getBoundingClientRect().top)).size,
    };
  });
  expect(layout.rows).toBe(1);
  expect(layout.hasHorizontalOverflow).toBe(true);
  const rail = trending.getByRole('region', { name: 'Trending listings' });
  await expect(rail).toHaveCSS('scrollbar-width', 'none');
  if (test.info().project.name === 'mobile-chrome') {
    await rail.scrollIntoViewIfNeeded();
    const bounds = (await rail.boundingBox())!;
    const x = Math.round(bounds.x + bounds.width * .85);
    const y = Math.round(bounds.y + 75);
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let offset = 20; offset <= 240; offset += 20) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - offset, y }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
  } else {
    await rail.focus();
    await rail.press('ArrowRight');
  }
  await expect.poll(() => rail.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
});

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
  await expect(card).toHaveCSS('box-shadow', 'none');
  const title = card.getByRole('heading', { level: 3 });
  await expect(page.locator('section[aria-label="Fresh listings"]').getByRole('heading', { level: 3 })).toHaveText('ExtraordinaryLongUnbrokenStudentProductNameWithoutSpacesForWrapping');
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
  const canHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  expect(bounds.save.h).toBe(canHover ? 32 : 44);
  expect(bounds.title.y + bounds.title.h).toBeLessThanOrEqual(bounds.price.y);
  expect(bounds.price.y + bounds.price.h).toBeLessThanOrEqual(bounds.seller.y);
  expect(bounds.campus.x + bounds.campus.w).toBeLessThanOrEqual(bounds.card.x + bounds.card.w);
  expect(bounds.card.w).toBeGreaterThan(160);
});

test('mobile trending rail uses compact cards for services with unavailable photos', async ({ page }) => {
  test.skip(test.info().project.name !== 'mobile-chrome', 'Checks the touch layout');
  await mockMarketplace(page, 'buyer');
  const service = {
    ...syntheticListing, title: 'Graduation photoshoot', type: 'service', price: 400, priceBasis: 'per session',
    condition: null, stockQuantity: null, category: { ...syntheticListing.category, name: 'Photography and video services' },
    images: Array(5).fill('/unavailable-product-photo.png'),
  };
  await homeListings(page, [service, { ...service, id: 92 }, { ...service, id: 93 }]);
  await page.goto('/');

  const card = page.locator('.home-listing-section .product-card').first();
  await expect(card.getByText('Photo unavailable')).toBeVisible();
  await expect(card.locator('.market-card__badge')).toBeHidden();
  await expect(card.locator('.market-card__seller .seller-avatar')).toBeHidden();
  const title = await card.getByRole('heading', { level: 3 }).boundingBox();
  const price = await card.locator('.market-card__price').boundingBox();
  const seller = await card.locator('.market-card__seller').boundingBox();
  expect(price!.y - (title!.y + title!.height)).toBeGreaterThanOrEqual(4);
  expect(seller!.y - (price!.y + price!.height)).toBeGreaterThanOrEqual(4);
  const photo = await card.locator('.product-photo').boundingBox();
  const bounds = await card.boundingBox();
  expect(photo!.height).toBeLessThanOrEqual(photo!.width * .6);
  expect(bounds!.height).toBeLessThan(265);
  const save = card.getByRole('button', { name: 'Save for later' });
  await expect(save).toBeVisible();
  await expect(save.getByText('Save', { exact: true })).toBeHidden();
  const target = await save.boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);
});

for (const path of ['/', '/explore']) {
  test(`price and seller rows align across listings with different amounts of detail on ${path}`, async ({ page }) => {
    await mockMarketplace(page, 'buyer');
    const items = [
      { ...syntheticListing, images: [photo], title: 'Calculus textbook with practice exercises and student notes', category: { ...syntheticListing.category, name: 'Textbooks and supplementary learning materials' } },
      { ...syntheticListing, id: 92, images: [photo], title: 'Tutoring', type: 'service', condition: null, stockQuantity: null, priceBasis: 'per session' },
    ];
    if (path === '/') await homeListings(page, items);
    else await page.route('**/api/v1/listings?*', route => route.fulfill({ json: { items, total: items.length, page: 1, pageSize: 20 } }));
    await page.goto(path);

    const results = path === '/' ? page.getByRole('region', { name: 'Trending on Campus', exact: true }) : page.locator('.explore-results');
    const cards = results.locator('.product-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator('.market-card__status')).toHaveText('Only 3 left');
    await expect(cards.nth(1).locator('.market-card__status')).toHaveCount(0);
    await expect(cards.nth(1).locator('.market-card__badge')).toHaveText('Service');

    const category = cards.first().locator('.market-card__category');
    if (test.info().project.name === 'mobile-chrome') {
      await expect(category).toBeHidden();
      await expect(cards.first().locator('.listing-view-count')).toBeHidden();
      const campus = await cards.first().locator('.market-card__campus').boundingBox();
      const like = await cards.first().locator('.listing-appreciation-action').boundingBox();
      expect(campus!.x + campus!.width).toBeLessThanOrEqual(like!.x);
      expect(campus!.y).toBeGreaterThanOrEqual(like!.y);
      expect(campus!.y + campus!.height).toBeLessThanOrEqual(like!.y + like!.height);
    } else {
      await expect(category).toBeVisible();
    }

    for (const row of ['.market-card__price', '.market-card__seller', '.market-card__footer', '.market-card__campus', '.listing-card-engagement']) {
      const positions = await cards.locator(row).evaluateAll(rows => rows.map(r => r.getBoundingClientRect().top));
      expect(Math.abs(positions[0] - positions[1]), row).toBeLessThan(1);
    }
  });
}
