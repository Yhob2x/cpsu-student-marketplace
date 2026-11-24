import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

// Synthetic browser acceptance only. No real student record or live DB mutation.
test('listing card shows low stock while appreciation lives on the listing page', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/explore');
  const card = page.locator('.product-card').filter({ hasText: 'Synthetic calculus textbook' }).first();
  await expect(card).toBeVisible();
  // Concept 2 cards stay minimal: stock shows as a photo label, likes and views move to the detail page.
  await expect(card.getByText('Only 3 left')).toBeVisible();
  await expect(card.getByRole('button', { name: /Appreciate this listing/ })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Save for later' })).toBeVisible();
});

test('listing detail shows stock and appreciation from the same product', async ({ page }) => {
  const state = await mockMarketplace(page, 'buyer');
  await page.goto('/listings/91');
  await expect(page.getByRole('heading', { name: 'Synthetic calculus textbook' })).toBeVisible();
  await expect(page.getByText('3 items in stock')).toBeVisible();
  await expect(page.getByRole('img', { name: '299 listing views' })).toBeVisible();
  expect(state.viewCounts.get(91)).toBe(299);
  const appreciation = page.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' });
  await expect(appreciation).toBeVisible();
  await appreciation.click();
  await expect(page.getByRole('button', { name: 'Remove appreciation from this listing; 1 appreciations' })).toBeVisible();
  expect(state.appreciatedListings.has(91)).toBe(true);
});
