import { defineConfig, devices } from '@playwright/test';

// Browser tests mock every /api response. Run `bun run build` first so Laravel serves current assets.
const port = process.env.CPSU_E2E_PORT ?? '8189';
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: './tests/e2e',
  // .pw.ts keeps Playwright browser tests out of Bun's unit-test discovery.
  testMatch: '**/*.pw.ts',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `php artisan serve --host=127.0.0.1 --port=${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 45_000,
  },
});
