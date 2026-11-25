import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

// Synthetic browser acceptance only. No real student record or live DB mutation.
test('listing card keeps Like and Save independent and shows views on wider screens', async ({ page }) => {
  const state = await mockMarketplace(page, 'buyer');
  await page.route('**/api/v1/saved/91', route => route.fulfill({ json: {} }));
  await page.goto('/explore');
  const card = page.locator('.product-card').filter({ hasText: 'Synthetic calculus textbook' }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText('Only 3 left')).toBeVisible();
  const views = card.locator('.listing-view-count');
  const compact = (page.viewportSize()?.width ?? 0) <= 700;
  if (compact) await expect(views).toBeHidden();
  else await expect(card.getByRole('img', { name: '298 listing views' })).toHaveText('298');
  const like = card.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' });
  await expect(like).toHaveText('0');
  await like.click();
  const unlike = card.getByRole('button', { name: 'Remove appreciation from this listing; 1 appreciations' });
  await expect(unlike).toHaveText('1');
  await expect.poll(() => state.appreciatedListings.has(91)).toBe(true);
  await unlike.click();
  await expect(like).toHaveText('0');
  await expect.poll(() => state.appreciatedListings.has(91)).toBe(false);
  if (!compact) await expect(views).toHaveText('298');
  await card.hover();
  await card.getByRole('button', { name: 'Save for later' }).click();
  const saved = card.getByRole('button', { name: 'Remove from saved' });
  await expect(saved).toHaveText('Saved');
  await saved.click();
  await expect(card.getByRole('button', { name: 'Save for later' })).toHaveText('Save');
  await expect(like).toHaveText('0');
});

test('listing detail shows stock and appreciation from the same product', async ({ page }) => {
  const state = await mockMarketplace(page, 'buyer');
  await page.goto('/listings/91');
  await expect(page.getByRole('heading', { name: 'Synthetic calculus textbook' })).toBeVisible();
  await expect(page.getByText('Books', { exact: true })).toBeVisible();
  await expect(page.getByText('3 items in stock')).toBeVisible();
  await expect(page.getByRole('img', { name: '299 listing views' })).toBeVisible();
  expect(state.viewCounts.get(91)).toBe(299);
  const appreciation = page.getByRole('button', { name: 'Appreciate this listing; 0 appreciations' });
  await expect(appreciation).toBeVisible();
  await appreciation.click();
  await expect(page.getByRole('button', { name: 'Remove appreciation from this listing; 1 appreciations' })).toBeVisible();
  await expect.poll(() => state.appreciatedListings.has(91)).toBe(true);
});
