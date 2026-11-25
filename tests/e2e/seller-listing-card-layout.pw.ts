import { expect, test } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

test('seller listing cards stay compact and preserve management controls', async ({ page }) => {
  const state = await mockMarketplace(page, 'seller');
  const longTitle = 'A very long listing title '.repeat(8);
  state.drafts.push(
    { ...syntheticListing, title: longTitle, media: [], availabilityState: 'available', reservedQuantity: 1 },
    { ...syntheticListing, id: 92, title: 'Sold product', media: [], availabilityState: 'sold' },
    { ...syntheticListing, id: 93, title: 'Draft product', media: [], status: 'draft', availabilityState: 'available' },
    { ...syntheticListing, id: 94, title: 'Campus photography', media: [], type: 'service', availabilityState: 'reserved' },
  );
  await page.goto('/dashboard');
  const card = page.locator('#store-listing-91');
  await expect(card).toBeVisible();
  await expect(card.locator('h3')).toHaveAttribute('title', longTitle);
  await expect(card.locator('h3')).toHaveCSS('text-overflow', 'ellipsis');
  await expect(card.getByText('3 in stock', { exact: false })).toBeVisible();
  await expect(card.locator('.seller-listing-appreciations')).toBeVisible();
  await expect(card.locator('.store-listing-help')).toHaveCount(0);
  await expect(card.locator('.store-listing-meta .status')).toHaveCount(1);
  await expect(card.getByRole('combobox')).toHaveValue('available');
  await expect(card.getByRole('button', { name: 'Remove', exact: true })).toBeVisible();
  await expect(card.getByRole('link', { name: /^View listing/ })).toBeVisible();
  await expect(page.locator('#store-listing-92').getByRole('button', { name: /Sell .* again/ })).toBeVisible();
  await expect(page.locator('#store-listing-93').getByRole('button', { name: 'Submit for review' })).toBeVisible();
  await expect(page.locator('#store-listing-94').getByRole('combobox')).toHaveValue('reserved');
  await expect(page.locator('#store-listing-94 .listing-stock-label')).toHaveCount(0);
  for (const control of await card.locator('.store-listing-actions :is(button, select)').all()) {
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  expect(state.unknownWrites).toEqual([]);
});
