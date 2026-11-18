import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockMarketplace } from './support/mock-marketplace';

async function assertWcagAAndAA(page: Page) {
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
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
  await assertWcagAAndAA(page);
});

test('open reporting form has no axe WCAG violations', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/listings/91');
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await expect(page.getByLabel('Why are you reporting this listing?')).toBeVisible();
  await assertWcagAAndAA(page);
});

test('floating chat quick-view has no axe WCAG violations', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/');
  await page.locator('.floating-chat').click();
  await expect(page.getByRole('dialog', { name: 'Messages quick view' })).toBeVisible();
  await assertWcagAAndAA(page);
});
