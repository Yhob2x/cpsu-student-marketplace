import { expect, test } from '@playwright/test';

test('Chat floats above mobile navigation without covering the tab targets', async ({ page }) => {
  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const chat = page.locator('.floating-chat');
    const nav = page.locator('.tabbar');
    await expect(chat).toBeVisible();
    await expect(nav).toBeVisible();

    const launcher = await chat.boundingBox();
    const tabs = await nav.boundingBox();
    expect(launcher).toBeTruthy();
    expect(tabs).toBeTruthy();
    expect(launcher!.y + launcher!.height).toBeLessThan(tabs!.y - 4);
    expect(launcher!.width).toBeGreaterThanOrEqual(44);
    expect(launcher!.height).toBeGreaterThanOrEqual(44);
    expect(launcher!.x).toBeGreaterThanOrEqual(0);
    expect(launcher!.x + launcher!.width).toBeLessThanOrEqual(width);

    const navLinks = await nav.locator('a').all();
    for (const link of navLinks) {
      const rect = await link.boundingBox();
      if (!rect) continue;
      const intersectX = Math.min(launcher!.x + launcher!.width, rect.x + rect.width)
        - Math.max(launcher!.x, rect.x);
      const intersectY = Math.min(launcher!.y + launcher!.height, rect.y + rect.height)
        - Math.max(launcher!.y, rect.y);
      expect(intersectX <= 0 || intersectY <= 0).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  }
});
