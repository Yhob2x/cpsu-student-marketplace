import { expect, test } from '@playwright/test';

/**
 * Observational baseline ONLY: the Vite preview has no production API, CDN,
 * university Wi-Fi, real images, phone CPU, or standalone browser context.
 * It cannot satisfy the production LCP <= 2.5s or offline-start acceptance.
 */
test('records local public-page paint and resource baseline without asserting production SLAs', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const state = window as Window & { __cpsuLcp?: number | null };
    state.__cpsuLcp = null;
    try {
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) state.__cpsuLcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* Unsupported browsers may not expose an LCP observer. */ }
  });
  await page.goto('/', { waitUntil: 'load' });
  await expect(page.locator('main#main-content')).toBeVisible();
  await page.waitForTimeout(700); // Give the paint observer time to receive its buffered entry.
  const report = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const fcp = performance.getEntriesByType('paint')
      .find(entry => entry.name === 'first-contentful-paint')?.startTime ?? null;
    const local = window as Window & { __cpsuLcp?: number | null };
    return {
      navigationResponseMs: nav ? Math.round(nav.responseEnd - nav.requestStart) : null,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      fcpMs: fcp === null ? null : Math.round(fcp),
      lcpMs: local.__cpsuLcp == null ? null : Math.round(local.__cpsuLcp),
      loadedResources: resources.length,
      scriptAndStyleKilobytes: Math.round(resources
        .filter(r => /\.(?:js|css)(?:\?|$)/.test(r.name))
        .reduce((sum, r) => sum + r.encodedBodySize, 0) / 1024),
    };
  });
  expect(report.navigationResponseMs).not.toBeNull();
  expect(report.loadedResources).toBeGreaterThan(0);
  console.log('[CPSU PWA local synthetic baseline]', testInfo.project.name, JSON.stringify(report));
});
