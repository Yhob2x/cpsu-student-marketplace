import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace, syntheticUniversityDashboard } from './support/mock-marketplace';

/** Synthetic university-admin credentials: no real user, database writes, or privileged actions. */
const sections = [
  ['overview', 'University dashboard', 'Overview'],
  ['students', 'Student accounts', 'Students'],
  ['staff', 'Reviewer accounts', 'Reviewer accounts'],
  ['catalog', 'Campuses & categories', 'Campuses & categories'],
  ['content', 'Student-facing content', 'Content'],
  ['listings', 'Listings to review', 'Listing reviews'],
  ['affiliations', 'Affiliations to verify', 'Verifications'],
  ['reports', 'Reports from students', 'Reports'],
  ['store-reviews', 'Store rating moderation', 'Store ratings'],
  ['transactions', 'Transaction monitoring', 'Transactions'],
  ['audit', 'Administrative audit history', 'Audit history'],
] as const;

test('admin overview uses the aggregate endpoint and can recover from a period request failure', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockMarketplace(page, 'admin');
  const privateRequests: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/^\/api\/v1\/admin\/(users|review-queue|reports|transactions|audit-logs)$/.test(path)) privateRequests.push(path);
  });
  let releaseAccount!: () => void;
  const accountGate = new Promise<void>(resolve => { releaseAccount = resolve; });
  await page.route('**/api/v1/me', async route => {
    await accountGate;
    await route.fallback();
  });
  await page.route('**/api/admin/dashboard?period=7d', route => route.fulfill({ status: 500 }), { times: 1 });
  await page.goto('/admin');
  try {
    await expect(page.getByRole('status').filter({ hasText: 'Checking session…' })).toBeVisible();
  } finally {
    releaseAccount();
  }

  const dashboard = page.getByRole('region', { name: 'University dashboard' });
  await expect(dashboard.getByRole('button', { name: '30 days', pressed: true })).toBeVisible();
  await expect(dashboard.getByText(/20% vs previous 30 days/)).toBeVisible();
  await dashboard.getByRole('button', { name: '7 days' }).click();
  await expect(dashboard.getByRole('alert')).toBeVisible();
  await expect(dashboard.getByText(/20% vs previous 7 days/)).toHaveCount(0);
  await dashboard.getByRole('button', { name: 'Retry' }).click();
  await expect(dashboard.getByText(/20% vs previous 7 days/)).toBeVisible();
  await expect(dashboard.getByRole('button', { name: '7 days', pressed: true })).toBeVisible();
  await page.route('**/api/admin/dashboard?period=7d', route => route.fulfill({ status: 403 }), { times: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(dashboard.getByRole('alert')).toBeVisible();
  await expect(dashboard.getByText(/20% vs previous 7 days/)).toHaveCount(0);
  expect(privateRequests).toEqual([]);
});

test('admin overview explains zero activity and keeps masked values distinct from zero', async ({ page }) => {
  await mockMarketplace(page, 'admin');
  const sample = syntheticUniversityDashboard('30d');
  await page.route('**/api/admin/dashboard?period=30d', route => route.fulfill({ json: {
    ...sample,
    reviewQueue: { listings: 0, verifications: 0 },
    ordersInProgress: { awaitingSeller: 0, accepted: 0, arrangingMeetup: 0, meetupAgreed: 0 },
    series: { ...sample.series, points: sample.series.points.map(point => ({ ...point, completed: 0 })) },
    quality: null,
  } }));
  await page.goto('/admin');
  await expect(page.getByText('All caught up. Nothing is waiting for review.')).toBeVisible();
  await expect(page.getByText('No orders in progress.')).toBeVisible();
  await expect(page.getByText('No completed orders in this period. This chart fills in as students confirm sales.')).toBeVisible();
  await expect(page.getByText('Sales, cancellation rate and time to complete unlock after 5 completed orders.')).toBeVisible();
  await expect(page.getByText('Too few to compare').first()).toBeVisible();
});

test('admin overview supports keyboard chart inspection and contained table scrolling in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await mockMarketplace(page, 'admin');
  await page.goto('/admin');

  const plot = page.getByRole('group', { name: 'Inspect completed orders' });
  const tooltip = page.locator('.university-dashboard-chart-tooltip');
  await plot.focus();
  await plot.press('Home');
  await expect(tooltip).toContainText('5 completed');
  await plot.press('ArrowRight');
  await expect(tooltip).toContainText('0 completed');
  await plot.press('Escape');
  await expect(tooltip).toHaveCount(0);
  const tableRegion = page.getByRole('region', { name: 'Campus activity table' });
  await expect(tableRegion).toBeVisible();
  expect(await tableRegion.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await expect(page.locator('.university-dashboard')).toHaveCSS('color-scheme', 'dark');
});

test('student accounts show the store names in the list and detail panel', async ({ page }) => {
  await mockMarketplace(page, 'admin');
  await page.route('**/api/v1/admin/users?*', route => route.fulfill({ json: {
    items: [
      { id: 41, displayName: 'Student Seller', email: 'seller@example.test', status: 'active', roles: [], affiliations: [], storeNames: ['Campus Books', 'Art Supplies'] },
      { id: 42, displayName: 'Student Buyer', email: 'buyer@example.test', status: 'active', roles: [], affiliations: [], storeNames: [] },
    ],
    total: 2, page: 1,
  } }));
  await page.goto('/admin');
  await page.locator('.admin-workspace').waitFor();
  const mobileNav = page.locator('.admin-workspace-mobile-nav select');
  if (await mobileNav.isVisible()) await mobileNav.selectOption('students');
  else await page.locator('.admin-workspace-nav-item').getByText('Students', { exact: true }).click();

  const seller = page.getByRole('button', { name: /Student Seller/ });
  await expect(seller.getByText('Stores: Campus Books, Art Supplies')).toBeVisible();
  const buyer = page.getByRole('button', { name: /Student Buyer/ });
  await expect(buyer.getByText('No store')).toBeVisible();
  const details = page.getByRole('complementary', { name: 'Selected student account' });
  await seller.click();
  await expect(details.getByText('Stores: Campus Books, Art Supplies')).toBeVisible();
  await buyer.click();
  await expect(details.getByText('No store')).toBeVisible();

  await page.getByRole('searchbox', { name: 'Name, email, or store' }).fill('Campus Books');
  const searchRequest = page.waitForRequest(request =>
    new URL(request.url()).searchParams.get('q') === 'Campus Books');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  expect(new URL((await searchRequest).url()).pathname).toBe('/api/v1/admin/users');
});

for (const [section, heading, navigationLabel] of sections) {
  test('admin UI consistency: ' + section, async ({ page }) => {
    await mockMarketplace(page, 'admin');
    await page.goto('/admin');
    // Pages load as separate chunks; wait for the workspace before checking which navigation is shown.
    await page.locator('.admin-workspace').waitFor();

    const mobileNav = page.locator('.admin-workspace-mobile-nav select');
    if (await mobileNav.isVisible()) {
      await mobileNav.selectOption(section);
    } else {
      await page.locator('.admin-workspace-nav-item')
        .filter({ hasText: navigationLabel }).first().click();
    }
    await expect(page.locator('#admin-workspace-main h2').filter({ hasText: heading }).first()).toBeVisible();

    const metrics = await page.evaluate(() => {
      const visible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && css.display !== 'none' && css.visibility !== 'hidden';
      };
      const elements = Array.from(document.querySelectorAll<HTMLElement>(
        '#admin-workspace-main button, #admin-workspace-main a, #admin-workspace-main input, #admin-workspace-main select, #admin-workspace-main textarea'
      )).filter(visible);
      const undersized = elements.filter(el => {
        const target = el instanceof HTMLInputElement && ['checkbox','radio'].includes(el.type)
          ? (el.closest('label') ?? el) : el;
        const { width, height } = target.getBoundingClientRect();
        return width < 44 || height < 44;
      }).map(el => el.outerHTML.slice(0, 100));
      return {
        overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
        undersized,
      };
    });
    expect(metrics.overflow, 'Unexpected horizontal overflow').toBeLessThanOrEqual(0);
    expect(metrics.undersized, JSON.stringify(metrics.undersized)).toEqual([]);

    let accessibility: Awaited<ReturnType<AxeBuilder['analyze']>> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        accessibility = await new AxeBuilder({ page })
          .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
          .analyze();
        break;
      } catch (error) {
        // An in-flight session refresh can navigate during the axe scan.
        // Retry only that transient case and reassert the selected admin section.
        if (attempt !== 0 || !/execution context was destroyed.*navigation/i.test(String(error))) throw error;
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('#admin-workspace-main h2').filter({ hasText: heading }).first()).toBeVisible();
      }
    }
    if (!accessibility) throw new Error('Accessibility scan did not complete');
    expect(accessibility.violations.map(v => ({
      id: v.id, targets: v.nodes.map(node => node.target),
    }))).toEqual([]);
  });
}
