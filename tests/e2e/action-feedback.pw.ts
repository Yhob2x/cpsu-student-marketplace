import { expect, test } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

test.beforeEach(async ({ page }) => {
  await mockMarketplace(page, 'guest');
  await page.goto('/');
});

test('important completion is centered, accessible, and non-modal', async ({ page }) => {
  const main = page.locator('main');
  await main.focus();

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cpsu:action-feedback', {
      detail: { kind: 'success', title: 'Submitted for review', message: 'A campus reviewer will review your listing.', presentation: 'center' },
    }));
  });

  const notice = page.getByRole('status');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('data-presentation', 'center');
  await expect(notice).toContainText('Submitted for review');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(main).toBeFocused();
  await expect(notice).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

  const bounds = await notice.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (bounds && viewport) {
    expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2)).toBeLessThan(2);
    expect(bounds.width).toBeLessThan(viewport.width);
  }
});

test('routine feedback stays near the top and centered horizontally', async ({ page }) => {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cpsu:action-feedback', {
      detail: { kind: 'success', title: 'Store followed', message: 'You will see updates from this store.' },
    }));
  });

  const notice = page.getByRole('status');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('data-presentation', 'toast');
  const bounds = await notice.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (bounds && viewport) {
    expect(Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(bounds.y).toBeLessThan(60);
  }
});

test('reduced-motion users receive the same centered result without movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('cpsu:action-feedback', {
      detail: { kind: 'success', title: 'Request created', message: 'The seller can review your request.', presentation: 'center' },
    }));
  });

  const notice = page.getByRole('status');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS('transition-duration', '0s');
  await expect(notice).toHaveCSS('transform', 'none');
});
