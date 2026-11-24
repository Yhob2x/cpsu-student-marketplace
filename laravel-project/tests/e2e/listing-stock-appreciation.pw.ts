import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

// Synthetic browser acceptance only. No real student record or live DB mutation.
test('listing card shows stock and its independent appreciation action', async ({ page }) => {
  const state = await mockMarketplace(page, 'buyer');
  await page.goto('/explore');
  const card = page.locator('.product-card').filter({ hasText: 'Synthetic calculus textbook' }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText('3 in stock')).toBeVisible();
  const appreciation = card.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' });
  await expect(appreciation).toBeVisible();
  await expect(appreciation.locator('svg')).toHaveAttribute('fill', 'none');
  await expect(appreciation).toHaveText('0');
  await expect(card.getByRole('img', { name: '298 listing views' })).toBeVisible();
  await appreciation.click();
  const liked = card.getByRole('button', { name: 'Remove appreciation from this listing; 1 appreciations' });
  await expect(liked).toHaveAttribute('aria-pressed', 'true');
  await expect(liked).toHaveText('1');
  await expect(liked.locator('svg')).toHaveAttribute('fill', 'currentColor');
  expect(state.appreciatedListings.has(91)).toBe(true);
  await liked.click();
  await expect(card.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' }))
    .toHaveAttribute('aria-pressed', 'false');
  await expect(appreciation.locator('svg')).toHaveAttribute('fill', 'none');
  expect(state.appreciatedListings.has(91)).toBe(false);
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
