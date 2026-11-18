import { test, expect } from '@playwright/test';
import { mockMarketplace, type Persona } from './support/mock-marketplace';

// Distinguish intentional horizontal chip/image rails from document-level overflow.
for (const scenario of [
  { label: 'Home', path: '/', persona: 'guest' },
  { label: 'Explore', path: '/explore', persona: 'guest' },
  { label: 'Listing detail', path: '/listings/91', persona: 'guest' },
  { label: 'Public store', path: '/stores/30', persona: 'guest' },
  { label: 'Profile', path: '/profile', persona: 'buyer' },
] as { label: string; path: string; persona: Persona }[]) {
  test('320px and 390px viewport reflow: ' + scenario.label, async ({ page }) => {
    await mockMarketplace(page, scenario.persona);
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(scenario.path);
    await expect(page.locator('main h1').first()).toBeVisible();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 780 });
      const geometry = await page.evaluate(() => {
        const root = document.documentElement;
        return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
      });
      expect(geometry.scrollWidth, `${scenario.label} at ${width}px: document overflow ${JSON.stringify(geometry)}`)
        .toBeLessThanOrEqual(geometry.clientWidth + 1);
    }
  });
}

test('keyboard skip link reaches main content', async ({ page }) => {
  await mockMarketplace(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('#main-content')).toBeVisible();
});

test('sign-in form retains keyboard order, email to password to submit', async ({ page }) => {
  await mockMarketplace(page);
  await page.goto('/login');
  const email = page.getByRole('textbox', { name: 'Email' });
  const password = page.getByLabel('Password');
  await email.focus();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.auth-form').getByRole('button', { name: 'Sign in' })).toBeFocused();
});

test('keyboard opens and closes floating chat and returns focus', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /Chat.*open messages/ });
  await expect(trigger).toBeVisible();
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
});

test('floating chat launcher does not overlap mobile navigation action targets', async ({ page }) => {
  await mockMarketplace(page, 'buyer');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.locator('.floating-chat');
  await expect(trigger).toBeVisible();
  const collision = await page.evaluate(() => {
    const chat = document.querySelector('.floating-chat')?.getBoundingClientRect();
    const controls = [...document.querySelectorAll<HTMLElement>('.tabbar a, .tabbar button')];
    if (!chat) return { ok: false, controls: -1, overlap: 1 };
    const overlapping = controls.filter(control => {
      const r = control.getBoundingClientRect();
      return r.width > 0 && r.height > 0 &&
        chat.left < r.right && chat.right > r.left && chat.top < r.bottom && chat.bottom > r.top;
    });
    return { ok: controls.length > 0, controls: controls.length, overlap: overlapping.length };
  });
  expect(collision.ok, 'Bottom navigation must have actionable controls').toBe(true);
  expect(collision.overlap, 'Floating chat must not cover navigation taps').toBe(0);
});
