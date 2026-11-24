import { defineConfig, devices } from '@playwright/test';

// Dedicated audit server: separate from the default 5189 Playwright runner.
// Prevents another concurrently running test job from stopping our webServer.
const auditPort = Number(process.env.UI_AUDIT_PORT ?? 5293);
if (!Number.isInteger(auditPort) || auditPort < 1024 || auditPort > 65535) throw new Error('Invalid UI_AUDIT_PORT');
const baseURL = `http://127.0.0.1:${auditPort}`;

export default defineConfig({
  testDir: './e2e',
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
    command: `bun run dev --host 127.0.0.1 --port ${auditPort} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
