import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';

async function assertWcagAAndAA(page: Page, expectedState: Locator) {
  let scan: Awaited<ReturnType<AxeBuilder['analyze']>> | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    await expect(expectedState, 'The intended UI state must remain visible').toBeVisible();
    try {
      scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      break;
    } catch (error) {
      // A late app navigation can invalidate axe's evaluation context.
      // Retry only that transient condition, and reassert the intended screen.
      if (attempt !== 0 || !/execution context was destroyed.*navigation/i.test(String(error))) throw error;
      await page.waitForLoadState('domcontentloaded');
    }
  }
  if (!scan) throw new Error('Accessibility scan did not complete');
  const problems = scan.violations.map(v => ({
    id: v.id, impact: v.impact, selectors: v.nodes.map(n => n.target),
  }));
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
}

test('expanded seller listing composer has no axe WCAG violations', async ({ page }) => {
  await mockMarketplace(page, 'seller');
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'New listing' }).click();
  await expect(page.getByRole('group', { name: 'What are you listing?' })).toBeVisible();
  await assertWcagAAndAA(page, page.getByRole('group', { name: 'What are you listing?' }));
});

test('open reporting form has no axe WCAG violations', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/listings/91');
  await page.getByRole('button', { name: 'Report this listing', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Reason for reporting' })).toBeVisible();
  await assertWcagAAndAA(page, page.getByRole('textbox', { name: 'Reason for reporting' }));
});

test('floating chat quick-view has no axe WCAG violations', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/');
  await page.locator('.floating-chat').click();
  await expect(page.getByRole('dialog', { name: 'Messages quick view' })).toBeVisible();
  await assertWcagAAndAA(page, page.getByRole('dialog', { name: 'Messages quick view' }));
});
