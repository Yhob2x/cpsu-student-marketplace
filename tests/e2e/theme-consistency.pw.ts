import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

for (const [label, path] of [['Home', '/'], ['Explore', '/explore']] as const) {
  test(label + ' uses shared CPSU colors for cards and selling actions', async ({ page }) => {
    await mockMarketplace(page, 'guest');
    await page.goto(path);

    // Compare computed styles to semantic tokens, not another hardcoded palette.
    const palette = await page.evaluate(() => {
      const values: Record<string, string> = {};
      for (const name of ['primary', 'primary-dark', 'primary-light', 'accent']) {
        const sample = document.createElement('span');
        sample.style.color = `var(--color-${name})`;
        document.body.appendChild(sample);
        values[name] = getComputedStyle(sample).color;
        sample.remove();
      }
      return values;
    });

    const price = page.locator('.product-card .price').first();
    await expect(price).toBeVisible();
    expect(await price.evaluate(el => getComputedStyle(el).color)).toBe(palette.primary);

    // Concept 2: the listing type is a solid badge on the photo, in the primary dark token.
    const badge = page.locator('.product-card .market-card__badge--sale').first();
    await expect(badge).toBeVisible();
    expect(await badge.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(palette['primary-dark']);

    if (label === 'Home') {
      const banner = page.locator('.cta-band');
      await expect(banner).toBeVisible();
      expect(await banner.evaluate(el => getComputedStyle(el).backgroundColor))
        .toBe(palette['primary-dark']);

      const button = banner.locator('.btn.gold');
      await expect(button).toBeVisible();
      expect(await button.evaluate(el => getComputedStyle(el).backgroundColor))
        .toBe(palette.accent);
    }
  });
}
