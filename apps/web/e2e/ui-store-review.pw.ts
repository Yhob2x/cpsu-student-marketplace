import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';
import { resolve } from 'node:path';

const reviewPage = {
  available: true,
  summary: { count: 2, average: 4.5, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } },
  items: [
    { id: 51, rating: 5, body: 'Clear communication and careful handoff.', createdAt: '2026-11-18T00:00:00Z' },
    { id: 52, rating: 4, body: 'Smooth campus meetup.', createdAt: '2026-11-17T00:00:00Z' },
  ],
  page: 1, pageSize: 8,
};

for (const width of [360, 768, 1280]) {
  test('populated store reviews remain readable and accessible at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await mockMarketplace(page, 'buyer');
    await page.route('**/api/v1/seller-profiles/30/reviews*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reviewPage) }));
    await page.goto('/store/synthetic-campus-books');
    const reviews = page.locator('.store-reviews-section');
    await expect(reviews.getByRole('heading', { name: 'Ratings & reviews' })).toBeVisible();
    await expect(reviews.locator('.store-review-row')).toHaveCount(2);
    await expect(reviews.getByRole('progressbar')).toHaveCount(5);
    const size = await reviews.evaluate(section => {
      const box = section.getBoundingClientRect();
      return { width: box.width, left: box.left, right: box.right,
        scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth };
    });
    expect(size.scrollWidth - size.viewport).toBeLessThanOrEqual(0);
    expect(size.left).toBeGreaterThanOrEqual(0);
    expect(size.right).toBeLessThanOrEqual(width + 1);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    if (process.env.CPSU_UI_CAPTURE) {
      const destination = resolve(process.cwd(), '../../.tmp', 'review-' + process.env.CPSU_UI_CAPTURE + '-' + width + '.png');
      await reviews.screenshot({ path: destination, animations: 'disabled' });
    }
  });
}

test('unreviewed store has an accessible, non-deceptive empty state', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await mockMarketplace(page, 'buyer');
  await page.route('**/api/v1/seller-profiles/30/reviews*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...reviewPage, summary: { count: 0, average: null, distribution: {} }, items: [],
    }) }));
  await page.goto('/store/synthetic-campus-books');
  await expect(page.getByText('No reviews yet')).toBeVisible();
  await expect(page.getByText('Approved buyer reviews will appear here.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Write a review' })).toBeVisible();
});

test('review rating controls retain 44px hit areas and native radio semantics', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  const state = await mockMarketplace(page, 'buyer');
  await page.route('**/api/v1/seller-profiles/30/reviews*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ...reviewPage, summary: { count: 0, average: null, distribution: {} }, items: [],
    }) }));
  await page.route('**/api/v1/seller-profiles/30/review-opportunities*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      available: true, items: [{ id: 42, createdAt: '2026-11-18T00:00:00Z',
        listing: { title: 'Synthetic textbook' } }], page: 1, pageSize: 10, hasMore: false, reason: null,
    }) }));
  await page.route('**/api/v1/transactions/42/store-review', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      available: true, eligible: true, review: null,
    }) }));
  await page.goto('/store/synthetic-campus-books');
  await page.getByRole('button', { name: 'Write a review' }).click();
  const options = page.locator('label.store-review-star-option');
  await expect(options).toHaveCount(5);
  const sizes = await options.evaluateAll(elements =>
    elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
  expect(sizes.every(box => box.width >= 44 && box.height >= 44), JSON.stringify(sizes)).toBe(true);
  await options.nth(3).click();
  await expect(page.getByRole('radio', { name: '4 stars' })).toBeChecked();
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: '4 of 5 stars selected' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  expect(state.unknownWrites).toEqual([]);
});
