import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace, type Persona } from './support/mock-marketplace';

test.use({
  viewport: { width: 320, height: 720 },
  forcedColors: 'active',
  reducedMotion: 'reduce',
});

const scenarios: { label: string; route: string; persona: Persona }[] = [
  { label: 'Home', route: '/', persona: 'guest' },
  { label: 'Explore', route: '/explore', persona: 'guest' },
  { label: 'Guidelines', route: '/guidelines', persona: 'guest' },
  { label: 'Login', route: '/login', persona: 'guest' },
  { label: 'Seller dashboard', route: '/dashboard', persona: 'seller' },
  { label: 'Messages', route: '/inquiries', persona: 'buyer' },
  { label: 'Transactions', route: '/transactions', persona: 'buyer' },
  { label: 'Profile', route: '/profile', persona: 'buyer' },
  { label: 'Admin', route: '/admin', persona: 'admin' },
];

for (const { label, route, persona } of scenarios) {
  test('320px reflow and high-contrast accessibility: ' + label, async ({ page }) => {
    await mockMarketplace(page, persona);
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
    );
    expect(overflow, label + ' has horizontal document overflow').toBeLessThanOrEqual(0);

    const violations = (await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()).violations.map(v => ({
        id: v.id, impact: v.impact, selectors: v.nodes.slice(0, 3).map(n => n.target),
      }));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}

test('keyboard focus reaches the skip link and primary search', async ({ page }) => {
  await mockMarketplace(page, 'guest');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveText(/Skip to main content/i);
  let reached = false;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    reached = await page.locator('input[placeholder*="Search"]:focus').count() > 0;
    if (reached) break;
  }
  expect(reached).toBe(true);
});
