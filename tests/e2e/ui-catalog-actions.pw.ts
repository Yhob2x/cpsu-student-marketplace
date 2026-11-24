import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';

// Synthetic content tests populated administration; no persistence or destructive requests.
const catalog = {
  campuses: [{
    id: 1, code: 'MAIN', name: 'CPSU Main Campus', active: true,
    _count: { affiliations: 3, listings: 2, campusRoles: 1 },
  }],
  categories: [
    { id: 1, name: 'Books', listingType: 'physical_product', parentId: null,
      _count: { listings: 2, children: 0 } },
    { id: 2, name: 'Photography', listingType: 'service', parentId: null,
      _count: { listings: 1, children: 0 } },
  ],
};
for (const width of [360, 768, 1280]) {
  test('populated admin catalog targets and names at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 860 });
    const state = await mockMarketplace(page, 'admin');
    await page.route('**/api/v1/admin/catalog', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(catalog),
    }));
    await page.goto('/admin');
    // Pages load as separate chunks; wait for the workspace before checking which navigation is shown.
    await page.locator('.admin-workspace').waitFor();
    const mobilePicker = page.locator('.admin-workspace-mobile-nav select');
    if (await mobilePicker.isVisible()) await mobilePicker.selectOption('catalog');
    else await page.locator('.admin-workspace-nav-item').filter({ hasText: 'Campuses & categories' }).click();

    await expect(page.getByRole('heading', { name: 'Campuses & categories' }).last()).toBeVisible();
    const campusEdit = page.getByRole('button', { name: 'Edit campus CPSU Main Campus' });
    const campusStatus = page.getByRole('button', { name: 'Deactivate campus CPSU Main Campus' });
    const productEdit = page.getByRole('button', { name: 'Edit product category Books' });
    await expect(campusEdit).toBeVisible();
    await expect(campusStatus).toBeVisible();
    await expect(productEdit).toBeVisible();

    await campusEdit.click();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    const heights = await page.locator('.catalog-admin-actions .btn:visible').evaluateAll(elements =>
      elements.map(el => Math.round(el.getBoundingClientRect().height)));
    expect(heights.length).toBeGreaterThan(2);
    expect(heights.every(height => height >= 44), 'All catalog edit controls must have >=44px height').toBe(true);

    const overflows = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
    expect(overflows).toBeLessThanOrEqual(0);

    const axe = await new AxeBuilder({ page }).withTags([
      'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa',
    ]).analyze();
    expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);

    // Do not submit any form: test the other category type as a read-only UI action.
    await page.getByRole('button', { name: 'Services', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Edit service category Photography' })).toBeVisible();
    expect(state.unknownWrites).toEqual([]);
  });
}
