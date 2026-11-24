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
  test('axe WCAG violations: ' + scenario.label, async ({ page }) => {
    await mockMarketplace(page, scenario.persona);
    await page.goto(scenario.path);
    await expect(page.locator('main h1').first()).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    if (process.env.CPSU_A11Y_DIAGNOSTICS === '1') {
      // Local-only diagnostic. Capture severity and targets without personal data.
      console.log('AXE_AUDIT ' + JSON.stringify({ scenario: scenario.label,
        violations: scan.violations.map(v => ({ id: v.id, impact: v.impact,
          targets: v.nodes.slice(0, 5).map(node => node.target) })) }));
    }
    // All WCAG A/AA violations are release regressions, not only 'critical' severity.
    const violations = scan.violations.map(v => ({ id: v.id, impact: v.impact,
      nodes: v.nodes.map(node => node.target) }));
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}
