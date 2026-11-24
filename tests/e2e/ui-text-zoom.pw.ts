import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace, type Persona } from './support/mock-marketplace';

/**
 * Automated approximation of enlarged root-relative text on an inexpensive phone.
 * This is NOT a substitute for Safari Dynamic Type or Android font-size testing.
 */
for (const { label, path, persona } of [
  { label: 'Home', path: '/', persona: 'guest' },
  { label: 'Explore', path: '/explore', persona: 'guest' },
  { label: 'Listing details', path: '/listings/91', persona: 'guest' },
  { label: 'Seller dashboard', path: '/dashboard', persona: 'seller' },
  { label: 'Student profile', path: '/profile', persona: 'buyer' },
  { label: 'Transactions', path: '/transactions', persona: 'buyer' },
  { label: 'University admin', path: '/admin', persona: 'admin' },
] satisfies { label: string; path: string; persona: Persona }[]) {
  test('200% root-relative text layout: ' + label, async ({ page }) => {
    await mockMarketplace(page, persona);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => {
      const d = document.documentElement;
      return { width: innerWidth, scroll: Math.max(d.scrollWidth, document.body.scrollWidth) };
    });
    expect(metrics.scroll, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.width + 1);
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  });
}
