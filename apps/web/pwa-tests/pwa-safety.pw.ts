import { test, expect } from '@playwright/test';

test('production PWA exposes valid install assets and a privacy-safe offline fallback', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  expect(manifest.display).toBe('standalone');
  expect(manifest.scope).toBe('/');
  expect(manifest.icons).toHaveLength(4);
  expect(manifest.shortcuts).toHaveLength(3);

  const entries = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('cpsu-offline-shell-'));
    const urls: string[] = [];
    for (const name of names) {
      const keys = await (await caches.open(name)).keys();
      urls.push(...keys.map(request => new URL(request.url).pathname));
    }
    return { names, urls };
  });
  expect(entries.names).toEqual(['cpsu-offline-shell-v4']);
  expect(entries.urls).toContain('/offline.html');
  expect(entries.urls.some(url => url.startsWith('/api/') || url === '/' || url === '/index.html')).toBe(false);

  await context.setOffline(true);
  await page.goto('/explore', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Repair app' })).toBeVisible();
  await context.setOffline(false);
});

test('connection loss is announced without losing the current screen', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  await expect(page.locator('.pwa-connection')).toContainText("You're offline");
  await expect(page.locator('main#main-content')).toBeVisible();
  await context.setOffline(false);
  await expect(page.locator('.pwa-connection')).toHaveCount(0);
});

test('browser notification permission is not requested on first load', async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __pushPromptCalls?: number }).__pushPromptCalls = 0;
    try {
      Object.defineProperty(Notification, 'requestPermission', {
        configurable: true,
        value: () => { (window as Window & { __pushPromptCalls?: number }).__pushPromptCalls!++; return Promise.resolve('default'); },
      });
    } catch { /* Browser may expose a nonconfigurable native permission API. */ }
  });
  await page.goto('/');
  await expect(page.locator('main#main-content')).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __pushPromptCalls?: number }).__pushPromptCalls)).toBe(0);
});

test('simulated iOS Home Screen mode hides browser-only installation controls', async ({ page }) => {
  // CDP cannot emulate the display-mode: standalone media query in this test browser.
  // Exercise the real iOS navigator.standalone fallback without claiming device acceptance.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
  });
  await page.goto('/');
  expect(await page.evaluate(() => (navigator as Navigator & { standalone?: boolean }).standalone)).toBe(true);
  await expect(page.getByRole('button', { name: 'Install app — CPSU Market' })).toHaveCount(0);
  await expect(page.locator('main#main-content')).toBeVisible();
});

test('slow connection preserves access to public browsing controls', async ({ page, context }) => {
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 20_000,
  });
  try {
    await page.getByRole('link', { name: 'Explore', exact: true }).first().click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator('main#main-content')).toBeVisible();
  } finally {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
  }
});

test('flaky API requests do not replace the whole marketplace with an error screen', async ({ page }) => {
  let failed = 0;
  await page.route('**/api/**', async (route) => {
    failed++;
    if (failed % 2 === 1) await route.abort('failed');
    else await route.fulfill({
      status: 503, contentType: 'application/json', body: '{"error":"synthetic_transient_failure"}',
    });
  });
  await page.goto('/');
  await expect(page.locator('main#main-content')).toBeVisible();
  await page.getByRole('link', { name: 'Explore', exact: true }).first().click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator('main#main-content')).toBeVisible();
});

test('signed-out push deep links land on login with only a safe internal return path', async ({ page }) => {
  for (const target of ['/inquiries/27', '/transactions/14', '/notifications', '/profile']) {
    await page.goto(target);
    await expect(page).toHaveURL(new RegExp('/login\\?next=' + encodeURIComponent(target).replace(/%/g, '%')));
    await expect(page.locator('main#main-content')).toBeVisible();
  }
});
