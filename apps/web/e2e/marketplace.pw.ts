import { test, expect } from '@playwright/test';
import { mockMarketplace } from './support/mock-marketplace';

test('guest browses Explore, filters by category and opens a listing', async ({ page }) => {
  const state = await mockMarketplace(page);
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Explore listings' })).toBeVisible();
  const filtersToggle = page.getByRole('button', { name: 'Filters', exact: true });
  if (await filtersToggle.isVisible()) await filtersToggle.click();
  await page.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Books' }).click();
  await expect(page).toHaveURL(/categoryId=1/);
  await expect(page.getByRole('link', { name: /View Synthetic calculus textbook/i })).toBeVisible();
  await page.getByRole('link', { name: /View Synthetic calculus textbook/i }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic calculus textbook' })).toBeVisible();
  expect(state.unknownWrites).toEqual([]);
});

test('guest messaging directs to sign-in and returns to the same listing', async ({ page }) => {
  await mockMarketplace(page);
  await page.goto('/listings/91');
  await page.locator('a[href="/login?next=%2Flistings%2F91"]').click();
  await expect(page).toHaveURL(/\/login\?next=%2Flistings%2F91/);
  await page.getByRole('textbox', { name: 'Email' }).fill('buyer@example.invalid');
  await page.getByLabel('Password').fill('test-password-strong');
  await page.locator('.auth-form').getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/listings\/91$/);
  await expect(page.getByRole('heading', { name: 'Ask the seller' })).toBeVisible();
});

test('seller uploads three photos to a private draft, never an unreviewed public listing', async ({ page }) => {
  const state = await mockMarketplace(page, 'seller');
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'New listing' }).click();
  await page.getByRole('radio', { name: /Product/ }).check();
  await page.getByLabel('Title').fill('Synthetic campus mathematics workbook');
  await page.getByLabel('Description').fill('Synthetic workbook with detailed practice exercises.');
  await page.getByLabel('Price (PHP)').fill('150');
  await page.getByLabel('Category').selectOption('1');
  await page.getByLabel('Product condition').selectOption('good');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');
  await page.locator('input[type=file]').first().setInputFiles(
    [1, 2, 3].map(n => ({ name: 'synthetic-' + n + '.png', mimeType: 'image/png', buffer: png })),
  );
  await page.getByRole('button', { name: /Save draft|Create listing/i }).click();
  await expect(page.getByText(/Draft saved with 3 photos/)).toBeVisible();
  expect(state.drafts).toHaveLength(1);
  expect(state.uploads).toBe(3);
  expect(state.drafts[0].status).toBe('draft');
  await page.goto('/explore');
  await expect(page.getByRole('link', { name: /View Synthetic campus mathematics workbook/i })).toHaveCount(0);
});

test('buyer starts a conversation and seller sees the inquiry in the inbox', async ({ page }) => {
  const state = await mockMarketplace(page, 'buyer');
  await page.goto('/listings/91');
  await page.getByLabel('Your message to the seller').fill('Is this available for campus pickup?');
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(page.getByText('Message sent.')).toBeVisible();
  expect(state.messages).toHaveLength(1);
  state.persona = 'seller';
  await page.goto('/inquiries');
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByText(/Is this available for campus pickup/)).toBeVisible();
});

test('buyer reports a listing and ends a conversation with confirmation', async ({ page }) => {
  const state = await mockMarketplace(page, 'buyer');
  await page.goto('/listings/91');
  await page.getByRole('button', { name: 'Report', exact: true }).click();
  await page.getByLabel('Why are you reporting this listing?').fill('Synthetic test: inaccurate textbook condition');
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Report sent to a campus reviewer.')).toBeVisible();
  expect(state.reports).toHaveLength(1);
  expect(state.reports[0].listingId).toBe(91);
  await page.getByLabel('Your message to the seller').fill('Can we discuss this textbook?');
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await page.getByRole('link', { name: 'Open conversation' }).click();
  await page.getByRole('button', { name: 'End conversation' }).click();
  await expect(page.getByText(/End this conversation/i)).toBeVisible();
  await page.getByRole('button', { name: 'Yes, end conversation' }).click();
  await expect(page.getByText('Conversation ended. Previous messages remain available.')).toBeVisible();
  expect(state.threadStatus).toBe('closed');
});

test('campus reviewer verifies a synthetic affiliation with a reason', async ({ page }) => {
  const state = await mockMarketplace(page, 'reviewer');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Campus review workspace' })).toBeVisible();
  if (await page.getByRole('combobox', { name: 'Workspace section' }).isVisible()) {
    await page.getByRole('combobox', { name: 'Workspace section' }).selectOption('affiliations');
  } else {
    await page.getByRole('navigation', { name: 'Administration sections' }).getByRole('button', { name: /Verifications/ }).click();
  }
  await expect(page.getByText('Synthetic Candidate')).toBeVisible();
  await page.getByLabel('Verification reason').fill('Verified using authorized synthetic records.');
  await page.getByRole('button', { name: 'Verify affiliation for Synthetic Candidate' }).click();
  await expect(page.getByText(/Student affiliation #501 verified/)).toBeVisible();
  expect(state.verified).toBe(true);
});
