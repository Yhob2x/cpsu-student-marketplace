import { test, expect } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

const photo = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#dfe7df"/></svg>');

for (const path of ['/', '/explore']) {
  test(`product image gains a soft vignette without zoom on ${path}`, async ({ page }) => {
    await mockMarketplace(page, 'buyer');
    const items = [{ ...syntheticListing, images: [photo, photo] }];
    // Home's first rail shows fresh listings until something is popular.
    if (path === '/') await page.route('**/api/v1/listings/popular', route => route.fulfill({ json: { items: [] } }));
    await page.route(path === '/' ? '**/api/v1/listings/fresh' : '**/api/v1/listings?*', route =>
      route.fulfill({ json: { items, total: 1, page: 1, pageSize: 20 } }));
    await page.goto(path);

    const card = page.locator(path === '/' ? '.home-listing-section .product-card:has(.product-photo img)' : '.explore-results .product-card').first();
    const image = card.locator('.product-photo img');
    const vignetteOpacity = () => card.locator('.product-photo').evaluate(el => getComputedStyle(el, '::after').opacity);
    await expect(image).toBeVisible();
    const save = card.getByRole('button', { name: 'Save for later' });
    await page.mouse.move(0, 0);
    await expect.poll(vignetteOpacity).toBe('0');
    // Concept 2: the heart save button is always visible, not revealed on hover.
    await expect(save).toHaveCSS('opacity', '1');
    await card.hover();
    await expect.poll(vignetteOpacity).toBe('1');
    await expect(save).toHaveCSS('opacity', '1');
    expect(await save.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
    await expect(save).toContainText('Save');
    await expect(image).toHaveCSS('transform', 'none');
    await expect(card.locator('.product-photo-multiple')).toBeVisible();
  });
}
