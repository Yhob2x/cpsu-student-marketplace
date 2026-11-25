import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';

const noHorizontalScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

test('seller tracks orders and sales from My store and Store insights', async ({ page }) => {
  await mockMarketplace(page, 'seller');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/dashboard');
  const summary = page.getByRole('region', { name: /Store performance/ });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('₱1,250')).toBeVisible();
  await expect(summary.getByRole('link', { name: /New request: Synthetic calculator/ })).toHaveAttribute('href', '/transactions/501');

  await summary.getByRole('link', { name: 'Store insights' }).click();
  await expect(page).toHaveURL(/\/dashboard\/insights$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Store insights' })).toBeVisible();
  await expect(page.getByText('+25%').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Accept or decline the request/ })).toHaveAttribute('href', '/transactions/501');
  await expect(page.getByRole('link', { name: /Confirm the handoff is complete/ })).toHaveAttribute('href', '/transactions/502');
  await expect(page.getByText('1 left')).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Synthetic calculator');

  const request = page.waitForRequest(r => r.url().includes('/api/v1/seller/analytics?range=90d'));
  await page.getByRole('radio', { name: 'Last 90 days' }).click();
  await request;
  await expect(page).toHaveURL(/range=90d/);
  await expect(page.getByRole('radio', { name: 'Last 90 days' })).toBeChecked();

  await page.getByText('Show as table').click();
  await expect(page.locator('.analytics-chart-table table')).toBeVisible();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations.map(v => v.id)).toEqual([]);
  expect(errors).toEqual([]);
});

test('store insights stay readable on a 320px phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockMarketplace(page, 'seller');
  await page.goto('/dashboard/insights');
  await expect(page.getByRole('heading', { level: 1, name: 'Store insights' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  for (const target of [page.getByRole('radio', { name: 'Last 7 days' }), page.getByRole('combobox', { name: 'Show' })]) {
    const box = await target.evaluate(el => (el.closest('label') ?? el).getBoundingClientRect().height);
    expect(box, 'touch target height').toBeGreaterThanOrEqual(44);
  }
});

test('store insights keeps the displayed period accurate when a range request fails', async ({ page }) => {
  await mockMarketplace(page, 'seller');
  await page.route('**/api/v1/seller/analytics?range=90d', route => route.fulfill({
    status: 500,
    json: { error: { code: 'internal_error' } },
  }), { times: 1 });

  await page.goto('/dashboard/insights');
  await expect(page.getByRole('heading', { name: 'Overview last 30 days' })).toBeVisible();
  await page.getByRole('radio', { name: 'Last 90 days' }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Store insights could not load' });
  await expect(alert).toContainText('Try again to load the last 90 days.');
  await expect(page.getByRole('heading', { name: 'Overview last 30 days' })).toBeVisible();

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Overview last 90 days' })).toBeVisible();
});

test('admin Overview shows aggregate activity and opens the review queue', async ({ page }) => {
  await mockMarketplace(page, 'admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1, name: 'University administration' })).toBeVisible();
  const mobileNav = page.locator('.admin-workspace-mobile-nav select');
  if (await mobileNav.isVisible()) await mobileNav.selectOption('overview');
  else await page.getByRole('navigation', { name: 'Administration sections' }).getByRole('button', { name: 'Overview' }).click();
  const section = page.getByRole('region', { name: 'University dashboard' });
  await expect(section.getByRole('heading', { name: 'From listing to sale' })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Completed orders over time' })).toBeVisible();
  await expect(section.getByRole('heading', { name: 'Live listings by category' })).toBeVisible();
  await expect(section.getByText('₱3,600').first()).toBeVisible();
  await expect(section.getByText('Too few to compare').first()).toBeVisible();
  await expect(section.getByText('Items need review', { exact: true })).toBeVisible();

  const scan = await new AxeBuilder({ page }).include('.university-dashboard').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations.map(v => v.id)).toEqual([]);

  await section.getByRole('button', { name: /listing/i }).click();
  await expect(page.getByRole('heading', { name: 'Listings to review' })).toBeFocused();
});
