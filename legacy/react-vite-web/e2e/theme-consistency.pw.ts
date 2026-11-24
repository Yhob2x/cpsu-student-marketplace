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

    const kind = page.locator('.product-card .listing-kind').first();
    await expect(kind).toBeVisible();
    const badge = await kind.evaluate(el => ({
      foreground: getComputedStyle(el).color,
      background: getComputedStyle(el).backgroundColor,
    }));
    expect(badge).toEqual({
      foreground: palette['primary-dark'],
      background: palette['primary-light'],
    });

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
