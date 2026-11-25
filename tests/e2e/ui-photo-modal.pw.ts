import { expect, test } from '@playwright/test';
import { mockMarketplace, syntheticListing } from './support/mock-marketplace';

async function openSyntheticGallery(page: import('@playwright/test').Page) {
  await mockMarketplace(page, 'guest');
  // Real public PWA icons stand in for synthetic listing photos.
  // No student records, images or production data are accessed or modified.
  await page.route('**/api/v1/listings/91', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ...syntheticListing, images: ['/icons/icon-192.png', '/icons/icon-512.png'] }),
  }));
  await page.goto('/listings/91');
  const trigger = page.getByRole('button', { name: 'Zoom photo 1 of 2' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: syntheticListing.title });
  await expect(dialog).toBeVisible();
  return { trigger, dialog };
}

test('full-screen photo modal traps keyboard focus and restores the opener', async ({ page }) => {
  const { trigger, dialog } = await openSyntheticGallery(page);
  const close = dialog.getByRole('button', { name: 'Close photo zoom' });
  await expect(close).toBeFocused();

  const first = dialog.locator('button:not(:disabled)').first();
  const last = dialog.locator('button:not(:disabled)').last();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();

  await last.focus();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('full-screen photo modal supports arrow navigation and keyboard zoom', async ({ page }) => {
  const { dialog } = await openSyntheticGallery(page);
  const progress = dialog.locator('.image-zoom-heading span');
  const zoom = dialog.locator('.image-zoom-value');

  await expect(progress).toHaveText('1 / 2');
  await expect(zoom).toHaveText('100%');
  await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveText('2 / 2');
  await page.keyboard.press('ArrowLeft');
  await expect(progress).toHaveText('1 / 2');

  await page.keyboard.press('=');
  await expect(zoom).toHaveText('150%');
  await page.keyboard.press('-');
  await expect(zoom).toHaveText('100%');
});
