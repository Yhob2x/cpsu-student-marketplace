import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';

for (const width of [320, 360, 768, 1280]) {
  test('owner dashboard type scale and touch actions at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    const state = await mockMarketplace(page, 'seller');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/dashboard');
    const actions = page.locator('.store-dashboard-actions');
    await expect(actions).toBeVisible();
    const listing = actions.getByRole('button', { name: 'New listing' });
    const publicStore = actions.getByRole('link', { name: 'View public store' });
    const settings = actions.getByRole('link', { name: 'Store settings' });

    for (const action of [listing, publicStore, settings]) {
      await expect(action).toBeVisible();
      const measurements = await action.evaluate(el => {
        const box = el.getBoundingClientRect(), style = getComputedStyle(el);
        return { width: box.width, height: box.height, size: parseFloat(style.fontSize) };
      });
      expect(measurements.width, 'action width').toBeGreaterThanOrEqual(44);
      expect(measurements.height, 'action height').toBeGreaterThanOrEqual(44);
      expect(measurements.size, 'action text must be at least 14px').toBeGreaterThanOrEqual(14);
    }

    expect(await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth, document.body.scrollWidth,
    ) - innerWidth)).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(v => ({ id: v.id, selectors: v.nodes.map(n => n.target) }))).toEqual([]);

    const composer = page.locator('.listing-composer').first();
    await expect(composer).toBeHidden();
    await listing.click();
    await expect(listing).toHaveAttribute('aria-expanded', 'true');
    await expect(composer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeVisible();
    await composer.getByRole('textbox', { name: 'Title' }).fill('Used campus textbook');
    await page.getByRole('button', { name: 'Close listing form' }).click();
    await expect(composer).toBeHidden();
    await expect(listing).toBeFocused();
    await listing.click();
    await expect(composer.getByRole('textbox', { name: 'Title' })).toHaveValue('Used campus textbook');
    expect(errors).toEqual([]);
    expect(state.unknownWrites).toEqual([]);
  });
}
