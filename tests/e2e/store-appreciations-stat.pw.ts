import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

test('store appreciation stat counts published listing likes and follows Like/Unlike', async ({ page }, info) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/stores/30');
  const facts = page.locator('.storefront-facts');
  const stat = facts.locator('.storefront-appreciations-fact');
  await expect(facts).toBeVisible();
  await expect(facts.locator(':scope > div')).toHaveCount(4);
  await expect(stat).toContainText('Appreciations');
  await expect(stat.locator('strong')).toHaveText('0');
  const items = ['Listings', 'Appreciations', 'Followers', 'Following'];
  for (let i = 0; i < items.length; i++) {
    await expect(facts.locator(':scope > div').nth(i)).toContainText(items[i]);
  }
  const like = page.getByRole('button', { name: 'Like this listing' }).first();
  await expect(like).toBeVisible();
  await like.click();
  await expect(page.getByRole('button', { name: 'Unlike this listing' }).first()).toBeVisible();
  await expect(stat.locator('strong')).toHaveText('1');
  await page.getByRole('button', { name: 'Unlike this listing' }).first().click();
  await expect(stat.locator('strong')).toHaveText('0');
  if (info.project.name === 'mobile-chrome') {
    const positions = await facts.locator(':scope > div').evaluateAll(elements =>
      elements.map(el => { const box = el.getBoundingClientRect(); return { x: box.x, y: box.y }; }));
    expect(positions[0].y).toBe(positions[1].y);
    expect(positions[2].y).toBe(positions[3].y);
    expect(positions[2].y).toBeGreaterThan(positions[0].y);
  }
});
