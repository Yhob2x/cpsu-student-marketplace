import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace, type Persona } from './support/mock-marketplace';

const screens: { path: string; persona: Persona; label: string }[] = [
  { path: '/dashboard', persona: 'seller', label: 'Seller listing workspace' },
  { path: '/inquiries', persona: 'buyer', label: 'Messages' },
  { path: '/saved', persona: 'buyer', label: 'Saved listings' },
  { path: '/transactions', persona: 'buyer', label: 'Transactions' },
  { path: '/profile', persona: 'buyer', label: 'Student profile' },
  { path: '/notifications', persona: 'buyer', label: 'Notifications' },
];

for (const screen of screens) {
  test('student UI consistency: ' + screen.label, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await mockMarketplace(page, screen.persona);
    await page.goto(screen.path);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => {
      const visible = (el: HTMLElement) => {
        const box = el.getBoundingClientRect(), css = getComputedStyle(el);
        return box.width > 0 && box.height > 0 && css.visibility !== 'hidden' && css.display !== 'none';
      };
      const controls = [...document.querySelectorAll<HTMLElement>(
        'main button, main a, main input, main select, main textarea'
      )].filter(visible);
      return {
        horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
        undersized: controls.filter(el => {
          const target = el instanceof HTMLInputElement && ['radio', 'checkbox'].includes(el.type)
            ? (el.closest('label') ?? el) : el;
          const r = target.getBoundingClientRect();
          return r.width < 44 || r.height < 44;
        }).slice(0, 12).map(el => el.outerHTML.slice(0, 110)),
      };
    });
    expect(runtimeErrors).toEqual([]);
    expect(metrics.horizontalOverflow).toBeLessThanOrEqual(0);
    expect(metrics.undersized).toEqual([]);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(v => ({
      id: v.id, targets: v.nodes.map(node => node.target),
    }))).toEqual([]);
  });
}
