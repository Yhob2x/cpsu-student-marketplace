import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';

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
