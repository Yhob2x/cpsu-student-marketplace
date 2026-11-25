import { expect, test, type Page } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

async function scrollDown(page: Page) {
  await page.evaluate(() => {
    document.body.style.minHeight = '350vh';
    window.scrollTo(0, 900);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
}

async function activatePrimaryTab(page: Page, pathname: string) {
  const area = (page.viewportSize()?.width ?? 1280) <= 600 ? '.tabbar' : '.site-nav';
  // Clicking via the DOM avoids Playwright automatically scrolling the desktop header into view.
  await page.evaluate(selector => {
    const anchor = document.querySelector<HTMLAnchorElement>(selector);
    if (!anchor) throw new Error(`Primary navigation link not found: ${selector}`);
    anchor.click();
  }, `${area} a[href="${pathname}"]`);
}

async function expectAtTop(page: Page) {
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(20);
}

test('reselecting Explore scrolls to top without resetting active filters', async ({ page }) => {
  await mockMarketplace(page);
  await page.goto('/explore?type=service');
  await expect(page.getByRole('heading', { name: 'Explore listings' })).toBeVisible();
  await scrollDown(page);
  await activatePrimaryTab(page, '/explore');
  await expectAtTop(page);
  await expect(page).toHaveURL(/\/explore\?type=service$/);
});

test('Home, Explore and Profile tabs scroll to top both when switched and reselected', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/profile');
  await scrollDown(page);
  await activatePrimaryTab(page, '/profile');
  await expectAtTop(page);
  await scrollDown(page);
  await activatePrimaryTab(page, '/explore');
  await expect(page).toHaveURL(/\/explore$/);
  await expectAtTop(page);
  await scrollDown(page);
  await activatePrimaryTab(page, '/');
  await expect(page).toHaveURL(/\/$/);
  await expectAtTop(page);
});
