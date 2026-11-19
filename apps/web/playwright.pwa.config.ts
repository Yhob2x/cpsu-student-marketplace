import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4199';
export default defineConfig({
  testDir: './pwa-tests',
  testMatch: '**/*.pw.ts',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'mobile-chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome',
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'bun run preview --host 127.0.0.1 --port 4199 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 45_000,
  },
});
