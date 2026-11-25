import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

const photoBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
  'base64',
);

test('Explore keeps an existing listing photo mounted when sorting refreshes results', async ({ page }) => {
  await mockMarketplace(page);
  let photoRequests = 0;
  await page.route('**/api/v1/media/777', async route => {
    photoRequests++;
    await route.fulfill({
      status: 200, contentType: 'image/png', body: photoBytes,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  });
  await page.route('**/api/v1/listings**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/v1/listings') return route.fallback();
    // Make the refresh visible, so the test catches a temporary photo unmount.
    if (url.searchParams.has('sort')) await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ json: {
      items: [{
        id: 91, type: 'physical_product', title: 'Synthetic calculus textbook',
        description: 'Synthetic test listing', price: 250, priceBasis: 'per item',
        availability: 'available', condition: 'good',
        category: { name: 'Books' },
        campus: { code: 'MAIN', name: 'CPSU Main Campus' },
        seller: { id: 30, storeName: 'Synthetic Campus Books', avatarUrl: null },
        images: ['/api/v1/media/777'],
      }], total: 1, page: 1, pageSize: 20,
    } });
  });

  await page.goto('/explore');
  const photo = page.locator('.explore-results .product-photo img').first();
  await expect(photo).toBeVisible();
  await photo.scrollIntoViewIfNeeded();
  await expect.poll(() => photoRequests).toBe(1);
  const originalPhoto = await photo.elementHandle();

  await page.getByRole('button', { name: 'Lowest price' }).click();
  await expect(page.locator('.explore-results-count')).toHaveText('Updating listings…');
  expect(await originalPhoto!.evaluate(element => element.isConnected)).toBe(true);
  await expect(page.locator('.explore-results-count')).toHaveText('1 listing');
  expect(await originalPhoto!.evaluate(element => element.isConnected)).toBe(true);
  expect(photoRequests).toBe(1);
});
