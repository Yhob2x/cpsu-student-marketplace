import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
};

async function withIsolatedBuild() {
  const dir = await mkdtemp(join(tmpdir(), 'cpsu-pwa-builds-'));
  await cp(resolve(process.cwd(), 'dist'), dir, { recursive: true });
  const server: Server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    if (pathname.startsWith('/api/')) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"error":"synthetic_api_offline"}');
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    try {
      let file = join(dir, relative);
      let bytes: Buffer;
      try { bytes = await readFile(file); }
      catch {
        if (extname(relative)) { res.writeHead(404); res.end(); return; }
        file = join(dir, 'index.html');
        bytes = await readFile(file);
      }
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': /(?:sw\.js|manifest\.webmanifest|index\.html)$/.test(file) ? 'no-cache' : 'no-store',
      });
      res.end(bytes);
    } catch {
      res.writeHead(500); res.end();
    }
  });
  try {
    await new Promise<void>((ok, fail) => {
      server.once('error', fail);
      server.listen(0, '127.0.0.1', ok);
    });
  } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local test port');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    async deployVersionB() {
      const path = join(dir, 'sw.js');
      const previous = await readFile(path, 'utf8');
      if (!previous.includes('cpsu-offline-shell-v4')) throw new Error('Expected build A worker cache version');
      await writeFile(path, previous.replaceAll('cpsu-offline-shell-v4', 'cpsu-offline-shell-v5') + '\n// isolated test build B\n');
    },
    async close() {
      await new Promise<void>((ok) => server.close(() => ok()));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

async function initialControlledPage(page: import('@playwright/test').Page, origin: string) {
  await page.goto(origin);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

async function detectVersionB(page: import('@playwright/test').Page, deploy: () => Promise<void>) {
  await deploy();
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('No registered service worker');
    await registration.update();
  });
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible({ timeout: 15_000 });
}

test('build A to B: an edited screen cannot be auto-reloaded and Later can be revisited', async ({ page }) => {
  const fixture = await withIsolatedBuild();
  try {
    await initialControlledPage(page, fixture.origin);
    const search = page.getByRole('textbox', { name: 'Search listings' });
    await search.fill('unfinished search');
    await detectVersionB(page, fixture.deployVersionB);
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.getByText('Finish and save your changes', { exact: false })).toBeVisible();
    await expect(search).toHaveValue('unfinished search');
    const stillWaiting = await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting));
    expect(stillWaiting).toBe(true);
    await page.getByRole('button', { name: 'Later' }).click();
    await expect(page.locator('.pwa-update')).toHaveCount(0);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();
    await expect(search).toHaveValue('unfinished search');
  } finally {
    await page.close().catch(() => {});
    await fixture.close();
  }
});

test('build A to B: explicit Update activates B, deletes A cache and reloads a clean tab', async ({ page }) => {
  const fixture = await withIsolatedBuild();
  let loads = 0;
  page.on('load', () => { loads++; });
  try {
    await initialControlledPage(page, fixture.origin);
    await detectVersionB(page, fixture.deployVersionB);
    expect(loads).toBe(1);
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect.poll(() => loads, { timeout: 15_000 }).toBeGreaterThan(1);
    await expect.poll(() => page.evaluate(async () =>
      (await caches.keys()).filter(name => name.startsWith('cpsu-offline-shell-'))
    )).toEqual(['cpsu-offline-shell-v5']);
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('.pwa-update')).toHaveCount(0);
  } finally {
    await page.close().catch(() => {});
    await fixture.close();
  }
});
