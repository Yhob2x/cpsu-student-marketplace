import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace, type Persona } from './support/mock-marketplace';

const scenarios: { label: string; path: string; persona: Persona }[] = [
  { label: 'Home', path: '/', persona: 'guest' },
  { label: 'Explore', path: '/explore', persona: 'guest' },
  { label: 'Listing detail', path: '/listings/91', persona: 'guest' },
  { label: 'Storefront', path: '/stores/30', persona: 'guest' },
  { label: 'Sign-in', path: '/login', persona: 'guest' },
  { label: 'Inbox', path: '/inquiries', persona: 'buyer' },
  { label: 'Notifications', path: '/notifications', persona: 'buyer' },
  { label: 'Profile', path: '/profile', persona: 'buyer' },
  { label: 'Review workspace', path: '/admin', persona: 'reviewer' },
];

for (const scenario of scenarios) {
  test('axe critical WCAG violations: ' + scenario.label, async ({ page }) => {
    await mockMarketplace(page, scenario.persona);
    await page.goto(scenario.path);
    await expect(page.locator('main h1').first()).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const critical = scan.violations.filter(v => v.impact === 'critical')
      .map(v => ({ id: v.id, description: v.description, nodes: v.nodes.map(n => n.target) }));
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
}
